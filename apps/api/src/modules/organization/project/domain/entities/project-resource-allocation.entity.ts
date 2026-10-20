import { ProjectResourceAllocation as IProjectResourceAllocation } from '@model-schema/ProjectResourceAllocationSchema';
import { ProjectResourceKindType as ResourceKind } from '@input-type-schemas/ProjectResourceKindSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { AllocateProjectResourceProps } from '@modules/organization/project/domain/contracts';
import { ProjectAllocationInvalidRangeException } from '@modules/organization/project/domain/exceptions/project.exceptions';
import { normalizeAllocationPercent } from '@modules/organization/project/domain/rules/resource-capacity.rules';

/**
 * Kaynak Tahsisi — bir personelin/odanın/cihazın bir tarih aralığında bu projeye
 * ayrılması. Kapasite çakışması handler'da (aynı transaction + kilit kapsamında)
 * `checkCapacity` ile doğrulanır; entity yalnız kendi tutarlılığını korur.
 */
export class ProjectResourceAllocation extends AggregateRoot {
  constructor(data: IProjectResourceAllocation) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._projectId = UUID.fromTrusted(data.projectId);
    this._phaseId = data.phaseId;
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._kind = data.kind;
    this._resourceId = UUID.fromTrusted(data.resourceId);
    this._startDate = data.startDate;
    this._endDate = data.endDate;
    this._allocationPercent = data.allocationPercent;
    this._note = data.note;
    this._createdById = data.createdById;
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

  private _kind: ResourceKind;
  get kind(): ResourceKind {
    return this._kind;
  }

  private _resourceId: UUID;
  get resourceId(): UUID {
    return this._resourceId;
  }

  private _startDate: Date;
  get startDate(): Date {
    return this._startDate;
  }

  private _endDate: Date;
  get endDate(): Date {
    return this._endDate;
  }

  private _allocationPercent: number;
  get allocationPercent(): number {
    return this._allocationPercent;
  }

  private _note: string | null;
  get note(): string | null {
    return this._note;
  }

  private _createdById: string;
  get createdById(): string {
    return this._createdById;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  public static create(
    props: AllocateProjectResourceProps
  ): ProjectResourceAllocation {
    if (DateTimeManager.isBefore(props.endDate, props.startDate)) {
      throw new ProjectAllocationInvalidRangeException(
        props.startDate,
        props.endDate
      );
    }

    const now = DateTimeManager.create();

    return new ProjectResourceAllocation({
      id: UUID.createOrGenerate(props.id).value,
      projectId: UUID.create(props.projectId).orThrow().value,
      phaseId: props.phaseId ?? null,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      kind: props.kind,
      resourceId: UUID.create(props.resourceId).orThrow().value,
      startDate: props.startDate,
      endDate: props.endDate,
      // Oda/cihaz bölünmez → yüzde daima 100'e sabitlenir.
      allocationPercent: normalizeAllocationPercent(
        props.kind,
        props.allocationPercent
      ),
      note: props.note ?? null,
      createdById: props.createdById,
      createdAt: now,
      updatedAt: now,
    });
  }

  public toPersistence(): IProjectResourceAllocation {
    return {
      id: this._id.value,
      projectId: this._projectId.value,
      phaseId: this._phaseId,
      clinicId: this._clinicId.value,
      kind: this._kind,
      resourceId: this._resourceId.value,
      startDate: this._startDate,
      endDate: this._endDate,
      allocationPercent: this._allocationPercent,
      note: this._note,
      createdById: this._createdById,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
