import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { RegisterUserOrProviderAccount } from '@shared';
import { RegisterClinicAccountCommand } from './register-clinic-account.command';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { ROLE_SLUGS } from '@src/domain/constants/db/role/role-slugs';
import { RegisterClinicAccountResponse } from '@modules/identity/auth/registration/application/commands/register-clinic-account/register-clinic-account.response';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';
import { GetRoleBySlugQuery } from '@modules/identity/role/application/queries/get-role-by-slug/get-role-by-slug.query';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { CreateOrganizationCommand } from '@modules/organization/organization/application/commands/create-organization/create-organization.command';
import { CreateClinicCommand } from '@modules/organization/clinic/application/commands/create-clinic/create-clinic.command';
import { SetClinicBusinessTypeCommand } from '@modules/organization/clinic/application/commands/set-clinic-business-type/set-clinic-business-type.command';
import { InitializeChartOfAccountsCommand } from '@modules/finance/accounting/chart-of-accounts/application/commands/initialize-chart-of-accounts/initialize-chart-of-accounts.command';
import { OpenPeriodCommand } from '@modules/finance/accounting/periods/application/commands/open-period/open-period.command';
import { InitializeTaxParametersCommand } from '@modules/finance/accounting/tax-parameters/application/commands/initialize-tax-parameters/initialize-tax-parameters.command';
import { DateTimeManager } from '@common/utils';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { CreateOrganization } from '@shared/modules/organization/types';
import { RegistrationConfigurationException } from '@modules/identity/auth/registration/domain/registration.exceptions';
import { RegisterUserOrProviderAccountCommand } from '@modules/identity/auth/registration/application/commands/register-user-or-provider-account';
import { StartTrialCommand } from '@modules/platform/subscription/application/commands/start-trial/start-trial.command';

@CommandHandler(RegisterClinicAccountCommand)
export class RegisterClinicAccountHandler
  implements
    ICommandHandler<
      RegisterClinicAccountCommand,
      RegisterClinicAccountResponse
    >
{
  private readonly internalCtx = ExecutionContextFactory.createInternal();
  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus,
    private readonly transactionManager: TransactionManager
  ) {}

  async execute(
    command: RegisterClinicAccountCommand
  ): Promise<RegisterClinicAccountResponse> {
    const { data } = command.payload;
    const { clinic: createClinicData, owner: ownerData, businessType } = data;

    const { data: role } = await this.queryBus.execute(
      new GetRoleBySlugQuery(ROLE_SLUGS.CLINIC_OWNER)
    );

    if (!role) {
      throw new RegistrationConfigurationException('Rol bulunamadı');
    }

    const generatedOrganizationUUID = UUID.generate();
    const generatedClinicUUID = UUID.generate();

    await this.transactionManager.outboxRun(async () => {
      const organizationDto: CreateOrganization = {
        name: createClinicData.name,
        phone: createClinicData.phone,
        email: createClinicData.email,
        address: createClinicData.address,
        city: createClinicData.city,
        district: createClinicData.district,
      };
      await this.commandBus.execute(
        new CreateOrganizationCommand({
          data: organizationDto,
          ctx: this.internalCtx,
          internalRelations: {
            id: generatedOrganizationUUID.value,
          },
        })
      );

      await this.commandBus.execute(
        new CreateClinicCommand({
          data: createClinicData,
          ctx: this.internalCtx,
          internalRelations: {
            clinicId: generatedClinicUUID.value,
            organizationId: generatedOrganizationUUID.value,
          },
        })
      );

      // İşletme biçimi (şirket / şahıs) yıl sonu devrinin hedefini belirler; kayıtta zorunlu.
      await this.commandBus.execute(
        new SetClinicBusinessTypeCommand({
          clinicId: generatedClinicUUID.value,
          data: { businessType },
          ctx: this.internalCtx,
        })
      );

      const createUserData: RegisterUserOrProviderAccount = {
        ...ownerData,
        roleId: role.id,
        organizationId: generatedOrganizationUUID.value,
        clinicId: generatedClinicUUID.value,
      };

      await this.commandBus.execute(
        new RegisterUserOrProviderAccountCommand({
          data: createUserData,
          ctx: this.internalCtx,
          internalRelations: {
            ownedOrganizationIds: [generatedOrganizationUUID.value],
            managedClinicIds: [generatedClinicUUID.value],
          },
        })
      );

      // Finans muhasebe altyapısı clinic (defter) seviyesinde kurulur: hesap planı
      // (idempotent) + cari yıl dönemi. Posting'in çalışabilmesi için ön koşul.
      await this.commandBus.execute(
        new InitializeChartOfAccountsCommand({
          clinicId: generatedClinicUUID.value,
          organizationId: generatedOrganizationUUID.value,
          ctx: this.internalCtx,
        })
      );

      await this.commandBus.execute(
        new OpenPeriodCommand({
          clinicId: generatedClinicUUID.value,
          year: DateTimeManager.currentYear(),
          ctx: this.internalCtx,
        })
      );

      // Varsayılan vergi parametreleri (KDV/stopaj/kurumlar) — idempotent.
      // Fatura kesimi KDV oranını buradan çözer
      await this.commandBus.execute(
        new InitializeTaxParametersCommand({
          clinicId: generatedClinicUUID.value,
          organizationId: generatedOrganizationUUID.value,
          ctx: this.internalCtx,
        })
      );

      // Ücretsiz deneme aboneliği. Aynı transaction içinde: aboneliği olmayan
      // kiracı `@RequiresModule` guard'ına takılıp uygulamayı hiç kullanamaz —
      // yarım kalmış bir kayıt bırakmaktansa kaydın tamamı geri alınmalı.
      // Komut kendi içinde idempotent (sahibin aboneliği varsa no-op).
      await this.commandBus.execute(
        new StartTrialCommand(
          generatedOrganizationUUID.value,
          generatedClinicUUID.value
        )
      );
    });
  }
}
