import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { PatientBookAppointmentCommand } from './patient-book-appointment.command';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';

import { Appointment } from '@modules/clinical/appointment/domain/entities/appointment.entity';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TimeZoneSchema } from '@shared';

import { AppointmentSourceSchema } from '@input-type-schemas/AppointmentSourceSchema';
import { AppointmentCreatorTypeSchema } from '@input-type-schemas/AppointmentCreatorTypeSchema';
import { AppointmentStatusSchema } from '@input-type-schemas/AppointmentStatusSchema';
import { GetClinicAppointmentSettingsQuery } from '@modules/organization/clinic/application/queries/get-clinic-appointment-settings/get-clinic-appointment-settings.query';
import {
  BookingWindowExceededException,
  MaxActiveBookingsExceededException,
  PatientBookingDisabledException,
} from '@modules/clinical/appointment/domain/exceptions/appointment.exceptions';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { ExecutionPolicy } from '@src/domain/common/execution/execution.policy';
import {
  ITenantScopeResolver,
  TENANT_SCOPE_RESOLVER,
} from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import { AppointmentClinicOutsideOrganizationException } from '@modules/clinical/appointment/domain/exceptions/appointment.exceptions';
import {
  APPOINTMENT_COMMAND_REPOSITORY,
  IAppointmentCommandRepository,
} from '@modules/clinical/appointment/domain/repositories/appointment';
import {
  IProviderBookingService,
  PROVIDER_BOOKING_SERVICE,
} from '@modules/clinical/provider/domain/services/provider-booking/provider-booking.service.interface';
import {
  CLINIC_BOOKING_SERVICE,
  IClinicBookingService,
} from '@modules/organization/clinic/domain/services/clinic-booking/clinic-booking.service.interface';
import {
  APPOINTMENT_CHECKER_SERVICE,
  IAppointmentCheckerService,
} from '@modules/clinical/appointment/domain/interfaces/appointment-checker.service.interface';

@CommandHandler(PatientBookAppointmentCommand)
export class PatientBookAppointmentHandler
  implements ICommandHandler<PatientBookAppointmentCommand, string>
{
  constructor(
    @Inject(APPOINTMENT_COMMAND_REPOSITORY)
    private readonly appointmentRepo: IAppointmentCommandRepository,
    @Inject(APPOINTMENT_CHECKER_SERVICE)
    private readonly appointmentCheckerService: IAppointmentCheckerService,
    @Inject(PROVIDER_BOOKING_SERVICE)
    private readonly providerBookingService: IProviderBookingService,
    @Inject(CLINIC_BOOKING_SERVICE)
    private readonly clinicBookingService: IClinicBookingService,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    private readonly queryBus: TSQueryBus,
    private readonly transactionManager: TransactionManager
  ) {}

  async execute(command: PatientBookAppointmentCommand): Promise<string> {
    const { data, ctx, aiConversationPatient } = command.payload;

    const patient = aiConversationPatient ?? command.payload.ctx.actor;

    const {
      clinicId,
      providerId,
      startTime,
      duration,
      endTime: dataEndTime,
      treatmentId,
      notes,
      isConsultation,
    } = data;

    // Kiracı sınırı: hasta yalnız kendi organizasyonunun kliniklerinde randevu
    // alabilir. Organizasyon İÇİNDE çok-klinikli portal bilinçli olarak serbest
    // (hangi kliniklerin listeleneceği kiracıya göre değişen bir ürün kararı);
    // başka bir kiracının takvimine randevu düşürmek ise her senaryoda yanlış.
    //
    // Sistem/AI kaynaklı çağrılar muaf: orada aktör SYSTEM_PATIENT_ACTOR'dır,
    // hasta kimliği `aiConversationPatient` ile taşınır ve klinik zaten
    // konuşmanın bağlandığı kliniktir.
    if (!ExecutionPolicy.isSystemInitiated(ctx.source)) {
      const organizationId = await this.tenantScopeResolver.resolve({
        clinicId,
      });

      // Fail-closed: aktör bağlamı beklenen kiracı kimliğini taşımıyorsa kontrol
      // sessizce devre dışı kalmaz, istek reddedilir.
      if (
        !ctx.actor?.organizationId ||
        organizationId !== ctx.actor.organizationId
      ) {
        throw new AppointmentClinicOutsideOrganizationException(clinicId);
      }
    }

    const endTime = Appointment.calculateEndTime({
      startTime,
      endTime: dataEndTime,
      duration,
    }).orThrow();

    // Klinik ayarı: hasta panelden randevu açabiliyor mu + en ileri tarih sınırı.
    // Satır yoksa DB default'ları (booking açık, 90 gün) geçerlidir.
    const { data: settings } = await this.queryBus.execute(
      new GetClinicAppointmentSettingsQuery(clinicId)
    );

    if (!settings.allowPatientBooking) {
      throw new PatientBookingDisabledException();
    }

    if (
      DateTimeManager.diffInDays(startTime, DateTimeManager.create()) >
      settings.maxFutureBookingDays
    ) {
      throw new BookingWindowExceededException(settings.maxFutureBookingDays);
    }

    // Hasta aynı anda en fazla kaç aktif randevu tutabilir (klinik ayarı) — aşımda reddet.
    const activeCount = await this.appointmentRepo.countActiveByPatient(
      patient.patientId
    );

    if (activeCount >= settings.maxActivePatientBookings) {
      throw new MaxActiveBookingsExceededException(
        settings.maxActivePatientBookings
      );
    }

    await Promise.all([
      this.clinicBookingService.assertCanBook({ clinicId, startTime, endTime }),
      this.providerBookingService.assertCanBook({
        providerId,
        startTime,
        endTime,
        isConsultation,
      }),
    ]);

    await this.appointmentCheckerService.assertNoConflict({
      providerId,
      startTime,
      endTime,
    });

    // Klinik ayarı sekreter onayı gerektiriyorsa randevu PENDING kalır; gerektirmiyorsa
    // doğrudan CONFIRMED doğar.
    const status = settings.requireConfirmation
      ? AppointmentStatusSchema.enum.PENDING
      : AppointmentStatusSchema.enum.CONFIRMED;

    const appointment = Appointment.book({
      patientId: patient.patientId,
      patientName: patient.firstName,
      patientPhone: patient.phone,
      patientEmail: patient.email,
      providerId,
      clinicId,
      treatmentId,
      startTime,
      endTime,
      notes,
      timezone: data.timezone ?? TimeZoneSchema.enum.Europe_Istanbul,
      isConsultation,
      status,
      // Hasta kendi aldığı için kaynak/oluşturan hasta olarak işaretlenir.
      source: AppointmentSourceSchema.enum.PATIENT_PORTAL,
      creatorType: AppointmentCreatorTypeSchema.enum.PATIENT,
      createdById: patient.patientId,
      createdByRealName: patient.firstName,
    });

    return this.transactionManager.run(async () => {
      const saved = await this.appointmentRepo.create(appointment);
      return saved.id.value;
    });
  }
}
