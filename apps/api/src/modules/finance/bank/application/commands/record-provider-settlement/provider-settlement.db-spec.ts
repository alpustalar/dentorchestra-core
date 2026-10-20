import {
  allowAllPolicyFactory,
  createFinanceDbHarness,
  FinanceDbHarness,
  ledgerBalance,
  LedgerFixture,
  makeCtx,
  readStoredEntry,
  recordAndPost,
  seedLedger,
} from '@src/testing/finance-db/finance-db.harness';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { PostFinancialEventCommand } from '@modules/finance/accounting/posting/application/commands/post-financial-event/post-financial-event.command';
import { InsufficientFundsInTransitException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';
import { BankAccountCommandRepository } from '@modules/finance/bank/infrastructure/persistence/prisma/repositories/bank-account/bank-account.command.repository';
import { ProviderSettlementCommandRepository } from '@modules/finance/bank/infrastructure/persistence/prisma/repositories/provider-settlement/provider-settlement.command.repository';
import { PeriodGateService } from '@modules/finance/accounting/periods/domain/services/period-gate/period-gate.service';
import { FundsInTransitGate } from '@modules/finance/accounting/posting/domain/services/funds-in-transit/funds-in-transit.gate';
import { RecordProviderSettlementHandler } from './record-provider-settlement.handler';
import { RecordProviderSettlementCommand } from './record-provider-settlement.command';

/**
 * Gerçek-DB turu — sağlayıcı hesap kapaması (108 → 102 + 653, kural 16): 108'i
 * kapatan akış. Kapı (`FundsInTransitGate`) bakiyeyi kilit altında okur; kilit
 * `Prisma` `void` sütunu yüzünden hiç çalışmıyordu (bkz. `lockConcept`).
 */
describe('Sağlayıcı hesap kapaması — gerçek DB', () => {
  let harness: FinanceDbHarness;
  let ledger: LedgerFixture;
  let handler: RecordProviderSettlementHandler;
  const ctx = makeCtx(UUID.generate().value);

  beforeAll(async () => {
    harness = await createFinanceDbHarness();
    ledger = await seedLedger(harness);

    handler = new RecordProviderSettlementHandler(
      new ProviderSettlementCommandRepository(harness.prisma),
      new BankAccountCommandRepository(harness.prisma),
      { resolve: async () => ledger.organizationId } as never,
      new PeriodGateService(harness.periodRepo),
      new FundsInTransitGate(harness.journalRepo, harness.accountRepo),
      allowAllPolicyFactory,
      harness.commandBus as never,
      harness.txManager
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  const balance = (code: string) =>
    ledgerBalance(harness, { clinicId: ledger.clinicId, code });

  async function collectCard(amount: string) {
    await recordAndPost(harness, {
      ledger,
      type: 'PAYMENT_RECEIVED',
      payload: { method: 'POS_CARD', amount, partyId: ledger.partyId },
    });
  }

  const settle = (gross: number, commission: number, reference?: string) =>
    handler.execute(
      new RecordProviderSettlementCommand(
        {
          clinicId: ledger.clinicId,
          provider: 'IYZICO',
          reference: reference ?? `ref-${UUID.generate().value}`,
          payoutDate: new Date(),
          grossAmount: gross,
          commissionAmount: commission,
          netAmount: Math.round((gross - commission) * 100) / 100,
        } as never,
        ctx
      )
    );

  it('kapama: 108 azalır, 102 net ile dolar, komisyon 653\'e yazılır; fiş dengeli', async () => {
    await collectCard('1000.00');
    const b108 = await balance('108');
    const b102 = await balance('102');
    const b653 = await balance('653');

    const id = await settle(1000, 25);

    const row = await harness.prisma.providerSettlement.findUniqueOrThrow({
      where: { id },
    });
    expect(row.grossAmount.toString()).toBe('1000');
    expect(row.accountingEventId).not.toBeNull();

    const entryId = await harness.postHandler.execute(
      new PostFinancialEventCommand(row.accountingEventId as string, ctx)
    );
    const entry = await readStoredEntry(harness, entryId as string);
    expect(entry.status).toBe('POSTED');

    expect(await balance('108')).toBe(b108 - 1000);
    expect(await balance('102')).toBe(b102 + 975);
    expect(await balance('653')).toBe(b653 + 25);
  });

  it('bekleyen bakiyeyi aşan kapama reddedilir: kayıt ve olay yazılmaz (kural 16)', async () => {
    const lg = await seedLedger(harness);
    // Bu deftere hiç kart tahsilatı girmedi → 108 = 0.
    const local = new RecordProviderSettlementHandler(
      new ProviderSettlementCommandRepository(harness.prisma),
      new BankAccountCommandRepository(harness.prisma),
      { resolve: async () => lg.organizationId } as never,
      new PeriodGateService(harness.periodRepo),
      new FundsInTransitGate(harness.journalRepo, harness.accountRepo),
      allowAllPolicyFactory,
      harness.commandBus as never,
      harness.txManager
    );

    await expect(
      local.execute(
        new RecordProviderSettlementCommand(
          {
            clinicId: lg.clinicId,
            provider: 'IYZICO',
            reference: 'over-1',
            payoutDate: new Date(),
            grossAmount: 10,
            commissionAmount: 0,
            netAmount: 10,
          } as never,
          ctx
        )
      )
    ).rejects.toBeInstanceOf(InsufficientFundsInTransitException);

    expect(
      await harness.prisma.providerSettlement.count({ where: { clinicId: lg.clinicId } })
    ).toBe(0);
    expect(
      await harness.prisma.financialEvent.count({
        where: { clinicId: lg.clinicId, type: 'PROVIDER_SETTLEMENT_RECEIVED' },
      })
    ).toBe(0);
  });

  it('fişlenmemiş kapama bekleyen bakiyeden düşülür: art arda iki kapama aynı parayı iki kez harcayamaz', async () => {
    const lg = await seedLedger(harness);
    await recordAndPost(harness, {
      ledger: lg,
      type: 'PAYMENT_RECEIVED',
      payload: { method: 'POS_CARD', amount: '1000.00', partyId: lg.partyId },
    });
    const local = new RecordProviderSettlementHandler(
      new ProviderSettlementCommandRepository(harness.prisma),
      new BankAccountCommandRepository(harness.prisma),
      { resolve: async () => lg.organizationId } as never,
      new PeriodGateService(harness.periodRepo),
      new FundsInTransitGate(harness.journalRepo, harness.accountRepo),
      allowAllPolicyFactory,
      harness.commandBus as never,
      harness.txManager
    );
    const run = (reference: string) =>
      local.execute(
        new RecordProviderSettlementCommand(
          {
            clinicId: lg.clinicId,
            provider: 'IYZICO',
            reference,
            payoutDate: new Date(),
            grossAmount: 600,
            commissionAmount: 0,
            netAmount: 600,
          } as never,
          ctx
        )
      );

    // Birinci kapamanın fişi henüz üretilmedi (olay outbox'ta bekliyor): 108 hâlâ 1000.
    await run('seq-1');
    await expect(run('seq-2')).rejects.toBeInstanceOf(
      InsufficientFundsInTransitException
    );
  });

  it('fişlendikten sonra çift sayılmaz: 600 kapat → fişle → kalan 400 kapanır, 1 kuruş fazlası reddedilir', async () => {
    const lg = await seedLedger(harness);
    await recordAndPost(harness, {
      ledger: lg,
      type: 'PAYMENT_RECEIVED',
      payload: { method: 'POS_CARD', amount: '1000.00', partyId: lg.partyId },
    });
    const local = new RecordProviderSettlementHandler(
      new ProviderSettlementCommandRepository(harness.prisma),
      new BankAccountCommandRepository(harness.prisma),
      { resolve: async () => lg.organizationId } as never,
      new PeriodGateService(harness.periodRepo),
      new FundsInTransitGate(harness.journalRepo, harness.accountRepo),
      allowAllPolicyFactory,
      harness.commandBus as never,
      harness.txManager
    );
    const run = (gross: number, reference: string) =>
      local.execute(
        new RecordProviderSettlementCommand(
          {
            clinicId: lg.clinicId,
            provider: 'IYZICO',
            reference,
            payoutDate: new Date(),
            grossAmount: gross,
            commissionAmount: 0,
            netAmount: gross,
          } as never,
          ctx
        )
      );

    const first = await run(600, 'post-1');
    const row = await harness.prisma.providerSettlement.findUniqueOrThrow({
      where: { id: first },
    });
    await harness.postHandler.execute(
      new PostFinancialEventCommand(row.accountingEventId as string, ctx)
    );

    // Fişlenmiş kesinti hem bakiyede hem "bekleyen"de sayılsaydı 400 reddedilirdi.
    await expect(run(400, 'post-2')).resolves.toEqual(expect.any(String));
    await expect(run(0.01, 'post-3')).rejects.toBeInstanceOf(
      InsufficientFundsInTransitException
    );
  });
});
