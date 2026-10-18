import { InstallmentNotFoundException } from '@modules/finance/payment/domain/exceptions/payment.exceptions';
import { MarkInstallmentAsCancelledHandler } from './mark-installment-as-cancelled.handler';
import { MarkInstallmentAsCancelledCommand } from './mark-installment-as-cancelled.command';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';

describe('MarkInstallmentAsCancelledHandler', () => {
  const ctx = ExecutionContextFactory.createInternal();

  const makePayment = () => ({
    id: { value: 'pay-1' },
    cancelInstallment: jest.fn(),
    rules: jest.fn().mockReturnValue({
      canCancel: () => ({ orThrow: jest.fn() }),
    }),
  });

  const make = (payment: ReturnType<typeof makePayment> | null) => {
    // Okuma kilitli ve command repo'dan: iptal kararı ödemenin o anki durumundan türüyor.
    const paymentCommandRepo = {
      findByInstallmentIdForUpdate: jest.fn().mockResolvedValue(payment),
      update: jest.fn().mockResolvedValue(payment),
    };
    const policyFactory = {
      entity: () => ({ policy: { getValidateOptions: () => ({}) } }),
    };
    const txManager = {
      run: jest.fn().mockImplementation((cb: () => Promise<unknown>) => cb()),
    };
    const handler = new MarkInstallmentAsCancelledHandler(
      paymentCommandRepo as never,
      policyFactory as never,
      txManager as never
    );
    return { handler, paymentCommandRepo, txManager };
  };

  it('taksiti iptal eder ve kaydeder', async () => {
    const payment = makePayment();
    const { handler, paymentCommandRepo } = make(payment);

    await handler.execute(new MarkInstallmentAsCancelledCommand('inst-1', ctx));

    expect(
      paymentCommandRepo.findByInstallmentIdForUpdate
    ).toHaveBeenCalledWith('inst-1');
    expect(payment.cancelInstallment).toHaveBeenCalledWith('inst-1');
    expect(paymentCommandRepo.update).toHaveBeenCalledWith(payment);
  });

  it('okuma ve yazma aynı transaction içinde yapılır (kilit etkili olsun diye)', async () => {
    const { handler, txManager } = make(makePayment());

    await handler.execute(new MarkInstallmentAsCancelledCommand('inst-1', ctx));

    expect(txManager.run).toHaveBeenCalledTimes(1);
  });

  it('taksit yoksa InstallmentNotFoundException atar, yazma yapmaz', async () => {
    const { handler, paymentCommandRepo } = make(null);

    await expect(
      handler.execute(new MarkInstallmentAsCancelledCommand('missing', ctx))
    ).rejects.toThrow(InstallmentNotFoundException);
    expect(paymentCommandRepo.update).not.toHaveBeenCalled();
  });
});
