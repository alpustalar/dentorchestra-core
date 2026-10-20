import { Decimal } from 'decimal.js';
import { ProjectPhase as IProjectPhase } from '@model-schema/ProjectPhaseSchema';
import {
  ProjectPhaseStatusSchema,
  ProjectPhaseStatusType as PhaseStatus,
} from '@input-type-schemas/ProjectPhaseStatusSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { isNotUndefined } from '@common/utils/is-not-undefined';
import {
  CreateProjectPhaseProps,
  UpdateProjectPhaseProps,
} from '@modules/organization/project/domain/contracts';

/**
 * Proje Aşaması. Sıralı (order) ve kendi durumu olan bir kilometre taşı.
 *
 * Aşama durumu bilinçli olarak SERBEST bırakılmıştır: gerçek projelerde aşamalar
 * sırayla ilerlemez (paralel yürüyen, atlanan, geri açılan aşamalar olur). Sıra
 * yalnız görüntüleme içindir; zorlayıcı bir öncül-ardıl kuralı yoktur.
 */
export class ProjectPhase extends AggregateRoot {
  constructor(data: IProjectPhase) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._projectId = UUID.fromTrusted(data.projectId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._name = data.name;
    this._order = data.order;
    this._status = data.status;
    this._startDate = data.startDate;
    this._dueDate = data.dueDate;
    this._completedAt = data.completedAt;
    this._budget = data.budget ? new Decimal(data.budget.toString()) : null;
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

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _name: string;
  get name(): string {
    return this._name;
  }

  private _order: number;
  get order(): number {
    return this._order;
  }

  private _status: PhaseStatus;
  get status(): PhaseStatus {
    return this._status;
  }

  private _startDate: Date | null;
  get startDate(): Date | null {
    return this._startDate;
  }

  private _dueDate: Date | null;
  get dueDate(): Date | null {
    return this._dueDate;
  }

  private _completedAt: Date | null;
  get completedAt(): Date | null {
    return this._completedAt;
  }

  private _budget: Decimal | null;
  get budget(): Decimal | null {
    return this._budget;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  public static create(props: CreateProjectPhaseProps): ProjectPhase {
    const now = DateTimeManager.create();

    return new ProjectPhase({
      id: UUID.createOrGenerate(props.id).value,
      projectId: UUID.create(props.projectId).orThrow().value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      name: props.name,
      order: props.order,
      status: ProjectPhaseStatusSchema.enum.PENDING,
      startDate: props.startDate ?? null,
      dueDate: props.dueDate ?? null,
      completedAt: null,
      budget: props.budget ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public update(props: UpdateProjectPhaseProps): void {
    if (isNotUndefined(props.name)) this._name = props.name;
    if (isNotUndefined(props.order)) this._order = props.order;
    if (isNotUndefined(props.startDate)) this._startDate = props.startDate;
    if (isNotUndefined(props.dueDate)) this._dueDate = props.dueDate;
    if (isNotUndefined(props.budget)) this._budget = props.budget;
    this._updatedAt = DateTimeManager.create();
  }

  public start(): void {
    this._status = ProjectPhaseStatusSchema.enum.ACTIVE;
    this._completedAt = null;
    this._updatedAt = DateTimeManager.create();
  }

  public complete(): void {
    const now = DateTimeManager.create();
    this._status = ProjectPhaseStatusSchema.enum.COMPLETED;
    this._completedAt = now;
    this._updatedAt = now;
  }

  /** Yapılmayacağına karar verilen aşama — tamamlanmış sayılmaz, raporda ayrışır. */
  public skip(): void {
    this._status = ProjectPhaseStatusSchema.enum.SKIPPED;
    this._completedAt = null;
    this._updatedAt = DateTimeManager.create();
  }

  public toPersistence(): IProjectPhase {
    return {
      id: this._id.value,
      projectId: this._projectId.value,
      clinicId: this._clinicId.value,
      name: this._name,
      order: this._order,
      status: this._status,
      startDate: this._startDate,
      dueDate: this._dueDate,
      completedAt: this._completedAt,
      budget: this._budget,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
