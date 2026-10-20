import { Pipeline as IPipeline } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { CreatePipelineProps } from '@modules/crm/pipeline/domain/contracts';

/**
 * Klinik-seviye satış hunisi (aggregate root). organizationId denormalize edilir —
 * org+klinik birlikte taşınır. Aşamalar (PipelineStage) ayrı entity olarak yönetilir;
 * huni yalnızca kimlik + meta taşır. Her kliniğe bir varsayılan huni (isDefault) seed'lenir.
 */
export class Pipeline extends AggregateRoot {
  constructor(data: IPipeline) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._name = data.name;
    this._isDefault = data.isDefault;
    this._isDeleted = data.isDeleted;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _name: string;
  get name(): string {
    return this._name;
  }

  private _isDefault: boolean;
  get isDefault(): boolean {
    return this._isDefault;
  }

  private _isDeleted: boolean;
  get isDeleted(): boolean {
    return this._isDeleted;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  public static create(props: CreatePipelineProps): Pipeline {
    const now = DateTimeManager.create();
    return new Pipeline({
      id: UUID.createOrGenerate(props.id).value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      name: props.name,
      isDefault: props.isDefault ?? false,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  public rename(name: string): void {
    this._name = name;
  }

  public markDefault(isDefault: boolean): void {
    this._isDefault = isDefault;
  }

  public softDelete(): void {
    this._isDeleted = true;
  }

  public toPersistence(): IPipeline {
    return {
      id: this.id.value,
      organizationId: this.organizationId.value,
      clinicId: this.clinicId.value,
      name: this.name,
      isDefault: this.isDefault,
      isDeleted: this.isDeleted,
      createdAt: this.createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }
}
