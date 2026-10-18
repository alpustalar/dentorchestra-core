import {
  AccountingPeriod as IAccountingPeriod,
  AccountingPeriodStatusSchema,
} from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { DateTimeManager } from '@common/utils';

import { AccountingPeriodStatusType as AccountingPeriodStatus } from '@input-type-schemas/AccountingPeriodStatusSchema';
import {
  AccountingPeriodTransitionProps,
  CreateAccountingPeriodProps,
} from '@modules/finance/accounting/periods/domain/contracts/accounting-period';
import {
  InvalidPeriodLockException,
  InvalidPeriodReopenException,
  InvalidPeriodYearException,
  PeriodAlreadyClosedException,
  PeriodNotClosedException,
  PeriodNotLockedException,
  PeriodNotOpenException,
} from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';
import {
  AccountingPeriodClosedEvent,
  AccountingPeriodEventPayload,
  AccountingPeriodLockedEvent,
  AccountingPeriodOpenedEvent,
  AccountingPeriodReopenedEvent,
} from '@modules/finance/accounting/periods/domain/events';
import { BaseEvent } from '@common/interfaces';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Guard } from '@common/domain/guards';
import { LogAction, LogType } from '@src/domain/constants/log-action.constant';

export class AccountingPeriod extends AggregateRoot {
  constructor(data: IAccountingPeriod) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._year = data.year;
    this._status = data.status;
    this._startsAt = data.startsAt;
    this._endsAt = data.endsAt;
    this._lastEntryNo = data.lastEntryNo;
    this._lockedAt = data.lockedAt;
    this._lockedById = data.lockedById;
    this._reopenedAt = data.reopenedAt;
    this._reopenedById = data.reopenedById;
    this._closedAt = data.closedAt;
    this._closedById = data.closedById;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _year: number;
  get year(): number {
    return this._year;
  }

  private _status: AccountingPeriodStatus;
  get status(): AccountingPeriodStatus {
    return this._status;
  }

  private _startsAt: Date;
  get startsAt(): Date {
    return this._startsAt;
  }

  private _endsAt: Date;
  get endsAt(): Date {
    return this._endsAt;
  }

  /**
   * Yevmiye numarası sayacı. **Entity bu değeri asla ilerletmez**: numara,
   * fişin yazıldığı transaction içinde `lockAndAllocateEntryNo` ile satır
   * kilidi altında DB'de artırılır (bkz. `IAccountingPeriodCommandRepository`).
   * Burada yalnız okunur taşınır ki `toPersistence()` dönüşü tam olsun.
   */
  private _lastEntryNo: bigint;
  get lastEntryNo(): bigint {
    return this._lastEntryNo;
  }

  private _lockedAt: Date | null;
  get lockedAt(): Date | null {
    return this._lockedAt;
  }

  private _lockedById: string | null;
  get lockedById(): string | null {
    return this._lockedById;
  }

  private _reopenedAt: Date | null;
  get reopenedAt(): Date | null {
    return this._reopenedAt;
  }

  private _reopenedById: string | null;
  get reopenedById(): string | null {
    return this._reopenedById;
  }

  private _closedAt: Date | null;
  get closedAt(): Date | null {
    return this._closedAt;
  }

  private _closedById: string | null;
  get closedById(): string | null {
    return this._closedById;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  public get validate() {
    return {
      isOpen: this.isOpen,
      isClosed: this.isClosed,
      isLocked: this.isLocked,
      isOpenOrLocked: this.validateIsOpenOrLocked,
    };
  }

  private get isOpen(): Guard<boolean> {
    const isOpen = this._status === AccountingPeriodStatusSchema.enum.OPEN;
    return Guard.monitor(
      isOpen,
      isOpen,
      () => new PeriodNotOpenException(this.id.value, this.status)
    );
  }

  private get isLocked(): Guard<boolean> {
    const isLocked = this._status === AccountingPeriodStatusSchema.enum.LOCKED;
    return Guard.monitor(
      isLocked,
      isLocked,
      () => new PeriodNotLockedException(this.id.value, this.status)
    );
  }

  private get isClosed(): Guard<boolean> {
    const isClosed = this._status === AccountingPeriodStatusSchema.enum.CLOSED;
    return Guard.monitor(
      isClosed,
      isClosed,
      () => new PeriodNotClosedException(this.id.value, this.status)
    );
  }

  private get validateIsOpenOrLocked(): Guard<boolean> {
    return Guard.monitor(
      !this.isClosed.value,
      !this.isClosed.value,
      () => new PeriodAlreadyClosedException(this.id.value, this.year)
    );
  }

  public static create(props: CreateAccountingPeriodProps): AccountingPeriod {
    this.assertValidYear(props.year);

    const now = DateTimeManager.create();

    const period = new AccountingPeriod({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      year: props.year,
      status: AccountingPeriodStatusSchema.enum.OPEN,
      // VARSAYIM: mali yıl **takvim yılıdır** ve sınırları `DateTimeManager`'ın
      // varsayılan saat dilimine (Europe/Istanbul) göre hesaplanır — ürün Türkiye
      // mevzuatına göre çalışıyor (bkz. documents/finans/README.md varsayımlar).
      // Başka saat dilimindeki bir klinik ya da özel hesap dönemi (takvim yılı
      // olmayan) desteklenecekse bu iki satır kliniğin ayarından beslenmelidir.
      startsAt: DateTimeManager.startOfYear(props.year),
      endsAt: DateTimeManager.endOfYear(props.year),
      lastEntryNo: 0n,
      lockedAt: null,
      lockedById: null,
      reopenedAt: null,
      reopenedById: null,
      closedAt: null,
      closedById: null,
      createdAt: now,
      updatedAt: now,
    });

    period.raiseTransitionEvent(
      AccountingPeriodOpenedEvent,
      LogAction.ACCOUNTING_PERIOD_OPENED,
      props
    );

    return period;
  }

  /**
   * Yıl aralığı HTTP sınırında da doğrulanır (`OpenPeriodSchema`); buradaki kontrol
   * DTO'dan geçmeyen iç çağrılar (klinik kaydı, zamanlanmış dönem açma işi) içindir.
   */
  private static assertValidYear(year: number): void {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new InvalidPeriodYearException(year);
    }
  }

  public lock(props: AccountingPeriodTransitionProps): void {
    if (!this.isOpen.value) {
      throw new InvalidPeriodLockException(this.status);
    }
    const now = DateTimeManager.create();
    this._status = AccountingPeriodStatusSchema.enum.LOCKED;
    this._lockedAt = now;
    this._lockedById = props.actorId;
    this._updatedAt = now;

    this.raiseTransitionEvent(
      AccountingPeriodLockedEvent,
      LogAction.ACCOUNTING_PERIOD_LOCKED,
      props
    );
  }

  public reopen(props: AccountingPeriodTransitionProps): void {
    if (!this.isLocked.value) {
      throw new InvalidPeriodReopenException(this.status);
    }
    const now = DateTimeManager.create();
    this._status = AccountingPeriodStatusSchema.enum.OPEN;
    this._reopenedAt = now;
    this._reopenedById = props.actorId;
    this._updatedAt = now;

    this.raiseTransitionEvent(
      AccountingPeriodReopenedEvent,
      LogAction.ACCOUNTING_PERIOD_REOPENED,
      props
    );
  }

  public close(props: AccountingPeriodTransitionProps): void {
    if (this.isClosed.value) {
      throw new PeriodAlreadyClosedException(this.id.value, this.year);
    }
    const now = DateTimeManager.create();
    this._status = AccountingPeriodStatusSchema.enum.CLOSED;
    this._closedAt = now;
    this._closedById = props.actorId;
    this._updatedAt = now;

    this.raiseTransitionEvent(
      AccountingPeriodClosedEvent,
      LogAction.ACCOUNTING_PERIOD_CLOSED,
      props
    );
  }

  public toPersistence(): IAccountingPeriod {
    return {
      id: this._id.value,
      clinicId: this._clinicId.value,
      organizationId: this._organizationId.value,
      year: this._year,
      status: this._status,
      startsAt: this._startsAt,
      endsAt: this._endsAt,
      lastEntryNo: this._lastEntryNo,
      lockedAt: this._lockedAt,
      lockedById: this._lockedById,
      reopenedAt: this._reopenedAt,
      reopenedById: this._reopenedById,
      closedAt: this._closedAt,
      closedById: this._closedById,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  /**
   * Dört geçiş de aynı gövdeyi (dönem kimliği + denetim alanları) taşıyor;
   * tek yerden kurulur ki bir alan eklendiğinde üç kopya geride kalmasın.
   */
  private raiseTransitionEvent(
    EventClass: new (payload: AccountingPeriodEventPayload) => BaseEvent,
    action: LogAction,
    props: AccountingPeriodTransitionProps
  ): void {
    this.addDomainEvent(
      new EventClass({
        periodId: this._id.value,
        clinicId: this._clinicId.value,
        organizationId: this._organizationId.value,
        year: this._year,
        action,
        type: LogType.INFO,
        actorId: props.actorId,
        source: props.source,
      })
    );
  }
}
