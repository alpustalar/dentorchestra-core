import {
  allowAllPolicyFactory,
  createFinanceDbHarness,
  FinanceDbHarness,
  LedgerFixture,
  ledgerBalance,
  LocalCommandBus,
  makeCtx,
  recordAndPost,
  seedLedger,
} from '@src/testing/finance-db/finance-db.harness';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { PostFinancialEventCommand } from '@modules/finance/accounting/posting/application/commands/post-financial-event/post-financial-event.command';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import { CardChargebackCommandRepository } from '@modules/finance/bank/infrastructure/persistence/prisma/repositories/card-chargeback/card-chargeback.command.repository';
import { BankAccountCommandRepository } from '@modules/finance/bank/infrastructure/persistence/prisma/repositories/bank-account/bank-account.command.repository';
import { PaymentCommandRepository } from '@modules/finance/payment/infrastructure/persistence/prisma/repositories/payment/payment.command.repository';
import { PaymentQueryRepository } from '@modules/finance/payment/infrastructure/persistence/prisma/repositories/payment/payment.query.repository';
import { PaymentCollectionService } from '@modules/finance/payment/domain/services/payment-collection/payment-collection.service';
import { PeriodGateService } from '@modules/finance/accounting/periods/domain/services/period-gate/period-gate.service';
import { FundsInTransitGate } from '@modules/finance/accounting/posting/domain/services/funds-in-transit/funds-in-transit.gate';
import { FinancialEventPresenceGuard } from '@modules/finance/accounting/financial-events/domain/services/event-presence/event-presence.guard';
import { ChargeBackInstallmentHandler } from '@modules/finance/payment/application/commands/charge-back-installment/charge-back-installment.handler';
import { ChargeBackInstallmentCommand } from '@modules/finance/payment/application/commands/charge-back-installment/charge-back-installment.command';
import { EnsurePartyForPatientCommand } from '@modules/finance/party/application/commands/ensure-party-for-patient/ensure-party-for-patient.command';
import { GetInstallmentForLedgerQuery } from '@modules/finance/payment/application/queries/get-installment-for-ledger/get-installment-for-ledger.query';
import {
  ChargebackAlreadyRecordedException,
  ChargebackAlreadyResolvedException,
  ChargebackExceedsCollectionException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import { InsufficientFundsInTransitException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';
import { OpenCardChargebackHandler } from './open-card-chargeback.handler';
import { OpenCardChargebackCommand } from './open-card-chargeback.command';
import { ResolveCardChargebackHandler } from '../resolve-card-chargeback/resolve-card-chargeback.handler';
import { ResolveCardChargebackCommand } from '../resolve-card-chargeback/resolve-card-chargeback.command';

/**
 * Gerçek-DB turu — kart itirazı (iş paketi 23, kural 21): tahsilat → itiraz açılışı
 * (127) → sonuç (kazanıldı/kaybedildi) → ödeme planı senkronu. Kural 17'nin kümülatif
 * tavanı ve `FOR UPDATE` kilidi burada gerçek PostgreSQL'e karşı sınanır.
 */
describe('Kart itirazı — gerçek DB (ONLINE_PAYMENT kaynağı)', () => {
  let harness: FinanceDbHarness;
  let ledger: LedgerFixture;
  let openHandler: OpenCardChargebackHandler;
  let resolveHandler: ResolveCardChargebackHandler;
  let patientId: string;
  const ctx = makeCtx(UUID.generate().value);
  const criticalFailure = { publish: jest.fn() };

  beforeAll(async () => {
    harness = await createFinanceDbHarness();
    ledger = await seedLedger(harness);

    patientId = UUID.generate().value;
    await harness.prisma.patient.create({
      data: {
        id: patientId,
        organizationId: ledger.organizationId,
        clinicId: ledger.clinicId,
        firstName: 'Test',
      },
    });

    const prisma = harness.prisma;
    const chargebackRepo = new CardChargebackCommandRepository(prisma);
    const bankAccountRepo = new BankAccountCommandRepository(prisma);
    const paymentRepo = new PaymentCommandRepository(prisma);
    const paymentQueryRepo = new PaymentQueryRepository(prisma);

    const bus = new LocalCommandBus();
    // Hasta carisi: gerçek handler yerine hazır cari (cari üretimi bu turun konusu değil).
    bus.register(EnsurePartyForPatientCommand, {
      execute: async () => ({ partyId: ledger.partyId }),
    });
    bus.register(
      ChargeBackInstallmentCommand,
      new ChargeBackInstallmentHandler(paymentRepo, harness.txManager)
    );
    // RecordFinancialEvent: harness'in gerçek handler'ı.
    const record = harness.commandBus;
    const commandBus = {
      execute: (cmd: unknown) =>
        cmd instanceof EnsurePartyForPatientCommand ||
        cmd instanceof ChargeBackInstallmentCommand
          ? bus.execute(cmd)
          : record.execute(cmd),
    } as never;

    const queryBus = {
      execute: async (query: unknown) => {
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

    const tenant = {
      resolve: async () => ledger.organizationId,
    } as never;
    const notUsed = {
      lockAndGetReversibleAmount: async () => {
        throw new Error('Bu kaynak türü bu turda kullanılmıyor');
      },
    } as never;

    openHandler = new OpenCardChargebackHandler(
      chargebackRepo,
      bankAccountRepo,
      tenant,
      new PeriodGateService(harness.periodRepo),
      new FundsInTransitGate(harness.journalRepo, harness.accountRepo),
      new FinancialEventPresenceGuard(harness.eventRepo),
      notUsed,
      new PaymentCollectionService(paymentRepo),
      notUsed,
      { resolve: async () => ({ clinicId: 'x', organizationId: 'x' }) } as never,
      allowAllPolicyFactory,
      commandBus,
      queryBus,
      harness.txManager
    );

    resolveHandler = new ResolveCardChargebackHandler(
      chargebackRepo,
      bankAccountRepo,
      new PeriodGateService(harness.periodRepo),
      allowAllPolicyFactory,
      commandBus,
      criticalFailure as never,
      harness.txManager
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  /** Tamamlanmış kart taksidi + defterde yazılı `PAYMENT_RECEIVED` (108 dolar). */
  async function seedCollectedInstallment(amount: string) {
    const paymentId = UUID.generate().value;
    const installmentId = UUID.generate().value;
    await harness.prisma.payment.create({
      data: {
        id: paymentId,
        clinicId: ledger.clinicId,
        patientId,
        totalAmount: amount,
        status: 'COMPLETED',
        installments: {
          create: {
            id: installmentId,
            installmentNo: 1,
            amount,
            method: 'CREDIT_CARD',
            status: 'COMPLETED',
            paidAt: new Date(),
          },
        },
      },
    });
    await recordAndPost(harness, {
      ledger,
      type: 'PAYMENT_RECEIVED',
      payload: { method: 'POS_CARD', amount, partyId: ledger.partyId },
      dedupeKey: FinancialEventDedupeKeys.payment_received(installmentId),
    });
    return { paymentId, installmentId };
  }

  const open = (
    installmentId: string,
    overrides: Partial<{
      amount: number;
      feeAmount: number;
      fundsChannel: 'FUNDS_IN_TRANSIT' | 'BANK';
      caseReference: string;
    }> = {}
  ) =>
    openHandler.execute(
      new OpenCardChargebackCommand(
        {
          clinicId: ledger.clinicId,
          sourceType: 'ONLINE_PAYMENT',
          sourceId: installmentId,
          caseReference: overrides.caseReference ?? `case-${UUID.generate().value}`,
          openedAt: new Date(),
          amount: overrides.amount ?? 100,
          feeAmount: overrides.feeAmount ?? 0,
          fundsChannel: overrides.fundsChannel ?? 'FUNDS_IN_TRANSIT',
        } as never,
        ctx
      )
    );

  const resolve = (chargebackId: string, data: Record<string, unknown>) =>
    resolveHandler.execute(
      new ResolveCardChargebackCommand({
        chargebackId,
        data: { resolvedAt: new Date(), ...data } as never,
        ctx,
      })
    );

  async function postEventOf(eventId: string | null) {
    expect(eventId).not.toBeNull();
    return harness.postHandler.execute(
      new PostFinancialEventCommand(eventId as string, ctx)
    );
  }

  const balance = (code: string) =>
    ledgerBalance(harness, { clinicId: ledger.clinicId, code });

  it('KAZANILDI: açılış 127\'ye, çözüm 127\'yi boşaltır; ücret 653\'e yazılır', async () => {
    const { installmentId } = await seedCollectedInstallment('300.00');
    const before127 = await balance('127');
    const before653 = await balance('653');

    const chargebackId = await open(installmentId, {
      amount: 300,
      feeAmount: 15,
      fundsChannel: 'BANK',
    });
    const opened = await harness.prisma.cardChargeback.findUniqueOrThrow({
      where: { id: chargebackId },
    });
    expect(opened.status).toBe('OPEN');
    expect(opened.amount.toString()).toBe('300');
    await postEventOf(opened.openedEventId);

    expect(await balance('127')).toBe(before127 + 300);
    expect(await balance('653')).toBe(before653 + 15);

    await resolve(chargebackId, { outcome: 'WON', fundsChannel: 'BANK' });
    const won = await harness.prisma.cardChargeback.findUniqueOrThrow({
      where: { id: chargebackId },
    });
    expect(won.status).toBe('WON');
    await postEventOf(won.resolvedEventId);

    expect(await balance('127')).toBe(before127);
  });

  it('KAYBEDİLDİ: taksit CHARGED_BACK, telafi taksidi açılır, 127 boşalır, 120 borçlanır', async () => {
    const { paymentId, installmentId } = await seedCollectedInstallment('500.00');
    const before127 = await balance('127');
    const before108 = await balance('108');
    const before120 = await balance('120');

    const chargebackId = await open(installmentId, { amount: 500 });
    const opened = await harness.prisma.cardChargeback.findUniqueOrThrow({
      where: { id: chargebackId },
    });
    await postEventOf(opened.openedEventId);
    expect(await balance('108')).toBe(before108 - 500);

    await resolve(chargebackId, { outcome: 'LOST' });
    const lost = await harness.prisma.cardChargeback.findUniqueOrThrow({
      where: { id: chargebackId },
    });
    expect(lost.status).toBe('LOST');
    expect(lost.planSyncStatus).toBe('SYNCED');
    await postEventOf(lost.resolvedEventId);

    const installments = await harness.prisma.paymentInstallment.findMany({
      where: { paymentId },
      orderBy: { installmentNo: 'asc' },
    });
    expect(installments.map((i) => i.status).sort()).toEqual(['CHARGED_BACK', 'PENDING']);
    const recovery = installments.find((i) => i.status === 'PENDING');
    expect(recovery?.amount.toString()).toBe('500');
    expect(recovery?.recoversInstallmentId).toBe(installmentId);

    expect(await balance('127')).toBe(before127);
    expect(await balance('120')).toBe(before120 + 500);
  });

  it('kümülatif tavan: ikinci itiraz kalan tutarı aşarsa reddedilir (kural 17)', async () => {
    const { installmentId } = await seedCollectedInstallment('500.00');
    await open(installmentId, { amount: 300 });
    await expect(open(installmentId, { amount: 300 })).rejects.toBeInstanceOf(
      ChargebackExceedsCollectionException
    );

    const active = await harness.prisma.cardChargeback.count({
      where: { sourceId: installmentId },
    });
    expect(active).toBe(1);
  });

  it('eşzamanlı iki itiraz: toplam tahsilatı aşmaz, yalnız biri kazanır (kilit)', async () => {
    const { installmentId } = await seedCollectedInstallment('500.00');
    const settled = await Promise.allSettled([
      open(installmentId, { amount: 300 }),
      open(installmentId, { amount: 300 }),
    ]);

    expect(settled.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    // Kaybeden, kilit sayesinde kazananın kaydını GÖRÜP tavan hatasıyla reddedilir
    // (rastgele bir hata değil): kilit yoksa ikisi de geçer ve 600 > 500 olurdu.
    const rejected = settled.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ChargebackExceedsCollectionException);
    expect(
      await harness.prisma.cardChargeback.count({ where: { sourceId: installmentId } })
    ).toBe(1);
  });

  it('108\'de olmayan para kesildi denemez: bakiyeyi aşan kesinti reddedilir (kural 14b)', async () => {
    const { installmentId } = await seedCollectedInstallment('200.00');
    const available = await balance('108');
    // İtiraz tutarı tahsilatı aşmıyor (200) — durduran yalnız 108 bakiye kapısıdır.
    await expect(
      open(installmentId, { amount: 200, feeAmount: available - 200 + 0.01 })
    ).rejects.toBeInstanceOf(InsufficientFundsInTransitException);
    expect(
      await harness.prisma.cardChargeback.count({ where: { sourceId: installmentId } })
    ).toBe(0);
  });

  it('aynı vaka iki kez girilemez (clinic+provider+caseReference tekil)', async () => {
    const { installmentId } = await seedCollectedInstallment('120.00');
    const caseReference = `dup-${UUID.generate().value}`;
    await open(installmentId, { amount: 50, caseReference });
    await expect(
      open(installmentId, { amount: 50, caseReference })
    ).rejects.toBeInstanceOf(ChargebackAlreadyRecordedException);
  });

  it('ikinci çözüm reddedilir: tek çözüm olayı', async () => {
    const { installmentId } = await seedCollectedInstallment('80.00');
    const chargebackId = await open(installmentId, { amount: 80 });
    await resolve(chargebackId, { outcome: 'LOST' });
    await expect(
      resolve(chargebackId, { outcome: 'LOST' })
    ).rejects.toBeInstanceOf(ChargebackAlreadyResolvedException);
    expect(
      await harness.prisma.financialEvent.count({
        where: { sourceRefId: chargebackId, type: 'CARD_CHARGEBACK_LOST' },
      })
    ).toBe(1);
  });
});
