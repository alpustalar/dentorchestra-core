import { BookingPaymentQueryRepository } from './booking-payment.query.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Aday kuralının kilidi. Koşul repo'nun `where` cümlesinde yaşıyor, yani
 * derleyiciye ve handler testlerine görünmez — bozulursa sessizce bozulur:
 *   - `bookingReference` süzgeci düşerse, rezervasyonu hiç açılmamış
 *     (PAID → FAILED → REFUNDED) kayıtlar da "fişi eksik" sayılır ve telafi
 *     turu **hiç doğmamış** bir tedarikçi borcunu deftere yazar;
 *   - `OR` penceresi tek tarihe inerse, geçen dönem tahsil edilip bu dönem
 *     iade edilen bir rezervasyonun eksik fişi görünmez olur.
 */
describe('BookingPaymentQueryRepository — aday süzgeci kilidi', () => {
  const build = () => {
    const findMany = jest.fn<
      Promise<unknown[]>,
      [Prisma.BookingPaymentFindManyArgs]
    >(() => Promise.resolve([]));
    const prisma = {
      bookingPayment: { findMany },
    } as unknown as PrismaService;

    return { repo: new BookingPaymentQueryRepository(prisma), findMany };
  };

  const from = new Date('2026-09-01T00:00:00Z');
  const to = new Date('2026-09-30T23:59:59Z');

  it('yalnız rezervasyonu FİİLEN açılmış kayıtlar aday olur', async () => {
    const { repo, findMany } = build();

    await repo.findBridgeable({ from, to });

    const where = findMany.mock.calls[0][0].where;
    expect(where?.bookingReference).toEqual({ not: null });
  });

  it('pencere YALNIZ paidAt’e uygulanır (iade yönü iade satırlarından gelir)', async () => {
    // `refundedAt` rezervasyon satırında "iade TALEP edildi" demekti ve sağlayıcı reddetse de
    // dolardı; ona bakan pencere doğrulanmamış iadeyi "ters fiş borçlu" diye getirirdi (P0-3).
    const { repo, findMany } = build();

    await repo.findBridgeable({ from, to });

    const where = findMany.mock.calls[0][0].where;
    expect(where?.paidAt).toEqual({ gte: from, lte: to });
    expect(where).not.toHaveProperty('OR');
    expect(JSON.stringify(where)).not.toContain('refundedAt');
  });

  it('klinik daraltması verilmezse where’e hiç girmez', async () => {
    const { repo, findMany } = build();

    await repo.findBridgeable({ from, to });

    expect(findMany.mock.calls[0][0].where).not.toHaveProperty('clinicId');
  });

  it('klinik daraltması verilirse uygulanır', async () => {
    const { repo, findMany } = build();

    await repo.findBridgeable({
      from,
      to,
      clinicId: '11111111-1111-4111-8111-111111111111',
    });

    expect(findMany.mock.calls[0][0].where?.clinicId).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
  });
});
