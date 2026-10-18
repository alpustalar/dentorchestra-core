import { ProductUsage as IProductUsage } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Quantity } from '@src/domain/value-objects/quantity.vo';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { CreateProductUsageProps } from '@modules/supply/inventory/domain/contracts';

/**
 * Malzeme tüketim kaydı.
 *
 * Neden ayrı bir kayıt: stok hareketi "ne kadar çıktı, kaça" sorusunu
 * cevaplıyor; "hangi randevuda kullanıldı" sorusunu yalnız bu kayıt
 * cevaplayabilir. Uç `appointmentId` alıyordu ama hiçbir yere yazılmıyordu —
 * tedavinin malzeme maliyeti bu yüzden hiç hesaplanamıyordu.
 */
export class ProductUsage extends AggregateRoot {
  constructor(data: IProductUsage) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._productId = UUID.fromTrusted(data.productId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._batchId = data.batchId;
    this._appointmentId = data.appointmentId;
    this._usedByProviderId = data.usedByProviderId;
    this._quantity = Quantity.fromTrusted(data.quantity);
    this._usedAt = data.usedAt;
    this._stockMovementId = data.stockMovementId;
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

  private _batchId: string | null;
  get batchId(): string | null {
    return this._batchId;
  }

  private _appointmentId: string | null;
  get appointmentId(): string | null {
    return this._appointmentId;
  }

  private _usedByProviderId: string | null;
  get usedByProviderId(): string | null {
    return this._usedByProviderId;
  }

  private _quantity: Quantity;
  get quantity(): Quantity {
    return this._quantity;
  }

  private _usedAt: Date;
  get usedAt(): Date {
    return this._usedAt;
  }

  private _stockMovementId: string | null;
  get stockMovementId(): string | null {
    return this._stockMovementId;
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

  public static create(props: CreateProductUsageProps): ProductUsage {
    const now = DateTimeManager.create();

    return new ProductUsage({
      id: UUID.createOrGenerate(props.id).value,
      productId: UUID.create(props.productId).orThrow().value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      batchId: props.batchId ?? null,
      appointmentId: props.appointmentId ?? null,
      // Uygulayan hekim kimliği bugün uçtan alınmıyor; randevudan türetilecekse
      // ayrı bir tur ister (bkz. denetim dokümanı §43).
      usedByProviderId: props.usedByProviderId ?? null,
      quantity: props.quantity.value,
      usedAt: now,
      stockMovementId: props.stockMovementId ?? null,
      notes: props.notes ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  toPersistence(): IProductUsage {
    return {
      id: this.id.value,
      productId: this.productId.value,
      clinicId: this.clinicId.value,
      batchId: this.batchId,
      appointmentId: this.appointmentId,
      usedByProviderId: this.usedByProviderId,
      quantity: this.quantity.value,
      usedAt: this.usedAt,
      stockMovementId: this.stockMovementId,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
