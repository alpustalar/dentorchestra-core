import {
  createFinanceDbHarness,
  FinanceDbHarness,
  ledgerBalance,
  LedgerFixture,
  seedLedger,
  seedPatient,
} from '@src/testing/finance-db/finance-db.harness';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { PostFinancialEventCommand } from '@modules/finance/accounting/posting/application/commands/post-financial-event/post-financial-event.command';
import { PaymentCommandRepository } from '@modules/finance/payment/infrastructure/persistence/prisma/repositories/payment/payment.command.repository';
import { IyzicoTransactionCommandRepository } from '@modules/finance/pos/virtual/infrastructure/persistence/prisma/repositories/iyzico-transaction/iyzico-transaction.command.repository';
import { MarkInstallmentAsPaidHandler } from '@modules/finance/payment/application/commands/mark-installment-as-paid/mark-installment-as-paid.handler';
import { MarkInstallmentAsPaidCommand } from '@modules/finance/payment/application/commands/mark-installment-as-paid/mark-installment-as-paid.command';
import { MarkInstallmentAsFailedHandler } from '@modules/finance/payment/application/commands/mark-installment-as-failed/mark-installment-as-failed.handler';
import { MarkInstallmentAsFailedCommand } from '@modules/finance/payment/application/commands/mark-installment-as-failed/mark-installment-as-failed.command';
import { EnsurePartyForPatientCommand } from '@modules/finance/party/application/commands/ensure-party-for-patient/ensure-party-for-patient.command';
import { IyzicoCallbackRejectedException } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/rules/iyzico-callback-rejected.exception';
import { HandlePaymentCallbackHandler } from './handle-payment-callback.handler';
import { HandlePaymentCallbackCommand } from './handle-payment-callback.command';

/**
 * Gerçek-DB turu — para GİREN yol: iyzico ödeme callback'i → taksit COMPLETED →
 * `PAYMENT_RECEIVED` olayı → 108. Tarayıcı callback'i ile webhook aynı ödemeyi iki kez
 * getirir (kilit + idempotency tek tahsilat üretmeli).
 */
describe('iyzico ödeme callback\'i (tahsilat köprüsü) — gerçek DB', () => {
  let harness: FinanceDbHarness;
  let ledger: LedgerFixture;
  let patientId: string;
  let handler: HandlePaymentCallbackHandler;
  let provider: { retrieveCheckoutForm: jest.Mock };
  const criticalFailure = { publish: jest.fn() };

  beforeAll(async () => {
    harness = await createFinanceDbHarness();
    ledger = await seedLedger(harness);
    patientId = await seedPatient(harness, ledger);

    const paymentRepo = new PaymentCommandRepository(harness.prisma);
    harness.commandBus.register(EnsurePartyForPatientCommand, {
      execute: async () => ({ partyId: ledger.partyId }),
    });
    harness.commandBus.register(
      MarkInstallmentAsPaidCommand,
      new MarkInstallmentAsPaidHandler(paymentRepo, harness.txManager)
    );
    harness.commandBus.register(
      MarkInstallmentAsFailedCommand,
      new MarkInstallmentAsFailedHandler(paymentRepo, harness.txManager)
    );

    provider = { retrieveCheckoutForm: jest.fn() };
    handler = new HandlePaymentCallbackHandler(
      provider as never,
      new IyzicoTransactionCommandRepository(harness.prisma),
      harness.txManager,
      harness.commandBus as never,
      criticalFailure as never
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  async function seedPending(amount = '250.00') {
    const paymentId = UUID.generate().value;
    const installmentId = UUID.generate().value;
    const conversationId = UUID.generate().value;
    const token = `tok-${conversationId}`;
    await harness.prisma.payment.create({
      data: {
        id: paymentId,
        clinicId: ledger.clinicId,
        patientId,
        totalAmount: amount,
        status: 'PENDING',
        installments: {
          create: {
            id: installmentId,
            installmentNo: 1,
            amount,
            method: 'CREDIT_CARD',
            status: 'PENDING',
          },
        },
      },
    });
    await harness.prisma.iyzicoTransaction.create({
      data: {
        id: UUID.generate().value,
        installmentId,
        conversationId,
        token,
        status: 'INITIALIZE',
      },
    });
    return { paymentId, installmentId, conversationId, token };
  }

  const ok = (conversationId: string) => ({
    isSuccess: true,
    conversationId,
    paymentId: 'pay-1',
    paymentTransactionId: 'pt-1',
    rawResponse: { status: 'success' },
  });

  const callback = (s: { conversationId: string; token: string }) =>
    handler.execute(
      new HandlePaymentCallbackCommand(s.token, s.conversationId, 'sig')
    );

  it('başarılı callback: taksit COMPLETED, işlem SUCCESS, tek tahsilat olayı fişlenir (108)', async () => {
    const s = await seedPending('250.00');
    provider.retrieveCheckoutForm.mockResolvedValue(ok(s.conversationId));
    const before = await ledgerBalance(harness, { clinicId: ledger.clinicId, code: '108' });

    await callback(s);

    const inst = await harness.prisma.paymentInstallment.findUniqueOrThrow({
      where: { id: s.installmentId },
    });
    expect(inst.status).toBe('COMPLETED');
    const tx = await harness.prisma.iyzicoTransaction.findUniqueOrThrow({
      where: { installmentId: s.installmentId },
    });
    expect(tx.status).toBe('SUCCESS');
    expect(tx.iyzicoPaymentTransactionId).toBe('pt-1');

    const events = await harness.prisma.financialEvent.findMany({
      where: { type: 'PAYMENT_RECEIVED', sourceRefId: s.paymentId },
    });
    expect(events).toHaveLength(1);
    await harness.postHandler.execute(new PostFinancialEventCommand(events[0].id, {} as never));
    expect(await ledgerBalance(harness, { clinicId: ledger.clinicId, code: '108' })).toBe(
      before + 250
    );
  });

  it('aynı callback ikinci kez gelirse yok sayılır: tek olay', async () => {
    const s = await seedPending();
    provider.retrieveCheckoutForm.mockResolvedValue(ok(s.conversationId));

    await callback(s);
    await callback(s);

    expect(
      await harness.prisma.financialEvent.count({
        where: { type: 'PAYMENT_RECEIVED', sourceRefId: s.paymentId },
      })
    ).toBe(1);
  });

  it('callback + webhook eşzamanlı: kilit tek tahsilat bırakır', async () => {
    const s = await seedPending();
    provider.retrieveCheckoutForm.mockResolvedValue(ok(s.conversationId));

    await Promise.all([callback(s), callback(s)]);

    expect(
      await harness.prisma.financialEvent.count({
        where: { type: 'PAYMENT_RECEIVED', sourceRefId: s.paymentId },
      })
    ).toBe(1);
    const inst = await harness.prisma.paymentInstallment.findUniqueOrThrow({
      where: { id: s.installmentId },
    });
    expect(inst.status).toBe('COMPLETED');
  });

  it('sağlayıcı başarısız derse işlem FAILED, taksit PENDING, olay yok', async () => {
    const s = await seedPending();
    provider.retrieveCheckoutForm.mockResolvedValue({
      isSuccess: false,
      conversationId: s.conversationId,
      errorCode: '10051',
      errorMessage: 'Yetersiz bakiye',
      rawResponse: {},
    });

    await callback(s);

    const tx = await harness.prisma.iyzicoTransaction.findUniqueOrThrow({
      where: { installmentId: s.installmentId },
    });
    expect(tx.status).toBe('FAILURE');
    const inst = await harness.prisma.paymentInstallment.findUniqueOrThrow({
      where: { id: s.installmentId },
    });
    expect(inst.status).toBe('PENDING');
    expect(
      await harness.prisma.financialEvent.count({ where: { sourceRefId: s.paymentId } })
    ).toBe(0);
  });

  it('token uyuşmazsa callback reddedilir ve hiçbir şey değişmez', async () => {
    const s = await seedPending();
    provider.retrieveCheckoutForm.mockResolvedValue(ok(s.conversationId));

    await expect(
      callback({ conversationId: s.conversationId, token: 'baska-token' })
    ).rejects.toBeInstanceOf(IyzicoCallbackRejectedException);

    const inst = await harness.prisma.paymentInstallment.findUniqueOrThrow({
      where: { id: s.installmentId },
    });
    expect(inst.status).toBe('PENDING');
  });

  it('muhasebe köprüsü patlarsa taksit COMPLETED işaretlemesi de geri sarılır (kural 4)', async () => {
    const s = await seedPending();
    provider.retrieveCheckoutForm.mockResolvedValue(ok(s.conversationId));
    const failingBus = {
      execute: (cmd: unknown) => {
        if (cmd instanceof EnsurePartyForPatientCommand) {
          throw new Error('cari kurulamadı');
        }
        return harness.commandBus.execute(cmd);
      },
    };
    const failing = new HandlePaymentCallbackHandler(
      provider as never,
      new IyzicoTransactionCommandRepository(harness.prisma),
      harness.txManager,
      failingBus as never,
      criticalFailure as never
    );

    await expect(
      failing.execute(new HandlePaymentCallbackCommand(s.token, s.conversationId, 'sig'))
    ).rejects.toThrow('cari kurulamadı');

    const inst = await harness.prisma.paymentInstallment.findUniqueOrThrow({
      where: { id: s.installmentId },
    });
    expect(inst.status).toBe('PENDING');
    const tx = await harness.prisma.iyzicoTransaction.findUniqueOrThrow({
      where: { installmentId: s.installmentId },
    });
    expect(tx.status).toBe('INITIALIZE');
  });
});
