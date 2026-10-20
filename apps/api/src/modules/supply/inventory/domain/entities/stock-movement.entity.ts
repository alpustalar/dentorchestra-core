import { StockMovement as IStockMovement } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { StockMovementTypeType as StockMovementType } from '@input-type-schemas/StockMovementTypeSchema';
import { StockMovementDirectionType as StockMovementDirection } from '@input-type-schemas/StockMovementDirectionSchema';
import { Money } from '@src/domain/value-objects/money.vo';
import { Currency } from '@src/domain/value-objects/currency.vo';
import { Quantity } from '@src/domain/value-objects/quantity.vo';
import { VatRate } from '@src/domain/value-objects/vat-rate.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { CreateStockMovementProps } from '@modules/supply/inventory/domain/contracts';

export class StockMovement extends AggregateRoot {
  constructor(data: IStockMovement) {
    super();

    const currency = Currency.create(data.currency).orThrow();

    this._id = UUID.fromTrusted(data.id);
    this._productId = UUID.fromTrusted(data.productId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._batchId = UUID.create(data.batchId).instance ?? null;
    this._type = data.type;
    this._direction = data.direction;
    this._quantity = Quantity.fromTrusted(data.quantity);
    this._currency = currency;

    this._unitPrice =
      Money.create(data.unitPrice, currency.value).instance ?? null;

    this._vatRate = data.vatRate && VatRate.fromTrusted(data?.vatRate);

    this._vatAmount =
      Money.create(data.vatAmount, currency.value).instance ?? null;

    this._totalAmount =
      Money.create(data.totalAmount, currency.value).instance ?? null;

    this._financeLedgerId = UUID.create(data.financeLedgerId).instance ?? null;
    // Personel kimliği **ham string**: `ctx.actor.userId` bir Firebase UID'dir
    // (`User.id = firebaseUid`), UUID değil. Burada UUID VO'suna sokulduğunda
    // kayıttan okunan gerçek personel kimliği sessizce `null`'a düşüyordu
    // (`instance ?? null`) ve `toPersistence()` o null'ı geri yazıyordu —
    // yani hareketi kimin yaptığı bir güncellemede siliniyordu.
    this._performedById = data.performedById;
    this._notes = data.notes;
    this._createdAt = data.createdAt;
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

  private _batchId: UUID | null;

  get batchId(): UUID | null {
    return this._batchId;
  }

  private _type: StockMovementType;

  get type(): StockMovementType {
    return this._type;
  }

  private _direction: StockMovementDirection;

  get direction(): StockMovementDirection {
    return this._direction;
  }

  private _quantity: Quantity;

  get quantity(): Quantity {
    return this._quantity;
  }

  private _unitPrice: Money | null;

  get unitPrice(): Money | null {
    return this._unitPrice;
  }

  private _currency: Currency;

  get currency(): Currency {
    return this._currency;
  }

  private _vatRate: VatRate | null;

  get vatRate(): VatRate | null {
    return this._vatRate;
  }

  private _vatAmount: Money | null;

  get vatAmount(): Money | null {
    return this._vatAmount;
  }

  private _totalAmount: Money | null;

  get totalAmount(): Money | null {
    return this._totalAmount;
  }

  private _financeLedgerId: UUID | null;

  get financeLedgerId(): UUID | null {
    return this._financeLedgerId;
  }

  private _performedById: string | null;

  get performedById(): string | null {
    return this._performedById;
  }

  private _notes: string | null;

  get notes(): string | null {
    return this._notes;
  }

  private _createdAt: Date;

  get createdAt(): Date {
    return this._createdAt;
  }

  public static create(props: CreateStockMovementProps): StockMovement {
    const { quantity, unitPrice } = props;

    let vatAmount: Money | null = null;
    let totalAmount: Money | null = null;

    if (unitPrice) {
      const subTotal = unitPrice.multiply(quantity);
      vatAmount = subTotal.calculateVat(props.vatRate ?? 0);
      totalAmount = subTotal.add(vatAmount);
    }

    const batchId = props.batchId ? UUID.create(props.batchId).orThrow() : null;

    const vatRate = props.vatRate
      ? VatRate.create(props.vatRate).orThrow()
      : null;

    const financeLedgerId = props.financeLedgerId
      ? UUID.create(props.financeLedgerId).orThrow()
      : null;

    // `UUID.create(...).orThrow()` buradaydı: gerçek personel kimliği 28 karakterli
    // bir Firebase UID olduğu için HER stok hareketi (mal kabul, sayım düzeltmesi,
    // ürün kullanımı) `InvalidUuidException` ile patlıyordu — satın almanın mal
    // kabulü de bu yüzden hiç tamamlanamıyordu.
    const performedById = props.performedById ?? null;

    return new StockMovement({
      id: UUID.createOrGenerate(props.id).value,
      productId: props.productId,
      clinicId: props.clinicId,
      batchId: batchId?.value ?? null,
      type: props.type,
      direction: props.direction,
      quantity: Quantity.create(quantity).orThrow().value,
      unitPrice: unitPrice?.value ?? null,
      currency: unitPrice?.currency ?? Currency.enum.TRY,
      vatRate: vatRate?.value ?? null,
      vatAmount: vatAmount?.value ?? null,
      totalAmount: totalAmount?.value ?? null,

      financeLedgerId: financeLedgerId?.value ?? null,
      performedById,
      notes: props.notes ?? null,
      createdAt: DateTimeManager.create(),
    });
  }

  toPersistence(): IStockMovement {
    return {
      id: this.id.value,
      productId: this.productId.value,
      clinicId: this.clinicId.value,
      batchId: this.batchId?.value ?? null,
      type: this.type,
      direction: this.direction,
      quantity: this.quantity.value,
      unitPrice: this.unitPrice?.value ?? null,
      currency: this.currency.value,
      vatRate: this.vatRate?.value ?? null,
      vatAmount: this.vatAmount?.value ?? null,
      totalAmount: this.totalAmount?.value ?? null,
      financeLedgerId: this.financeLedgerId?.value ?? null,
      performedById: this.performedById,
      notes: this.notes,
      createdAt: this.createdAt,
    };
  }
}
