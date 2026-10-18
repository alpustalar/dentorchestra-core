import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateClinicAppointmentSettingsCommand } from './update-clinic-appointment-settings.command';

import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ClinicAppointmentSettings } from '@modules/organization/clinic/domain/entities/clinic-appointment-settings.entity';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { CLINIC_EVENTS } from '@src/domain/constants/events';
import {
  CLINIC_CACHE_SERVICE,
  IClinicCacheService,
} from '@modules/organization/clinic/domain/interfaces/clinic-cache.service.interface';
import {
  CLINIC_APPOINTMENT_SETTINGS_COMMAND_REPOSITORY,
  IClinicAppointmentSettingsCommandRepository,
} from '@modules/organization/clinic/domain/repositories/clinic-appointment-settings/clinic-appointment-settings.command.repository';

/**
 * Randevu ayarlarını günceller. Yükle (yoksa default'tan üret) → domain metodu
 * (update, invariant revalidasyonu) → save (clinicId üzerinden upsert) → Redis cache
 * bust. Cache bust DB commit'inden SONRA yapılır ki bir sonraki okuma taze veriyi çeksin.
 */
@CommandHandler(UpdateClinicAppointmentSettingsCommand)
export class UpdateClinicAppointmentSettingsHandler implements ICommandHandler<
  UpdateClinicAppointmentSettingsCommand,
  void
> {
  constructor(
    @Inject(CLINIC_APPOINTMENT_SETTINGS_COMMAND_REPOSITORY)
    private readonly clinicAppointmentSettingsRepo: IClinicAppointmentSettingsCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(CLINIC_CACHE_SERVICE)
    private readonly cacheService: IClinicCacheService,
    private readonly txManager: TransactionManager
  ) {}

  async execute(
    command: UpdateClinicAppointmentSettingsCommand
  ): Promise<void> {
    const { clinicId, data, ctx } = command.payload;

    this.policyFactory
      .clinic(ctx.actor, ctx.source)
      .evaluator.check(
        (p) => p.actorCanManageTargetClinic(clinicId),
        'Klinik bulunamadı veya ayarları güncelleme yetkiniz yok.'
      )
      .orThrow(CLINIC_EVENTS.APPOINTMENT_SETTINGS_UPDATED);

    const settings =
      (await this.clinicAppointmentSettingsRepo.findByClinicId(clinicId)) ??
      ClinicAppointmentSettings.createDefault(clinicId);

    settings.update(data);

    await this.txManager.run(async () => {
      await this.clinicAppointmentSettingsRepo.upsertByClinicId(settings);
    });

    // DB commit sonrası cache'i temizle → bir sonraki randevu oluşturma taze ayarı okur.
    await this.cacheService.clinicAppointmentSettings().del(clinicId);
  }
}
