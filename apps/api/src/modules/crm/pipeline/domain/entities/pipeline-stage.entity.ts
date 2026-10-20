import { PipelineStage as IPipelineStage } from '@shared';
import {
  PipelineStageTypeSchema,
  PipelineStageTypeType as PipelineStageType,
} from '@input-type-schemas/PipelineStageTypeSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { isDefined } from '@common/utils';
import { isNotUndefined } from '@common/utils/is-not-undefined';
import {
  CreatePipelineStageProps,
  UpdatePipelineStageProps,
} from '@modules/crm/pipeline/domain/contracts';

/** Huni aşaması. `type` (OPEN/WON/LOST) sistem senkronunu, `order` sıralamayı belirler. */
export class PipelineStage extends AggregateRoot {
  constructor(data: IPipelineStage) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._pipelineId = UUID.fromTrusted(data.pipelineId);
    this._name = data.name;
    this._order = data.order;
    this._type = data.type;
    this._color = data.color;
    this._isDeleted = data.isDeleted;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _pipelineId: UUID;
  get pipelineId(): UUID {
    return this._pipelineId;
  }

  private _name: string;
  get name(): string {
    return this._name;
  }

  private _order: number;
  get order(): number {
    return this._order;
  }

  private _type: PipelineStageType;
  get type(): PipelineStageType {
    return this._type;
  }

  private _color: string | null;
  get color(): string | null {
    return this._color;
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

  public static create(props: CreatePipelineStageProps): PipelineStage {
    const now = DateTimeManager.create();
    return new PipelineStage({
      id: UUID.createOrGenerate(props.id).value,
      pipelineId: UUID.create(props.pipelineId).orThrow().value,
      name: props.name,
      order: props.order,
      type: props.type ?? PipelineStageTypeSchema.enum.OPEN,
      color: props.color ?? null,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Aşama WON tipinde mi (kazanıldı senkronu için). */
  public isWon(): boolean {
    return this._type === PipelineStageTypeSchema.enum.WON;
  }

  /** Aşama LOST tipinde mi (kaybedildi senkronu için). */
  public isLost(): boolean {
    return this._type === PipelineStageTypeSchema.enum.LOST;
  }

  /** Yalnız sağlanan (undefined olmayan) alanları günceller. */
  public update(props: UpdatePipelineStageProps): void {
    if (isDefined(props.name)) this._name = props.name;
    if (isDefined(props.order)) this._order = props.order;
    if (isDefined(props.type)) this._type = props.type;
    if (isNotUndefined(props.color)) this._color = props.color;
  }

  public softDelete(): void {
    this._isDeleted = true;
  }

  public toPersistence(): IPipelineStage {
    return {
      id: this.id.value,
      pipelineId: this.pipelineId.value,
      name: this.name,
      order: this.order,
      type: this.type,
      color: this.color,
      isDeleted: this.isDeleted,
      createdAt: this.createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }
}
