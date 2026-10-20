import {
  allowAllPolicyFactory,
  createFinanceDbHarness,
  FinanceDbHarness,
  LedgerFixture,
  makeCtx,
  recordAndPost,
  seedLedger,
} from '@src/testing/finance-db/finance-db.harness';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { AccountingPeriod } from '@modules/finance/accounting/periods/domain/entities/accounting-period.entity';
import { AccountingPeriodCommandRepository } from '@modules/finance/accounting/periods/infrastructure/persistence/prisma/repositories/accounting-period/accounting-period.command.repository';
import { AccountQueryRepository } from '@modules/finance/accounting/chart-of-accounts/infrastructure/persistence/prisma/repositories/account/account.query.repository';
import { ClinicFinanceSettingsQueryRepository } from '@modules/organization/clinic/infrastructure/persistence/prisma/repositories/clinic-finance-settings/clinic-finance-settings.query.repository';
import { FinancialEventPostingCompletenessService } from '@modules/finance/accounting/financial-events/domain/services/posting-completeness/posting-completeness.service';
import { JournalEntryNumberingService } from '@modules/finance/accounting/periods/domain/services/entry-numbering/journal-entry-numbering.service';
import { GenerateYearEndClosingHandler } from '@modules/finance/accounting/posting/application/commands/generate-year-end-closing/generate-year-end-closing.handler';
import { GenerateYearEndClosingCommand } from '@modules/finance/accounting/posting/application/commands/generate-year-end-closing/generate-year-end-closing.command';
import { GetChartOfAccountsQuery } from '@modules/finance/accounting/chart-of-accounts/application/queries/get-chart-of-accounts/get-chart-of-accounts.query';
import { GetClinicFinanceSettingsQuery } from '@modules/organization/clinic/application/queries/get-clinic-finance-settings/get-clinic-finance-settings.query';
import {
  ClosingNextPeriodUnavailableException,
  ClosingPreviewStaleException,
  PeriodAlreadyClosedException,
} from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';
import { ClosePeriodHandler } from './close-period.handler';
import { ClosePeriodCommand } from './close-period.command';

/**
 * Gerçek-DB turu — mali yıl kapanışı (iş paketi 23; §94 (d): özkaynak devri adımı
 * yalnız birim testlerle sınanmıştı). Gerçek mizan, gerçek numaralama, gerçek
 * claim; kapanış fişleri aynı transaction'da.
 */
describe('Mali yıl kapanışı — gerçek DB', () => {
  let harness: FinanceDbHarness;
  let closePeriod: ClosePeriodHandler;
  const ctx = makeCtx(UUID.generate().value);

  beforeAll(async () => {
    harness = await createFinanceDbHarness();

    const periodRepo = new AccountingPeriodCommandRepository(harness.prisma);
    const accountQueryRepo = new AccountQueryRepository(harness.prisma);
    const settingsRepo = new ClinicFinanceSettingsQueryRepository(harness.prisma);

    const queryBus = {
      execute: async (query: unknown) => {
        if (query instanceof GetClinicFinanceSettingsQuery) {
          return { data: await settingsRepo.findByClinicId(query.clinicId) };
        }
        if (query instanceof GetChartOfAccountsQuery) {
          return { data: await accountQueryRepo.findAllByClinicId(query.clinicId) };
        }
        throw new Error('Harness bu sorguyu bilmiyor');
      },
    } as never;

    harness.commandBus.register(
      GenerateYearEndClosingCommand,
      new GenerateYearEndClosingHandler(
        harness.journalRepo,
        allowAllPolicyFactory,
        new JournalEntryNumberingService(periodRepo),
        queryBus,
        harness.txManager
      )
    );

    closePeriod = new ClosePeriodHandler(
      periodRepo,
      harness.commandBus as never,
      queryBus,
      harness.txManager,
      allowAllPolicyFactory,
      new FinancialEventPostingCompletenessService(harness.eventRepo)
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  const JUNE_2024 = new Date('2024-06-15T10:00:00Z');

  /** 2024 + 2025 dönemleri, işletme biçimi ve bir kâr (gelir 1000 − gider 300 = 700). */
  async function profitableLedger(
    businessType: 'COMPANY' | 'SOLE_PROPRIETOR' | null
  ): Promise<{ ledger: LedgerFixture; nextPeriodId: string }> {
    const ledger = await seedLedger(harness, { year: 2024 });
    const next = await harness.periodRepo.create(
      AccountingPeriod.create({
        clinicId: ledger.clinicId,
        organizationId: ledger.organizationId,
        year: 2025,
        actorId: 'db-e2e',
      })
    );
    if (businessType) {
      await harness.prisma.clinicFinanceSettings.create({
        data: {
          id: UUID.generate().value,
          clinicId: ledger.clinicId,
          businessType,
        },
      });
    }

    await recordAndPost(harness, {
      ledger,
      type: 'SALES_INVOICE_ISSUED',
      occurredAt: JUNE_2024,
      payload: {
        partyId: ledger.partyId,
        netTotal: '1000.00',
        vatTotal: '200.00',
        grandTotal: '1200.00',
      },
    });
    await recordAndPost(harness, {
      ledger,
      type: 'PURCHASE_INVOICE_RECEIVED',
      occurredAt: JUNE_2024,
      payload: {
        partyId: ledger.supplierPartyId,
        netTotal: '300.00',
        vatTotal: '60.00',
        grandTotal: '360.00',
        lineAccountCode: '770',
      },
    });
    return { ledger, nextPeriodId: next.id.value };
  }

  async function sumByPrefix(ledger: LedgerFixture, prefix: string) {
    const lines = await harness.prisma.journalLine.findMany({
      where: {
        account: { clinicId: ledger.clinicId, code: { startsWith: prefix } },
        entry: { status: { in: ['POSTED', 'REVERSED'] } },
      },
      select: { debit: true, credit: true },
    });
    return (
      lines.reduce(
        (a, l) =>
          a +
          Math.round(Number(l.debit ?? 0) * 100) -
          Math.round(Number(l.credit ?? 0) * 100),
        0
      ) / 100
    );
  }

  async function closeIt(ledger: LedgerFixture) {
    const period = await harness.prisma.accountingPeriod.findUniqueOrThrow({
      where: { id: ledger.periodId },
    });
    return closePeriod.execute(
      new ClosePeriodCommand({
        periodId: ledger.periodId,
        data: {
          expectedLastEntryNo: period.lastEntryNo.toString(),
          grniAccruals: [],
        } as never,
        ctx,
      })
    );
  }

  it('ŞİRKET: sonuç hesapları sıfırlanır, kâr 590 üzerinden 570\'e devredilir (1 Ocak)', async () => {
    const { ledger } = await profitableLedger('COMPANY');

    await closeIt(ledger);

    expect(await sumByPrefix(ledger, '6')).toBe(0);
    expect(await sumByPrefix(ledger, '7')).toBe(0);
    expect(await sumByPrefix(ledger, '690')).toBe(0);
    expect(await sumByPrefix(ledger, '590')).toBe(0);
    expect(await sumByPrefix(ledger, '591')).toBe(0);
    // Kâr alacak bakiye (özkaynak): borç − alacak = −700
    expect(await sumByPrefix(ledger, '570')).toBe(-700);

    const period = await harness.prisma.accountingPeriod.findUniqueOrThrow({
      where: { id: ledger.periodId },
    });
    expect(period.status).toBe('CLOSED');
    expect(period.closedAt).not.toBeNull();
  });

  it('ŞAHIS: kâr 500 Sermaye\'ye devredilir', async () => {
    const { ledger } = await profitableLedger('SOLE_PROPRIETOR');

    await closeIt(ledger);

    expect(await sumByPrefix(ledger, '590')).toBe(0);
    expect(await sumByPrefix(ledger, '570')).toBe(0);
    expect(await sumByPrefix(ledger, '500')).toBe(-700);
  });

  it('kapanış fişleri dengeli, numaralı ve ertesi yılın devri 2025 #1', async () => {
    const { ledger, nextPeriodId } = await profitableLedger('COMPANY');
    await closeIt(ledger);

    const entries = await harness.prisma.journalEntry.findMany({
      where: { clinicId: ledger.clinicId },
      include: { lines: true },
    });
    for (const e of entries) {
      const d = e.lines.reduce((a, l) => a + Math.round(Number(l.debit ?? 0) * 100), 0);
      const c = e.lines.reduce((a, l) => a + Math.round(Number(l.credit ?? 0) * 100), 0);
      expect(d).toBe(c);
      expect(e.status).toBe('POSTED');
      expect(e.entryNo).not.toBeNull();
    }

    const carry = entries.filter((e) => e.periodId === nextPeriodId);
    expect(carry).toHaveLength(1);
    expect(Number(carry[0].entryNo)).toBe(1);
    expect(carry[0].kind).toBe('CLOSING');
  });

  it('işletme biçimi seçilmemişse devir atlanır: 590 kâr bakiyesiyle kalır', async () => {
    const { ledger } = await profitableLedger(null);
    await closeIt(ledger);
    expect(await sumByPrefix(ledger, '590')).toBe(-700);
  });

  it('bayat önizleme belirteci reddedilir: dönem açık kalır, kapanış fişi yok', async () => {
    const { ledger } = await profitableLedger('COMPANY');
    const before = await harness.prisma.journalEntry.count({
      where: { clinicId: ledger.clinicId },
    });

    await expect(
      closePeriod.execute(
        new ClosePeriodCommand({
          periodId: ledger.periodId,
          data: { expectedLastEntryNo: '1', grniAccruals: [] } as never,
          ctx,
        })
      )
    ).rejects.toBeInstanceOf(ClosingPreviewStaleException);

    const period = await harness.prisma.accountingPeriod.findUniqueOrThrow({
      where: { id: ledger.periodId },
    });
    expect(period.status).toBe('OPEN');
    expect(
      await harness.prisma.journalEntry.count({ where: { clinicId: ledger.clinicId } })
    ).toBe(before);
  });

  it('ertesi yıl dönemi yokken devir gerektiren kapanış durur ve geri sarılır', async () => {
    const ledger = await seedLedger(harness, { year: 2023 });
    await harness.prisma.clinicFinanceSettings.create({
      data: {
        id: UUID.generate().value,
        clinicId: ledger.clinicId,
        businessType: 'COMPANY',
      },
    });
    await expect(closeIt(ledger)).rejects.toBeInstanceOf(
      ClosingNextPeriodUnavailableException
    );
    const period = await harness.prisma.accountingPeriod.findUniqueOrThrow({
      where: { id: ledger.periodId },
    });
    expect(period.status).toBe('OPEN');
  });

  it('eşzamanlı iki kapanış: biri kazanır, kapanış fişleri bir kez yazılır', async () => {
    const { ledger } = await profitableLedger('COMPANY');
    const settled = await Promise.allSettled([closeIt(ledger), closeIt(ledger)]);

    expect(settled.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = settled.find(
      (r) => r.status === 'rejected'
    ) as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(PeriodAlreadyClosedException);
    expect(await sumByPrefix(ledger, '570')).toBe(-700);
  });
});
