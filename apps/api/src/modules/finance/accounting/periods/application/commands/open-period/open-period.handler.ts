import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { AccountingPeriod } from '@modules/finance/accounting/periods/domain/entities/accounting-period.entity';
import { OpenPeriodCommand } from './open-period.command';
import { PeriodAlreadyExistsException } from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';
import {
  ITenantScopeResolver,
  TENANT_SCOPE_RESOLVER,
} from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import {
  ACCOUNTING_PERIOD_COMMAND_REPOSITORY,
  IAccountingPeriodCommandRepository,
} from '@modules/finance/accounting/periods/domain/repositories/accounting-period/accounting-period.command.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';

/**
 * Bir clinic (defter) için ilgili yılın muhasebe dönemini açar.
 * Aynı yıl için ikinci dönem açılamaz (clinicId+year unique).
 */
@CommandHandler(OpenPeriodCommand)
export class OpenPeriodHandler implements ICommandHandler<
  OpenPeriodCommand,
  string
> {
  constructor(
    @Inject(ACCOUNTING_PERIOD_COMMAND_REPOSITORY)
    private readonly accountingPeriodRepo: IAccountingPeriodCommandRepository,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    private readonly txManager: TransactionManager,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(command: OpenPeriodCommand): Promise<string> {
    const { clinicId, year, ctx } = command.payload;

    // `clinicId` istek parametresinden geliyor, aktörün kliniğinden değil:
    // kontrol olmadan başka kliniğin muhasebe dönemi açılabilirdi.
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.actorCanManageTargetClinic(clinicId))
      .orThrow(ACCOUNTING_EVENTS.PERIOD_OPEN);

    const organizationId = await this.tenantScopeResolver.resolve({
      clinicId,
    });

    const period = AccountingPeriod.create({
      clinicId,
      organizationId,
      year,
      actorId: ctx.actor.userId,
      source: ctx.actor.source,
    });

    await this.txManager.run(async () => {
      // "Zaten var mı" kararı yazmayla aynı transaction içinde ve command repo'dan;
      // nihai güvence `clinicId_year` unique kısıtı (repo P2002'yi tipli hataya çevirir).
      const existing = await this.accountingPeriodRepo.findByYear(
        clinicId,
        year
      );
      if (existing) throw new PeriodAlreadyExistsException(year);

      await this.accountingPeriodRepo.create(period);
    });

    return period.id.value;
  }
}
