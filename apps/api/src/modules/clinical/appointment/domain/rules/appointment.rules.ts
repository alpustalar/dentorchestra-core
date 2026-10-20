import { Validate } from '@common/interfaces';
import {
  AppointmentCancellationNotAllowedException,
  AppointmentCannotCompleteException,
  AppointmentCheckInNotAllowedException,
  AppointmentInvalidNoShowStatusException,
  AppointmentOnlyPendingCanBeConfirmedException,
  AppointmentRescheduleNotAllowedException,
} from '@modules/clinical/appointment/domain/exceptions/appointment.exceptions';
import { AppointmentStatusSchema } from '@shared';
import { BaseRules } from '@common/domain/rules/base.rules';
import { DefaultValidateOptions } from '@common/domain/constants/default-options.constant';
import { ValidateOptionsType } from '@shared/common/validate-options/validate-options.type';
import { IAppointmentRules } from '@modules/clinical/appointment/domain/interfaces/appointment.rules.interface';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { AppointmentStatusType } from '@input-type-schemas/AppointmentStatusSchema';
import {
  AppointmentRuleSnapshot,
  CreateAppointmentProps,
} from '@modules/clinical/appointment/domain/contracts/appointment';

/** Bir işlemin üzerinde yapılamayacağı, sonuçlanmış (terminal) durumlar. */
const SETTLED_STATUSES: AppointmentStatusType[] = [
  AppointmentStatusSchema.enum.CANCELLED,
  AppointmentStatusSchema.enum.COMPLETED,
  AppointmentStatusSchema.enum.NOSHOW,
];

/** Henüz gerçekleşmemiş, işleme açık durumlar. */
const OPEN_STATUSES: AppointmentStatusType[] = [
  AppointmentStatusSchema.enum.PENDING,
  AppointmentStatusSchema.enum.CONFIRMED,
];

/**
 * Randevu iş kuralları. Entity'ye değil düz {@link AppointmentRuleSnapshot}'a
 * bağlıdır: command tarafı `appointment.rules()` ile entity'nin snapshot'ını
 * geçer, okuma tarafı aynı kuralı bir read-model'den kurup entity hydrate etmeden
 * çalıştırabilir. Kural tek yerde yaşar, iki tüketicisi olur.
 */
export class AppointmentRules extends BaseRules implements IAppointmentRules {
  constructor(
    private readonly snapshot: AppointmentRuleSnapshot,
    private readonly validateOptions: ValidateOptionsType = DefaultValidateOptions
  ) {
    super();
  }

  public get markAsNoShow(): Validate {
    return this.evaluate(
      OPEN_STATUSES.includes(this.status),
      () =>
        new AppointmentInvalidNoShowStatusException(
          this.snapshot.id,
          this.status
        ),
      this.validateOptions
    );
  }

  public get checkIn(): Validate {
    return this.evaluate(
      OPEN_STATUSES.includes(this.status),
      () => new AppointmentCheckInNotAllowedException(this.status),
      this.validateOptions
    );
  }

  public get complete(): Validate {
    return this.evaluate(
      !SETTLED_STATUSES.includes(this.status),
      () =>
        new AppointmentCannotCompleteException(this.snapshot.id, this.status),
      this.validateOptions
    );
  }

  public get confirm(): Validate {
    return this.evaluate(
      this.status === AppointmentStatusSchema.enum.PENDING,
      () =>
        new AppointmentOnlyPendingCanBeConfirmedException(
          this.snapshot.id,
          this.status
        ),
      this.validateOptions
    );
  }

  public get canBeCancelled(): Validate {
    return this.evaluate(
      !SETTLED_STATUSES.includes(this.status),
      () => new AppointmentCancellationNotAllowedException(),
      this.validateOptions
    );
  }

  public get canBeScheduled(): Validate {
    return this.evaluate(
      !SETTLED_STATUSES.includes(this.status),
      () =>
        new AppointmentRescheduleNotAllowedException(
          this.snapshot.id,
          this.status
        ),
      this.validateOptions
    );
  }

  private get status(): AppointmentStatusType {
    return this.snapshot.status;
  }

  public schedule(props: Pick<CreateAppointmentProps, 'startTime'>) {
    const { isValid, error } = this.create(props);
    return this.evaluate(isValid, () => error, this.validateOptions);
  }

  public reschedule(startTime: Date, endTime: Date): Validate {
    const now = DateTimeManager.create();
    const isInvalid =
      DateTimeManager.isBefore(startTime, now) ||
      DateTimeManager.isBeforeOrEqual(endTime, startTime);

    return this.evaluate(
      !isInvalid,
      () => new Error('Geçersiz başlangıç zamanı'),
      this.validateOptions
    );
  }

  private create(props: Pick<CreateAppointmentProps, 'startTime'>) {
    const now = DateTimeManager.create();
    const isInvalid = DateTimeManager.isBefore(props.startTime, now);

    return {
      isValid: !isInvalid,
      error: new Error('Randevu başlangıç tarihi geçmişte olamaz'),
    };
  }
}
