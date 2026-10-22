/* eslint-disable @typescript-eslint/no-require-imports */
import {
  allowAllPolicyFactory,
  createFinanceDbHarness,
  FinanceDbHarness,
  ledgerBalance,
  LedgerFixture,
  LocalCommandBus,
  makeCtx,
  seedCollectedInstallment,
  seedLedger,
  seedPatient,
} from '@src/testing/finance-db/finance-db.harness';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { PostFinancialEventCommand } from '@modules/finance/accounting/posting/application/commands/post-financial-event/post-financial-event.command';
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
import { EnsurePartyForPatientCommand } from '@modules/finance/party/application/commands/ensure-party-for-patient/ensure-party-for-patient.command';
import { GetPaymentWithInstallmentsQuery } from '@modules/finance/payment/application/queries/get-payment-with-installments/get-payment-with-installments.query';
import { GetInstallmentForLedgerQuery } from '@modules/finance/payment/application/queries/get-installment-for-ledger/get-installment-for-ledger.query';
import { OpenCardChargebackHandler } from '@modules/finance/bank/application/commands/open-card-chargeback/open-card-chargeback.handler';
import { OpenCardChargebackCommand } from '@modules/finance/bank/application/commands/open-card-chargeback/open-card-chargeback.command';
import {
  ChargebackSourceNotChargeableException,
  CollectionUnderChargebackException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import {
  CompletedInstallmentNotFoundException,
  InstallmentReversalInFlightException,
} from '@modules/finance/payment/domain/exceptions/payment.exceptions';
import { BeginInstallmentReversalCommand } from '@modules/finance/payment/application/commands/begin-installment-reversal/begin-installment-reversal.command';
import { BeginInstallmentReversalHandler } from '@modules/finance/payment/application/commands/begin-installment-reversal/begin-installment-reversal.handler';
import { ReleaseInstallmentReversalCommand } from '@modules/finance/payment/application/commands/release-installment-reversal/release-installment-reversal.command';
import { ReleaseInstallmentReversalHandler } from '@modules/finance/payment/application/commands/release-installment-reversal/release-installment-reversal.handler';
import { IyzicoReversalFinalizer } from '@modules/finance/pos/virtual/application/services/iyzico-reversal-finalizer.service';
import { RefundPaymentHandler } from './refund-payment.handler';
import { RefundPaymentCommand } from './refund-payment.command';

/**
 * Gerçek-DB turu — sanal POS (iyzico) iadesi ve kural 17'nin iade ↔ itiraz ortak
 * tavanı: iki yol aynı taksidin aynı tutarına dokunur. Sağlayıcı SDK'sı taklit
 * (ağ), geri kalan her şey gerçek.
 */
describe('Sanal POS iadesi — gerçek DB', () => {
  let harness: FinanceDbHarness;
  let ledger: LedgerFixture;
  let patientId: string;
  let refundHandler: RefundPaymentHandler;
  let openChargeback: OpenCardChargebackHandler;
  let provider: { refund: jest.Mock };
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
    bus.register(EnsurePartyForPatientCommand, {
      execute: async () => ({ partyId: ledger.partyId }),
    });
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
    const commandBus = {
      execute: (cmd: unknown) =>
        cmd instanceof EnsurePartyForPatientCommand ||
        cmd instanceof MarkInstallmentAsRefundedCommand ||
        cmd instanceof BeginInstallmentReversalCommand ||
        cmd instanceof ReleaseInstallmentReversalCommand
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

    provider = { refund: jest.fn().mockResolvedValue({ status: 'success' }) };

    refundHandler = new RefundPaymentHandler(
      provider as never,
      new IyzicoTransactionCommandRepository(prisma),
      harness.txManager,
      commandBus,
      new IyzicoReversalFinalizer(
        new IyzicoTransactionCommandRepository(prisma),
        harness.txManager,
        commandBus
      ),
      queryBus,
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
    provider.refund.mockReset();
    provider.refund.mockResolvedValue({ status: 'success' });
  });

  afterAll(async () => {
    await harness.close();
  });

  const collect = (amount: string) =>
    seedCollectedInstallment(harness, { ledger, patientId, amount });
  const refund = (paymentId: string) =>
    refundHandler.execute(
      new RefundPaymentCommand(paymentId, '127.0.0.1', ctx)
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

  it('başarılı iade: taksit REFUNDED, iyzico kaydı REFUNDED, olay yazılır ve 108 geri alınır', async () => {
    const { paymentId, installmentId } = await collect('400.00');
    const before108 = await balance('108');

    await refund(paymentId);

    const installment =
      await harness.prisma.paymentInstallment.findUniqueOrThrow({
        where: { id: installmentId },
      });
    expect(installment.status).toBe('REFUNDED');
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
    expect(await balance('108')).toBe(before108 - 400);
    expect(provider.refund).toHaveBeenCalledTimes(1);
  });

  it('sağlayıcı iadeyi reddederse hiçbir yerel durum değişmez, olay yazılmaz', async () => {
    const { paymentId, installmentId } = await collect('150.00');
    provider.refund.mockResolvedValue({
      status: 'failure',
      errorMessage: 'refund rejected',
    });

    await expect(refund(paymentId)).rejects.toThrow();

    const installment =
      await harness.prisma.paymentInstallment.findUniqueOrThrow({
        where: { id: installmentId },
      });
    expect(installment.status).toBe('COMPLETED');
    expect(
      await harness.prisma.financialEvent.count({
        where: { type: 'PAYMENT_REFUNDED', sourceRefId: paymentId },
      })
    ).toBe(0);
  });

  it('ikinci iade sağlayıcıya hiç gitmez', async () => {
    const { paymentId } = await collect('90.00');
    await refund(paymentId);
    provider.refund.mockClear();

    await expect(refund(paymentId)).rejects.toBeInstanceOf(
      CompletedInstallmentNotFoundException
    );
    expect(provider.refund).not.toHaveBeenCalled();
  });

  it('açık itiraz varken iade sağlayıcıya GİTMEDEN reddedilir (kural 17)', async () => {
    const { paymentId, installmentId } = await collect('300.00');
    await chargeback(installmentId, 300);

    await expect(refund(paymentId)).rejects.toBeInstanceOf(
      CollectionUnderChargebackException
    );
    expect(provider.refund).not.toHaveBeenCalled();
  });

  it('iade edilmiş takside itiraz açılamaz (kural 17, ters yön)', async () => {
    const { paymentId, installmentId } = await collect('210.00');
    await refund(paymentId);

    await expect(chargeback(installmentId, 210)).rejects.toBeInstanceOf(
      ChargebackSourceNotChargeableException
    );
  });

  const marker = async (installmentId: string) =>
    (
      await harness.prisma.paymentInstallment.findUniqueOrThrow({
        where: { id: installmentId },
      })
    ).reversalRequestedAt;

  // §96 #1 (§97'de kapandı): iade SDK çağrısından önce taksidi damgalar; uçuştayken açılmaya
  // çalışılan itiraz damgayı görür ve reddedilir. Para kart sahibine iki kez gidemez.
  it('SDK uçuştayken açılan itiraz reddedilir, iade tamamlanır (kural 17/18d)', async () => {
    const { paymentId, installmentId } = await collect('260.00');
    provider.refund.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ status: 'success' }), 300)
        )
    );

    const settled = await Promise.allSettled([
      refund(paymentId),
      new Promise((r) => setTimeout(r, 80)).then(() =>
        chargeback(installmentId, 260)
      ),
    ]);

    expect(settled[0].status).toBe('fulfilled');
    expect(settled[1].status).toBe('rejected');
    expect((settled[1] as PromiseRejectedResult).reason).toBeInstanceOf(
      InstallmentReversalInFlightException
    );
    expect(
      await harness.prisma.cardChargeback.count({
        where: { sourceId: installmentId },
      })
    ).toBe(0);
  });

  it('itiraz tavan kapısını geçemeyen iade damgayı BIRAKMAZ (geri sarılır)', async () => {
    const { paymentId, installmentId } = await collect('120.00');
    await chargeback(installmentId, 120);

    await expect(refund(paymentId)).rejects.toBeInstanceOf(
      CollectionUnderChargebackException
    );
    expect(await marker(installmentId)).toBeNull();
  });

  it('sağlayıcı iadeyi AÇIKÇA reddederse damga kalkar ve itiraz açılabilir', async () => {
    const { paymentId, installmentId } = await collect('140.00');
    provider.refund.mockResolvedValue({
      status: 'failure',
      errorMessage: 'refund rejected',
    });

    await expect(refund(paymentId)).rejects.toThrow();
    expect(await marker(installmentId)).toBeNull();

    await expect(chargeback(installmentId, 140)).resolves.toBeDefined();
  });

  it('SDK FIRLATIRSA (sonuç bilinmiyor) damga kalır: itiraz reddedilir, süre dolmadan yeniden deneme sağlayıcıya gitmez', async () => {
    const { paymentId, installmentId } = await collect('170.00');
    provider.refund.mockRejectedValue(new Error('socket hang up'));

    await expect(refund(paymentId)).rejects.toThrow('socket hang up');
    expect(await marker(installmentId)).not.toBeNull();

    await expect(chargeback(installmentId, 170)).rejects.toBeInstanceOf(
      InstallmentReversalInFlightException
    );

    provider.refund.mockClear();
    await expect(refund(paymentId)).rejects.toBeInstanceOf(
      InstallmentReversalInFlightException
    );
    expect(provider.refund).not.toHaveBeenCalled();
  });

  it('damga bayatladıktan sonra aynı iade yeniden denenebilir', async () => {
    const { paymentId, installmentId } = await collect('180.00');
    provider.refund.mockRejectedValueOnce(new Error('timeout'));
    await expect(refund(paymentId)).rejects.toThrow('timeout');

    await harness.prisma.paymentInstallment.update({
      where: { id: installmentId },
      data: { reversalRequestedAt: new Date(Date.now() - 11 * 60 * 1000) },
    });

    await expect(refund(paymentId)).resolves.not.toThrow();
    const installment =
      await harness.prisma.paymentInstallment.findUniqueOrThrow({
        where: { id: installmentId },
      });
    expect(installment.status).toBe('REFUNDED');
  });

  it('sonucu bilinmeyen girişim, bayatlayınca değişmez taramasında görünür', async () => {
    const { CHECKS } =
      require('../../../../../../../../../scripts/finance-invariants.cjs') as {
        CHECKS: { key: string; sql: string }[];
      };
    const scan = CHECKS.find(
      (c) => c.key === 'sanal-pos-iade-sonucu-bilinmiyor'
    );
    if (!scan) throw new Error('tarama tanımlı değil');
    const found = async (installmentId: string) =>
      (
        await harness.prisma.$queryRawUnsafe<{ installment_id: string }[]>(
          scan.sql
        )
      ).some((r) => r.installment_id === installmentId);

    const { paymentId, installmentId } = await collect('77.00');
    provider.refund.mockRejectedValueOnce(new Error('timeout'));
    await expect(refund(paymentId)).rejects.toThrow('timeout');

    expect(await found(installmentId)).toBe(false); // taze damga: henüz bekleme süresi içinde
    await harness.prisma.paymentInstallment.update({
      where: { id: installmentId },
      data: { reversalRequestedAt: new Date(Date.now() - 11 * 60 * 1000) },
    });
    expect(await found(installmentId)).toBe(true);
  });

  it('eşzamanlı iki iade: yalnız biri sağlayıcıya gider', async () => {
    const { paymentId } = await collect('95.00');
    provider.refund.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ status: 'success' }), 150)
        )
    );

    const settled = await Promise.allSettled([
      refund(paymentId),
      refund(paymentId),
    ]);

    expect(settled.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(provider.refund).toHaveBeenCalledTimes(1);
  });
});
