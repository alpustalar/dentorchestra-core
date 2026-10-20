import { Activity as IActivity } from '@shared';
import { ActivityTypeType as ActivityType } from '@input-type-schemas/ActivityTypeSchema';
import {
  ActivityStatusSchema,
  ActivityStatusType as ActivityStatus,
} from '@input-type-schemas/ActivityStatusSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { isDefined } from '@common/utils';
import { isNotUndefined } from '@common/utils/is-not-undefined';
import {
  CreateActivityProps,
  UpdateActivityProps,
} from '@modules/crm/activity/domain/contracts/activity';
import { ValidateOptionsType } from '@shared/common/validate-options/validate-options.type';
import { ActivityRules } from '@modules/crm/activity/domain/rules/activity.rules';

/**
 * Lead (ve opsiyonel Patient) üzerine kaydedilen satış aktivitesi: arama/not/görev/toplantı.
 * NOTE anlık kayıttır (tamamlanamaz). CALL/TASK/MEETING zamanlanır (dueAt) ve tamamlanır.
 */
export class Activity extends AggregateRoot {
  constructor(data: IActivity) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._leadId = UUID.create(data.leadId).instance ?? null;
    this._patientId = UUID.create(data.patientId).instance ?? null;
    this._type = data.type;
    this._status = data.status;
    this._subject = data.subject;
    this._notes = data.notes;
    this._assignedToId = data.assignedToId;
    this._createdById = data.createdById;
    this._dueAt = data.dueAt;
    this._completedAt = data.completedAt;
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

  private _leadId: UUID | null;
  get leadId(): UUID | null {
    return this._leadId;
  }

  private _patientId: UUID | null;
  get patientId(): UUID | null {
    return this._patientId;
  }

  private _type: ActivityType;
  get type(): ActivityType {
    return this._type;
  }

  private _status: ActivityStatus;
  get status(): ActivityStatus {
    return this._status;
  }

  private _subject: string;
  get subject(): string {
    return this._subject;
  }

  private _notes: string | null;
  get notes(): string | null {
    return this._notes;
  }

  private _assignedToId: string | null;
  get assignedToId(): string | null {
    return this._assignedToId;
  }

  private _createdById: string | null;
  get createdById(): string | null {
    return this._createdById;
  }

  private _dueAt: Date | null;
  get dueAt(): Date | null {
    return this._dueAt;
  }

  private _completedAt: Date | null;
  get completedAt(): Date | null {
    return this._completedAt;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  public static create(props: CreateActivityProps): Activity {
    const now = DateTimeManager.create();
    return new Activity({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      leadId: props.leadId ? UUID.create(props.leadId).orThrow().value : null,
      patientId: props.patientId
        ? UUID.create(props.patientId).orThrow().value
        : null,
      type: props.type,
      status: ActivityStatusSchema.enum.PENDING,
      subject: props.subject,
      notes: props.notes ?? null,
      assignedToId: props.assignedToId ?? null,
      createdById: props.createdById ?? null,
      dueAt: props.dueAt ?? null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public rules(validateOptions: ValidateOptionsType) {
    return new ActivityRules(this, validateOptions);
  }

  public complete(): void {
    this._status = ActivityStatusSchema.enum.COMPLETED;
    this._completedAt = DateTimeManager.create();
    this._updatedAt = DateTimeManager.create();
  }

  /** Yalnız sağlanan (undefined olmayan) alanları günceller. */
  public update(props: UpdateActivityProps): void {
    if (isDefined(props.subject)) this._subject = props.subject;
    if (isNotUndefined(props.notes)) this._notes = props.notes;
    if (isNotUndefined(props.assignedToId))
      this._assignedToId = props.assignedToId;
    if (isNotUndefined(props.dueAt)) this._dueAt = props.dueAt;
    this._updatedAt = DateTimeManager.create();
  }

  public toPersistence(): IActivity {
    return {
      id: this.id.value,
      clinicId: this.clinicId.value,
      organizationId: this.organizationId.value,
      leadId: this.leadId?.value ?? null,
      patientId: this.patientId?.value ?? null,
      type: this.type,
      status: this.status,
      subject: this.subject,
      notes: this.notes,
      assignedToId: this.assignedToId,
      createdById: this.createdById,
      dueAt: this.dueAt,
      completedAt: this.completedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
