import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { JournalEntryUniqueConstraintException } from '@modules/finance/accounting/posting/domain/exceptions/journal-entry.exceptions';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetFinancialEventByIdQuery } from '@modules/finance/accounting/financial-events/application/queries/get-financial-event-by-id/get-financial-event-by-id.query';
import { FindPeriodByDateQuery } from '@modules/finance/accounting/periods/application/queries/find-period-by-date/find-period-by-date.query';
import { GetChartOfAccountsQuery } from '@modules/finance/accounting/chart-of-accounts/application/queries/get-chart-of-accounts/get-chart-of-accounts.query';
import { GetClinicCurrencyQuery } from '@modules/organization/clinic/application/queries/get-clinic-currency/get-clinic-currency.query';
import {
  FX_RATE_PROVIDER,
  IFxRateProvider,
} from '@src/infrastructure/payment/links/fx-rate.port';
import {
  IJournalCommandRepository,
  JOURNAL_COMMAND_REPOSITORY,
} from '@modules/finance/accounting/posting/domain/repositories/journal.repository';
import {
  IJournalEntryNumberingService,
  JOURNAL_ENTRY_NUMBERING_SERVICE,
} from '@modules/finance/accounting/periods/domain/services/entry-numbering/journal-entry-numbering.service.interface';
import { JournalEntry } from '@modules/finance/accounting/posting/domain/entities/journal-entry.entity';
import { AccountResolver } from '@modules/finance/accounting/posting/domain/posting/account-resolver';
import { FxConversion } from '@modules/finance/accounting/posting/domain/posting/fx-conversion';
import { PostingRuleRegistry } from '@modules/finance/accounting/posting/domain/posting/posting-rule.registry';
import { PostFinancialEventCommand } from './post-financial-event.command';
import { CreateJournalEntryLineProps } from '@modules/finance/accounting/posting/domain/contracts/journal-line';
import { isPeriodPostable } from '@modules/finance/accounting/periods/domain/rules/postable-period-statuses.constant';
import {
  ConflictingFxBasisException,
  NoAccountingPeriodForDateException,
  FinancialEventNotFoundForPostingException,
  PartyRequiredForAccountException,
  PeriodNotOpenForPostingException,
  UnbalancedJournalEntryException,
} from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';

@CommandHandler(PostFinancialEventCommand)
export class PostFinancialEventHandler implements ICommandHandler<
  PostFinancialEventCommand,
  string | null
> {
  private readonly logger = new Logger(PostFinancialEventHandler.name);

  constructor(
    @Inject(JOURNAL_COMMAND_REPOSITORY)
    private readonly journalCommandRepo: IJournalCommandRepository,
    private readonly registry: PostingRuleRegistry,
    @Inject(FX_RATE_PROVIDER)
    private readonly fxRateProvider: IFxRateProvider,
    @Inject(JOURNAL_ENTRY_NUMBERING_SERVICE)
    private readonly entryNumbering: IJournalEntryNumberingService,
    private readonly queryBus: TSQueryBus,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: PostFinancialEventCommand): Promise<string | null> {
    const { financialEventId, ctx } = command;

    const { data: event } = await this.queryBus.execute(
      new GetFinancialEventByIdQuery(financialEventId, ctx)
    );
    if (!event) {
      // Sessizce atlamak, "ekonomik olay var ama fişi yok" durumunu kalıcı ve
      // görünmez kılardı. Hata, dinleyicideki CRITICAL uyarısını tetikler.
      throw new FinancialEventNotFoundForPostingException(financialEventId);
    }

    // İdempotentlik: olay zaten fişlenmişse mevcut fişi döndür.
    const existing = await this.journalCommandRepo.findByEventId(event.id);
    if (existing) return existing.id;

    const rule = this.registry.get(event.type);
    if (!rule) {
      this.logger.log(`Posting kuralı yok, atlandı: ${event.type}`);
      return null;
    }

    // Bu okuma yalnız "fiş hangi döneme düşüyor" sorusunu yanıtlar ve **hızlı-ret**
    // sağlar; dönem kapısının otoriter kontrolü değildir. Kesin kapı, fişin
    // yazıldığı transaction içindeki `lockAndAllocateEntryNo` (status='OPEN'
    // koşullu, satır kilitli) çağrısıdır — arada dönem kapanırsa orada reddedilir.
    const { data: period } = await this.queryBus.execute(
      new FindPeriodByDateQuery(event.clinicId, event.occurredAt, ctx)
    );
    if (!period) {
      throw new NoAccountingPeriodForDateException(event.occurredAt);
    }
    // Kabul kümesi tek sabitten: belge tarihini alan yazma kapısı
    // (`PERIOD_GATE_SERVICE`) ile burası aynı listeyi görmek zorunda, aksi halde
    // yazılabilen ama fişlenemeyen belge üretilir (CLAUDE.md finans kuralı 12).
    if (!isPeriodPostable(period.status)) {
      throw new PeriodNotOpenForPostingException(period.year, period.status);
    }

    const { data: accounts } = await this.queryBus.execute(
      new GetChartOfAccountsQuery(event.clinicId, ctx)
    );
    const resolver = new AccountResolver(accounts);

    const draft = rule.build(event);

    // Model A — defter tek fonksiyonel para biriminde tutulur. İşlem yabancı para
    // ise posting anında çevrilir: debit/credit fonksiyonel olur, orijinal tutar +
    // kur (original*/fxRate) izlenebilirlik için saklanır.
    const { data: functionalCurrency } = await this.queryBus.execute(
      new GetClinicCurrencyQuery(event.clinicId)
    );
    const txCurrency = draft.currency ?? functionalCurrency;
    const fxRate =
      txCurrency === functionalCurrency
        ? null
        : new Decimal(
            // İşlem tarihindeki kur (VUK/TCMB döviz alış) — anlık kur değil.
            await this.fxRateProvider.getRate(
              txCurrency,
              functionalCurrency,
              event.occurredAt
            )
          );

    const lines: CreateJournalEntryLineProps[] = draft.lines.map((line) => {
      // Hesabın kendi kuralları (var / aktif / yaprak) `resolve` içinde zorlanır;
      // burada yalnız satıra bağlı kural kalır.
      const account = resolver.resolve(line.accountCode);

      if (account.requiresParty && !line.partyId) {
        throw new PartyRequiredForAccountException(account.code);
      }

      // Tutar çevrimi saf domain'de; handler yalnızca kuru çözüp orchestrate eder.
      const converted = FxConversion.convertLine({
        debit: line.debit,
        credit: line.credit,
        txCurrency,
        functionalCurrency,
        rate: fxRate,
      });

      // Satırın kendi yabancı para temeli: gövde fonksiyonel parada yazılmışken
      // o satırın altındaki yükümlülük yabancı paraysa (rezervasyon tahsilatında
      // para TRY girer ama 320 sağlayıcıya EUR borçtur) kural kilitli kuru
      // satıra iliştirir. Fiş-seviyesi çevrimle birlikte olamaz: aynı kolonları
      // iki kaynak yazardı ve hangi kurun geçerli olduğu belirsizleşirdi.
      if (fxRate && line.originalCurrency) {
        throw new ConflictingFxBasisException({
          accountCode: line.accountCode,
          entryCurrency: txCurrency,
          lineOriginalCurrency: line.originalCurrency,
        });
      }

      const lineBasis = line.originalCurrency
        ? {
            originalDebit: line.originalDebit ?? null,
            originalCredit: line.originalCredit ?? null,
            originalCurrency: line.originalCurrency,
            fxRate: line.fxRate ?? null,
          }
        : {};

      return {
        accountId: account.id,
        partyId: line.partyId,
        lineDesc: line.desc,
        ...converted,
        ...lineBasis,
      };
    });

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);
    for (const line of lines) {
      totalDebit = totalDebit.plus(new Decimal(line.debit?.toString() ?? '0'));
      totalCredit = totalCredit.plus(
        new Decimal(line.credit?.toString() ?? '0')
      );
    }

    // Yabancı para çevriminde satır-başı yuvarlama artığını Kambiyo farkına yaz
    // (646 Kâr / 656 Zarar) ki çift taraflı denge korunsun.
    if (fxRate) {
      const balance = FxConversion.roundingBalance(totalDebit, totalCredit);
      if (balance) {
        // Denkleştirme YALNIZ yuvarlama artığını kapatabilir. Satır başına
        // yuvarlama hatası en fazla yarım kuruş olduğundan artık kuruş cinsinden
        // satır sayısını aşamaz. Sınır konmazsa: kaynak olayın kendisi dengesiz
        // geldiğinde (ör. komisyon dağılımı hatalı) fark ne kadar büyük olursa
        // olsun Kambiyo hesabına yazılıyor ve aşağıdaki denge kontrolü hiç
        // devreye girmiyordu — dengesiz fiş sessizce "kur farkı" diye defterlenirdi.
        const maxRoundingResidue = new Decimal(lines.length).mul('0.01');
        if (balance.amount.greaterThan(maxRoundingResidue)) {
          throw new UnbalancedJournalEntryException(
            totalDebit.toString(),
            totalCredit.toString()
          );
        }

        const isGain = balance.side === 'CREDIT';
        const kambiyo = resolver.resolve(isGain ? '646' : '656');
        lines.push({
          accountId: kambiyo.id,
          partyId: null,
          currency: functionalCurrency,
          debit: isGain ? undefined : balance.amount,
          credit: isGain ? balance.amount : undefined,
          lineDesc: 'Kambiyo kur farkı (çevrim yuvarlaması)',
        });
        if (isGain) totalCredit = totalCredit.plus(balance.amount);
        else totalDebit = totalDebit.plus(balance.amount);
      }
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new UnbalancedJournalEntryException(
        totalDebit.toString(),
        totalCredit.toString()
      );
    }

    const entry = JournalEntry.createDraft({
      organizationId: event.organizationId,
      clinicId: event.clinicId,
      periodId: period.id,
      entryDate: draft.date,
      description: draft.description,
      eventId: event.id,
      performedById: event.performedById,
      lines,
    });

    // Numara tahsisi ve fiş yazımı **tek** transaction: numara dönem satırındaki
    // sayaçtan kilit altında alınır, böylece
    //   (a) iki eşzamanlı fiş aynı numarayı alamaz,
    //   (b) numara ayrı commit edilip kayıp (boşluk) bırakmaz,
    //   (c) satır kilidi eşzamanlı dönem kapanışıyla serileşir → kapanmış döneme
    //       fiş sızmaz (tahsis `status='OPEN'` koşuluyla 0 satır döner ve reddedilir).
    try {
      return await this.txManager.outboxRun(async () => {
        const entryNo = await this.entryNumbering.lockAndAllocateEntryNo(
          period.id
        );
        entry.post(entryNo);
        const saved = await this.journalCommandRepo.create(entry);
        return saved.id;
      });
    } catch (error) {
      // Eşzamanlı posting aynı olay için fiş üretmiş olabilir (event_id unique).
      if (error instanceof JournalEntryUniqueConstraintException) {
        const raced = await this.journalCommandRepo.findByEventId(event.id);
        if (raced) return raced.id;
      }
      throw error;
    }
  }
}
