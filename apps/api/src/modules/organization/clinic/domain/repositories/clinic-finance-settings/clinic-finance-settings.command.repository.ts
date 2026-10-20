import { ClinicFinanceSettings } from '@modules/organization/clinic/domain/entities/clinic-finance-settings.entity';
import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';

export const CLINIC_FINANCE_SETTINGS_COMMAND_REPOSITORY = Symbol(
  'IClinicFinanceSettingsCommandRepository'
);

export type IClinicFinanceSettingsCommandRepository =
  IBaseCommandRepository<ClinicFinanceSettings> & {
    findByClinicId(clinicId: string): Promise<ClinicFinanceSettings | null>;
    /** clinicId unique → get-or-create (satır yoksa ilk seçim kaydı açılır). */
    upsertByClinicId(
      entity: ClinicFinanceSettings
    ): Promise<ClinicFinanceSettings>;
  };
