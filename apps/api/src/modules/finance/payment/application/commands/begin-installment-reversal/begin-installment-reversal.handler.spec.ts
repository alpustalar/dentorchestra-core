import { randomUUID } from 'crypto';
import { BeginInstallmentReversalHandler } from './begin-installment-reversal.handler';
import { BeginInstallmentReversalCommand } from './begin-installment-reversal.command';
import { Payment } from '@modules/finance/payment/domain/entities/payment.entity';
import { IPaymentCommandRepository } from '@modules/finance/payment/domain/repositories/payment/payment.command.repository';
import {
  InstallmentNotFoundException,
  InstallmentNotRefundableException,
  InstallmentReversalInFlightException,
} from '@modules/finance/payment/domain/exceptions/payment.exceptions';
import { REVERSAL_RETRY_AFTER_MINUTES } from '@modules/finance/payment/domain/constants/installment-reversal.constant';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { Money } from '@src/domain/value-objects/money.vo';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { IGetContext } from '@common/decorators';

/**
 * Parayı geri götürecek girişimin damgası: SDK çağrısından ÖNCE, ödeme satırı
 * kilitliyken yazılır (kural 18d). Burada yalnız karar mantığı sınanır; kilit ve
 * yarış davranışı `refund-payment.db-spec.ts`'te gerçek veritabanıyla sınanır.
 */
describe('BeginInstallmentReversalHandler', () => {
  const ctx = {} as IGetContext;
  const audit = { actorId: 'user-1', logSource: LogSource.WEB };

  const buildPayment = (collect = true) => {
    const installmentId = randomUUID();
    const payment = Payment.create({
      clinicId: randomUUID(),
      patientId: randomUUID(),
      totalAmount: Money.create(500, 'TRY').orThrow(),
      installments: [
        {
          id: installmentId,
          installmentNo: 1,
          money: Money.create(500, 'TRY').orThrow(),
        },
      ],
    });
    if (collect) payment.completeInstallment({ installmentId, ...audit });
    return { payment, installmentId };
  };

  const build = (payment: Payment | null) => {
    const repo = {
      findByInstallmentIdForUpdate: jest.fn().mockResolvedValue(payment),
      setReversalRequestedAt: jest.fn().mockResolvedValue(undefined),
    };
    const txManager = {
      run: jest.fn((work: () => Promise<unknown>) => work()),
    };
    const handler = new BeginInstallmentReversalHandler(
      repo as unknown as IPaymentCommandRepository,
      txManager as unknown as TransactionManager
    );
    return { handler, repo, txManager };
  };

  const minutesAgo = (minutes: number) =>
    new Date(Date.now() - minutes * 60 * 1000);

  it('tahsil edilmiş taksidi KİLİTLİ okuyup damgalar', async () => {
    const { payment, installmentId } = buildPayment();
    const { handler, repo, txManager } = build(payment);

    await handler.execute(
      new BeginInstallmentReversalCommand(installmentId, ctx)
    );

    expect(txManager.run).toHaveBeenCalledTimes(1);
    expect(repo.findByInstallmentIdForUpdate).toHaveBeenCalledWith(
      installmentId
    );
    expect(repo.setReversalRequestedAt).toHaveBeenCalledWith({
      installmentId,
      requestedAt: expect.any(Date) as Date,
    });
  });

  it('taksit yoksa tipli hata, damga yazılmaz', async () => {
    const { handler, repo } = build(null);

    await expect(
      handler.execute(new BeginInstallmentReversalCommand(randomUUID(), ctx))
    ).rejects.toBeInstanceOf(InstallmentNotFoundException);
    expect(repo.setReversalRequestedAt).not.toHaveBeenCalled();
  });

  it('tahsil edilmemiş taksit damgalanmaz', async () => {
    const { payment, installmentId } = buildPayment(false);
    const { handler, repo } = build(payment);

    await expect(
      handler.execute(new BeginInstallmentReversalCommand(installmentId, ctx))
    ).rejects.toBeInstanceOf(InstallmentNotRefundableException);
    expect(repo.setReversalRequestedAt).not.toHaveBeenCalled();
  });

  it('sürmekte olan girişim varken ikincisi reddedilir', async () => {
    const { payment, installmentId } = buildPayment();
    const row = payment.installments.find((i) => i.id === installmentId);
    if (!row) throw new Error('taksit yok');
    row.reversalRequestedAt = minutesAgo(REVERSAL_RETRY_AFTER_MINUTES - 1);
    const { handler, repo } = build(payment);

    await expect(
      handler.execute(new BeginInstallmentReversalCommand(installmentId, ctx))
    ).rejects.toBeInstanceOf(InstallmentReversalInFlightException);
    expect(repo.setReversalRequestedAt).not.toHaveBeenCalled();
  });

  it('bayatlamış damga yeniden denemeye izin verir ve yenilenir', async () => {
    const { payment, installmentId } = buildPayment();
    const row = payment.installments.find((i) => i.id === installmentId);
    if (!row) throw new Error('taksit yok');
    row.reversalRequestedAt = minutesAgo(REVERSAL_RETRY_AFTER_MINUTES + 1);
    const { handler, repo } = build(payment);

    await handler.execute(
      new BeginInstallmentReversalCommand(installmentId, ctx)
    );

    expect(repo.setReversalRequestedAt).toHaveBeenCalledTimes(1);
  });
});
