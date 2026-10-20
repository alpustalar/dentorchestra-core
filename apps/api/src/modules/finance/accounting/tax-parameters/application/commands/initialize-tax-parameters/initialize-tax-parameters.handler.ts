import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TaxParameter } from '@modules/finance/accounting/tax-parameters/domain/entities/tax-parameter.entity';
import { TAX_PARAMETER_DEFAULTS } from '@modules/finance/accounting/tax-parameters/domain/constants/tax-parameter-defaults';
import { InitializeTaxParametersCommand } from './initialize-tax-parameters.command';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  ITaxParameterCommandRepository,
  TAX_PARAMETER_COMMAND_REPOSITORY,
} from '@modules/finance/accounting/tax-parameters/domain/repositories/tax-parameter/tax-parameter.command.repository';
import { TENANT_SCOPE_RESOLVER } from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import { ITenantScopeResolver } from '@shared';

/**
 * Şube açılışında varsayılan vergi oranlarını kurar. İdempotent: parametre
 * zaten varsa hiçbir şey yapmaz (register-clinic saga'sından çağrılır).
 */
@CommandHandler(InitializeTaxParametersCommand)
export class InitializeTaxParametersHandler
  implements ICommandHandler<InitializeTaxParametersCommand, void>
{
  constructor(
    @Inject(TAX_PARAMETER_COMMAND_REPOSITORY)
    private readonly taxParameterRepo: ITaxParameterCommandRepository,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: InitializeTaxParametersCommand): Promise<void> {
    const { clinicId } = command.payload;

    const organizationId = await this.tenantScopeResolver.resolve(
      command.payload
    );
    await this.txManager.run(async () => {
      // İdempotentlik kontrolü seed yazmasını belirlediği için aynı tx içinde,
      // Command Repo'dan okunur (replica gecikmesi mükerrer seed'e yol açardı).
      const alreadyInitialized =
        await this.taxParameterRepo.existsForClinic(clinicId);
      if (alreadyInitialized) return;

      const validFrom = DateTimeManager.create();
      const parameters = TAX_PARAMETER_DEFAULTS.map((def) =>
        TaxParameter.create({
          clinicId,
          organizationId,
          key: def.key,
          rate: def.rate,
          validFrom,
        })
      );

      await this.taxParameterRepo.createMany(parameters);
    });
  }
}
