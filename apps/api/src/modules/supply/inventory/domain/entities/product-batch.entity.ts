import {
  ProductBatch as IProductBatch,
  StockMovementDirectionSchema,
  StockMovementTypeSchema,
} from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { StockPurchasedEvent } from '../events/stock-purchased.event';
import { StockQuantityChangedEvent } from '../events/stock-quantity-changed.event';
import { Money } from '@src/domain/value-objects/money.vo';
import { Quantity } from '@src/domain/value-objects/quantity.vo';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import {
  AddQuantityProps,
  CreateBatchFromPurchaseProps,
  DeductQuantityProps,
  RaiseStockQuantityChangedProps,
} from '@modules/supply/inventory/domain/contracts';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { BatchExpiredException } from '@modules/supply/inventory/domain/exceptions/inventory.exceptions';

export class ProductBatch extends AggregateRoot {
  constructor(data: IProductBatch) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._productId = UUID.fromTrusted(data.productId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._supplierId = UUID.create(data.supplierId).instance ?? null;
    this._lotNumber = data.lotNumber;
    this._expiresAt = data.expiresAt;
    this._quantity = Quantity.fromTrusted(data.quantity);
    this._purchasePrice = Money.fromTrusted(data.purchasePrice, data.currency);
    this._receivedAt = data.receivedAt;
    this._notes = data.notes;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _productId: UUID;
  get productId(): UUID {
    return this._productId;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _supplierId: UUID | null;
  get supplierId(): UUID | null {
    return this._supplierId;
  }

  private _lotNumber: string | null;
  get lotNumber(): string | null {
    return this._lotNumber;
  }

  private _expiresAt: Date | null;
  get expiresAt(): Date | null {
    return this._expiresAt;
  }

  private _quantity: Quantity;
  get quantity(): Quantity {
    return this._quantity;
  }

  private _purchasePrice: Money;
  get purchasePrice(): Money {
    return this._purchasePrice;
  }

  private _receivedAt: Date;
  get receivedAt(): Date {
    return this._receivedAt;
  }

  private _notes: string | null;
  get notes(): string | null {
    return this._notes;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  private get raiseEvent() {
    return {
      quantityChanged: (props: RaiseStockQuantityChangedProps): void => {
        this.addDomainEvent(
          new StockQuantityChangedEvent({
            movementId: UUID.createOrGenerate(props.movementId).value,
            productId: this.productId.value,
            clinicId: this.clinicId.value,
            batchId: this.id.value,
            type: props.movementType,
            direction: props.direction,
            quantity: props.quantity.value.toString(),
            // Maliyet temeli partiden gelir: hareket kaydı bu fiyatla değerlenir.
            unitPrice: this.purchasePrice.value.toFixed(2),
            currency: this.purchasePrice.currency,
            performedById: props.performedById,
            notes: props.notes ?? null,
          })
        );
      },
    };
  }

  public static createFromPurchase(
    props: CreateBatchFromPurchaseProps
  ): ProductBatch {
    if (props.expiresAt && props.expiresAt <= DateTimeManager.create()) {
      throw new BatchExpiredException({
        expiresAt: props.expiresAt.toISOString(),
      });
    }

    const totalAmount = props.purchasePrice.multiply(props.quantity.value);

    const batchId = UUID.createOrGenerate(props.id);
    const batch = new ProductBatch({
      id: batchId.value,
      productId: UUID.create(props.productId).orThrow().value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      supplierId: props.supplierId
        ? UUID.create(props.supplierId).orThrow().value
        : null,
      lotNumber: props.lotNumber ?? null,
      expiresAt: props.expiresAt ?? null,
      quantity: props.quantity.value,
      purchasePrice: props.purchasePrice.value,
      currency: props.purchasePrice.currency,
      receivedAt: DateTimeManager.create(),
      notes: props.notes ?? null,
      createdAt: DateTimeManager.create(),
      updatedAt: DateTimeManager.create(),
    });

    batch.addDomainEvent(
      new StockPurchasedEvent({
        ...props.eventPayload,
        batchId: batchId.value,
        productId: props.productId,
        clinicId: props.clinicId,
        organizationId: props.organizationId,
        supplierId: props.supplierId ?? null,
        quantity: props.quantity.value.toString(),
        unitPrice: props.purchasePrice.value.toString(),
        totalAmount: totalAmount.value.toString(),
      })
    );

    return batch;
  }

  /**
   * Partiden stok düşer. Hareket kaydı (StockMovement) bu metodun dönüşü değil,
   * fırlatılan olayın yan etkisidir — kayıt dinleyicide yazılır.
   */
  public deductQuantity({
    qty,
    movementType = StockMovementTypeSchema.enum.ADJUSTMENT,
    movementId,
    performedById,
    notes,
  }: DeductQuantityProps): void {
    const incomingQuantity =
      qty instanceof Quantity
        ? qty
        : Quantity.createPositive(qty, 'Stok düşüm').orThrow();

    incomingQuantity.validate.greaterThanZero.orThrow();

    this._quantity = this.quantity.sub(incomingQuantity);
    this._updatedAt = DateTimeManager.create();

    this.raiseEvent.quantityChanged({
      movementId,
      direction: StockMovementDirectionSchema.enum.OUT,
      movementType,
      quantity: incomingQuantity,
      performedById,
      notes: notes ?? 'Batch üzerinden stok düşümü yapıldı.',
    });
  }

  /**
   * Partiye stok ekler. Hareket kaydı (StockMovement) yan etkidir; bkz.
   * {@link deductQuantity}.
   */
  public addQuantity({
    qty,
    movementType = StockMovementTypeSchema.enum.ADJUSTMENT,
    movementId,
    performedById,
    notes,
  }: AddQuantityProps): void {
    const incomingQuantity =
      qty instanceof Quantity
        ? qty
        : Quantity.createPositive(qty, 'Stok giriş').orThrow();

    incomingQuantity.validate.greaterThanZero.orThrow();

    this._quantity = this.quantity.add(incomingQuantity);
    this._updatedAt = DateTimeManager.create();

    this.raiseEvent.quantityChanged({
      movementId,
      direction: StockMovementDirectionSchema.enum.IN,
      movementType,
      quantity: incomingQuantity,
      performedById,
      notes: notes ?? 'Batch üzerinden stok artırımı yapıldı.',
    });
  }

  toPersistence(): IProductBatch {
    return {
      id: this.id.value,
      productId: this.productId.value,
      clinicId: this.clinicId.value,
      supplierId: this.supplierId?.value ?? null,
      lotNumber: this.lotNumber,
      expiresAt: this.expiresAt,
      quantity: this.quantity.value,
      purchasePrice: this.purchasePrice.value,
      currency: this.purchasePrice.currency,
      receivedAt: this.receivedAt,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
