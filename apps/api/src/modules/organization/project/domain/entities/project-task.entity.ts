import { Decimal } from 'decimal.js';
import { ProjectTask as IProjectTask } from '@model-schema/ProjectTaskSchema';
import {
  ProjectTaskStatusSchema,
  ProjectTaskStatusType as TaskStatus,
} from '@input-type-schemas/ProjectTaskStatusSchema';
import {
  ProjectTaskPrioritySchema,
  ProjectTaskPriorityType as TaskPriority,
} from '@input-type-schemas/ProjectTaskPrioritySchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { isNotUndefined } from '@common/utils/is-not-undefined';
import {
  CreateProjectTaskProps,
  MoveProjectTaskProps,
  UpdateProjectTaskProps,
} from '@modules/organization/project/domain/contracts';
import { ProjectTaskInvalidStateException } from '@modules/organization/project/domain/exceptions/project.exceptions';

/**
 * Proje Görevi (aggregate root). Kanban panosunda bir kart.
 *
 * `crm/activity` ile karıştırılmamalı: Activity satış hunisine (lead/hasta) aittir;
 * bu görev iç iş takibidir ve lead/hasta bilmez.
 *
 * Durum akışı serbesttir (panoda kart her kolona sürüklenebilir) — tek kısıt
 * CANCELLED'ın terminal olmasıdır: iptal edilmiş kart yeniden akışa sokulmaz,
 * yerine yeni görev açılır. DONE'dan geri dönüş serbesttir (yeniden açma).
 */
export class ProjectTask extends AggregateRoot {
  constructor(data: IProjectTask) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._projectId = UUID.fromTrusted(data.projectId);
    this._phaseId = data.phaseId;
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._parentTaskId = data.parentTaskId;
    this._title = data.title;
    this._description = data.description;
    this._status = data.status;
    this._priority = data.priority;
    this._assigneeId = data.assigneeId;
    this._createdById = data.createdById;
    this._startDate = data.startDate;
    this._dueAt = data.dueAt;
    this._completedAt = data.completedAt;
    this._boardOrder = data.boardOrder;
    this._estimatedHours = data.estimatedHours
      ? new Decimal(data.estimatedHours.toString())
      : null;
    this._actualHours = data.actualHours
      ? new Decimal(data.actualHours.toString())
      : null;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _projectId: UUID;
  get projectId(): UUID {
    return this._projectId;
  }

  private _phaseId: string | null;
  get phaseId(): string | null {
    return this._phaseId;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _parentTaskId: string | null;
  get parentTaskId(): string | null {
    return this._parentTaskId;
  }

  private _title: string;
  get title(): string {
    return this._title;
  }

  private _description: string | null;
  get description(): string | null {
    return this._description;
  }

  private _status: TaskStatus;
  get status(): TaskStatus {
    return this._status;
  }

  private _priority: TaskPriority;
  get priority(): TaskPriority {
    return this._priority;
  }

  private _assigneeId: string | null;
  get assigneeId(): string | null {
    return this._assigneeId;
  }

  private _createdById: string;
  get createdById(): string {
    return this._createdById;
  }

  private _startDate: Date | null;
  get startDate(): Date | null {
    return this._startDate;
  }

  private _dueAt: Date | null;
  get dueAt(): Date | null {
    return this._dueAt;
  }

  private _completedAt: Date | null;
  get completedAt(): Date | null {
    return this._completedAt;
  }

  private _boardOrder: number;
  get boardOrder(): number {
    return this._boardOrder;
  }

  private _estimatedHours: Decimal | null;
  get estimatedHours(): Decimal | null {
    return this._estimatedHours;
  }

  private _actualHours: Decimal | null;
  get actualHours(): Decimal | null {
    return this._actualHours;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  public static create(props: CreateProjectTaskProps): ProjectTask {
    const now = DateTimeManager.create();

    return new ProjectTask({
      id: UUID.createOrGenerate(props.id).value,
      projectId: UUID.create(props.projectId).orThrow().value,
      phaseId: props.phaseId ?? null,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      parentTaskId: props.parentTaskId ?? null,
      title: props.title,
      description: props.description ?? null,
      status: ProjectTaskStatusSchema.enum.TODO,
      priority: props.priority ?? ProjectTaskPrioritySchema.enum.MEDIUM,
      assigneeId: props.assigneeId ?? null,
      createdById: props.createdById,
      startDate: props.startDate ?? null,
      dueAt: props.dueAt ?? null,
      completedAt: null,
      boardOrder: props.boardOrder ?? 0,
      estimatedHours: props.estimatedHours ?? null,
      actualHours: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public update(props: UpdateProjectTaskProps): void {
    this.assertNotCancelled();

    if (isNotUndefined(props.title)) this._title = props.title;
    if (isNotUndefined(props.description))
      this._description = props.description;
    if (isNotUndefined(props.priority)) this._priority = props.priority;
    if (isNotUndefined(props.phaseId)) this._phaseId = props.phaseId;
    if (isNotUndefined(props.startDate)) this._startDate = props.startDate;
    if (isNotUndefined(props.dueAt)) this._dueAt = props.dueAt;
    if (isNotUndefined(props.estimatedHours)) {
      this._estimatedHours = props.estimatedHours;
    }
    if (isNotUndefined(props.actualHours))
      this._actualHours = props.actualHours;

    this._updatedAt = DateTimeManager.create();
  }

  /**
   * Kanban hareketi: kolon + kolon içi sıra. DONE'a geçişte tamamlanma zamanı
   * damgalanır, DONE'dan çıkışta temizlenir (kart yeniden açılmış olur).
   */
  public move(props: MoveProjectTaskProps): void {
    this.assertNotCancelled();

    const now = DateTimeManager.create();
    const isDone = props.status === ProjectTaskStatusSchema.enum.DONE;

    this._status = props.status;
    this._boardOrder = props.boardOrder;
    this._completedAt = isDone ? (this._completedAt ?? now) : null;
    this._updatedAt = now;
  }

  /** null = atamayı kaldır. */
  public assign(assigneeId: string | null): void {
    this.assertNotCancelled();
    this._assigneeId = assigneeId
      ? UUID.create(assigneeId).orThrow().value
      : null;
    this._updatedAt = DateTimeManager.create();
  }

  public cancel(): void {
    this.assertNotCancelled();
    this._status = ProjectTaskStatusSchema.enum.CANCELLED;
    this._completedAt = null;
    this._updatedAt = DateTimeManager.create();
  }

  public toPersistence(): IProjectTask {
    return {
      id: this._id.value,
      projectId: this._projectId.value,
      phaseId: this._phaseId,
      clinicId: this._clinicId.value,
      organizationId: this._organizationId.value,
      parentTaskId: this._parentTaskId,
      title: this._title,
      description: this._description,
      status: this._status,
      priority: this._priority,
      assigneeId: this._assigneeId,
      createdById: this._createdById,
      startDate: this._startDate,
      dueAt: this._dueAt,
      completedAt: this._completedAt,
      boardOrder: this._boardOrder,
      estimatedHours: this._estimatedHours,
      actualHours: this._actualHours,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  private assertNotCancelled(): void {
    if (this._status === ProjectTaskStatusSchema.enum.CANCELLED) {
      throw new ProjectTaskInvalidStateException(this._id.value, this._status);
    }
  }
}
