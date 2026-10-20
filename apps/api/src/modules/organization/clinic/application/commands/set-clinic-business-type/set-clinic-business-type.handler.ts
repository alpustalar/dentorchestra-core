import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { AccountingPeriodStatusSchema } from '@shared';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { CLINIC_EVENTS } from '@src/domain/constants/events';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ClinicFinanceSettings } from '@modules/organization/clinic/domain/entities/clinic-finance-settings.entity';
import {
  CLINIC_FINANCE_SETTINGS_COMMAND_REPOSITORY,
  IClinicFinanceSettingsCommandRepository,
} from '@modules/organization/clinic/domain/repositories/clinic-finance-settings/clinic-finance-settings.command.repository';
import { GetAccountingPeriodsQuery } from '@modules/finance/accounting/periods/application/queries/get-accounting-periods/get-accounting-periods.query';
import { SetClinicBusinessTypeCommand } from './set-clinic-business-type.command';

/**
 * İşletme biçimini yazar. Satır yoksa (ilk seçim) varsayılan ayarlarla açılır; varsa entity
 * `changeBusinessType` ile değiştirir. Kapanmış mali yıl bilgisi yalnız GERÇEK bir değişiklikte
 * (dolu → farklı değer) sorulur: kapanmış (CLOSED) dönem terminaldir, geri açılamaz — bu yüzden
 * okuma kilit/replica yarışına açık değildir (kapanış sırası kapısıyla aynı gerekçe).
 */
@CommandHandler(SetClinicBusinessTypeCommand)
export class SetClinicBusinessTypeHandler implements ICommandHandler<
  SetClinicBusinessTypeCommand,
  void
> {
  constructor(
    @Inject(CLINIC_FINANCE_SETTINGS_COMMAND_REPOSITORY)
    private readonly settingsCommandRepo: IClinicFinanceSettingsCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly queryBus: TSQueryBus,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: SetClinicBusinessTypeCommand): Promise<void> {
    const { clinicId, data, ctx } = command.payload;

    this.policyFactory
      .clinic(ctx.actor, ctx.source)
      .evaluator.check(
        (p) => p.actorCanManageTargetClinic(clinicId),
        'Klinik bulunamadı veya işletme biçimini değiştirme yetkiniz yok.'
      )
      .orThrow(CLINIC_EVENTS.BUSINESS_TYPE_CHANGED);

    const existing = await this.settingsCommandRepo.findByClinicId(clinicId);

    const settings =
      existing ??
      ClinicFinanceSettings.create({
        clinicId,
        businessType: data.businessType,
      });

    if (existing) {
      const isChange =
        existing.businessType !== null &&
        existing.businessType !== data.businessType;

      existing.changeBusinessType({
        businessType: data.businessType,
        hasClosedPeriod: isChange
          ? await this.hasClosedPeriod(clinicId, command)
          : false,
      });
    }

    await this.txManager.run(async () => {
      await this.settingsCommandRepo.upsertByClinicId(settings);
    });
  }

  private async hasClosedPeriod(
    clinicId: string,
    command: SetClinicBusinessTypeCommand
  ): Promise<boolean> {
    const { data: periods } = await this.queryBus.execute(
      new GetAccountingPeriodsQuery(clinicId, command.payload.ctx)
    );
    return periods.some(
      (p) => p.status === AccountingPeriodStatusSchema.enum.CLOSED
    );
  }
}
