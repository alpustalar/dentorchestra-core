import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { GenerateYearEndClosingCommand } from '@modules/finance/accounting/posting/application/commands/generate-year-end-closing/generate-year-end-closing.command';
import { ClosePeriodCommand } from './close-period.command';
import {
  PeriodAlreadyClosedException,
  PeriodNotFoundException,
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

@CommandHandler(ClosePeriodCommand)
export class ClosePeriodHandler implements ICommandHandler<
  ClosePeriodCommand,
  void
> {
  constructor(
    @Inject(ACCOUNTING_PERIOD_COMMAND_REPOSITORY)
    private readonly accountingPeriodRepo: IAccountingPeriodCommandRepository,
    private readonly commandBus: TSCommandBus,
    private readonly txManager: TransactionManager,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(FINANCIAL_EVENT_POSTING_COMPLETENESS_SERVICE)
    private readonly postingCompleteness: IFinancialEventPostingCompletenessService
  ) {}

  async execute(command: ClosePeriodCommand): Promise<void> {
    const period = await this.accountingPeriodRepo.findById(command.periodId);
    if (!period) throw new PeriodNotFoundException();

    // `periodId` URL'den geliyor; kapsam kaydın KENDİ kliniğinden doğrulanır.
    // Kontrol yokken, dönem kapatma yetkisi olan herhangi bir personel başka bir
    // kliniğin mali yılını kapatıp kapanış fişlerini defterine yazdırabiliyordu
    // (lock/reopen'da kontrol vardı, close'da yoktu).
    this.policyFactory
      .finance(command.ctx.actor, command.ctx.source)
      .evaluator.check((p) =>
        p.actorCanManageTargetClinic(period.clinicId.value)
      )
      .orThrow(ACCOUNTING_EVENTS.PERIOD_CLOSE);

    // Transaction dışı hızlı-ret (belirgin kapalı dönemler için); kesin/otoriter
    // koruma aşağıdaki atomik claimForClosing'dir.
    period.validate.isOpenOrLocked.orThrow();

    period.close({
      actorId: command.ctx.actor.userId,
      source: command.ctx.actor.source,
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

      // 2) Ön koşul (doc 04 §5 adım 1): fişlenmemiş ekonomik olay kalmamalı.
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

      // 3) Kapanış fişleri: aynı transaction'a (ALS join) katılarak atılır.
      await this.commandBus.execute(
        new GenerateYearEndClosingCommand(
          {
            clinicId: period.clinicId.value,
            organizationId: period.organizationId.value,
            periodId: period.id.value,
            dateFrom: period.startsAt,
            dateTo: period.endsAt,
            entryDate: period.endsAt,
            performedById: command.ctx.actor.userId,
          },
          command.ctx
        )
      );
    });
  }
}
