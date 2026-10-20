import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetClinicFinanceSettingsQuery } from '@modules/organization/clinic/application/queries/get-clinic-finance-settings/get-clinic-finance-settings.query';
import { GenerateYearEndClosingCommand } from '@modules/finance/accounting/posting/application/commands/generate-year-end-closing/generate-year-end-closing.command';
import { ClosePeriodCommand } from './close-period.command';
import { AccountingPeriod } from '@modules/finance/accounting/periods/domain/entities/accounting-period.entity';
import {
  ClosingNextPeriodUnavailableException,
  ClosingPreviewStaleException,
  PeriodAlreadyClosedException,
  PeriodNotFoundException,
  PreviousPeriodNotClosedException,
} from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';
import {
  ACCOUNTING_PERIOD_COMMAND_REPOSITORY,
  IAccountingPeriodCommandRepository,
} from '@modules/finance/accounting/periods/domain/repositories/accounting-period/accounting-period.command.repository';
import {
  FINANCIAL_EVENT_POSTING_COMPLETENESS_SERVICE,
  IFinancialEventPostingCompletenessService,
} from '@modules/finance/accounting/financial-events/domain/services/posting-completeness/posting-completeness.service.interface';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';
import { POSTABLE_FINANCIAL_EVENT_TYPES } from '@modules/finance/accounting/posting/domain/posting/postable-event-types.constant';
import { AccountingPeriodStatusSchema } from '@shared';

@CommandHandler(ClosePeriodCommand)
export class ClosePeriodHandler implements ICommandHandler<
  ClosePeriodCommand,
  void
> {
  constructor(
    @Inject(ACCOUNTING_PERIOD_COMMAND_REPOSITORY)
    private readonly accountingPeriodRepo: IAccountingPeriodCommandRepository,
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus,
    private readonly txManager: TransactionManager,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(FINANCIAL_EVENT_POSTING_COMPLETENESS_SERVICE)
    private readonly postingCompleteness: IFinancialEventPostingCompletenessService
  ) {}

  async execute(command: ClosePeriodCommand): Promise<void> {
    const { periodId, data, ctx } = command.payload;

    const period = await this.accountingPeriodRepo.findById(periodId);
    if (!period) throw new PeriodNotFoundException();

    // `periodId` URL'den geliyor; kapsam kaydın KENDİ kliniğinden doğrulanır.
    // Kontrol yokken, dönem kapatma yetkisi olan herhangi bir personel başka bir
    // kliniğin mali yılını kapatıp kapanış fişlerini defterine yazdırabiliyordu
    // (lock/reopen'da kontrol vardı, close'da yoktu).
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) =>
        p.actorCanManageTargetClinic(period.clinicId.value)
      )
      .orThrow(ACCOUNTING_EVENTS.PERIOD_CLOSE);

    // Transaction dışı hızlı-ret (belirgin kapalı dönemler için); kesin/otoriter
    // koruma aşağıdaki atomik claimForClosing'dir.
    period.validate.isOpenOrLocked.orThrow();

    // Sıra kapısı: yıllar sırayla kapanır. CLOSED terminal bir durum olduğu için (reopen yalnız
    // LOCKED'ı açar) bu okuma tx dışında da yarışsızdır: kapalı görünen dönem kapalı kalır.
    await this.assertPreviousYearsClosed(period);

    // İşletme biçimi (kullanıcı seçer) devir hedefini belirler. Kapanış sırasında DEĞİŞMEZ: biçim
    // yalnız kapanmış yılı olmayan klinikte değişebilir ve bu dönem claim'den sonra CLOSED olur.
    const { data: financeSettings } = await this.queryBus.execute(
      new GetClinicFinanceSettingsQuery(period.clinicId.value)
    );
    const businessType = financeSettings?.businessType ?? null;

    // Ertesi yıl, ertesi yıla yazılan fiş varsa gerekir: GRNI ters kaydı (tahakkuk seçildiyse) ve
    // öz kaynak devri (işletme biçimi seçiliyse). Dönem var ve OPEN olmak zorunda; kapı fiilî tahsis
    // (`lockAndAllocateEntryNo`) ayrıca doğrular.
    const nextPeriod =
      data.grniAccruals.length > 0 || businessType !== null
        ? await this.requireOpenNextPeriod(period)
        : null;

    period.close({
      actorId: ctx.actor.userId,
      source: ctx.actor.source,
    });

    await this.txManager.outboxRun(async () => {
      // 1) Atomik sahiplenme: OPEN/LOCKED → CLOSED tek koşullu UPDATE ile. Eşzamanlı
      // ikinci istek satır kilidinde bekler, commit sonrası CLOSED görüp 0 satır
      // etkiler → false döner ve mükerrer kapanış fişi üretmeden reddedilir.
      // Satır kilidi aynı zamanda yevmiye numarası tahsisini (dolayısıyla yeni fiş
      // atmayı) bekletir: bu noktadan sonra mizanı değiştirecek fiş giremez.
      const claimed = await this.accountingPeriodRepo.claimForClosing(period);
      if (!claimed) {
        throw new PeriodAlreadyClosedException(period.id.value, period.year);
      }

      // 2) Önizleme taze mi? Sayaç kilit ALTINDA okunur (claim'den sonra, aynı tx): bu noktadan
      // sonra dönem OPEN olmadığı için sayaç ilerleyemez. Muhasebeci önizlemede görmediği
      // tutarlarla kapatmaz; hata durumunda transaction geri sarılır ve dönem kapanmaz.
      await this.assertPreviewIsFresh({
        periodId: period.id.value,
        expectedLastEntryNo: data.expectedLastEntryNo,
      });

      // 3) Ön koşul (doc 04 §5 adım 1): fişlenmemiş ekonomik olay kalmamalı.
      // Kapanıştan sonra o olaylar bir daha fişlenemez → mizan kalıcı eksik kalırdı.
      // Kilidi aldıktan SONRA sayılır ki araya giren bir fiş ıskalanmasın;
      // hata durumunda transaction geri sarılır ve dönem kapanmaz.
      await this.postingCompleteness.assertAllPostedInRange({
        clinicId: period.clinicId.value,
        from: period.startsAt,
        to: period.endsAt,
        // Kapsam: yalnız fiş üretimi beklenen tipler. Kuralı olmayan bir olay tipi
        // (STOCK_IN, MANUAL_JOURNAL) hiç fişlenmeyeceği için kapsama alınırsa mali
        // yıl kapanışı sonsuza kadar bloke olurdu.
        types: POSTABLE_FINANCIAL_EVENT_TYPES,
      });

      // 4) Kapanış fişleri: aynı transaction'a (ALS join) katılarak atılır.
      await this.commandBus.execute(
        new GenerateYearEndClosingCommand(
          {
            clinicId: period.clinicId.value,
            organizationId: period.organizationId.value,
            periodId: period.id.value,
            dateFrom: period.startsAt,
            dateTo: period.endsAt,
            entryDate: period.endsAt,
            performedById: ctx.actor.userId,
            nextPeriod: nextPeriod
              ? { id: nextPeriod.id.value, startsAt: nextPeriod.startsAt }
              : null,
            grniAccruals: data.grniAccruals,
            businessType,
          },
          ctx
        )
      );
    });
  }

  private async assertPreviousYearsClosed(
    period: AccountingPeriod
  ): Promise<void> {
    const [oldestOpen] = await this.accountingPeriodRepo.findNotClosedBefore(
      period.clinicId.value,
      period.year
    );
    if (oldestOpen) {
      throw new PreviousPeriodNotClosedException({
        periodId: period.id.value,
        year: period.year,
        blockingYear: oldestOpen.year,
      });
    }
  }

  private async requireOpenNextPeriod(
    period: AccountingPeriod
  ): Promise<AccountingPeriod> {
    const nextYear = period.year + 1;
    const next = await this.accountingPeriodRepo.findByYear(
      period.clinicId.value,
      nextYear
    );

    if (!next) {
      throw new ClosingNextPeriodUnavailableException({
        periodId: period.id.value,
        nextYear,
        reason: 'MISSING',
      });
    }
    if (next.status !== AccountingPeriodStatusSchema.enum.OPEN) {
      throw new ClosingNextPeriodUnavailableException({
        periodId: period.id.value,
        nextYear,
        reason: 'NOT_OPEN',
      });
    }
    return next;
  }

  private async assertPreviewIsFresh(props: {
    periodId: string;
    expectedLastEntryNo: string;
  }): Promise<void> {
    const locked = await this.accountingPeriodRepo.findById(props.periodId);
    if (!locked) throw new PeriodNotFoundException();

    const actual = locked.lastEntryNo.toString();
    if (actual !== props.expectedLastEntryNo) {
      throw new ClosingPreviewStaleException({
        periodId: props.periodId,
        expectedLastEntryNo: props.expectedLastEntryNo,
        actualLastEntryNo: actual,
      });
    }
  }
}
