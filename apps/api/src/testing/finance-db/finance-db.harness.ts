/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { OutboxRepository } from '@src/infrastructure/persistence/prisma/outbox/outbox.repository';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { JournalCommandRepository } from '@modules/finance/accounting/posting/infrastructure/persistence/prisma/repositories/journal/journal.command.repository';
import { FinancialEventCommandRepository } from '@modules/finance/accounting/financial-events/infrastructure/persistence/prisma/repositories/financial-event/financial-event.command.repository';
import { FinancialEventQueryRepository } from '@modules/finance/accounting/financial-events/infrastructure/persistence/prisma/repositories/financial-event/financial-event.query.repository';
import { AccountingPeriodCommandRepository } from '@modules/finance/accounting/periods/infrastructure/persistence/prisma/repositories/accounting-period/accounting-period.command.repository';
import { AccountingPeriodQueryRepository } from '@modules/finance/accounting/periods/infrastructure/persistence/prisma/repositories/accounting-period/accounting-period.query.repository';
import { AccountCommandRepository } from '@modules/finance/accounting/chart-of-accounts/infrastructure/persistence/prisma/repositories/account/account.command.repository';
import { AccountQueryRepository } from '@modules/finance/accounting/chart-of-accounts/infrastructure/persistence/prisma/repositories/account/account.query.repository';
import { ClinicFinanceSettingsQueryRepository } from '@modules/organization/clinic/infrastructure/persistence/prisma/repositories/clinic-finance-settings/clinic-finance-settings.query.repository';
import { JournalEntryNumberingService } from '@modules/finance/accounting/periods/domain/services/entry-numbering/journal-entry-numbering.service';
import { Account } from '@modules/finance/accounting/chart-of-accounts/domain/entities/account.entity';
import { AccountingPeriod } from '@modules/finance/accounting/periods/domain/entities/accounting-period.entity';
import { FinancialEvent } from '@modules/finance/accounting/financial-events/domain/entities/financial-event.entity';
import { PostFinancialEventHandler } from '@modules/finance/accounting/posting/application/commands/post-financial-event/post-financial-event.handler';
import { PostFinancialEventCommand } from '@modules/finance/accounting/posting/application/commands/post-financial-event/post-financial-event.command';
import { PostingRuleRegistry } from '@modules/finance/accounting/posting/domain/posting/posting-rule.registry';
import { PaymentReceivedRule } from '@modules/finance/accounting/posting/domain/posting/rules/payment-received.rule';
import { PaymentRefundedRule } from '@modules/finance/accounting/posting/domain/posting/rules/payment-refunded.rule';
import { SalesInvoiceIssuedRule } from '@modules/finance/accounting/posting/domain/posting/rules/sales-invoice-issued.rule';
import { PurchaseInvoiceReceivedRule } from '@modules/finance/accounting/posting/domain/posting/rules/purchase-invoice-received.rule';
import { PayrollAccruedRule } from '@modules/finance/accounting/posting/domain/posting/rules/payroll-accrued.rule';
import { CashSessionClosedRule } from '@modules/finance/accounting/posting/domain/posting/rules/cash-session-closed.rule';
import { PlatformBookingSettledRule } from '@modules/finance/accounting/posting/domain/posting/rules/platform-booking-settled.rule';
import { PlatformBookingRefundedRule } from '@modules/finance/accounting/posting/domain/posting/rules/platform-booking-refunded.rule';
import { PlatformReturnableChargeReceivedRule } from '@modules/finance/accounting/posting/domain/posting/rules/platform-returnable-charge-received.rule';
import { PlatformReturnableChargeRefundedRule } from '@modules/finance/accounting/posting/domain/posting/rules/platform-returnable-charge-refunded.rule';
import { PaymentMadeRule } from '@modules/finance/accounting/posting/domain/posting/rules/payment-made.rule';
import { StockOutRule } from '@modules/finance/accounting/posting/domain/posting/rules/stock-out.rule';
import { StockInRule } from '@modules/finance/accounting/posting/domain/posting/rules/stock-in.rule';
import { ProviderSettlementReceivedRule } from '@modules/finance/accounting/posting/domain/posting/rules/provider-settlement-received.rule';
import { CardChargebackOpenedRule } from '@modules/finance/accounting/posting/domain/posting/rules/card-chargeback-opened.rule';
import { CardChargebackWonRule } from '@modules/finance/accounting/posting/domain/posting/rules/card-chargeback-won.rule';
import { CardChargebackLostRule } from '@modules/finance/accounting/posting/domain/posting/rules/card-chargeback-lost.rule';
import { GetFinancialEventByIdQuery } from '@modules/finance/accounting/financial-events/application/queries/get-financial-event-by-id/get-financial-event-by-id.query';
import { FindPeriodByDateQuery } from '@modules/finance/accounting/periods/application/queries/find-period-by-date/find-period-by-date.query';
import { GetChartOfAccountsQuery } from '@modules/finance/accounting/chart-of-accounts/application/queries/get-chart-of-accounts/get-chart-of-accounts.query';
import { GetClinicCurrencyQuery } from '@modules/organization/clinic/application/queries/get-clinic-currency/get-clinic-currency.query';
import { RecordFinancialEventHandler } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.handler';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import { FinancialEventTypeType as FinancialEventType } from '@input-type-schemas/FinancialEventTypeSchema';
import { InputJsonValueType as InputJsonValue } from '@input-type-schemas/InputJsonValueSchema';

/**
 * Gerçek-DB turu düzeneği (CLAUDE.md finans kuralı 21).
 *
 * Mock'lu test veritabanının döndürdüğü tipi (Prisma.Decimal, BigInt, Date) taklit
 * edemez; bu düzenek **gerçek repository'leri** izole bir veritabanına karşı kurar.
 * Veritabanını `test/db/global-setup.cjs` açar (dev DB'ye dokunulmaz).
 *
 * Kasıtlı olarak yalnız şu sınır taklit edilir: sorgu yolundaki `TSQueryBus` +
 * politika katmanı (yetki bu turun konusu değil) ve FX kur sağlayıcısı (ağ).
 * Sorgu *repository*'leri gerçektir — hidrasyon sınırı sınanan şey budur.
 */

/** Yalnız ctx'i politika katmanına geçirmeyen sorgular için yer tutucu. */
const FAKE_CTX = { actor: {}, source: 'SYSTEM' } as any;

/** Politika katmanı bu turun konusu değil: her kontrol geçer (yetki testleri ayrı yerde). */
const ALLOW_CHAIN: any = { check: () => ALLOW_CHAIN, orThrow: () => undefined };
export const allowAllPolicyFactory: any = {
  finance: () => ({ evaluator: ALLOW_CHAIN, policy: {} }),
};

export function makeCtx(userId: string): any {
  return { actor: { userId, source: 'API' }, source: 'API' };
}

/** Tek süreçlik komut veriyolu: kayıtlı gerçek handler'ı çağırır (taklit değil). */
export class LocalCommandBus {
  private readonly handlers = new Map<unknown, { execute(c: any): Promise<any> }>();

  register(commandClass: unknown, handler: { execute(c: any): Promise<any> }) {
    this.handlers.set(commandClass, handler);
  }

  execute(command: any): Promise<any> {
    const handler = this.handlers.get(command.constructor);
    if (!handler) {
      throw new Error(`Harness bu komutu bilmiyor: ${command.constructor.name}`);
    }
    return handler.execute(command);
  }
}

export interface FinanceDbHarness {
  commandBus: LocalCommandBus;
  prisma: PrismaService;
  txManager: TransactionManager;
  postHandler: PostFinancialEventHandler;
  journalRepo: JournalCommandRepository;
  periodRepo: AccountingPeriodCommandRepository;
  accountRepo: AccountCommandRepository;
  eventRepo: FinancialEventCommandRepository;
  close(): Promise<void>;
}

export interface LedgerFixture {
  organizationId: string;
  clinicId: string;
  periodId: string;
  partyId: string;
  supplierPartyId: string;
}

export async function createFinanceDbHarness(): Promise<FinanceDbHarness> {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) {
    throw new Error('E2E_DATABASE_URL yok — test:db globalSetup çalışmadı.');
  }

  const prisma = new PrismaService({ datasourceUrl: url });
  await prisma.$connect();

  const outboxRepo = new OutboxRepository(prisma);
  const criticalFailure = { publish: jest.fn() } as any;
  const txManager = new TransactionManager(
    prisma,
    new EventEmitter2(),
    outboxRepo,
    criticalFailure
  );

  const journalRepo = new JournalCommandRepository(prisma);
  const periodRepo = new AccountingPeriodCommandRepository(prisma);
  const accountRepo = new AccountCommandRepository(prisma);
  const eventRepo = new FinancialEventCommandRepository(prisma);

  const eventQueryRepo = new FinancialEventQueryRepository(prisma);
  const periodQueryRepo = new AccountingPeriodQueryRepository(prisma);
  const accountQueryRepo = new AccountQueryRepository(prisma);
  const settingsQueryRepo = new ClinicFinanceSettingsQueryRepository(prisma);

  // Politika katmanı atlanır; repository çağrıları ve dönüş şekilleri gerçektir.
  const queryBus = {
    execute: async (query: unknown) => {
      if (query instanceof GetFinancialEventByIdQuery) {
        return { data: await eventQueryRepo.findById(query.financialEventId) };
      }
      if (query instanceof FindPeriodByDateQuery) {
        return {
          data: await periodQueryRepo.findByDate(query.clinicId, query.date),
        };
      }
      if (query instanceof GetChartOfAccountsQuery) {
        return { data: await accountQueryRepo.findAllByClinicId(query.clinicId) };
      }
      if (query instanceof GetClinicCurrencyQuery) {
        const settings = await settingsQueryRepo.findByClinicId(query.clinicId);
        return { data: settings?.defaultCurrency ?? 'TRY' };
      }
      throw new Error(`Harness bu sorguyu bilmiyor: ${String(query)}`);
    },
  } as any;

  const registry = new PostingRuleRegistry([
    new PaymentReceivedRule(),
    new PaymentRefundedRule(),
    new SalesInvoiceIssuedRule(),
    new PurchaseInvoiceReceivedRule(),
    new PayrollAccruedRule(),
    new CashSessionClosedRule(),
    new PlatformBookingSettledRule(),
    new PlatformBookingRefundedRule(),
    new PlatformReturnableChargeReceivedRule(),
    new PlatformReturnableChargeRefundedRule(),
    new PaymentMadeRule(),
    new StockOutRule(),
    new StockInRule(),
    new ProviderSettlementReceivedRule(),
    new CardChargebackOpenedRule(),
    new CardChargebackWonRule(),
    new CardChargebackLostRule(),
  ] as any);

  const postHandler = new PostFinancialEventHandler(
    journalRepo,
    registry,
    { getRate: async () => '1' } as any,
    new JournalEntryNumberingService(periodRepo),
    queryBus,
    txManager
  );

  const commandBus = new LocalCommandBus();
  commandBus.register(
    RecordFinancialEventCommand,
    new RecordFinancialEventHandler(
      eventRepo,
      {
        // Kiracı kapsamı `clinicId`'den çözülür (üretimdeki sözleşme).
        resolve: async (input: { clinicId: string }) => {
          const clinic = await prisma.clinic.findUniqueOrThrow({
            where: { id: input.clinicId },
            select: { organizationId: true },
          });
          return clinic.organizationId;
        },
      } as any,
      allowAllPolicyFactory,
      txManager
    )
  );

  return {
    commandBus,
    prisma,
    txManager,
    postHandler,
    journalRepo,
    periodRepo,
    accountRepo,
    eventRepo,
    close: () => prisma.$disconnect(),
  };
}

/**
 * Bir kiracı + klinik + TDHP hesap planı + açık dönem + iki cari kurar.
 * Hesap planı üretimdeki yolla (`Account.buildChartFromTemplate`) kurulur — şablon
 * ile kuralların hesap kodları arasındaki sapma burada görünür.
 */
export async function seedLedger(
  harness: FinanceDbHarness,
  options: { year?: number } = {}
): Promise<LedgerFixture> {
  const { prisma } = harness;
  const year = options.year ?? new Date().getUTCFullYear();
  const suffix = UUID.generate().value.slice(0, 8);

  const organizationId = UUID.generate().value;
  const clinicId = UUID.generate().value;
  const sectorId = UUID.generate().value;

  await prisma.sector.create({
    data: { id: sectorId, slug: `dental-${suffix}`, name: 'DENTAL' },
  });
  await prisma.organization.create({
    data: { id: organizationId, name: `Org ${suffix}`, slug: `org-${suffix}` },
  });
  await prisma.clinic.create({
    data: {
      id: clinicId,
      organizationId,
      sectorId,
      name: `Klinik ${suffix}`,
      slug: `klinik-${suffix}`,
    },
  });

  await harness.accountRepo.createChart(
    Account.buildChartFromTemplate({ clinicId, organizationId })
  );

  const period = await harness.periodRepo.create(
    AccountingPeriod.create({
      clinicId,
      organizationId,
      year,
      actorId: 'db-e2e',
    })
  );

  const makeParty = async (name: string, role: 'PATIENT' | 'SUPPLIER') => {
    const id = UUID.generate().value;
    await prisma.party.create({
      data: {
        id,
        clinicId,
        organizationId,
        type: 'INDIVIDUAL',
        roles: [role],
        name,
        originType: 'EXTERNAL',
        originId: id,
      },
    });
    return id;
  };

  return {
    organizationId,
    clinicId,
    periodId: period.id.value,
    partyId: await makeParty('Hasta', 'PATIENT'),
    supplierPartyId: await makeParty('Tedarikçi', 'SUPPLIER'),
  };
}

export interface PostEventInput {
  ledger: LedgerFixture;
  type: FinancialEventType;
  payload: Record<string, unknown>;
  occurredAt?: Date;
  /** Verilmezse rastgele; tahsilat kanıtı gibi anahtarla aranan olaylar için. */
  dedupeKey?: string;
}

/** Olayı gerçek repository ile yazar ve gerçek handler ile fişler. Fiş id'sini döner. */
export async function recordAndPost(
  harness: FinanceDbHarness,
  input: PostEventInput
): Promise<{ eventId: string; entryId: string | null }> {
  const { ledger } = input;
  const event = FinancialEvent.record({
    clinicId: ledger.clinicId,
    organizationId: ledger.organizationId,
    type: input.type,
    occurredAt: input.occurredAt,
    payload: input.payload as InputJsonValue,
    sourceModule: 'db-e2e',
    sourceRefId: UUID.generate().value,
    dedupeKey: input.dedupeKey ?? `db-e2e:${UUID.generate().value}`,
  });

  const stored = await harness.eventRepo.appendIfAbsent(event);
  if (!stored) throw new Error('Olay yazılamadı (dedupe çakışması?).');

  const entryId = await harness.postHandler.execute(
    new PostFinancialEventCommand(stored.id.value, FAKE_CTX)
  );
  return { eventId: stored.id.value, entryId };
}

/** Fişin saklanan hâli: satırlar hesap kodu ile, ham SQL ile (hidrasyon yok). */
export async function readStoredEntry(
  harness: FinanceDbHarness,
  entryId: string
) {
  const entry = await harness.prisma.journalEntry.findUniqueOrThrow({
    where: { id: entryId },
    include: { lines: { include: { account: true } } },
  });
  return {
    status: entry.status,
    entryNo: entry.entryNo,
    lines: entry.lines.map((l) => ({
      code: l.account.code,
      debit: l.debit?.toString() ?? '0',
      credit: l.credit?.toString() ?? '0',
      partyId: l.partyId,
      currency: l.currency,
    })),
  };
}

/** Hesap bakiyesi (borç − alacak), saklanan satırlardan — kuruş cinsinden tam sayı toplamıyla. */
export async function ledgerBalance(
  harness: FinanceDbHarness,
  params: { clinicId: string; code: string }
): Promise<number> {
  const rows = await harness.prisma.journalLine.findMany({
    where: { account: { code: params.code, clinicId: params.clinicId } },
    select: { debit: true, credit: true },
  });
  const kurus = rows.reduce(
    (acc, r) =>
      acc +
      Math.round(Number(r.debit ?? 0) * 100) -
      Math.round(Number(r.credit ?? 0) * 100),
    0
  );
  return kurus / 100;
}
