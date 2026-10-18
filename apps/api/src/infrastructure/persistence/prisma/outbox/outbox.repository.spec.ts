import { Prisma } from '@prisma/client';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { OutboxRepository } from '@src/infrastructure/persistence/prisma/outbox/outbox.repository';
import {
  OUTBOX_CLAIM_LEASE_MS,
  OUTBOX_MAX_ATTEMPTS,
} from '@src/infrastructure/persistence/prisma/outbox/outbox.constants';

describe('OutboxRepository', () => {
  let queryRaw: jest.Mock;
  let update: jest.Mock;
  let findMany: jest.Mock;
  let repo: OutboxRepository;

  beforeEach(() => {
    queryRaw = jest.fn().mockResolvedValue([]);
    update = jest.fn().mockResolvedValue({});
    findMany = jest.fn().mockResolvedValue([]);

    repo = new OutboxRepository({
      $queryRaw: queryRaw,
      outbox: { update, findMany },
    } as unknown as PrismaService);
  });

  const claimSql = (): Prisma.Sql => {
    const [sql] = queryRaw.mock.calls[0] as [Prisma.Sql];
    return sql;
  };

  describe('claimPending', () => {
    /**
     * Sahiplenmenin üç garantisi SQL'de durur; biri düşerse iki işçi aynı
     * event'i iki kez yayınlar ya da sıra bozulur. Bu yüzden metin düzeyinde
     * sabitlenir.
     */
    it('tek UPDATE ile sahiplenir: SKIP LOCKED + seq sırası + deneme artışı', async () => {
      await repo.claimPending(50);

      const sql = claimSql().sql.replace(/\s+/g, ' ');

      expect(sql).toContain('UPDATE "Outbox"');
      expect(sql).toContain('FOR UPDATE SKIP LOCKED');
      expect(sql).toContain('ORDER BY "seq" ASC');
      expect(sql).toContain('"attempts" = "attempts" + 1');
      expect(sql).toContain('RETURNING');
    });

    it('işlenmiş, ölü mektup ve kiralaması süren kayıtları atlar', async () => {
      await repo.claimPending(50);

      const sql = claimSql().sql.replace(/\s+/g, ' ');

      expect(sql).toContain('"processedAt" IS NULL');
      expect(sql).toContain('"failedAt" IS NULL');
      expect(sql).toContain('"claimedAt" IS NULL OR "claimedAt" <');
    });

    it('kiralama kesim anı sabitten gelir', async () => {
      const before = Date.now();

      await repo.claimPending(7);

      const [cutoff, limit] = claimSql().values as [Date, number];
      expect(limit).toBe(7);
      // Kesim anı "şimdi − kiralama süresi" olmalı (±2 sn tolerans).
      expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(
        OUTBOX_CLAIM_LEASE_MS - 2_000
      );
      expect(before - cutoff.getTime()).toBeLessThanOrEqual(
        OUTBOX_CLAIM_LEASE_MS + 2_000
      );
    });
  });

  describe('markProcessed', () => {
    it('kaydı kapatır ve sahiplenmeyi bırakır', async () => {
      await repo.markProcessed('outbox-1');

      const [args] = update.mock.calls[0] as [
        { where: { id: string }; data: Record<string, unknown> },
      ];
      expect(args.where).toEqual({ id: 'outbox-1' });
      expect(args.data.processedAt).toBeInstanceOf(Date);
      expect(args.data.claimedAt).toBeNull();
    });
  });

  describe('markFailed', () => {
    it('deneme sürerken ölü mektup damgası atılmaz', async () => {
      await repo.markFailed({
        id: 'outbox-1',
        error: 'dönem kapalı',
        deadLetter: false,
      });

      const [args] = update.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(args.data.failedAt).toBeNull();
      expect(args.data.lastError).toBe('dönem kapalı');
      // `claimedAt` BİLEREK dokunulmaz: kiralama süresi denemeler arası beklemedir.
      expect(args.data).not.toHaveProperty('claimedAt');
    });

    it('deneme hakkı bitince ölü mektup damgası atılır', async () => {
      await repo.markFailed({
        id: 'outbox-1',
        error: 'boom',
        deadLetter: true,
      });

      const [args] = update.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(args.data.failedAt).toBeInstanceOf(Date);
    });

    it('çok uzun hata mesajı kısaltılır (kayıt yazılamaz hâle gelmesin)', async () => {
      await repo.markFailed({
        id: 'outbox-1',
        error: 'x'.repeat(5_000),
        deadLetter: false,
      });

      const [args] = update.mock.calls[0] as [{ data: { lastError: string } }];
      expect(args.data.lastError).toHaveLength(2_000);
    });
  });

  describe('isExhausted', () => {
    it('sınır tek yerde yaşar', () => {
      expect(OutboxRepository.isExhausted(OUTBOX_MAX_ATTEMPTS - 1)).toBe(false);
      expect(OutboxRepository.isExhausted(OUTBOX_MAX_ATTEMPTS)).toBe(true);
    });
  });

  describe('findDeadLettered', () => {
    it('teslim edilmemiş ve artık denenmeyen kayıtları sırayla listeler', async () => {
      await repo.findDeadLettered(25);

      const [args] = findMany.mock.calls[0] as [
        {
          where: Record<string, unknown>;
          orderBy: Record<string, string>;
          take: number;
        },
      ];
      expect(args.where).toEqual({
        processedAt: null,
        failedAt: { not: null },
      });
      expect(args.orderBy).toEqual({ seq: 'asc' });
      expect(args.take).toBe(25);
    });
  });
});
