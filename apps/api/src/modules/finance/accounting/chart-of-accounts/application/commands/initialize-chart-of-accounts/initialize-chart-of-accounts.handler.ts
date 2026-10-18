import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { Account } from '@modules/finance/accounting/chart-of-accounts/domain/entities/account.entity';
import { InitializeChartOfAccountsCommand } from './initialize-chart-of-accounts.command';
import {
  ACCOUNT_COMMAND_REPOSITORY,
  IAccountCommandRepository,
} from '@modules/finance/accounting/chart-of-accounts/domain/repositories/account/account.command.repository';
import { TENANT_SCOPE_RESOLVER } from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import { ITenantScopeResolver } from '@shared';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  CHART_OF_ACCOUNTS_EVENT_PUBLISHER,
  IChartOfAccountsEventPublisher,
} from '@modules/finance/accounting/chart-of-accounts/domain/interfaces/chart-of-accounts-event-publisher.interface';
import { LogAction, LogType } from '@src/domain/constants/log-action.constant';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';

/**
 * Bir clinic (şube/defter) için klinik TDHP hesap planını kurar.
 *
 * Idempotent ama "hepsi ya da hiçbiri" DEĞİL: şablondaki hesaplardan şubede
 * bulunmayanlar eklenir.
 */

@CommandHandler(InitializeChartOfAccountsCommand)
export class InitializeChartOfAccountsHandler implements ICommandHandler<
  InitializeChartOfAccountsCommand,
  void
> {
  constructor(
    @Inject(ACCOUNT_COMMAND_REPOSITORY)
    private readonly accountRepo: IAccountCommandRepository,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(CHART_OF_ACCOUNTS_EVENT_PUBLISHER)
    private readonly eventPublisher: IChartOfAccountsEventPublisher,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: InitializeChartOfAccountsCommand): Promise<void> {
    const { clinicId, ctx } = command.payload;

    // Hesap planı kurulumu klinik-seviye bir yapılandırma; `clinicId` istekten
    // geldiği için kapsam burada doğrulanır.
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.actorCanManageTargetClinic(clinicId))
      .orThrow(ACCOUNTING_EVENTS.CHART_OF_ACCOUNTS_INITIALIZE);

    const organizationId = await this.tenantScopeResolver.resolve(
      command.payload
    );

    await this.txManager.run(async () => {
      const existingIdByCode = await this.accountRepo.findIdByCodeMap(clinicId);

      // Mevcut hesaplar kimliklerini korur; yalnız eksikler yeni id alır. Böylece
      // sonradan eklenen bir alt hesap, üst hesabın DB'deki gerçek id'sine bağlanır.
      const chart = Account.buildChartFromTemplate({
        clinicId,
        organizationId,
        existingIdByCode,
      });

      const missing = chart.filter(
        (account) => !(account.code.value in existingIdByCode)
      );
      if (missing.length === 0) return;

      await this.accountRepo.createChart(missing);


      // Toplu işlem: 65 entity olayı yerine tek bir denetim olayı.
      this.eventPublisher.initialized({
        clinicId,
        organizationId,
        createdCount: missing.length,
        createdCodes: missing.map((account) => account.code.value),
        actorId: ctx.actor.userId,
        source: ctx.actor.source,
        action: LogAction.CHART_OF_ACCOUNTS_INITIALIZED,
        type: LogType.INFO,
        details: `Hesap planına ${missing.length} hesap eklendi (${clinicId}).`,
      });
    });
  }
}
