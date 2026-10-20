import { LeaveRequest as ILeaveRequest } from '@shared';
import {
  LeaveTypeSchema,
  LeaveTypeType as LeaveType,
} from '@input-type-schemas/LeaveTypeSchema';
import {
  LeaveStatusSchema,
  LeaveStatusType as LeaveStatus,
} from '@input-type-schemas/LeaveStatusSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { RequestLeaveProps } from '@modules/hr/leave/domain/contracts/leave-request';
import { DateRange } from '@src/domain/value-objects/date-range.vo';
import { Guard } from '@common/domain/guards';
import { ValidateOptionsType } from '@shared/common/validate-options/validate-options.type';
import { LeaveRequestRules } from '@modules/hr/leave/domain/rules/leave-request.rules';

/** İzin talebi. Gün sayısı dahil (inclusive) hesaplanır; ANNUAL onaylanınca bakiyeden düşer. */
export class LeaveRequest extends AggregateRoot {
  constructor(data: ILeaveRequest) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._employeeId = UUID.fromTrusted(data.employeeId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._type = data.type;
    this._status = data.status;
    this._dateRange = DateRange.fromTrusted(data.startDate, data.endDate);
    this._days = data.days;
    this._reason = data.reason;
    this._reviewedById = data.reviewedById;
    this._reviewedAt = data.reviewedAt;
    this._reviewNote = data.reviewNote;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _employeeId: UUID;
  get employeeId(): UUID {
    return this._employeeId;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _type: LeaveType;
  get type(): LeaveType {
    return this._type;
  }

  private _status: LeaveStatus;
  get status(): LeaveStatus {
    return this._status;
  }

  private _dateRange: DateRange;
  get dateRange(): DateRange {
    return this._dateRange;
  }

  get startDate(): Date {
    return this.dateRange.startDate;
  }

  get endDate(): Date {
    return this.dateRange.endDate;
  }

  private _days: number;
  get days(): number {
    return this._days;
  }

  private _reason: string | null;
  get reason(): string | null {
    return this._reason;
  }

  private _reviewedById: string | null;
  get reviewedById(): string | null {
    return this._reviewedById;
  }

  private _reviewedAt: Date | null;
  get reviewedAt(): Date | null {
    return this._reviewedAt;
  }

  private _reviewNote: string | null;
  get reviewNote(): string | null {
    return this._reviewNote;
  }

  private _leaveDateRange: DateRange;
  get leaveDateRange(): DateRange {
    return this._leaveDateRange;
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
      status: {
        isPending: () => this.isPending(),
        isRejected: () => this.isRejected(),
        isCancelled: () => this.isCancelled(),
      },
      type: {
        isAnnual: () => this.isAnnual(),
      },
    };
  }

  public static create(props: RequestLeaveProps): LeaveRequest {
    const dateRange = DateRange.create(
      props.startDate,
      props.endDate
    ).orThrow();

    const now = DateTimeManager.create();
    const days = DateTimeManager.diffInDays(props.endDate, props.startDate) + 1;

    return new LeaveRequest({
      id: UUID.createOrGenerate(props.id).value,
      employeeId: UUID.create(props.employeeId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      type: props.type,
      status: LeaveStatusSchema.enum.PENDING,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      days,
      reason: props.reason ?? null,
      reviewedById: null,
      reviewedAt: null,
      reviewNote: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public rules(validateOptions?: ValidateOptionsType) {
    return new LeaveRequestRules(this, validateOptions);
  }

  public approve(reviewerId: string, note?: string | null): void {
    this._status = LeaveStatusSchema.enum.APPROVED;
    this.applyReview(reviewerId, note);
  }

  public reject(reviewerId: string, note?: string | null): void {
    this._status = LeaveStatusSchema.enum.REJECTED;
    this.applyReview(reviewerId, note);
  }

  /** Çalışan/İK iptali — sonuçlanmış (REJECTED/CANCELLED) talep iptal edilemez. */
  public cancel(): void {
    this._status = LeaveStatusSchema.enum.CANCELLED;
    this._updatedAt = DateTimeManager.create();
  }

  public toPersistence(): ILeaveRequest {
    return {
      id: this.id.value,
      employeeId: this.employeeId.value,
      organizationId: this.organizationId.value,
      clinicId: this.clinicId.value,
      type: this.type,
      status: this.status,
      startDate: this.startDate,
      endDate: this.endDate,
      days: this.days,
      reason: this.reason,
      reviewedById: this.reviewedById,
      reviewedAt: this.reviewedAt,
      reviewNote: this.reviewNote,
      createdAt: this.createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }

  private isAnnual() {
    const is = this._type === LeaveTypeSchema.enum.ANNUAL;
    return Guard.monitor(is, is, () => new Error('Yıllık değil'));
  }

  private isPending() {
    const is = this._status === LeaveStatusSchema.enum.PENDING;
    return Guard.monitor(is, is, () => new Error('Beklemede değil'));
  }

  private isRejected() {
    const is = this._status === LeaveStatusSchema.enum.REJECTED;
    return Guard.monitor(is, is, () => new Error('Reddedilmiş durumda değil.'));
  }

  private isCancelled() {
    const is = this._status === LeaveStatusSchema.enum.PENDING;
    return Guard.monitor(is, is, () => new Error('İptal edilmiş değil'));
  }

  private applyReview(reviewerId: string, note?: string | null): void {
    this._reviewedById = reviewerId;
    this._reviewedAt = DateTimeManager.create();
    this._reviewNote = note ?? null;
    this._updatedAt = DateTimeManager.create();
  }
}
