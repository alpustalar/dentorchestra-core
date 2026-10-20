import { Appointment as IAppointment } from '@model-schema/AppointmentSchema';
import {
  AppointmentStatusSchema,
  AppointmentStatusType as AppointmentStatus,
} from '@input-type-schemas/AppointmentStatusSchema';
import { ExaminationTypeType as ExaminationType } from '@input-type-schemas/ExaminationTypeSchema';
import { ExternalSystemType as ExternalSystem } from '@input-type-schemas/ExternalSystemSchema';
import { VisitTypeType as VisitType } from '@input-type-schemas/VisitTypeSchema';
import {
  AppointmentSourceSchema,
  AppointmentSourceType as AppointmentSource,
} from '@input-type-schemas/AppointmentSourceSchema';
import {
  AppointmentCreatorTypeSchema,
  AppointmentCreatorTypeType as AppointmentCreatorType,
} from '@input-type-schemas/AppointmentCreatorTypeSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { AppointmentDetailsUpdatedEvent } from '@modules/clinical/appointment/domain/events/appointment-details-updated.event';
import { AppointmentCheckedInEvent } from '@modules/clinical/appointment/domain/events/appointment-checked-in.event';
import { AppointmentReminderDueEvent } from '@modules/clinical/appointment/domain/events/appointment-reminder-due.event';
import {
  AppointmentInvalidCreationDateException,
  AppointmentInvalidTimeRangeException,
  AppointmentNotCancelledException,
  AppointmentNotCompletedException,
  AppointmentNotConfirmedException,
  AppointmentNotNoShowException,
  AppointmentNotPendingException,
  AppointmentPastDateException,
  AppointmentPatientRequiredException,
  AppointmentRescheduleWindowExpiredException,
} from '@modules/clinical/appointment/domain/exceptions/appointment.exceptions';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { Guard } from '@common/domain/guards';
import { endTimeCalculator } from '@common/utils';
import { Name } from '@src/domain/value-objects/name.vo';
import { DefaultValidateOptions } from '@common/domain/constants/default-options.constant';
import { isNotUndefined } from '@common/utils/is-not-undefined';
import { AppointmentRules } from '@modules/clinical/appointment/domain/rules/appointment.rules';
import { ValidateOptionsType } from '@shared/common/validate-options/validate-options.type';
import { Cancellation } from '@modules/clinical/appointment/domain/value-objects/cancellation.vo';
import {
  AppointmentBookedEvent,
  AppointmentCancelledEvent,
  AppointmentCompletedEvent,
  AppointmentConfirmedEvent,
  AppointmentRescheduledEvent,
  AppointmentScheduledEvent,
} from '@modules/clinical/appointment/domain/events';
import {
  DateRange,
  Email,
  Phone,
  TimeZone,
  UUID,
} from '@src/domain/value-objects';
import { IAuditLog } from '@common/interfaces/audit-log.interface';
import {
  AppointmentRuleSnapshot,
  CalculateEndTimeProps,
  CancelScheduleProps,
  CreateAppointmentProps,
  RescheduleByPatientProps,
  RescheduleRequestProps,
  UpdateAppointmentDetailsProps,
} from '@modules/clinical/appointment/domain/contracts/appointment';

export class Appointment extends AggregateRoot {
  constructor(data: IAppointment) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._patientName = Name.fromTrusted(data.patientName);
    this._patientPhone = Phone.fromTrusted(data.patientPhone);
    this._patientEmail = Email.create(data.patientEmail).instance ?? null;
    this._timeRange = DateRange.fromTrusted(data.startTime, data.endTime);
    this._timezone = TimeZone.fromTrusted(data.timezone);
    this._treatmentType = data.treatmentType;
    this._notes = data.notes;
    this._status = data.status;
    this._checkedInAt = data.checkedInAt;
    this._reminderSentAt = data.reminderSentAt;
    this._cancellation =
      Cancellation.create({
        canceledBy: data.canceledBy,
        reason: data.cancelReason,
      }).instance ?? null;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
    this._externalSystem = data.externalSystem;
    this._externalId = data.externalId ?? null;
    this._treatmentId = UUID.create(data.treatmentId).instance ?? null;
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._providerId = UUID.fromTrusted(data.providerId);
    this._patientId = UUID.fromTrusted(data.patientId);
    this._examinationType = data.examinationType;
    this._visitType = data.visitType;
    this._isConsultation = data.isConsultation;
    this._resourceId = data.resourceId;
    this._isDeleted = data.isDeleted;
    this._deletedAt = data.deletedAt;
    this._source = data.source;
    this._creatorType = data.creatorType;
    this._approvedAt = data.approvedAt;
    this._approvedBy = data.approvedBy;
    this._createdById = data.createdById;
    this._createdByRealName = data.createdByRealName
      ? Name.fromTrusted(data.createdByRealName)
      : null;
    this._version = data.version;
  }

  private _version: number;

  /** Optimistic concurrency version'ı — repository update() guard'ında kullanılır. */
  get version(): number {
    return this._version;
  }

  private _cancellation: Cancellation | null;

  get cancellation(): Cancellation | null {
    return this._cancellation;
  }

  private _id: UUID;

  get id(): UUID {
    return this._id;
  }

  private _isConsultation: boolean;

  get isConsultation(): boolean {
    return this._isConsultation;
  }

  private _patientName: Name;

  get patientName(): Name {
    return this._patientName;
  }

  private _patientPhone: Phone;

  get patientPhone(): Phone {
    return this._patientPhone;
  }

  private _patientEmail: Email | null;

  get patientEmail(): Email | null {
    return this._patientEmail;
  }

  get startTime(): Date {
    return this._timeRange.startDate;
  }

  get endTime(): Date {
    return this._timeRange.endDate;
  }

  private _timeRange: DateRange;

  get timeRange(): DateRange {
    return this._timeRange;
  }

  private _timezone: TimeZone;

  get timezone(): TimeZone {
    return this._timezone;
  }

  private _treatmentType: string | null;

  get treatmentType(): string | null {
    return this._treatmentType;
  }

  private _notes: string | null;

  get notes(): string | null {
    return this._notes;
  }

  private _status: AppointmentStatus;

  get status(): AppointmentStatus {
    return this._status;
  }

  private _checkedInAt: Date | null;

  get checkedInAt(): Date | null {
    return this._checkedInAt;
  }

  private _reminderSentAt: Date | null;

  get reminderSentAt(): Date | null {
    return this._reminderSentAt;
  }

  get canceledAt(): Date | null {
    return this.cancellation?.canceledAt ?? null;
  }

  get canceledBy(): string | null {
    return this.cancellation?.canceledBy ?? null;
  }

  get cancelReason(): string | null {
    return this.cancellation?.reason ?? null;
  }

  private _createdAt: Date;

  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;

  get updatedAt(): Date {
    return this._updatedAt;
  }

  private _externalSystem: ExternalSystem | null;

  get externalSystem(): ExternalSystem | null {
    return this._externalSystem;
  }

  private _externalId: string | null;

  get externalId(): string | null {
    return this._externalId;
  }

  private _treatmentId: UUID | null;

  get treatmentId(): UUID | null {
    return this._treatmentId;
  }

  private _clinicId: UUID;

  get clinicId(): UUID {
    return this._clinicId;
  }

  private _providerId: UUID;

  get providerId(): UUID {
    return this._providerId;
  }

  private _patientId: UUID;

  get patientId(): UUID {
    return this._patientId;
  }

  private _examinationType: ExaminationType | null;

  get examinationType(): ExaminationType | null {
    return this._examinationType;
  }

  private _visitType: VisitType | null;

  get visitType(): VisitType | null {
    return this._visitType;
  }

  private _resourceId: string | null;

  get resourceId(): string | null {
    return this._resourceId;
  }

  private _isDeleted: boolean;

  get isDeleted(): boolean {
    return this._isDeleted;
  }

  private _deletedAt: Date | null;

  get deletedAt(): Date | null {
    return this._deletedAt;
  }

  private _source: AppointmentSource;

  get source(): AppointmentSource {
    return this._source;
  }

  private _creatorType: AppointmentCreatorType;

  get creatorType(): AppointmentCreatorType {
    return this._creatorType;
  }

  private _approvedAt: Date | null;

  get approvedAt(): Date | null {
    return this._approvedAt;
  }

  private _approvedBy: string | null;

  get approvedBy(): string | null {
    return this._approvedBy;
  }

  private _createdById: string | null;

  get createdById(): string | null {
    return this._createdById;
  }

  private _createdByRealName: Name | null;

  get createdByRealName(): Name | null {
    return this._createdByRealName;
  }

  public get validate() {
    return {
      status: {
        isPending: (error?: Error) => this.isPending(error),
        isConfirmed: (error?: Error) => this.isConfirmed(error),
        isCancelled: (error?: Error) => this.isCancelled(error),
        isCompleted: (error?: Error) => this.isCompleted(error),
        isNoShow: (error?: Error) => this.isNoShow(error),
      },
    };
  }

  private get raiseEvent() {
    return {
      cancelled: (canceledBy: string, reason?: string): void => {
        this.addDomainEvent(
          new AppointmentCancelledEvent({
            appointmentId: this.id.value,
            clinicId: this.clinicId.value,
            providerId: this.providerId.value,
            patientId: this.patientId.value,
            patientName: this.patientName.value,
            patientPhone: this.patientPhone.value,
            patientEmail: this.patientEmail?.value ?? null,
            startTime: this.startTime,
            canceledBy,
            cancelReason: reason,
          })
        );
      },
      confirmed: (): void => {
        this.addDomainEvent(
          new AppointmentConfirmedEvent({
            appointmentId: this.id.value,
            clinicId: this.clinicId.value,
            providerId: this.providerId.value,
            patientId: this.patientId.value,
            patientName: this.patientName.value,
            patientPhone: this.patientPhone.value,
            patientEmail: this.patientEmail?.value ?? null,
            startTime: this.startTime,
          })
        );
      },
      rescheduled: (): void => {
        this.addDomainEvent(
          new AppointmentRescheduledEvent({
            appointmentId: this.id.value,
            clinicId: this.clinicId.value,
            providerId: this.providerId.value,
            patientId: this.patientId.value,
            patientName: this.patientName.value,
            patientPhone: this.patientPhone.value,
            patientEmail: this.patientEmail?.value ?? null,
            startTime: this.startTime,
          })
        );
      },
      reminderDue: (requireResponse: boolean): void => {
        this.addDomainEvent(
          new AppointmentReminderDueEvent({
            appointmentId: this.id.value,
            clinicId: this.clinicId.value,
            providerId: this.providerId.value,
            patientId: this.patientId.value,
            patientName: this.patientName.value,
            patientPhone: this.patientPhone.value,
            patientEmail: this.patientEmail?.value ?? null,
            startTime: this.startTime,
            requireResponse,
          })
        );
      },
      checkedIn: (): void => {
        this.addDomainEvent(
          new AppointmentCheckedInEvent({
            appointmentId: this.id.value,
            clinicId: this.clinicId.value,
            providerId: this.providerId.value,
            patientId: this.patientId.value,
            checkedInAt: this.checkedInAt ?? DateTimeManager.create(),
          })
        );
      },
      detailsUpdated: (): void => {
        this.addDomainEvent(
          new AppointmentDetailsUpdatedEvent({
            appointmentId: this.id.value,
            clinicId: this.clinicId.value,
            providerId: this.providerId.value,
            patientId: this.patientId.value,
          })
        );
      },
    };
  }

  public static schedule(props: CreateAppointmentProps): Appointment {
    const appointment = Appointment.create(props);
    appointment.addDomainEvent(
      new AppointmentScheduledEvent({
        appointmentId: appointment.id.value,
        clinicId: appointment.clinicId.value,
        providerId: appointment.providerId.value,
        patientId: appointment.patientId.value,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
      })
    );
    return appointment;
  }

  public static book(props: CreateAppointmentProps): Appointment {
    const appointment = Appointment.create(props);

    const now = DateTimeManager.create();

    if (DateTimeManager.isBefore(props.startTime, now)) {
      throw new AppointmentInvalidCreationDateException(props.startTime);
    }

    if (DateTimeManager.isBeforeOrEqual(props.endTime, props.startTime)) {
      throw new AppointmentInvalidTimeRangeException(
        props.startTime,
        props.endTime
      );
    }

    appointment.addDomainEvent(
      new AppointmentBookedEvent({
        appointmentId: appointment.id.value,
        clinicId: appointment.clinicId.value,
        providerId: appointment.providerId.value,
        patientId: appointment.patientId.value,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
      })
    );
    return appointment;
  }

  public static calculateEndTime({
    startTime,
    endTime,
    duration,
  }: CalculateEndTimeProps) {
    return endTimeCalculator({ startTime, endTime, duration });
  }

  private static create(props: CreateAppointmentProps): Appointment {
    const endTime = this.calculateEndTime({
      startTime: props.startTime,
      endTime: props.endTime,
      duration: props.duration,
    }).orThrow();

    const now = DateTimeManager.create();

    const dateRange = DateRange.create(props.startTime, endTime).orThrow();

    const timezone = TimeZone.create(props.timezone).orThrow().value;

    return new Appointment({
      id: UUID.createOrGenerate(props.id).value,

      patientName: props.patientName,
      patientPhone: Phone.create(props.patientPhone).orThrow().value,
      patientEmail: props.patientEmail
        ? Email.create(props.patientEmail).orThrow().value
        : null,
      patientId: UUID.create(props.patientId).orThrow().value,
      providerId: UUID.create(props.providerId).orThrow().value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      treatmentId: props.treatmentId
        ? UUID.create(props.treatmentId).orThrow().value
        : null,
      startTime: dateRange.startDate,
      endTime: dateRange.endDate,
      timezone,
      notes: props.notes ?? null,
      treatmentType: props.treatmentType ?? null,
      externalSystem: props.externalSystem ?? null,
      externalId: props.externalId ?? null,
      examinationType: props.examinationType ?? null,
      visitType: props.visitType ?? null,
      resourceId: props.resourceId ?? null,
      status: props.status ?? AppointmentStatusSchema.enum.PENDING,
      checkedInAt: null,
      reminderSentAt: null,
      canceledAt: null,
      canceledBy: null,
      cancelReason: null,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
      isConsultation: props.isConsultation,
      source: props.source ?? AppointmentSourceSchema.enum.CLINIC_INTERNAL,
      creatorType:
        props.creatorType ?? AppointmentCreatorTypeSchema.enum.CLINIC_STAFF,
      approvedAt: null,
      approvedBy: null,
      createdById: props.createdById ?? null,
      createdByRealName: props.createdByRealName ?? null,
      version: 0,
    });
  }

  public confirm(): void {
    this._status = AppointmentStatusSchema.enum.CONFIRMED;
    this._updatedAt = DateTimeManager.create();

    this.raiseEvent.confirmed();
  }

  public cancelSchedule(props: CancelScheduleProps): void {
    this.applyCancellation(props.canceledBy, props.reason);

    this._updatedAt = DateTimeManager.create();

    // sağlık turizmi iadesi + hasta bildirimi + audit
    // yan etkileri listener'da (AppointmentCancelledEvent) işlenir.
    this.raiseEvent.cancelled(props.canceledBy, props.reason);
  }

  /**
   * Hasta (Patient) tarafından yapılan iptal işlemi.
   *
   * NOT: Hastanın kendi iptal edip edemeyeceği (allowPatientCancel) ve iptalin
   * doğrudan mı yoksa "onay bekliyor" olarak mı işleneceği (cancelLimitHours)
   * kararı klinik ayarına bağlıdır ve handler'da verilir (settings okunur).
   * Bu metod çağrıldığında iptal fiilen uygulanır ve event raise edilir.
   */
  public cancelBooking(patientId?: string, reason?: string): void {
    if (!patientId) {
      throw new AppointmentPatientRequiredException();
    }

    this.applyCancellation(patientId, reason);

    this._updatedAt = DateTimeManager.create();

    this.raiseEvent.cancelled(patientId, reason);
  }

  public complete(eventPayload: IAuditLog): void {
    this._status = AppointmentStatusSchema.enum.COMPLETED;
    this._updatedAt = DateTimeManager.create();

    this.addDomainEvent(
      new AppointmentCompletedEvent({
        ...eventPayload,
        appointmentId: this.id.value,
        clinicId: this.clinicId.value,
        patientId: this.patientId.value,
        providerId: this.providerId.value,
      })
    );
  }

  public markAsNoShow(): void {
    this._status = AppointmentStatusSchema.enum.NOSHOW;
    this._updatedAt = DateTimeManager.create();
  }

  /**
   * Hasta kliniğe geldiğinde check-in (ARRIVED). Yalnız bekleyen/onaylanan
   * randevular check-in edilebilir; geliş zamanı (bekleme sırası için) işaretlenir.
   */
  public checkIn(): void {
    const now = DateTimeManager.create();
    this._status = AppointmentStatusSchema.enum.ARRIVED;
    this._checkedInAt = now;
    this._updatedAt = now;

    this.raiseEvent.checkedIn();
  }

  /**
   * Randevu hatırlatmasını "gönderildi" olarak işaretler (aynı randevuya tekrar
   * gönderimi önler) ve dış-kanal hatırlatmasını tetikleyen event'i fırlatır.
   * `requireResponse` klinik ayarından (iki yönlü onay) taşınır.
   */
  public markReminderSent(requireResponse = false): void {
    const now = DateTimeManager.create();
    this._reminderSentAt = now;
    this._updatedAt = now;

    this.raiseEvent.reminderDue(requireResponse);
  }

  public reschedule(props: RescheduleRequestProps): void {
    this.applyReschedule({
      startTime: props.startTime,
      endTime: props.endTime,
      providerId: props.providerId,
      notes: props.notes,
      treatmentId: props.treatmentId,
    });

    this._status = AppointmentStatusSchema.enum.CONFIRMED;
    this._updatedAt = DateTimeManager.create();

    this.raiseEvent.rescheduled();
  }

  /**
   * Hasta (Patient) tarafından yapılan yeniden zamanlama. Klinik ayarındaki
   * `rescheduleLimitHours` kadar saatten az kaldıysa reddedilir ve işlem onay
   * bekliyor (PENDING) statüsüne düşürülür.
   */
  public rescheduleByPatient(props: RescheduleByPatientProps): void {
    const now = DateTimeManager.create();
    const hoursLeft = DateTimeManager.diffInHours(this.startTime, now);

    const lastRescheduleTimeForPatient = props.rescheduleLimitHours;

    const isTooLate = hoursLeft < lastRescheduleTimeForPatient;

    if (isTooLate) {
      throw new AppointmentRescheduleWindowExpiredException(
        lastRescheduleTimeForPatient
      );
    }

    const isNewTimeInPast =
      DateTimeManager.isBefore(props.startTime, now) ||
      DateTimeManager.isSame(props.startTime, now);

    if (isNewTimeInPast) {
      throw new AppointmentPastDateException();
    }

    this.applyReschedule(props);
    this._status = AppointmentStatusSchema.enum.PENDING;
    this._updatedAt = DateTimeManager.create();

    this.raiseEvent.rescheduled();
  }

  /**
   * Personel (resepsiyon) tarafından randevu içerik alanlarının düzenlenmesi.
   * Zaman/doktor/durum DEĞİL — yalnız hasta iletişim, not, tedavi/muayene/ziyaret türü.
   * undefined alan dokunulmaz; null gönderilen nullable alan temizlenir. Kullanıcı
   * girişi VO'larla (Phone/Email/Name/UUID) doğrulanır.
   */
  public updateDetails(props: UpdateAppointmentDetailsProps): void {
    if (isNotUndefined(props.patientName))
      this._patientName = Name.create(props.patientName).orThrow();

    if (isNotUndefined(props.patientPhone))
      this._patientPhone = Phone.create(props.patientPhone).orThrow();

    if (isNotUndefined(props.patientEmail))
      this._patientEmail = props.patientEmail
        ? Email.create(props.patientEmail).orThrow()
        : null;

    if (isNotUndefined(props.notes)) this._notes = props.notes;

    if (isNotUndefined(props.treatmentType))
      this._treatmentType = props.treatmentType;

    if (isNotUndefined(props.treatmentId))
      this._treatmentId = props.treatmentId
        ? UUID.create(props.treatmentId).orThrow()
        : null;

    if (isNotUndefined(props.examinationType))
      this._examinationType = props.examinationType;

    if (isNotUndefined(props.visitType)) this._visitType = props.visitType;

    this._updatedAt = DateTimeManager.create();

    this.raiseEvent.detailsUpdated();
  }

  public rules(validateOptions: ValidateOptionsType = DefaultValidateOptions) {
    return new AppointmentRules(this.toRuleSnapshot(), validateOptions);
  }

  /**
   * Kuralların ihtiyaç duyduğu asgari veri. Kural sınıfı entity'ye bağlı olmadığı
   * için okuma tarafı da (read-model'den snapshot kurup) aynı kuralı çalıştırabilir.
   */
  public toRuleSnapshot(): AppointmentRuleSnapshot {
    return { id: this.id.value, status: this.status };
  }

  public toPersistence(): IAppointment {
    return {
      id: this.id.value,
      patientName: this.patientName.value,
      patientPhone: this.patientPhone.value,
      patientEmail: this.patientEmail?.value ?? null,
      startTime: this.startTime,
      endTime: this.endTime,
      timezone: this.timezone.value,
      treatmentType: this.treatmentType,
      notes: this.notes,
      status: this.status,
      checkedInAt: this.checkedInAt,
      reminderSentAt: this.reminderSentAt,
      canceledAt: this.canceledAt,
      canceledBy: this.canceledBy,
      cancelReason: this.cancelReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      externalSystem: this.externalSystem,
      externalId: this.externalId ?? null,
      treatmentId: this.treatmentId?.value ?? null,
      clinicId: this.clinicId.value,
      providerId: this.providerId.value,
      patientId: this.patientId.value,
      examinationType: this.examinationType,
      visitType: this.visitType,
      resourceId: this.resourceId ?? null,
      isDeleted: this.isDeleted,
      deletedAt: this.deletedAt,
      isConsultation: this.isConsultation,
      source: this.source,
      creatorType: this.creatorType,
      approvedAt: this.approvedAt,
      approvedBy: this.approvedBy,
      createdById: this.createdById,
      createdByRealName: this.createdByRealName?.value ?? null,
      version: this.version,
    };
  }

  private isNoShow(error?: Error) {
    const is = this._status === AppointmentStatusSchema.enum.NOSHOW;
    return Guard.monitor(
      is,
      is,
      () => error ?? new AppointmentNotNoShowException()
    );
  }

  private isCompleted(error?: Error) {
    const isCompleted = this._status === AppointmentStatusSchema.enum.COMPLETED;

    return Guard.monitor(
      isCompleted,
      isCompleted,
      () =>
        error ??
        new AppointmentNotCompletedException(this.id.value, this.status)
    );
  }

  private isCancelled(error?: Error) {
    const isCancelled = this._status === AppointmentStatusSchema.enum.CANCELLED;
    return Guard.monitor(
      isCancelled,
      isCancelled,
      () =>
        error ||
        new AppointmentNotCancelledException(this.id.value, this.status)
    );
  }

  private isConfirmed(error?: Error) {
    const isConfirmed = this._status === AppointmentStatusSchema.enum.CONFIRMED;
    return Guard.monitor(
      isConfirmed,
      isConfirmed,
      () =>
        error ??
        new AppointmentNotConfirmedException(this.id.value, this.status)
    );
  }

  private isPending(error?: Error) {
    const isPending = this._status === AppointmentStatusSchema.enum.PENDING;
    return Guard.monitor(
      isPending,
      isPending,
      () =>
        error ?? new AppointmentNotPendingException(this.id.value, this.status)
    );
  }

  /**
   * Yeniden zamanlama işlemlerinin ortak validasyon ve atama motoru (Private Helper)
   */
  private applyReschedule(props: RescheduleRequestProps): void {
    this._providerId = UUID.create(props.providerId).orThrow();

    this._timeRange = DateRange.create(
      props.startTime,
      props.endTime
    ).orThrow();

    if (isNotUndefined(props.notes)) this._notes = props.notes;

    if (isNotUndefined(props.treatmentId))
      this._treatmentId = props.treatmentId
        ? UUID.create(props.treatmentId).orThrow()
        : null;
  }

  private applyCancellation(canceledBy: string, reason?: string): void {
    this._cancellation = Cancellation.create({
      canceledBy,
      reason,
    }).orThrow();

    this._status = AppointmentStatusSchema.enum.CANCELLED;
  }
}
