import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { BookingPaymentRefundQueryRepository } from './booking-payment-refund.query.repository';

const from = new Date('2026-09-01T00:00:00Z');
const to = new Date('2026-09-30T23:59:59Z');

describe('BookingPaymentRefundQueryRepository', () => {
  const build = () => {
    const findMany = jest.fn((_args: { where?: Record<string, unknown> }) =>
      Promise.resolve([])
    );
    const count = jest.fn(() => Promise.resolve(0));
    const prisma = {
      bookingPaymentRefund: { findMany, count },
    } as unknown as PrismaService;
    return { repo: new BookingPaymentRefundQueryRepository(prisma), findMany };
  };

  describe('findBridgeable — aday süzgeci kilidi', () => {
    it('iki yönün adayı: CONFIRMED + refundedAt penceresi VEYA LIVE iade edilecek tahsilat + requestedAt penceresi', async () => {
      const { repo, findMany } = build();

      await repo.findBridgeable({ from, to });

      expect(findMany.mock.calls[0][0].where?.OR).toEqual([
        { status: 'CONFIRMED', refundedAt: { gte: from, lte: to } },
        {
          origin: 'LIVE',
          kind: { not: 'CANCELLATION' },
          requestedAt: { gte: from, lte: to },
        },
      ]);
    });

    it('klinik daraltması yalnız verilirse uygulanır', async () => {
      const { repo, findMany } = build();

      await repo.findBridgeable({ from, to });
      await repo.findBridgeable({ from, to, clinicId: 'c-1' });

      expect(findMany.mock.calls[0][0].where).not.toHaveProperty('clinicId');
      expect(findMany.mock.calls[1][0].where).toMatchObject({
        clinicId: 'c-1',
      });
    });
  });

  describe('findUnresolved', () => {
    const pagination = { page: 1, limit: 20, skip: 0, take: 20 } as never;

    it('taze PENDING listelenmez: yalnız bayat PENDING + UNCONFIRMED + FAILED', async () => {
      const { repo, findMany } = build();

      await repo.findUnresolved({ filter: {}, pagination });

      const or = findMany.mock.calls[0][0].where?.OR as Array<{
        status: string;
        requestedAt?: { lte: Date };
      }>;
      expect(or.map((c) => c.status)).toEqual([
        'UNCONFIRMED',
        'FAILED',
        'PENDING',
      ]);
      const pending = or.find((c) => c.status === 'PENDING');
      expect(pending?.requestedAt?.lte).toBeInstanceOf(Date);
    });

    it('durum filtresi yalnız o kolu bırakır', async () => {
      const { repo, findMany } = build();

      await repo.findUnresolved({ filter: { status: 'FAILED' }, pagination });

      expect(findMany.mock.calls[0][0].where?.OR).toEqual([
        { status: 'FAILED' },
      ]);
    });
  });
});
