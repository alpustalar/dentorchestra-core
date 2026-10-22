import { randomUUID } from 'crypto';
import { PaymentCollectionService } from './payment-collection.service';
import { Payment } from '@modules/finance/payment/domain/entities/payment.entity';
import { IPaymentCommandRepository } from '@modules/finance/payment/domain/repositories/payment/payment.command.repository';
import {
  InstallmentNotFoundException,
  InstallmentNotRefundableException,
  InstallmentReversalInFlightException,
} from '@modules/finance/payment/domain/exceptions/payment.exceptions';
import { Money } from '@src/domain/value-objects/money.vo';
import { LogSource } from '@src/domain/constants/log-action.constant';

/**
 * Sanal POS taksidinin geri götürülebilir tutarı kilit altında okunur:
 * iade ve ters ibraz aynı ödeme satırını kilitler, yani sıraya girer.
 */
describe('PaymentCollectionService', () => {
  const audit = { actorId: 'user-1', logSource: LogSource.WEB };

  const buildPayment = () => {
    const ids = [randomUUID(), randomUUID()];
    const payment = Payment.create({
      clinicId: randomUUID(),
      patientId: randomUUID(),
      totalAmount: Money.create(1000, 'TRY').orThrow(),
      installments: ids.map((id, i) => ({
        id,
        installmentNo: i + 1,
        money: Money.create(500, 'TRY').orThrow(),
      })),
    });
    return { payment, ids };
  };

  const build = (payment: Payment | null) => {
    // Kilitsiz `findById` bilerek tanımsız: servis kullanırsa test patlar.
    const findByInstallmentIdForUpdate = jest.fn(() =>
      Promise.resolve(payment)
    );
    const repo = {
      findByInstallmentIdForUpdate,
    } as unknown as IPaymentCommandRepository;
    return {
      service: new PaymentCollectionService(repo),
      findByInstallmentIdForUpdate,
    };
  };

  it('tahsil edilmiş taksidin tutarını KİLİTLİ okuyarak döner', async () => {
    const { payment, ids } = buildPayment();
    payment.completeInstallment({ installmentId: ids[0], ...audit });
    const { service, findByInstallmentIdForUpdate } = build(payment);

    const collected = await service.lockAndGetCollectedAmount({
      installmentId: ids[0],
    });

    expect(collected.toFixed(2)).toBe('500.00');
    expect(findByInstallmentIdForUpdate).toHaveBeenCalledWith(ids[0]);
  });

  it('tahsil edilmemiş taksidin geri götürülecek parası yoktur', async () => {
    const { payment, ids } = buildPayment();
    const { service } = build(payment);

    await expect(
      service.lockAndGetCollectedAmount({ installmentId: ids[0] })
    ).rejects.toBeInstanceOf(InstallmentNotRefundableException);
  });

  it('iade edilmiş taksit itiraz edilemez (para zaten geri gitti)', async () => {
    const { payment, ids } = buildPayment();
    payment.completeInstallment({ installmentId: ids[0], ...audit });
    payment.refundInstallment({ installmentId: ids[0], ...audit });
    const { service } = build(payment);

    await expect(
      service.lockAndGetCollectedAmount({ installmentId: ids[0] })
    ).rejects.toBeInstanceOf(InstallmentNotRefundableException);
  });

  it('ters ibraz edilmiş taksit tekrar itiraz edilemez', async () => {
    const { payment, ids } = buildPayment();
    payment.completeInstallment({ installmentId: ids[0], ...audit });
    payment.chargeBackInstallment({
      installmentId: ids[0],
      ...audit,
      recoveryInstallmentId: randomUUID(),
      recoveryDueDate: new Date(),
      caseReference: 'CB-1',
    });
    const { service } = build(payment);

    await expect(
      service.lockAndGetCollectedAmount({ installmentId: ids[0] })
    ).rejects.toBeInstanceOf(InstallmentNotRefundableException);
  });

  it('iade/iptal girişimi sürerken itiraz reddedilir (sonuç bilinmiyor: para çıkmış olabilir)', async () => {
    const { payment, ids } = buildPayment();
    payment.completeInstallment({ installmentId: ids[0], ...audit });
    // Damga kolonu entity'de değil repo'da yazılır; okunan satırda taşınır.
    const row = payment.installments.find((i) => i.id === ids[0]);
    if (!row) throw new Error('taksit yok');
    row.reversalRequestedAt = new Date('2026-10-21T10:00:00.000Z');
    const { service } = build(payment);

    await expect(
      service.lockAndGetCollectedAmount({ installmentId: ids[0] })
    ).rejects.toBeInstanceOf(InstallmentReversalInFlightException);
  });

  it('taksit/ödeme bulunamazsa tipli hata', async () => {
    const { service } = build(null);
    await expect(
      service.lockAndGetCollectedAmount({ installmentId: randomUUID() })
    ).rejects.toBeInstanceOf(InstallmentNotFoundException);

    const { payment } = buildPayment();
    const other = build(payment);
    await expect(
      other.service.lockAndGetCollectedAmount({ installmentId: randomUUID() })
    ).rejects.toBeInstanceOf(InstallmentNotFoundException);
  });
});
