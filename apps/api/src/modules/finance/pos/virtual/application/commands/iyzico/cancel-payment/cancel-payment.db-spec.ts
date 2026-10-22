import {
  allowAllPolicyFactory,
  createFinanceDbHarness,
  FinanceDbHarness,
  LedgerFixture,
  ledgerBalance,
  LocalCommandBus,
  makeCtx,
  seedCollectedInstallment,
  seedLedger,
  seedPatient,
} from '@src/testing/finance-db/finance-db.harness';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { PaymentCommandRepository } from '@modules/finance/payment/infrastructure/persistence/prisma/repositories/payment/payment.command.repository';
import { PaymentQueryRepository } from '@modules/finance/payment/infrastructure/persistence/prisma/repositories/payment/payment.query.repository';
import { IyzicoTransactionCommandRepository } from '@modules/finance/pos/virtual/infrastructure/persistence/prisma/repositories/iyzico-transaction/iyzico-transaction.command.repository';
import { CardChargebackCommandRepository } from '@modules/finance/bank/infrastructure/persistence/prisma/repositories/card-chargeback/card-chargeback.command.repository';
import { BankAccountCommandRepository } from '@modules/finance/bank/infrastructure/persistence/prisma/repositories/bank-account/bank-account.command.repository';
import { CardChargebackExposureGuard } from '@modules/finance/bank/domain/services/card-chargeback-exposure/card-chargeback-exposure.guard';
import { PaymentCollectionService } from '@modules/finance/payment/domain/services/payment-collection/payment-collection.service';
import { PeriodGateService } from '@modules/finance/accounting/periods/domain/services/period-gate/period-gate.service';
import { FundsInTransitGate } from '@modules/finance/accounting/posting/domain/services/funds-in-transit/funds-in-transit.gate';
import { FinancialEventPresenceGuard } from '@modules/finance/accounting/financial-events/domain/services/event-presence/event-presence.guard';
import { MarkInstallmentAsRefundedHandler } from '@modules/finance/payment/application/commands/mark-installment-as-refunded/mark-installment-as-refunded.handler';
import { MarkInstallmentAsRefundedCommand } from '@modules/finance/payment/application/commands/mark-installment-as-refunded/mark-installment-as-refunded.command';
import { IyzicoReversalFinalizer } from '@modules/finance/pos/virtual/application/services/iyzico-reversal-finalizer.service';
import { PostFinancialEventCommand } from '@modules/finance/accounting/posting/application/commands/post-financial-event/post-financial-event.command';
import { EnsurePartyForPatientCommand } from '@modules/finance/party/application/commands/ensure-party-for-patient/ensure-party-for-patient.command';
import { GetPaymentWithInstallmentsQuery } from '@modules/finance/payment/application/queries/get-payment-with-installments/get-payment-with-installments.query';
import { GetInstallmentForLedgerQuery } from '@modules/finance/payment/application/queries/get-installment-for-ledger/get-installment-for-ledger.query';
import { OpenCardChargebackHandler } from '@modules/finance/bank/application/commands/open-card-chargeback/open-card-chargeback.handler';
import { OpenCardChargebackCommand } from '@modules/finance/bank/application/commands/open-card-chargeback/open-card-chargeback.command';
import { CollectionUnderChargebackException } from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import {
  CompletedInstallmentNotFoundException,
  InstallmentReversalInFlightException,
} from '@modules/finance/payment/domain/exceptions/payment.exceptions';
import { BeginInstallmentReversalCommand } from '@modules/finance/payment/application/commands/begin-installment-reversal/begin-installment-reversal.command';
import { BeginInstallmentReversalHandler } from '@modules/finance/payment/application/commands/begin-installment-reversal/begin-installment-reversal.handler';
import { ReleaseInstallmentReversalCommand } from '@modules/finance/payment/application/commands/release-installment-reversal/release-installment-reversal.command';
import { ReleaseInstallmentReversalHandler } from '@modules/finance/payment/application/commands/release-installment-reversal/release-installment-reversal.handler';
import { CancelPaymentHandler } from './cancel-payment.handler';
import { CancelPaymentCommand } from './cancel-payment.command';

/**
 * Gerçek-DB turu — sanal POS (iyzico) iadesi ve kural 17'nin iade ↔ itiraz ortak
 * tavanı: iki yol aynı taksidin aynı tutarına dokunur. Sağlayıcı SDK'sı taklit
 * (ağ), geri kalan her şey gerçek.
 */
/**
 * Gerçek-DB turu — sanal POS (iyzico) iptali ve kural 17/18d: iptal de parayı kart
 * sahibine geri götürür; iade ile aynı damga + tavan kapısından geçer. Sağlayıcı SDK'sı
 * taklit (ağ), geri kalan her şey gerçek.
 */
describe('Sanal POS iptali — gerçek DB', () => {
  let harness: FinanceDbHarness;
  let ledger: LedgerFixture;
  let patientId: string;
  let cancelHandler: CancelPaymentHandler;
  let openChargeback: OpenCardChargebackHandler;
  let provider: { cancelPayment: jest.Mock };
  const ctx = makeCtx(UUID.generate().value);

  beforeAll(async () => {
    harness = await createFinanceDbHarness();
    ledger = await seedLedger(harness);
    patientId = await seedPatient(harness, ledger);

    const prisma = harness.prisma;
    const paymentRepo = new PaymentCommandRepository(prisma);
    const paymentQueryRepo = new PaymentQueryRepository(prisma);
    const chargebackRepo = new CardChargebackCommandRepository(prisma);

    const bus = new LocalCommandBus();
    bus.register(
      MarkInstallmentAsRefundedCommand,
      new MarkInstallmentAsRefundedHandler(
        paymentRepo,
        allowAllPolicyFactory,
        harness.txManager
      )
    );
    bus.register(
      BeginInstallmentReversalCommand,
      new BeginInstallmentReversalHandler(paymentRepo, harness.txManager)
    );
    bus.register(
      ReleaseInstallmentReversalCommand,
      new ReleaseInstallmentReversalHandler(paymentRepo, harness.txManager)
    );
    bus.register(EnsurePartyForPatientCommand, {
      execute: async () => ({ partyId: ledger.partyId }),
    });
    const commandBus = {
      execute: (cmd: unknown) =>
        cmd instanceof MarkInstallmentAsRefundedCommand ||
        cmd instanceof BeginInstallmentReversalCommand ||
        cmd instanceof ReleaseInstallmentReversalCommand ||
        cmd instanceof EnsurePartyForPatientCommand
          ? bus.execute(cmd)
          : harness.commandBus.execute(cmd),
    } as never;

    const queryBus = {
      execute: async (query: unknown) => {
        if (query instanceof GetPaymentWithInstallmentsQuery) {
          return {
            data: await paymentQueryRepo.findPaymentWithInstallments(
              query.paymentId
            ),
          };
        }
        if (query instanceof GetInstallmentForLedgerQuery) {
          return {
            data: await paymentQueryRepo.findInstallmentForLedger(
              query.installmentId
            ),
          };
        }
        throw new Error('Harness bu sorguyu bilmiyor');
      },
    } as never;

    provider = {
      cancelPayment: jest.fn().mockResolvedValue({ status: 'success' }),
    };

    cancelHandler = new CancelPaymentHandler(
      harness.txManager,
      provider as never,
      new IyzicoTransactionCommandRepository(prisma),
      { paymentCancelled: jest.fn() } as never,
      commandBus,
      queryBus,
      new IyzicoReversalFinalizer(
        new IyzicoTransactionCommandRepository(prisma),
        harness.txManager,
        commandBus
      ),
      allowAllPolicyFactory,
      new CardChargebackExposureGuard(chargebackRepo)
    );

    openChargeback = new OpenCardChargebackHandler(
      chargebackRepo,
      new BankAccountCommandRepository(prisma),
      { resolve: async () => ledger.organizationId } as never,
      new PeriodGateService(harness.periodRepo),
      new FundsInTransitGate(harness.journalRepo, harness.accountRepo),
      new FinancialEventPresenceGuard(harness.eventRepo),
      {} as never,
      new PaymentCollectionService(paymentRepo),
      {} as never,
      {} as never,
      allowAllPolicyFactory,
      commandBus,
      queryBus,
      harness.txManager
    );
  });

  beforeEach(() => {
    provider.cancelPayment.mockReset();
    provider.cancelPayment.mockResolvedValue({ status: 'success' });
  });

  afterAll(async () => {
    await harness.close();
  });

  const collect = (amount: string) =>
    seedCollectedInstallment(harness, { ledger, patientId, amount });
  const cancel = (paymentId: string) =>
    cancelHandler.execute(
      new CancelPaymentCommand({ paymentId } as never, '127.0.0.1', ctx)
    );
  const chargeback = (installmentId: string, amount: number) =>
    openChargeback.execute(
      new OpenCardChargebackCommand(
        {
          clinicId: ledger.clinicId,
          sourceType: 'ONLINE_PAYMENT',
          sourceId: installmentId,
          caseReference: `case-${UUID.generate().value}`,
          openedAt: new Date(),
          amount,
          feeAmount: 0,
          fundsChannel: 'BANK',
        } as never,
        ctx
      )
    );
  const balance = (code: string) =>
    ledgerBalance(harness, { clinicId: ledger.clinicId, code });
  const installmentOf = (id: string) =>
    harness.prisma.paymentInstallment.findUniqueOrThrow({ where: { id } });

  // §97 P0: iptal sağlayıcıda parayı geri götürüyordu ama yerel kapanış tahsil edilmiş
  // taksidi reddettiği için tx geri sarılıyor, taksit COMPLETED ve defter tahsilatı
  // göstermeye devam ediyordu. Artık iptal, iade ile aynı yoldan kapanır.
  it('başarılı iptal: taksit REFUNDED, iyzico kaydı REFUNDED, olay yazılır ve 108 geri alınır', async () => {
    const { paymentId, installmentId } = await collect('310.00');
    const before108 = await balance('108');

    await cancel(paymentId);

    expect((await installmentOf(installmentId)).status).toBe('REFUNDED');
    const tx = await harness.prisma.iyzicoTransaction.findUniqueOrThrow({
      where: { installmentId },
    });
    expect(tx.status).toBe('REFUNDED');

    const event = await harness.prisma.financialEvent.findFirstOrThrow({
      where: { type: 'PAYMENT_REFUNDED', sourceRefId: paymentId },
    });
    await harness.postHandler.execute(
      new PostFinancialEventCommand(event.id, ctx)
    );
    expect(await balance('108')).toBe(before108 - 310);
    expect(provider.cancelPayment).toHaveBeenCalledTimes(1);
  });

  it('iptal edilmiş taksit ikinci kez iptal/iade edilemez', async () => {
    const { paymentId } = await collect('80.00');
    await cancel(paymentId);
    provider.cancelPayment.mockClear();

    await expect(cancel(paymentId)).rejects.toBeInstanceOf(
      CompletedInstallmentNotFoundException
    );
    expect(provider.cancelPayment).not.toHaveBeenCalled();
  });

  it('açık itiraz varken iptal sağlayıcıya GİTMEDEN reddedilir (kural 17)', async () => {
    const { paymentId, installmentId } = await collect('330.00');
    await chargeback(installmentId, 330);

    await expect(cancel(paymentId)).rejects.toBeInstanceOf(
      CollectionUnderChargebackException
    );
    expect(provider.cancelPayment).not.toHaveBeenCalled();
    expect((await installmentOf(installmentId)).reversalRequestedAt).toBeNull();
  });

  it('SDK uçuştayken açılan itiraz reddedilir, iptal tamamlanır (kural 18d)', async () => {
    const { paymentId, installmentId } = await collect('270.00');
    provider.cancelPayment.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ status: 'success' }), 300)
        )
    );

    const settled = await Promise.allSettled([
      cancel(paymentId),
      new Promise((r) => setTimeout(r, 80)).then(() =>
        chargeback(installmentId, 270)
      ),
    ]);

    expect(settled[0].status).toBe('fulfilled');
    expect(settled[1].status).toBe('rejected');
    expect((settled[1] as PromiseRejectedResult).reason).toBeInstanceOf(
      InstallmentReversalInFlightException
    );
  });

  it('sağlayıcı iptali AÇIKÇA reddederse damga kalkar', async () => {
    const { paymentId, installmentId } = await collect('150.00');
    provider.cancelPayment.mockResolvedValue({
      status: 'failure',
      errorMessage: 'cancel rejected',
    });

    await expect(cancel(paymentId)).rejects.toThrow();

    const installment = await installmentOf(installmentId);
    expect(installment.status).toBe('COMPLETED');
    expect(installment.reversalRequestedAt).toBeNull();
  });

  it('SDK FIRLATIRSA damga kalır ve itiraz reddedilir', async () => {
    const { paymentId, installmentId } = await collect('175.00');
    provider.cancelPayment.mockRejectedValue(new Error('socket hang up'));

    await expect(cancel(paymentId)).rejects.toThrow('socket hang up');
    expect(
      (await installmentOf(installmentId)).reversalRequestedAt
    ).not.toBeNull();

    await expect(chargeback(installmentId, 175)).rejects.toBeInstanceOf(
      InstallmentReversalInFlightException
    );
  });
});
