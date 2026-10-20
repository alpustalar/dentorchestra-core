import { AttendanceRecord as IAttendanceRecord } from '@shared';
import {
  AttendanceStatusSchema,
  AttendanceStatusType as AttendanceStatus,
} from '@input-type-schemas/AttendanceStatusSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  CheckInProps,
  RecordAttendanceProps,
} from '@modules/hr/attendance/domain/contracts/attendance-record';
import {
  AttendanceAlreadyClosedException,
  AttendanceInvalidTimeRangeException,
} from '@modules/hr/attendance/domain/exceptions/attendance.exceptions';

/** Standart iş günü süresi (8 saat) — bunun üzeri fazla mesai sayılır. */
const STANDARD_WORKDAY_MINUTES = 480;

/** Çalışan devam/mesai kaydı. Çalışan+gün başına tek kayıt; giriş/çıkış üzerinden çalışılan/fazla mesai dakikası türetilir. */
export class AttendanceRecord extends AggregateRoot {
  constructor(data: IAttendanceRecord) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._employeeId = UUID.fromTrusted(data.employeeId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._workDate = data.workDate;
    this._checkInAt = data.checkInAt;
    this._checkOutAt = data.checkOutAt;
    this._workedMinutes = data.workedMinutes;
    this._overtimeMinutes = data.overtimeMinutes;
    this._status = data.status;
    this._note = data.note;
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

  private _workDate: Date;
  get workDate(): Date {
    return this._workDate;
  }

  private _checkInAt: Date;
  get checkInAt(): Date {
    return this._checkInAt;
  }

  private _checkOutAt: Date | null;
  get checkOutAt(): Date | null {
    return this._checkOutAt;
  }

  private _workedMinutes: number | null;
  get workedMinutes(): number | null {
    return this._workedMinutes;
  }

  private _overtimeMinutes: number;
  get overtimeMinutes(): number {
    return this._overtimeMinutes;
  }

  private _status: AttendanceStatus;
  get status(): AttendanceStatus {
    return this._status;
  }

  private _note: string | null;
  get note(): string | null {
    return this._note;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Çalışanın kendi kendine girişi — o günün ilk (ve tek) kaydını açar. */
  public static checkIn(props: CheckInProps): AttendanceRecord {
    const now = DateTimeManager.create();

    return new AttendanceRecord({
      id: UUID.createOrGenerate(props.id).value,
      employeeId: UUID.create(props.employeeId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      workDate: DateTimeManager.startOfDay(now),
      checkInAt: now,
      checkOutAt: null,
      workedMinutes: null,
      overtimeMinutes: 0,
      status: AttendanceStatusSchema.enum.OPEN,
      note: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** HR manuel giriş/düzeltme — geçmişe dönük veya unutulan çıkışı elle kapatır. */
  public static record(props: RecordAttendanceProps): AttendanceRecord {
    if (props.checkOutAt < props.checkInAt) {
      throw new AttendanceInvalidTimeRangeException();
    }

    const now = DateTimeManager.create();
    const workedMinutes = DateTimeManager.diffInMinutes(
      props.checkOutAt,
      props.checkInAt
    );

    return new AttendanceRecord({
      id: UUID.createOrGenerate(props.id).value,
      employeeId: UUID.create(props.employeeId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      workDate: DateTimeManager.startOfDay(props.workDate),
      checkInAt: props.checkInAt,
      checkOutAt: props.checkOutAt,
      workedMinutes,
      overtimeMinutes: Math.max(0, workedMinutes - STANDARD_WORKDAY_MINUTES),
      status: AttendanceStatusSchema.enum.CLOSED,
      note: props.note ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public isOpen(): boolean {
    return this._status === AttendanceStatusSchema.enum.OPEN;
  }

  public checkOut(): void {
    if (!this.isOpen()) {
      throw new AttendanceAlreadyClosedException(this.id.value);
    }

    const now = DateTimeManager.create();
    const workedMinutes = DateTimeManager.diffInMinutes(now, this._checkInAt);

    this._checkOutAt = now;
    this._workedMinutes = workedMinutes;
    this._overtimeMinutes = Math.max(
      0,
      workedMinutes - STANDARD_WORKDAY_MINUTES
    );
    this._status = AttendanceStatusSchema.enum.CLOSED;
    this._updatedAt = now;
  }

  public toPersistence(): IAttendanceRecord {
    return {
      id: this.id.value,
      employeeId: this.employeeId.value,
      organizationId: this.organizationId.value,
      clinicId: this.clinicId.value,
      workDate: this.workDate,
      checkInAt: this.checkInAt,
      checkOutAt: this.checkOutAt,
      workedMinutes: this.workedMinutes,
      overtimeMinutes: this.overtimeMinutes,
      status: this.status,
      note: this.note,
      createdAt: this.createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }
}
