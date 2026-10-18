import { Decimal } from 'decimal.js';
import { PurchaseRequest as IPurchaseRequest } from '@model-schema/PurchaseRequestSchema';
import {
  PurchaseRequestStatusSchema,
  PurchaseRequestStatusType as PurchaseRequestStatus,
} from '@input-type-schemas/PurchaseRequestStatusSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { CreatePurchaseRequestProps } from '@modules/supply/purchasing/domain/contracts';
import {
  PurchaseRequestEmptyItemsException,
  PurchaseRequestNotApprovedException,
  PurchaseRequestNotPendingException,
} from '@modules/supply/purchasing/domain/exceptions/purchasing.exceptions';

export interface PurchaseRequestLine {
  id: string;
  productId: string | null;
  description: string;
  quantity: Decimal;
  estimatedUnitPrice: Decimal | null;
  unit: string | null;
}

/**
 * Satın Alma Talebi (aggregate root). Personel ihtiyaç bildirir; yönetici onaylar.
 * Onaylanan talep siparişe (PurchaseOrder) dönüştürülünce ORDERED olur.
 */
export class PurchaseRequest extends AggregateRoot {
  constructor(data: IPurchaseRequest, lines: PurchaseRequestLine[]) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._requestedById = data.requestedById;
    this._status = data.status;
    this._neededBy = data.neededBy;
    this._note = data.note;
    this._reviewedById = data.reviewedById;
    this._reviewedAt = data.reviewedAt;
    this._reviewNote = data.reviewNote;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
    this._lines = lines;
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

  private _requestedById: string;
  get requestedById(): string {
    return this._requestedById;
  }

  private _status: PurchaseRequestStatus;
  get status(): PurchaseRequestStatus {
    return this._status;
  }

  private _neededBy: Date | null;
  get neededBy(): Date | null {
    return this._neededBy;
  }

  private _note: string | null;
  get note(): string | null {
    return this._note;
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

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  private _lines: PurchaseRequestLine[];
  get lines(): PurchaseRequestLine[] {
    return this._lines;
  }

  public static create(props: CreatePurchaseRequestProps): PurchaseRequest {
    if (!props.items || props.items.length === 0) {
      throw new PurchaseRequestEmptyItemsException();
    }

    const now = DateTimeManager.create();
    const requestId = UUID.createOrGenerate(props.id).value;

    const lines: PurchaseRequestLine[] = props.items.map((item) => ({
      id: UUID.generate().value,
      productId: item.productId ?? null,
      description: item.description,
      quantity: new Decimal(item.quantity),
      estimatedUnitPrice:
        item.estimatedUnitPrice !== undefined &&
        item.estimatedUnitPrice !== null
          ? new Decimal(item.estimatedUnitPrice)
          : null,
      unit: item.unit ?? null,
    }));

    return new PurchaseRequest(
      {
        id: requestId,
        clinicId: UUID.create(props.clinicId).orThrow().value,
        organizationId: UUID.create(props.organizationId).orThrow().value,
        // Talep sahibi **ham string**: `ctx.actor.userId` bir Firebase UID'dir
        // (`User.id = firebaseUid`), UUID değil. UUID VO'sundan geçirildiği
        // sürece gerçek personelin açtığı her talep `InvalidUuidException` ile
        // reddediliyordu — talep akışı hiç çalışmıyordu. Kardeş alan
        // `reviewedById` zaten ham string tutuluyor.
        requestedById: props.requestedById,
        status: PurchaseRequestStatusSchema.enum.SUBMITTED,
        neededBy: props.neededBy ?? null,
        note: props.note ?? null,
        reviewedById: null,
        reviewedAt: null,
        reviewNote: null,
        createdAt: now,
        updatedAt: now,
      },
      lines
    );
  }

  public isSubmitted(): boolean {
    return this._status === PurchaseRequestStatusSchema.enum.SUBMITTED;
  }

  public isApproved(): boolean {
    return this._status === PurchaseRequestStatusSchema.enum.APPROVED;
  }

  public approve(reviewerId: string, note?: string | null): void {
    this._assertSubmitted();
    this._status = PurchaseRequestStatusSchema.enum.APPROVED;
    this._applyReview(reviewerId, note);
  }

  public reject(reviewerId: string, note?: string | null): void {
    this._assertSubmitted();
    this._status = PurchaseRequestStatusSchema.enum.REJECTED;
    this._applyReview(reviewerId, note);
  }

  public cancel(): void {
    if (
      this._status === PurchaseRequestStatusSchema.enum.REJECTED ||
      this._status === PurchaseRequestStatusSchema.enum.CANCELLED ||
      this._status === PurchaseRequestStatusSchema.enum.ORDERED
    ) {
      throw new PurchaseRequestNotPendingException(this._status);
    }
    this._status = PurchaseRequestStatusSchema.enum.CANCELLED;
    this._updatedAt = DateTimeManager.create();
  }

  /** Onaylı talep siparişe dönüştürüldüğünde çağrılır. */
  public markOrdered(): void {
    if (!this.isApproved()) {
      throw new PurchaseRequestNotApprovedException(this._status);
    }
    this._status = PurchaseRequestStatusSchema.enum.ORDERED;
    this._updatedAt = DateTimeManager.create();
  }

  public toPersistence(): IPurchaseRequest {
    return {
      id: this._id.value,
      clinicId: this._clinicId.value,
      organizationId: this._organizationId.value,
      requestedById: this._requestedById,
      status: this._status,
      neededBy: this._neededBy,
      note: this._note,
      reviewedById: this._reviewedById,
      reviewedAt: this._reviewedAt,
      reviewNote: this._reviewNote,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  private _assertSubmitted(): void {
    if (!this.isSubmitted()) {
      throw new PurchaseRequestNotPendingException(this._status);
    }
  }

  private _applyReview(reviewerId: string, note?: string | null): void {
    this._reviewedById = reviewerId;
    this._reviewedAt = DateTimeManager.create();
    this._reviewNote = note ?? null;
    this._updatedAt = DateTimeManager.create();
  }
}
