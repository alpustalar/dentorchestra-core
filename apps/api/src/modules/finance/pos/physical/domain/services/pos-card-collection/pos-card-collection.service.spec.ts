import { Decimal } from 'decimal.js';
import { PosCardCollectionService } from './pos-card-collection.service';
import { PosTransaction } from '@modules/finance/pos/physical/domain/entities/pos-transaction.entity';
import { IPosTransactionCommandRepository } from '@modules/finance/pos/physical/domain/repositories/pos-transaction/pos-transaction.command.repository';
import {
  OriginalPosTransactionNotFoundException,
  PosTransactionAlreadyReversedException,
  PosTransactionNotRefundableException,
} from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';
import PosTransactionKindSchema from '@input-type-schemas/PosTransactionKindSchema';
import CurrencySchema from '@input-type-schemas/CurrencySchema';

/**
 * Kilitli skaler okuma (`lockAndGet*`): kilit ile okuma TEK metotta tutulur.
 * İade/iptal handler'ları da aynı satırı kilitler, yani kart itirazı ile
 * iade/iptal sıraya girer.
 */
describe('PosCardCollectionService', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const DEVICE_ID = '22222222-2222-4222-8222-222222222222';

  const makeSale = (status: 'SUCCESS' | 'PENDING' = 'SUCCESS') => {
    const sale = PosTransaction.create({
      posDeviceId: DEVICE_ID,
      clinicId: CLINIC_ID,
      amount: 1000,
      currency: CurrencySchema.enum.TRY,
      initiatedById: 'firebase-staff-uid-1',
    });
    if (status === 'SUCCESS') sale.markSuccess('HOSTREF-1');
    return sale;
  };

  const build = (
    sale: PosTransaction | null,
    reversal = { hasActiveVoid: false, refundedAmount: new Decimal(0) }
  ) => {
    const order: string[] = [];
    const findByIdForUpdate = jest.fn(() => {
      order.push('lock');
      return Promise.resolve(sale);
    });
    const findLiveReversalSummary = jest.fn(() => {
      order.push('reversalSummary');
      return Promise.resolve(reversal);
    });
    // Kilitsiz `findById` bilerek tanımsız: servis kullanırsa test patlar.
    const repo = {
      findByIdForUpdate,
      findLiveReversalSummary,
    } as unknown as IPosTransactionCommandRepository;

    return {
      service: new PosCardCollectionService(repo),
      order,
      findByIdForUpdate,
      findLiveReversalSummary,
    };
  };

  it('satışı kilitler, SONRA iadeleri okur ve net tutarı döner', async () => {
    const sale = makeSale();
    const { service, order, findByIdForUpdate } = build(sale, {
      hasActiveVoid: false,
      refundedAmount: new Decimal(400),
    });

    const reversible = await service.lockAndGetReversibleAmount({
      posTransactionId: sale.id.value,
    });

    expect(reversible.toFixed(2)).toBe('600.00');
    expect(findByIdForUpdate).toHaveBeenCalledWith(sale.id.value);
    expect(order).toEqual(['lock', 'reversalSummary']);
  });

  it('iade yoksa satışın tamamı geri götürülebilir', async () => {
    const sale = makeSale();
    const { service } = build(sale);

    const reversible = await service.lockAndGetReversibleAmount({
      posTransactionId: sale.id.value,
    });

    expect(reversible.toFixed(2)).toBe('1000.00');
  });

  it('olmayan satış', async () => {
    const { service } = build(null);

    await expect(
      service.lockAndGetReversibleAmount({ posTransactionId: 'yok' })
    ).rejects.toBeInstanceOf(OriginalPosTransactionNotFoundException);
  });

  it('iptal edilmiş satışta geri götürülecek tutar kalmaz', async () => {
    const sale = makeSale();
    const { service } = build(sale, {
      hasActiveVoid: true,
      refundedAmount: new Decimal(0),
    });

    await expect(
      service.lockAndGetReversibleAmount({ posTransactionId: sale.id.value })
    ).rejects.toBeInstanceOf(PosTransactionAlreadyReversedException);
  });

  it('başarılı olmayan işlem itiraz edilemez', async () => {
    const pending = makeSale('PENDING');
    const { service, findLiveReversalSummary } = build(pending);

    await expect(
      service.lockAndGetReversibleAmount({ posTransactionId: pending.id.value })
    ).rejects.toBeInstanceOf(PosTransactionNotRefundableException);

    // Reddedilen istek iade özetini okumaya bile gitmez.
    expect(findLiveReversalSummary).not.toHaveBeenCalled();
  });

  it('iade/iptal KAYDI itiraz edilemez — yalnız SATIŞ', async () => {
    const original = makeSale();
    const refund = PosTransaction.create({
      posDeviceId: DEVICE_ID,
      clinicId: CLINIC_ID,
      amount: 100,
      currency: CurrencySchema.enum.TRY,
      initiatedById: 'firebase-staff-uid-1',
      kind: PosTransactionKindSchema.enum.REFUND,
      originalPosTransactionId: original.id.value,
    });
    refund.markSuccess('HOSTREF-REFUND');
    const { service } = build(refund);

    await expect(
      service.lockAndGetReversibleAmount({ posTransactionId: refund.id.value })
    ).rejects.toBeInstanceOf(PosTransactionNotRefundableException);
  });
});
