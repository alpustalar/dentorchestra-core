import { InstallmentNotFoundException } from '@modules/finance/payment/domain/exceptions/payment.exceptions';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { MarkInstallmentAsFailedHandler } from './mark-installment-as-failed.handler';
import { MarkInstallmentAsFailedCommand } from './mark-installment-as-failed.command';

describe('MarkInstallmentAsFailedHandler', () => {
  const ctx = {
    actor: { userId: 'u1', source: LogSource.SYSTEM },
    source: 'INTERNAL_CASCADE',
  } as never;

  const makePayment = () => ({
    id: { value: 'pay-1' },
    appointmentId: { value: 'appt-1' },
    clinicId: { value: 'clinic-1' },
    failInstallment: jest.fn(),
  });

  const make = (payment: ReturnType<typeof makePayment> | null) => {
    // Okuma da yazma da command repo'dan: kilitli okuma + güncelleme aynı tx'te.
    const paymentCommandRepo = {
      findByInstallmentIdForUpdate: jest.fn().mockResolvedValue(payment),
      update: jest.fn().mockResolvedValue(payment),
    };
    const txManager = {
      outboxRun: jest
        .fn()
        .mockImplementation((cb: () => Promise<unknown>) => cb()),
    };
    const handler = new MarkInstallmentAsFailedHandler(
      paymentCommandRepo as never,
      txManager as never
    );
    return { handler, paymentCommandRepo };
  };

  const run = (
    handler: MarkInstallmentAsFailedHandler,
    installmentId: string,
    details?: string
  ) =>
    handler.execute(
      new MarkInstallmentAsFailedCommand({ installmentId, details, ctx })
    );

  it('başarısızlığı entity üzerinden işler ve nedeni audit detayına taşır', async () => {
    const payment = makePayment();
    const { handler, paymentCommandRepo } = make(payment);

    await run(handler, 'inst-1', 'Yetersiz bakiye');

    expect(payment.failInstallment).toHaveBeenCalledWith({
      installmentId: 'inst-1',
      details: 'Yetersiz bakiye',
      actorId: 'u1',
      logSource: LogSource.SYSTEM,
    });
    expect(paymentCommandRepo.update).toHaveBeenCalledWith(payment);
  });

  it('taksit yoksa InstallmentNotFoundException atar ve yazma yapmaz', async () => {
    const { handler, paymentCommandRepo } = make(null);

    await expect(run(handler, 'missing')).rejects.toThrow(
      InstallmentNotFoundException
    );
    expect(paymentCommandRepo.update).not.toHaveBeenCalled();
  });
});
