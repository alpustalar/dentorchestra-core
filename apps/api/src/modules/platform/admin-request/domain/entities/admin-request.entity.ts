import {
  AdminRequest as IAdminRequest,
  AdminRequestStatusSchema,
} from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { AdminRequestCreatedEvent } from '@modules/platform/admin-request/domain/events/admin-request-created.event';
import { AdminRequestReviewedEvent } from '@modules/platform/admin-request/domain/events/admin-request-reviewed.event';
import { JsonValueType as JsonValue } from '@input-type-schemas/JsonValueSchema';
import { CreateAdminRequestProps } from '@modules/platform/admin-request/domain/contracts/admin-request';
import { AdminRequestTypeType as AdminRequestType } from '@input-type-schemas/AdminRequestTypeSchema';
import { AdminRequestStatusType as AdminRequestStatus } from '@input-type-schemas/AdminRequestStatusSchema';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

export class AdminRequest extends AggregateRoot {
  constructor(data: IAdminRequest) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._type = data.type;
    this._status = data.status;
    this._targetId = data.targetId;
    this._requestedBy = data.requestedBy;
    this._organizationId = UUID.create(data.organizationId).instance ?? null;
    this._metadata = data.metadata;
    this._reviewedBy = data.reviewedBy;
    this._reviewedAt = data.reviewedAt;
    this._reviewNote = data.reviewNote;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
    this._clinicId = UUID.create(data.clinicId).instance ?? null;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _type: AdminRequestType;
  get type(): AdminRequestType {
    return this._type;
  }

  private _status: AdminRequestStatus;
  get status(): AdminRequestStatus {
    return this._status;
  }

  private _clinicId: UUID | null;
  get clinicId(): UUID | null {
    return this._clinicId;
  }

  private _targetId: string;
  get targetId(): string {
    return this._targetId;
  }

  private _requestedBy: string;
  get requestedBy(): string {
    return this._requestedBy;
  }

  private _organizationId: UUID | null;
  get organizationId(): UUID | null {
    return this._organizationId;
  }

  private _metadata: JsonValue | null;
  get metadata(): JsonValue | null {
    return this._metadata;
  }

  private _reviewedBy: string | null;
  get reviewedBy(): string | null {
    return this._reviewedBy;
  }

  private _reviewedAt: Date | null;
  get reviewedAt(): Date | null {
    return this._reviewedAt;
  }

  private _reviewNote: string | null;
  get reviewNote(): string | null {
    return this._reviewNote;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  static create(props: CreateAdminRequestProps): AdminRequest {
    const now = DateTimeManager.create();

    const entity = new AdminRequest({
      id: UUID.createOrGenerate(props.id).value,
      type: props.type,
      status: AdminRequestStatusSchema.enum.PENDING,
      targetId: props.targetId,
      requestedBy: props.requestedBy,

      organizationId: props.organizationId
        ? UUID.create(props.organizationId).orThrow().value
        : null,

      clinicId: props.clinicId
        ? UUID.create(props.clinicId).orThrow().value
        : null,

      metadata: (props.metadata as JsonValue) ?? null,

      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
      createdAt: now,
      updatedAt: now,
    });

    entity.addDomainEvent(
      new AdminRequestCreatedEvent({
        requestId: entity.id.value,
        type: entity.type,
        targetId: entity.targetId,
        requestedBy: entity.requestedBy,
        organizationId: entity.organizationId?.value ?? undefined,
      })
    );

    return entity;
  }

  public approve(reviewedBy: string, reviewNote?: string): void {
    this._status = AdminRequestStatusSchema.enum.APPROVED;
    this._reviewedBy = reviewedBy;
    this._reviewedAt = DateTimeManager.create();
    this._reviewNote = reviewNote ?? null;

    this.addDomainEvent(
      new AdminRequestReviewedEvent({
        requestId: this._id.value,
        type: this._type,
        status: AdminRequestStatusSchema.enum.APPROVED,
        targetId: this._targetId,
        requestedBy: this._requestedBy,
        reviewedBy,
        organizationId: this._organizationId?.value ?? undefined,
        reviewNote,
      })
    );
  }

  public reject(reviewedBy: string, reviewNote?: string): void {
    this._status = AdminRequestStatusSchema.enum.REJECTED;
    this._reviewedBy = reviewedBy;
    this._reviewedAt = DateTimeManager.create();
    this._reviewNote = reviewNote ?? null;

    this.addDomainEvent(
      new AdminRequestReviewedEvent({
        requestId: this._id.value,
        type: this._type,
        status: AdminRequestStatusSchema.enum.REJECTED,
        targetId: this._targetId,
        requestedBy: this._requestedBy,
        reviewedBy,
        organizationId: this._organizationId?.value ?? undefined,
        reviewNote,
      })
    );
  }

  public isPending(): boolean {
    return this._status === AdminRequestStatusSchema.enum.PENDING;
  }

  public toPersistence(): IAdminRequest {
    return {
      id: this._id.value,
      type: this._type,
      status: this._status,
      targetId: this._targetId,
      requestedBy: this._requestedBy,
      organizationId: this._organizationId?.value ?? null,
      clinicId: this._clinicId?.value ?? null,
      metadata: this._metadata,
      reviewedBy: this._reviewedBy,
      reviewedAt: this._reviewedAt,
      reviewNote: this._reviewNote,
      createdAt: this._createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }
}
