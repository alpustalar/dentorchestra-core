import { Decimal } from 'decimal.js';
import { ProjectCost as IProjectCost } from '@model-schema/ProjectCostSchema';
import {
  ProjectCostSourceSchema,
  ProjectCostSourceType as CostSource,
} from '@input-type-schemas/ProjectCostSourceSchema';
import {
  CurrencySchema,
  CurrencyType as Currency,
} from '@input-type-schemas/CurrencySchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { RecordProjectCostProps } from '@modules/organization/project/domain/contracts';

/**
 * Proje Maliyet Kalemi. **Muhasebe fişi değildir** — satın alma faturası / dış iş
 * emri gibi zaten muhasebeleşmiş bir kaydın projeye etiketlenmesidir. Bu yüzden
 * bu modül posting yapmaz (mükerrer kayıt olurdu); yalnız bütçe-vs-fiili raporunu
 * besler.
 *
 * Değişmezdir: yanlış girilen kalem düzeltilmez, silinip yeniden girilir —
 * maliyet defterinin geçmişi oynanmaz.
 */
export class ProjectCost extends AggregateRoot {
  constructor(data: IProjectCost) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._projectId = UUID.fromTrusted(data.projectId);
    this._phaseId = data.phaseId;
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._source = data.source;
    this._sourceRefId = data.sourceRefId;
    this._description = data.description;
    this._amount = new Decimal(data.amount.toString());
    this._currency = data.currency;
    this._incurredAt = data.incurredAt;
    this._recordedById = data.recordedById;
    this._createdAt = data.createdAt;
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

  private _source: CostSource;
  get source(): CostSource {
    return this._source;
  }

  private _sourceRefId: string | null;
  get sourceRefId(): string | null {
    return this._sourceRefId;
  }

  private _description: string;
  get description(): string {
    return this._description;
  }

  private _amount: Decimal;
  get amount(): Decimal {
    return this._amount;
  }

  private _currency: Currency;
  get currency(): Currency {
    return this._currency;
  }

  private _incurredAt: Date;
  get incurredAt(): Date {
    return this._incurredAt;
  }

  private _recordedById: string;
  get recordedById(): string {
    return this._recordedById;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  public static create(props: RecordProjectCostProps): ProjectCost {
    return new ProjectCost({
      id: UUID.createOrGenerate(props.id).value,
      projectId: UUID.create(props.projectId).orThrow().value,
      phaseId: props.phaseId ?? null,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      source: props.source ?? ProjectCostSourceSchema.enum.MANUAL,
      sourceRefId: props.sourceRefId ?? null,
      description: props.description,
      amount: props.amount,
      currency: props.currency ?? CurrencySchema.enum.TRY,
      incurredAt: props.incurredAt,
      recordedById: props.recordedById,
      createdAt: DateTimeManager.create(),
    });
  }

  public toPersistence(): IProjectCost {
    return {
      id: this._id.value,
      projectId: this._projectId.value,
      phaseId: this._phaseId,
      clinicId: this._clinicId.value,
      organizationId: this._organizationId.value,
      source: this._source,
      sourceRefId: this._sourceRefId,
      description: this._description,
      amount: this._amount,
      currency: this._currency,
      incurredAt: this._incurredAt,
      recordedById: this._recordedById,
      createdAt: this._createdAt,
    };
  }
}
