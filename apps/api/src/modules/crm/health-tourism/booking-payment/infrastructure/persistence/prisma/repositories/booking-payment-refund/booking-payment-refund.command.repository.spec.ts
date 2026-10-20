import { Prisma } from '@prisma/client';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { Money } from '@src/domain/value-objects/money.vo';
import { BookingPaymentRefund } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment-refund.entity';
import { BookingPaymentRefundAlreadyClaimedException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment-refund.exceptions';
import { BookingPaymentRefundCommandRepository } from './booking-payment-refund.command.repository';

/** Yalnız `create` sırasında yazılan, sonradan DEĞİŞMEYEN kolonlar. */
const CREATE_ONLY_COLUMNS = new Set([
  'id',
  'bookingPaymentId',
  'clinicId',
  'organizationId',
  'kind',
  'origin',
  'provider',
  'chargeProviderRef',
  'amount',
  'currency',
  'createdAt',
]);

const newRefund = (): BookingPaymentRefund =>
  BookingPaymentRefund.request({
    bookingPaymentId: '33333333-3333-4333-8333-333333333333',
    clinicId: '00000000-0000-4000-8000-000000000002',
    organizationId: '00000000-0000-4000-8000-000000000001',
    kind: 'UNCLAIMED_CHARGE',
    provider: 'IYZICO',
    chargeProviderRef: 'ptx-2',
    amount: Money.fromTrusted('250.00', 'TRY'),
  });

describe('BookingPaymentRefundCommandRepository', () => {
  const build = () => {
    const update = jest.fn((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...newRefund().toPersistence(), ...args.data })
    );
    const create = jest.fn((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...newRefund().toPersistence(), ...args.data })
    );
    const prisma = {
      bookingPaymentRefund: { update, create },
    } as unknown as PrismaService;
    return {
      repo: new BookingPaymentRefundCommandRepository(prisma),
      update,
      create,
    };
  };

  describe('update mapping kilidi (kural 9)', () => {
    it('entity’nin taşıdığı her değişken kolon mapping’de bulunur', async () => {
      const { repo, update } = build();
      const refund = newRefund();
      refund.markConfirmedByProvider({ attempt: 1, providerRefundRef: 'h-1' });

      await repo.update(refund);

      const mapped = new Set(Object.keys(update.mock.calls[0][0].data));
      const missing = Object.keys(refund.toPersistence()).filter(
        (key) => !CREATE_ONLY_COLUMNS.has(key) && !mapped.has(key)
      );
      expect(missing).toEqual([]);
    });

    it('sağlayıcı iade referansı ve elle karar damgası DB’ye yazılır', async () => {
      const { repo, update } = build();
      const refund = newRefund();
      refund.markUnconfirmed({ attempt: 1, failureReason: 'x' });
      refund.resolve({
        outcome: 'CONFIRMED',
        resolvedById: 'u-1',
        note: 'iyzico panelinden doğrulandı',
        refundedAt: new Date(),
        providerRefundRef: 'h-9',
      });

      await repo.update(refund);

      const data = update.mock.calls[0][0].data;
      expect(data.providerRefundRef).toBe('h-9');
      expect(data.resolution).toBe('CONFIRMED');
      expect(data.resolvedById).toBe('u-1');
    });

    it('create alanlarına dokunmaz (tutar, tahsilat referansı, kiracı değişmez)', async () => {
      const { repo, update } = build();

      await repo.update(newRefund());

      const mapped = Object.keys(update.mock.calls[0][0].data);
      for (const key of [
        'amount',
        'chargeProviderRef',
        'clinicId',
        'provider',
      ]) {
        expect(mapped).not.toContain(key);
      }
    });
  });

  describe('create', () => {
    it('(provider, charge_provider_ref) çakışması AlreadyClaimed olur (tekrar teslim)', async () => {
      const { repo, create } = build();
      create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        })
      );

      await expect(repo.create(newRefund())).rejects.toBeInstanceOf(
        BookingPaymentRefundAlreadyClaimedException
      );
    });

    it('başka veritabanı hatası olduğu gibi fırlar', async () => {
      const { repo, create } = build();
      create.mockRejectedValue(new Error('bağlantı koptu'));

      await expect(repo.create(newRefund())).rejects.toThrow('bağlantı koptu');
    });
  });
});
