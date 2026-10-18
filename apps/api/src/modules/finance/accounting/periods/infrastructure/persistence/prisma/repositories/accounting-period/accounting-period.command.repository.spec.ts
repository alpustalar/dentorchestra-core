/*
 * Prisma delegesi taklit edildiği için mock nesneleri `any` taşır; bu iki kural
 * yalnız bu dosyada kapatılır (üretim kodunda açık kalır).
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { AccountingPeriodStatusSchema } from '@shared';
import { AccountingPeriodCommandRepository } from './accounting-period.command.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { txStorage } from '@src/infrastructure/transaction/als-storage';
import { AccountingPeriod } from '@modules/finance/accounting/periods/domain/entities/accounting-period.entity';
import {
  PeriodNotFoundException,
  PeriodNotOpenException,
} from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';
import { UUID } from '@src/domain/value-objects/uuid.vo';

const { OPEN, LOCKED, CLOSED } = AccountingPeriodStatusSchema.enum;

describe('AccountingPeriodCommandRepository (koşullu geçiş + numara tahsisi)', () => {
  const makePeriod = () =>
    AccountingPeriod.create({
      clinicId: UUID.generate().value,
      organizationId: UUID.generate().value,
      year: 2026,
      actorId: 'user-1',
    });

  const buildDb = (overrides: Record<string, unknown> = {}) => {
    const db = {
      accountingPeriod: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...makePeriod().toPersistence(), ...data })
        ),
        findUnique: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ last_entry_no: 42n }]),
      ...overrides,
    };
    return db;
  };

  const buildRepo = (db: ReturnType<typeof buildDb>) =>
    new AccountingPeriodCommandRepository(db as unknown as PrismaService);

  /** Kilit alan çağrılar aktif transaction ister; ALS bağlamını taklit eder. */
  const inTransaction = <T>(db: unknown, work: () => Promise<T>): Promise<T> =>
    txStorage.run({ tx: db, events: [], correlationId: 'c-1' } as never, work);

  describe('claimForLocking / claimForReopening / claimForClosing', () => {
    it('kilitleme yalnız OPEN dönemi hedefler ve başarıda event flush edilir', async () => {
      const db = buildDb();
      const repo = buildRepo(db);
      const period = makePeriod();
      period.lock({ actorId: 'manager-1' });

      const claimed = await repo.claimForLocking(period);

      expect(claimed).toBe(true);
      expect(db.accountingPeriod.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: period.id.value, status: { in: [OPEN] } },
          data: expect.objectContaining({
            status: LOCKED,
            lockedById: 'manager-1',
          }),
        })
      );
      // Geçiş uygulandı → olay yayınlanabilir.
      expect(period.getDomainEvents()).toHaveLength(0);
    });

    it('yeniden açma yalnız LOCKED dönemi hedefler (kapanmış dönem dirilemez)', async () => {
      const db = buildDb();
      const repo = buildRepo(db);
      const period = makePeriod();
      period.lock({ actorId: 'm' });
      period.reopen({ actorId: 'm' });

      await repo.claimForReopening(period);

      expect(db.accountingPeriod.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: period.id.value, status: { in: [LOCKED] } },
        })
      );
    });

    it('kapanış OPEN/LOCKED dönemi hedefler; 0 satırda false döner ve event flush EDİLMEZ', async () => {
      const db = buildDb({
        accountingPeriod: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          update: jest.fn(),
          findUnique: jest.fn(),
        },
      });
      const repo = buildRepo(db);
      const period = makePeriod();
      period.clearDomainEvents(); // açılış olayını sayma
      period.close({ actorId: 'manager-2' });

      const claimed = await repo.claimForClosing(period);

      expect(claimed).toBe(false);
      expect(
        (db.accountingPeriod as { updateMany: jest.Mock }).updateMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: period.id.value, status: { in: [OPEN, LOCKED] } },
          data: expect.objectContaining({ status: CLOSED }),
        })
      );
      // Yarışı kaybeden taraf "dönem kapandı" olayını yayınlamamalı.
      expect(period.getDomainEvents()).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('sayacı (lastEntryNo) geri yazmaz — kilit altındaki tahsisi ezmemek için', async () => {
      const db = buildDb();
      const repo = buildRepo(db);
      const period = makePeriod();

      await repo.update(period);

      const args = (db.accountingPeriod.update as jest.Mock).mock.calls[0][0];
      // `undefined` → Prisma kolona dokunmaz (kilit altındaki tahsis ezilmez).
      expect(args.data.lastEntryNo).toBeUndefined();
      expect(args.data).not.toHaveProperty('id');
    });
  });

  describe('lockAndAllocateEntryNo', () => {
    it('transaction dışında çağrılırsa patlar (kilit sessizce etkisiz kalmasın)', async () => {
      const repo = buildRepo(buildDb());

      await expect(repo.lockAndAllocateEntryNo('p-1')).rejects.toThrow(
        /transaction/i
      );
    });

    it('sayacı artırıp yeni numarayı döner', async () => {
      const db = buildDb();
      const repo = buildRepo(db);

      const entryNo = await inTransaction(db, () =>
        repo.lockAndAllocateEntryNo('p-1')
      );

      expect(entryNo).toBe(42n);
      expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('0 satır etkilenirse dönem açık değildir → PeriodNotOpenException', async () => {
      const period = makePeriod();
      period.lock({ actorId: 'm' });
      const db = buildDb({
        $queryRaw: jest.fn().mockResolvedValue([]),
        accountingPeriod: {
          updateMany: jest.fn(),
          update: jest.fn(),
          findUnique: jest.fn().mockResolvedValue(period.toPersistence()),
        },
      });
      const repo = buildRepo(db);

      await expect(
        inTransaction(db, () => repo.lockAndAllocateEntryNo(period.id.value))
      ).rejects.toBeInstanceOf(PeriodNotOpenException);
    });

    it('dönem hiç yoksa PeriodNotFoundException', async () => {
      const db = buildDb({
        $queryRaw: jest.fn().mockResolvedValue([]),
        accountingPeriod: {
          updateMany: jest.fn(),
          update: jest.fn(),
          findUnique: jest.fn().mockResolvedValue(null),
        },
      });
      const repo = buildRepo(db);

      await expect(
        inTransaction(db, () => repo.lockAndAllocateEntryNo('p-1'))
      ).rejects.toBeInstanceOf(PeriodNotFoundException);
    });
  });
});
