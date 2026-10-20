import { ClinicAppointmentSettings as IClinicAppointmentSettings } from '@shared';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { Guard } from '@common/domain/guards';
import {
  CreateClinicAppointmentSettingsProps,
  UpdateClinicAppointmentSettingsProps,
} from '@modules/organization/clinic/domain/contracts/clinic-appointment-settings';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DefaultValidateOptions } from '@common/domain/constants/default-options.constant';
import { shouldValidate } from '@common/domain/utils/should-validate';
import { isNotUndefined } from '@common/utils/is-not-undefined';

interface AppointmentSettingsInvariants {
  rescheduleLimitHours: number;
  cancelLimitHours: number;
  sendSmsReminderHours: number;
  maxActivePatientBookings: number;
  maxFutureBookingDays: number;
  slotDurationMinutes: number;
}

/**
 * Kliniğin randevu davranış ayarları (1:1 satellite). Hastanın panelden kendi
 * randevusunu iptal/erteleme sınırları (saat), sekreter onay zorunluluğu ve en
 * ileri randevu tarihini taşır. Satır yoksa {@link ClinicAppointmentSettings.createDefault}
 * ile DB default'ları geçerlidir.
 */
export class ClinicAppointmentSettings {
  constructor(data: IClinicAppointmentSettings) {
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._allowPatientBooking = data.allowPatientBooking;
    this._rescheduleLimitHours = data.rescheduleLimitHours;
    this._cancelLimitHours = data.cancelLimitHours;
    this._allowPatientCancel = data.allowPatientCancel;
    this._staffAllowOverbooking = data.staffAllowOverbooking;
    this._sendSmsReminderHours = data.sendSmsReminderHours;
    this._maxActivePatientBookings = data.maxActivePatientBookings;
    this._requireReminderResponse = data.requireReminderResponse;
    this._requireConfirmation = data.requireConfirmation;
    this._maxFutureBookingDays = data.maxFutureBookingDays;
    this._slotDurationMinutes = data.slotDurationMinutes;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  // TODO: validator kaldırılacak. domain rules oluşturulacak
  /** Girişlerin iş kuralı barikatı — create sırasında koşulur. */
  private static get businessRulesValidator() {
    return {
      create: (input: AppointmentSettingsInvariants) => {
        const nonNegativeInvalid =
          input.rescheduleLimitHours < 0 ||
          input.cancelLimitHours < 0 ||
          input.sendSmsReminderHours < 0;
        const bookingsInvalid = input.maxActivePatientBookings < 1;
        const futureDaysInvalid = input.maxFutureBookingDays < 1;
        const slotDurationInvalid = input.slotDurationMinutes < 5;
        const isInvalid =
          nonNegativeInvalid ||
          bookingsInvalid ||
          futureDaysInvalid ||
          slotDurationInvalid;

        return {
          isValid: !isInvalid,
          orThrow: () => {
            if (nonNegativeInvalid) {
              throw new Error('Saat sınırları negatif olamaz.');
            }
            if (bookingsInvalid) {
              throw new Error('Aktif randevu limiti en az 1 olmalı.');
            }
            if (futureDaysInvalid) {
              throw new Error('İleri randevu gün sınırı en az 1 olmalı.');
            }
            if (slotDurationInvalid) {
              throw new Error('Slot süresi en az 5 dakika olmalı.');
            }
          },
        };
      },
    };
  }

  private _id: UUID;

  get id(): UUID {
    return this._id;
  }

  private _clinicId: UUID;

  get clinicId(): UUID {
    return this._clinicId;
  }

  private _allowPatientBooking: boolean;

  /** Hasta kendi randevusunu panelden oluşturabilir mi? */
  get allowPatientBooking(): boolean {
    return this._allowPatientBooking;
  }

  private _rescheduleLimitHours: number;

  /** Randevuya bu kadar saatten az kaldıysa hasta panelden erteleyemez. */
  get rescheduleLimitHours(): number {
    return this._rescheduleLimitHours;
  }

  private _cancelLimitHours: number;

  /** Randevuya bu kadar saatten az kaldıysa hasta panelden iptal edemez. */
  get cancelLimitHours(): number {
    return this._cancelLimitHours;
  }

  private _allowPatientCancel: boolean;

  /** Hasta kendi randevusunu panelden iptal edebilir mi? */
  get allowPatientCancel(): boolean {
    return this._allowPatientCancel;
  }

  private _staffAllowOverbooking: boolean;

  /** Personel aynı hekime/koltuğa çift randevu (overbooking) yazabilsin mi? */
  get staffAllowOverbooking(): boolean {
    return this._staffAllowOverbooking;
  }

  private _sendSmsReminderHours: number;

  /** Randevuya kaç saat kala hatırlatma gönderilsin? */
  get sendSmsReminderHours(): number {
    return this._sendSmsReminderHours;
  }

  private _maxActivePatientBookings: number;

  /** Bir hastanın aynı anda gelecekte sahip olabileceği maksimum randevu sayısı. */
  get maxActivePatientBookings(): number {
    return this._maxActivePatientBookings;
  }

  private _requireReminderResponse: boolean;

  /** Hastadan hatırlatmaya "geleceğim/gelmeyeceğim" onayı zorunlu kılınsın mı? */
  get requireReminderResponse(): boolean {
    return this._requireReminderResponse;
  }

  private _requireConfirmation: boolean;

  /** Randevu alındığında sekreter onayı gereksin mi? */
  get requireConfirmation(): boolean {
    return this._requireConfirmation;
  }

  private _maxFutureBookingDays: number;

  /** En fazla kaç gün sonrasına randevu açılabilir? */
  get maxFutureBookingDays(): number {
    return this._maxFutureBookingDays;
  }

  private _slotDurationMinutes: number;

  /** Açık randevu slotları bu adımla (dakika) üretilir. */
  get slotDurationMinutes(): number {
    return this._slotDurationMinutes;
  }

  private _createdAt: Date;

  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Durum sorguları (Guard tabanlı). */
  public get validate() {
    return {
      patientBooking: {
        isAllowed: Guard.monitor(
          this.allowPatientBooking,
          this.allowPatientBooking,
          () => new Error('Hasta panelden randevu oluşturamaz.')
        ),
      },
      confirmation: {
        isRequired: Guard.monitor(
          this.requireConfirmation,
          this.requireConfirmation,
          () => new Error('Sekreter onayı zorunlu değil.')
        ),
      },
      patientCancel: {
        isAllowed: Guard.monitor(
          this.allowPatientCancel,
          this.allowPatientCancel,
          () => new Error('Hasta panelden iptal edemez.')
        ),
      },
      reminderResponse: {
        isRequired: Guard.monitor(
          this.requireReminderResponse,
          this.requireReminderResponse,
          () => new Error('Hatırlatma yanıtı zorunlu değil.')
        ),
      },
    };
  }

  /** Klinik için varsayılan randevu ayarları. */
  public static createDefault(clinicId: string): ClinicAppointmentSettings {
    return ClinicAppointmentSettings.create({ clinicId });
  }

  public static create(
    props: CreateClinicAppointmentSettingsProps,
    validateOptions = DefaultValidateOptions
  ): ClinicAppointmentSettings {
    const rescheduleLimitHours = props.rescheduleLimitHours ?? 6;
    const cancelLimitHours = props.cancelLimitHours ?? 24;
    const sendSmsReminderHours = props.sendSmsReminderHours ?? 24;
    const maxActivePatientBookings = props.maxActivePatientBookings ?? 3;
    const maxFutureBookingDays = props.maxFutureBookingDays ?? 90;
    const slotDurationMinutes = props.slotDurationMinutes ?? 30;

    if (shouldValidate(validateOptions))
      ClinicAppointmentSettings.businessRulesValidator
        .create({
          rescheduleLimitHours,
          cancelLimitHours,
          sendSmsReminderHours,
          maxActivePatientBookings,
          maxFutureBookingDays,
          slotDurationMinutes,
        })
        .orThrow();

    const now = DateTimeManager.create();
    return new ClinicAppointmentSettings({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      allowPatientBooking: props.allowPatientBooking ?? true,
      rescheduleLimitHours,
      cancelLimitHours,
      allowPatientCancel: props.allowPatientCancel ?? true,
      staffAllowOverbooking: props.staffAllowOverbooking ?? true,
      sendSmsReminderHours,
      maxActivePatientBookings,
      requireReminderResponse: props.requireReminderResponse ?? false,
      requireConfirmation: props.requireConfirmation ?? false,
      maxFutureBookingDays,
      slotDurationMinutes,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Ayarların kısmi güncellemesi. Yalnız gönderilen alanlar değişir; sayısal
   * invariant'lar (saat sınırları ≥0, aktif randevu/ileri gün ≥1, slot ≥5dk)
   * güncel değerlerle yeniden doğrulanır.
   */

  // TODO: validate options kaldırılacak. rules oluşturulacak.
  public update(
    props: UpdateClinicAppointmentSettingsProps,
    validateOptions = DefaultValidateOptions
  ): void {
    const rescheduleLimitHours =
      props.rescheduleLimitHours ?? this._rescheduleLimitHours;
    const cancelLimitHours = props.cancelLimitHours ?? this._cancelLimitHours;
    const sendSmsReminderHours =
      props.sendSmsReminderHours ?? this._sendSmsReminderHours;
    const maxActivePatientBookings =
      props.maxActivePatientBookings ?? this._maxActivePatientBookings;
    const maxFutureBookingDays =
      props.maxFutureBookingDays ?? this._maxFutureBookingDays;
    const slotDurationMinutes =
      props.slotDurationMinutes ?? this._slotDurationMinutes;

    if (shouldValidate(validateOptions))
      ClinicAppointmentSettings.businessRulesValidator
        .create({
          rescheduleLimitHours,
          cancelLimitHours,
          sendSmsReminderHours,
          maxActivePatientBookings,
          maxFutureBookingDays,
          slotDurationMinutes,
        })
        .orThrow();

    this._rescheduleLimitHours = rescheduleLimitHours;
    this._cancelLimitHours = cancelLimitHours;
    this._sendSmsReminderHours = sendSmsReminderHours;
    this._maxActivePatientBookings = maxActivePatientBookings;
    this._maxFutureBookingDays = maxFutureBookingDays;
    this._slotDurationMinutes = slotDurationMinutes;

    if (isNotUndefined(props.allowPatientBooking))
      this._allowPatientBooking = props.allowPatientBooking;
    if (isNotUndefined(props.allowPatientCancel))
      this._allowPatientCancel = props.allowPatientCancel;
    if (isNotUndefined(props.staffAllowOverbooking))
      this._staffAllowOverbooking = props.staffAllowOverbooking;
    if (isNotUndefined(props.requireReminderResponse))
      this._requireReminderResponse = props.requireReminderResponse;
    if (isNotUndefined(props.requireConfirmation))
      this._requireConfirmation = props.requireConfirmation;

    this._updatedAt = DateTimeManager.create();
  }

  toPersistence(): IClinicAppointmentSettings {
    return {
      id: this.id.value,
      clinicId: this.clinicId.value,
      allowPatientBooking: this.allowPatientBooking,
      rescheduleLimitHours: this.rescheduleLimitHours,
      cancelLimitHours: this.cancelLimitHours,
      allowPatientCancel: this.allowPatientCancel,
      staffAllowOverbooking: this.staffAllowOverbooking,
      sendSmsReminderHours: this.sendSmsReminderHours,
      maxActivePatientBookings: this.maxActivePatientBookings,
      requireReminderResponse: this.requireReminderResponse,
      requireConfirmation: this.requireConfirmation,
      maxFutureBookingDays: this.maxFutureBookingDays,
      slotDurationMinutes: this.slotDurationMinutes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
