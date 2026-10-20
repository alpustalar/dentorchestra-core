import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetChartOfAccountsQuery } from '@modules/finance/accounting/chart-of-accounts/application/queries/get-chart-of-accounts/get-chart-of-accounts.query';
import { GetClinicCurrencyQuery } from '@modules/organization/clinic/application/queries/get-clinic-currency/get-clinic-currency.query';
import { GetGrniAccrualCandidatesQuery } from '@modules/supply/purchasing/application/queries/get-grni-accrual-candidates/get-grni-accrual-candidates.query';
import {
  IJournalCommandRepository,
  JOURNAL_COMMAND_REPOSITORY,
} from '@modules/finance/accounting/posting/domain/repositories/journal.repository';
import { AccountResolver } from '@modules/finance/accounting/posting/domain/posting/account-resolver';
import { GenerateYearEndClosingCommand } from './generate-year-end-closing.command';
import { YearEndClosingService } from '@modules/finance/accounting/posting/domain/services/year-and-closing.service';
import {
  ClosingAccrual,
  YearEndClosingPlan,
  collectPlanAccountCodes,
  planYearEndClosing,
} from '@modules/finance/accounting/posting/domain/closing/year-end-closing.planner';
import { resolveGrniAccruals } from '@modules/finance/accounting/posting/domain/closing/grni-accrual-selection.resolver';
import { ClosingAccountsMissingException } from '@modules/finance/accounting/posting/domain/exceptions/year-end-closing.exceptions';
import {
  IJournalEntryNumberingService,
  JOURNAL_ENTRY_NUMBERING_SERVICE,
} from '@modules/finance/accounting/periods/domain/services/entry-numbering/journal-entry-numbering.service.interface';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';
import { Account } from '@shared';

@CommandHandler(GenerateYearEndClosingCommand)
export class GenerateYearEndClosingHandler implements ICommandHandler<
  GenerateYearEndClosingCommand,
  void
> {
  constructor(
    @Inject(JOURNAL_COMMAND_REPOSITORY)
    private readonly journalCommandRepo: IJournalCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(JOURNAL_ENTRY_NUMBERING_SERVICE)
    private readonly entryNumbering: IJournalEntryNumberingService,
    private readonly queryBus: TSQueryBus,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: GenerateYearEndClosingCommand): Promise<void> {
    const { input, ctx } = command;

    // Yetki burada da doğrulanır. Komut bugün yalnız `close-period` içinden
    // çağrılıyor (o da PERIOD_CLOSE yetkisini kontrol ediyor) ama komut bus'a
    // kayıtlı: "çağıran zaten kontrol ediyor" varsayımı derleyiciye görünmez ve
    // ileride bir controller/başka bir handler bu komutu yetkisiz dispatch
    // edebilir. Kapsam, isteğin alanından değil kapanan defterin kliniğinden
    // doğrulanır. (Sistem aktörleri `PolicyEvaluator` içinde muaftır.)
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.actorCanManageTargetClinic(input.clinicId))
      .orThrow(ACCOUNTING_EVENTS.YEAR_END_CLOSING);

    const { data: accounts } = await this.queryBus.execute(
      new GetChartOfAccountsQuery(input.clinicId, ctx)
    );
    const resolver = new AccountResolver(accounts);

    const accruals = await this.resolveAccruals(command);

    // Mizan okuması kapanış fişinin tutarlarını üretir → fişlerle aynı transaction
    // içinde, Command Repo'dan okunur (aradaki yeni fişler ıskalanmasın).
    await this.txManager.outboxRun(async () => {
      const rows = await this.journalCommandRepo.trialBalance({
        clinicId: input.clinicId,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
      });

      const plan = planYearEndClosing({
        balances: YearEndClosingService.toClosingBalances({
          trialBalanceRows: rows,
          accounts,
        }),
        periodEndsAt: input.entryDate,
        nextPeriodStartsAt: input.nextPeriod?.startsAt ?? null,
        accruals,
        businessType: input.businessType,
      });

      if (plan.steps.length === 0) return;

      this.assertPlanAccountsExist({
        clinicId: input.clinicId,
        plan,
        accounts,
      });

      const drafts = YearEndClosingService.buildEntries({
        clinicId: input.clinicId,
        organizationId: input.organizationId,
        performedById: input.performedById,
        closingPeriodId: input.periodId,
        nextPeriodId: input.nextPeriod?.id ?? null,
        plan,
        resolver,
      });

      // Kilitler eski yıldan yeniye alınır (önce kapanan yıl, sonra ertesi yıl): kapanış
      // adımları sırayla yazıldığı ve ters kayıt EN SON olduğu için sıra kendiliğinden böyledir.
      for (const { period, entry } of drafts) {
        const entryNo =
          period === 'NEXT_PERIOD'
            ? // Ertesi yılın normal akışı: dönem OPEN olmak ZORUNDA (kapıdır).
              await this.entryNumbering.lockAndAllocateEntryNo(
                input.nextPeriod!.id
              )
            : // Kapanış varyantı: dönem bu transaction içinde zaten CLOSED'a alındı
              // (ve satır kilidi bizde), o yüzden `status='OPEN'` koşulu aranmaz.
              await this.entryNumbering.lockAndAllocateClosingEntryNo(
                input.periodId
              );

        entry.post(entryNo);
        await this.journalCommandRepo.create(entry);
      }
    });
  }

  /**
   * Seçimi, sunucunun `asOf` = dönem sonu için hesapladığı aday listesine bağlar. Aday
   * hesabı mal kabul günlüğünden ve fatura tarihlerinden gelir; istemciden tutar alınmaz.
   * Seçim yoksa satın alma modülüne hiç gidilmez.
   */
  private async resolveAccruals(
    command: GenerateYearEndClosingCommand
  ): Promise<ClosingAccrual[]> {
    const { input, ctx } = command;
    if (input.grniAccruals.length === 0) return [];

    const { data: functionalCurrency } = await this.queryBus.execute(
      new GetClinicCurrencyQuery(input.clinicId)
    );
    const { data: report } = await this.queryBus.execute(
      new GetGrniAccrualCandidatesQuery({
        clinicId: input.clinicId,
        asOf: input.dateTo,
        functionalCurrency,
        ctx,
      })
    );

    return resolveGrniAccruals({
      candidates: report.candidates,
      selections: input.grniAccruals,
    });
  }

  /**
   * Planın yazacağı hesapların TAMAMI hesap planında olmalı. Şablon sonradan genişleyince
   * (622/631/632) mevcut kliniklerde bu hesaplar yoktur; kapanış tek transaction'dır, ortada
   * `AccountCodeNotFound` ile patlarsa her şey geri alınır ama muhasebeci yalnız İLK eksiği
   * görürdü. Eksiklerin tamamı baştan listelenir (çözüm: hesap planı kurulumunu yeniden çalıştır).
   */
  private assertPlanAccountsExist(props: {
    clinicId: string;
    plan: YearEndClosingPlan;
    accounts: Account[];
  }): void {
    const existing = new Set(props.accounts.map((account) => account.code));
    const missingCodes = collectPlanAccountCodes(props.plan).filter(
      (code) => !existing.has(code)
    );

    if (missingCodes.length > 0) {
      throw new ClosingAccountsMissingException({
        clinicId: props.clinicId,
        missingCodes,
      });
    }
  }
}
