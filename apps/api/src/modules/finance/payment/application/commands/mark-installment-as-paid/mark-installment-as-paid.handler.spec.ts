import { InstallmentNotFoundException } from '@modules/finance/payment/domain/exceptions/payment.exceptions';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { MarkInstallmentAsPaidHandler } from './mark-installment-as-paid.handler';
import { MarkInstallmentAsPaidCommand } from './mark-installment-as-paid.command';

describe('MarkInstallmentAsPaidHandler', () => {
  const ctx = {
    actor: { userId: 'u1', source: LogSource.SYSTEM },
    source: 'INTERNAL_CASCADE',
  } as never;

  const makePayment = () => ({
    id: { value: 'pay-1' },
    appointmentId: { value: 'appt-1' },
    clinicId: { value: 'clinic-1' },
    completeInstallment: jest.fn(),
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
    const handler = new MarkInstallmentAsPaidHandler(
      paymentCommandRepo as never,
      txManager as never
    );
    return { handler, paymentCommandRepo, txManager };
  };

  const run = (
    handler: MarkInstallmentAsPaidHandler,
    installmentId: string,
    details?: string
  ) =>
    handler.execute(
      new MarkInstallmentAsPaidCommand({ installmentId, details, ctx })
    );

  it('taksiti entity üzerinden tahsil eder ve aktörü audit alanlarına taşır', async () => {
    // Event'i handler DEĞİL entity raise eder: handler koşulsuz yayınladığı
    // sürece tekrarlanan POS callback'i, taksit zaten COMPLETED olsa bile
    // ikinci bir cari kayıt işi ve ikinci bir faturalama denemesi üretiyordu.
    const payment = makePayment();
    const { handler, paymentCommandRepo } = make(payment);

    await run(handler, 'inst-1', 'POS ödemesi tahsil edildi');

    expect(payment.completeInstallment).toHaveBeenCalledWith({
      installmentId: 'inst-1',
      details: 'POS ödemesi tahsil edildi',
      actorId: 'u1',
      logSource: LogSource.SYSTEM,
    });
    expect(paymentCommandRepo.update).toHaveBeenCalledWith(payment);
  });

  it('details verilmezse entity varsayılan metni yazsın diye undefined geçilir', async () => {
    const payment = makePayment();
    const { handler } = make(payment);

    await run(handler, 'inst-1');

    expect(payment.completeInstallment).toHaveBeenCalledWith(
      expect.objectContaining({ details: undefined })
    );
  });

  it('okuma ve yazma aynı transaction içinde (kilit etkili olsun diye)', async () => {
    const { handler, txManager } = make(makePayment());

    await run(handler, 'inst-1');

    expect(txManager.outboxRun).toHaveBeenCalledTimes(1);
  });

  it('taksit yoksa InstallmentNotFoundException atar ve yazma yapmaz', async () => {
    const { handler, paymentCommandRepo } = make(null);

    await expect(run(handler, 'missing')).rejects.toThrow(
      InstallmentNotFoundException
    );
    expect(paymentCommandRepo.update).not.toHaveBeenCalled();
  });
});
