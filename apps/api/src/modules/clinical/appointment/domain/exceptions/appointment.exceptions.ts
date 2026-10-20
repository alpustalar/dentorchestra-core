import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';
import type { SlotConflictMeta } from '@shared/modules/appointment/interfaces';

export class AppointmentNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.APPOINTMENT.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(message = 'Randevu bulunamadı.') {
    super(message);
  }
}

export class AppointmentCancellationTimeException extends DomainException {
  public readonly errorCode = ERROR_CODES.APPOINTMENT.INVALID_DATE;

  constructor(message = 'Geçmiş bir tarihe/zamana ait iptal kaydı girilemez.') {
    super(message);
  }
}

export class InvalidAppointmentCancellationException extends DomainException<{
  appointmentId?: string;
}> {
  readonly errorCode = ERROR_CODES.APPOINTMENT.INVALID_CANCELLATION_USER;

  constructor(appointmentId?: string) {
    super('Randevuyu iptal eden kullanıcı bilgisi boş olamaz.', {
      appointmentId,
    });
  }
}

export class AppointmentCancellationNotAllowedException extends DomainException<{
  appointmentId?: string;
  status?: string;
}> {
  readonly errorCode = ERROR_CODES.APPOINTMENT.INVALID_CANCELLATION_STATUS;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(appointmentId?: string, status?: string) {
    super(
      'Tamamlanan, iptal edilmiş veya randevuya gelmedi olarak işaretlenmiş randevular iptal edilemez.',
      {
        appointmentId,
        status,
      }
    );
  }
}

/**
 * Seçilen uzman + zaman aralığında çakışan başka bir randevu bulunduğunda
 * fırlatılır. `meta` ile çakışan slotun saatleri frontend'e taşınır.
 */
export class AppointmentSlotConflictException extends DomainException<SlotConflictMeta> {
  public readonly errorCode = ERROR_CODES.APPOINTMENT.ALREADY_BOOKED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(conflictStart: Date, conflictEnd: Date) {
    // Tel üzerinde ISO string olarak gidiyor; sözleşme (`SlotConflictMeta`) de
    // string diyor — Date'i olduğu gibi bırakmak tipi yalan söyletirdi.
    super(`Bu uzman için seçilen saatte çakışan bir randevu mevcut`, {
      conflictStart: conflictStart.toISOString(),
      conflictEnd: conflictEnd.toISOString(),
    });
  }
}

/**
 * Klinik ayarında hastanın kendi randevusunu oluşturması kapalıyken
 * (ClinicAppointmentSettings.allowPatientBooking = false) fırlatılır. Hasta
 * panelden randevu açamaz; klinik ile iletişime geçmelidir.
 */
export class PatientBookingDisabledException extends DomainException {
  public readonly errorCode = ERROR_CODES.APPOINTMENT.PATIENT_BOOKING_DISABLED;
  public override readonly httpStatus = HttpStatus.FORBIDDEN;

  constructor(
    message = 'Bu klinikte hastalar kendileri randevu oluşturamaz. Lütfen klinik ile iletişime geçin.'
  ) {
    super(message);
  }
}

/**
 * Randevu tarihi, klinik ayarındaki en ileri tarih sınırını
 * (ClinicAppointmentSettings.maxFutureBookingDays) aşarsa fırlatılır.
 */
export class BookingWindowExceededException extends DomainException<{
  maxFutureBookingDays: number;
}> {
  public readonly errorCode = ERROR_CODES.APPOINTMENT.BOOKING_WINDOW_EXCEEDED;

  constructor(maxFutureBookingDays: number) {
    super(
      `En fazla ${maxFutureBookingDays} gün sonrasına randevu oluşturabilirsiniz.`,
      { maxFutureBookingDays }
    );
  }
}

/**
 * Hasta, klinik ayarındaki aynı anda sahip olunabilecek en fazla aktif (gelecek,
 * iptal/tamamlanmamış) randevu sınırına (maxActivePatientBookings) ulaştığında
 * fırlatılır. Yeni randevu için mevcut bir randevusunu iptal etmelidir.
 */
export class MaxActiveBookingsExceededException extends DomainException<{
  maxActivePatientBookings: number;
}> {
  public readonly errorCode =
    ERROR_CODES.APPOINTMENT.MAX_ACTIVE_BOOKINGS_EXCEEDED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(maxActivePatientBookings: number) {
    super(
      `Aynı anda en fazla ${maxActivePatientBookings} aktif randevunuz olabilir. Yeni randevu oluşturmak için mevcut bir randevunuzu iptal edin ya da destek ekibimize ulaşın.`,
      { maxActivePatientBookings }
    );
  }
}

/**
 * Randevu, check-in (ARRIVED) için uygun durumda değilken fırlatılır. Yalnız
 * bekleyen veya onaylanan randevular için check-in yapılabilir.
 */
export class AppointmentCheckInNotAllowedException extends DomainException<{
  status?: string;
}> {
  public readonly errorCode = ERROR_CODES.APPOINTMENT.CHECK_IN_NOT_ALLOWED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(status?: string) {
    super(
      'Yalnızca bekleyen veya onaylanan randevular için hasta girişi (check-in) yapılabilir.',
      { status }
    );
  }
}

/**
 * Seçilen slot başka bir kullanıcı tarafından geçici olarak kilitlenmişken (randevu
 * oluşturma akışında elde tutuluyorken) fırlatılır. Kilit kısa ömürlüdür; birkaç
 * dakika sonra tekrar denenebilir.
 */
export class SlotTemporarilyHeldException extends DomainException {
  public readonly errorCode = ERROR_CODES.APPOINTMENT.SLOT_TEMPORARILY_HELD;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(
    message = 'Bu saat şu anda başka bir işlem tarafından geçici olarak tutuluyor. Lütfen birkaç dakika sonra tekrar deneyin.'
  ) {
    super(message);
  }
}

/**
 * Klinik ayarında hastanın kendi randevusunu iptal etmesi kapalıyken
 * (allowPatientCancel = false) fırlatılır. Hasta panelden iptal edemez; klinik
 * ile iletişime geçmelidir.
 */
export class PatientCancellationDisabledException extends DomainException {
  public readonly errorCode = ERROR_CODES.APPOINTMENT.PATIENT_CANCEL_DISABLED;
  public override readonly httpStatus = HttpStatus.FORBIDDEN;

  constructor(
    message = 'Randevunuzu panel üzerinden iptal edemezsiniz. Lütfen klinik ile iletişime geçin.'
  ) {
    super(message);
  }
}

export class AppointmentRescheduleNotAllowedException extends DomainException<{
  appointmentId: string;
  status: string;
}> {
  readonly errorCode = ERROR_CODES.APPOINTMENT.INVALID_RESCHEDULE_STATUS;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(appointmentId: string, status: string) {
    super(
      `İptal edilmiş, tamamlanmış veya gelmedi durumundaki randevular yeniden zamanlanamaz.`,
      {
        appointmentId,
        status,
      }
    );
  }
}

export class AppointmentPatientRequiredException extends DomainException {
  readonly errorCode = ERROR_CODES.APPOINTMENT.PATIENT_REQUIRED;
  public override readonly httpStatus = HttpStatus.BAD_REQUEST;

  constructor() {
    super('Randevu iptali için geçerli bir kullanıcı ID gereklidir.');
  }
}

export class AppointmentRescheduleWindowExpiredException extends DomainException<{
  thresholdHours: number;
}> {
  readonly errorCode = ERROR_CODES.APPOINTMENT.RESCHEDULE_WINDOW_EXPIRED;
  public override readonly httpStatus = HttpStatus.FORBIDDEN;
  constructor(thresholdHours: number) {
    super(
      `Randevunuza ${thresholdHours} saatten az bir süre kaldığı için sistem üzerinden değişiklik yapamazsınız. Lütfen müşteri hizmetleri ile iletişime geçin.`,
      {
        thresholdHours,
      }
    );
  }
}

export class AppointmentPastDateException extends DomainException<{
  attemptedDate: Date;
}> {
  readonly errorCode = ERROR_CODES.APPOINTMENT.INVALID_DATE_IN_PAST;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(attemptedDate?: Date) {
    super('Geçmiş bir tarihe randevu yeniden zamanlanamaz.', {
      attemptedDate,
    });
  }
}

export class AppointmentNotPendingException extends DomainException<{
  appointmentId?: string;
  actualStatus?: string;
}> {
  readonly errorCode = ERROR_CODES.APPOINTMENT.NOT_PENDING;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(appointmentId?: string, actualStatus?: string) {
    super('Randevu beklemede değil, işlem gerçekleştirilemez.', {
      appointmentId,
      actualStatus,
    });
  }
}

export class AppointmentNotConfirmedException extends DomainException<{
  appointmentId: string;
  actualStatus: string;
}> {
  readonly errorCode = ERROR_CODES.APPOINTMENT.NOT_CONFIRMED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(appointmentId: string, actualStatus: string) {
    super('Randevu durumu "onaylanmış" değil, işlem gerçekleştirilemez.', {
      appointmentId,
      actualStatus,
    });
  }
}

export class AppointmentInvalidNoShowStatusException extends DomainException<{
  appointmentId?: string;
  actualStatus?: string;
}> {
  readonly errorCode = ERROR_CODES.APPOINTMENT.INVALID_NO_SHOW_STATUS;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(appointmentId?: string, actualStatus?: string) {
    super(
      'Yalnızca onaylanan veya bekleyen randevular "gelmedi" olarak işaretlenebilir.',
      {
        appointmentId,
        actualStatus,
      }
    );
  }
}

export class AppointmentCannotCompleteException extends DomainException<{
  appointmentId?: string;
  actualStatus?: string;
}> {
  readonly errorCode = ERROR_CODES.APPOINTMENT.CANNOT_COMPLETE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(appointmentId?: string, actualStatus?: string) {
    super(
      'İptal edilmiş, tamamlanmış veya gelmedi durumundaki randevular tamamlanamaz.',
      {
        appointmentId,
        actualStatus,
      }
    );
  }
}

export class AppointmentOnlyPendingCanBeConfirmedException extends DomainException<{
  appointmentId?: string;
  actualStatus?: string;
}> {
  readonly errorCode = ERROR_CODES.APPOINTMENT.ONLY_PENDING_CAN_BE_CONFIRMED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(appointmentId?: string, actualStatus?: string) {
    super('Yalnızca bekleyen randevular onaylanabilir.', {
      appointmentId,
      actualStatus,
    });
  }
}

export class AppointmentInvalidCreationDateException extends DomainException<{
  attemptedDate: Date;
}> {
  readonly errorCode = ERROR_CODES.APPOINTMENT.INVALID_CREATION_DATE;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(attemptedDate: Date) {
    super('Geçmiş bir tarihe randevu oluşturulamaz.', {
      attemptedDate,
    });
  }
}

export class AppointmentNotCancelledException extends DomainException<{
  appointmentId: string;
  actualStatus: string;
}> {
  readonly errorCode = ERROR_CODES.APPOINTMENT.NOT_CANCELLED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(appointmentId: string, actualStatus: string) {
    super(
      'Randevu durumu "iptal edilmiş" değil, bu işlem gerçekleştirilemez.',
      {
        appointmentId,
        actualStatus,
      }
    );
  }
}

export class AppointmentNotCompletedException extends DomainException<{
  appointmentId?: string;
  actualStatus?: string;
}> {
  readonly errorCode = ERROR_CODES.APPOINTMENT.NOT_COMPLETED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(appointmentId?: string, actualStatus?: string) {
    super('Randevu durumu "tamamlanmış" değil, bu işlem gerçekleştirilemez.', {
      appointmentId,
      actualStatus,
    });
  }
}

export class AppointmentNotNoShowException extends DomainException {
  readonly errorCode = ERROR_CODES.APPOINTMENT.NOT_NO_SHOW;
  constructor() {
    super('Randevu durumu "gelmedi" değil.');
  }
}

export class AppointmentInvalidEndDateException extends DomainException {
  readonly errorCode = ERROR_CODES.APPOINTMENT.INVALID_END_DATE;
  constructor() {
    super('Randevu bitiş tarihi eski bir tarihte olamaz.');
  }
}

export class AppointmentInvalidStartDateException extends DomainException {
  readonly errorCode = ERROR_CODES.APPOINTMENT.INVALID_START_DATE;
  constructor() {
    super('Başlangıç tarihi ileri bir tarihte (gelecekte) olmalıdır.');
  }
}

export class AppointmentInvalidTimeRangeException extends DomainException<{
  startTime?: Date;
  endTime?: Date;
}> {
  readonly errorCode = ERROR_CODES.APPOINTMENT.INVALID_TIME_RANGE;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(startTime?: Date, endTime?: Date) {
    super('Randevu bitiş saati başlangıç saatinden sonra olmalıdır.', {
      startTime,
      endTime,
    });
  }
}

/**
 * Hasta, kendi organizasyonu dışındaki bir kliniğe randevu almaya çalıştı.
 *
 * Organizasyon İÇİNDE çok-klinikli portal bilinçli olarak serbesttir (hangi
 * kliniklerin listeleneceği bir ürün/iş kararıdır ve kiracıya göre değişir);
 * kiracı sınırı ise her senaryoda geçerlidir — başka bir organizasyonun
 * takvimine randevu düşürmek hastanın verisini o kiracıya taşır.
 */
export class AppointmentClinicOutsideOrganizationException extends DomainException<{
  clinicId: string;
}> {
  public readonly errorCode =
    ERROR_CODES.APPOINTMENT.CLINIC_OUTSIDE_ORGANIZATION;
  public override readonly httpStatus = HttpStatus.FORBIDDEN;

  constructor(clinicId: string) {
    super('Bu klinik için randevu alma yetkiniz yok.', { clinicId });
  }
}

export class AppointmentPatientPhoneRequiredException extends DomainException<{
  patientId?: string;
}> {
  readonly errorCode = ERROR_CODES.APPOINTMENT.PATIENT_PHONE_REQUIRED;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(patientId?: string) {
    super('Hasta telefonu bulunamadı.', { patientId });
  }
}
