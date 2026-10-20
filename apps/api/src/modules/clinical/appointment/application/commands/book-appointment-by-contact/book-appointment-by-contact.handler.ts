import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { BookAppointmentByContactCommand } from './book-appointment-by-contact.command';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
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
import { CreatePatientCommand } from '@modules/crm/patient/application/commands/create-patient/create-patient.command';
import {
  APPOINTMENT_COMMAND_REPOSITORY,
  IAppointmentCommandRepository,
} from '@modules/clinical/appointment/domain/repositories/appointment/appointment.command.repository';
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

/**
 * AI asistanı üzerinden randevu açar. Portal handler'ı ile aynı iş kurallarını uygular
 * (klinik ayar geçidi + en ileri tarih sınırı + klinik/doktor müsaitliği + çakışma),
 * farkı: hasta önceden çözülmüş kimlikle gelmez — telefonla çöz-veya-oluştur yapılır ve
 * randevu kaynağı entegrasyon/AI olarak işaretlenir. Cross-module hasta oluşturma yalnız
 * CommandBus üzerinden yapılır.
 */
@CommandHandler(BookAppointmentByContactCommand)
export class BookAppointmentByContactHandler
  implements ICommandHandler<BookAppointmentByContactCommand, string>
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
    private readonly queryBus: TSQueryBus,
    private readonly commandBus: TSCommandBus,
    private readonly transactionManager: TransactionManager
  ) {}

  async execute(command: BookAppointmentByContactCommand): Promise<string> {
    const { data } = command;
    const isConsultation = data.isConsultation ?? false;

    const endTime = Appointment.calculateEndTime({
      duration: data.durationMinutes,
      endTime: data.endTime,
      startTime: data.startTime,
    }).orThrow();

    // Klinik ayarı: hasta (dış kanal dahil) randevu açabiliyor mu + en ileri tarih sınırı.
    // Satır yoksa DB default'ları (booking açık, 90 gün) geçerlidir.
    const { data: settings } = await this.queryBus.execute(
      new GetClinicAppointmentSettingsQuery(data.clinicId)
    );

    if (!settings.allowPatientBooking)
      throw new PatientBookingDisabledException();

    if (
      DateTimeManager.diffInDays(data.startTime, DateTimeManager.create()) >
      settings.maxFutureBookingDays
    )
      throw new BookingWindowExceededException(settings.maxFutureBookingDays);

    await Promise.all([
      this.clinicBookingService.assertCanBook({
        clinicId: data.clinicId,
        startTime: data.startTime,
        endTime,
      }),

      this.providerBookingService.assertCanBook({
        providerId: data.providerId,
        startTime: data.startTime,
        endTime,
        isConsultation,
      }),
    ]);

    await this.appointmentCheckerService.assertNoConflict({
      providerId: data.providerId,
      startTime: data.startTime,
      endTime,
    });

    // Telefonla hasta çöz-veya-oluştur (org + telefon). CreatePatientCommand mükerrer
    // kaydı kendisi önler: numarayla eşleşen hasta varsa onun id'sini döner.
    const patientId = await this.commandBus.execute(
      new CreatePatientCommand({
        phone: data.patientPhone,
        organizationId: data.organizationId,
        clinicId: data.clinicId,
        firstName: data.patientName,
      })
    );

    // Hasta aynı anda kaç aktif randevu tutabilir (klinik ayarı) — aşımda reddet.
    // Yeni oluşan hasta için sayım 0'dır; mevcut hastada gerçek aktif sayı kontrol edilir.
    const activeCount =
      await this.appointmentRepo.countActiveByPatient(patientId);
    if (activeCount >= settings.maxActivePatientBookings) {
      throw new MaxActiveBookingsExceededException(
        settings.maxActivePatientBookings
      );
    }

    // Klinik ayarı sekreter onayı gerektiriyorsa PENDING, gerektirmiyorsa CONFIRMED.
    const status = settings.requireConfirmation
      ? AppointmentStatusSchema.enum.PENDING
      : AppointmentStatusSchema.enum.CONFIRMED;

    const appointment = Appointment.book({
      patientId,
      patientName: data.patientName,
      patientPhone: data.patientPhone,
      patientEmail: data.patientEmail ?? null,
      providerId: data.providerId,
      clinicId: data.clinicId,
      treatmentId: data.treatmentId ?? null,
      startTime: data.startTime,
      endTime,
      notes: data.notes ?? null,
      timezone: data.timezone ?? TimeZoneSchema.enum.Europe_Istanbul,
      isConsultation,
      status,
      // AI asistanı üzerinden alındı: kaynak entegrasyon, oluşturan AI.
      source: AppointmentSourceSchema.enum.INTEGRATION,
      creatorType: AppointmentCreatorTypeSchema.enum.AI_AGENT,
      createdById: patientId,
      createdByRealName: data.patientName,
    });

    return this.transactionManager.run(async () => {
      const saved = await this.appointmentRepo.create(appointment);
      return saved.id.value;
    });
  }
}
