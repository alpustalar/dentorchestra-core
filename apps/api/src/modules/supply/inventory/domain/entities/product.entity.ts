import { Product as IProduct } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { ProductBatch } from '@modules/supply/inventory/domain/entities/product-batch.entity';
import { ProductConditionType as ProductCondition } from '@input-type-schemas/ProductConditionSchema';
import { ProductUnitType as ProductUnit } from '@input-type-schemas/ProductUnitSchema';
import { VatRate } from '@src/domain/value-objects/vat-rate.vo';
import { Quantity } from '@src/domain/value-objects/quantity.vo';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Barcode } from '@src/domain/value-objects/barcode.vo';
import { StockCode } from '@src/domain/value-objects/stock-code.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { Img } from '@src/domain/value-objects/img.vo';
import { Name } from '@src/domain/value-objects/name.vo';
import { isNotUndefined } from '@common/utils/is-not-undefined';
import {
  CreateProductProps,
  HandleStockChangeProps,
  UpdateProductProps,
} from '@modules/supply/inventory/domain/contracts';
import {
  NoLotToDeductException,
  ProductNotUsableInClinicException,
  StockIncreaseRequiresReceiptException,
} from '@modules/supply/inventory/domain/exceptions/inventory.exceptions';

export class Product extends AggregateRoot {
  constructor(data: IProduct) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._name = Name.fromTrusted(data.name);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._stockCode = StockCode.fromTrusted(data.stockCode);
    this._barcode = Barcode.create(data.barcode).instance ?? null;
    this._brand = data.brand;
    this._description = data.description;
    this._imageUrl = Img.create(data.imageUrl).instance ?? null;
    this._unit = data.unit;
    this._condition = data.condition;
    this._vatRate = VatRate.fromTrusted(data.vatRate);
    this._criticalStockQty = Quantity.fromTrusted(data.criticalStockQty);
    this._reorderQty = Quantity.fromTrusted(data.reorderQty);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._categoryId = UUID.create(data.categoryId).instance ?? null;
    this._supplierId = UUID.create(data.supplierId).instance ?? null;
    this._isActive = data.isActive;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
    this._deletedAt = data.deletedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _name: Name;
  get name(): Name {
    return this._name;
  }

  private _stockCode: StockCode;
  get stockCode(): StockCode {
    return this._stockCode;
  }

  private _barcode: Barcode | null;
  get barcode(): Barcode | null {
    return this._barcode;
  }

  private _brand: string | null;
  get brand(): string | null {
    return this._brand;
  }

  private _description: string | null;
  get description(): string | null {
    return this._description;
  }

  private _imageUrl: Img | null;
  get imageUrl(): Img | null {
    return this._imageUrl;
  }

  private _unit: ProductUnit;
  get unit(): ProductUnit {
    return this._unit;
  }

  private _condition: ProductCondition | null;
  get condition(): ProductCondition | null {
    return this._condition;
  }

  private _vatRate: VatRate;
  get vatRate(): VatRate {
    return this._vatRate;
  }

  private _criticalStockQty: Quantity;
  get criticalStockQty(): Quantity {
    return this._criticalStockQty;
  }

  private _reorderQty: Quantity;
  get reorderQty(): Quantity {
    return this._reorderQty;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _categoryId: UUID | null;
  get categoryId(): UUID | null {
    return this._categoryId;
  }

  private _supplierId: UUID | null;
  get supplierId(): UUID | null {
    return this._supplierId;
  }

  private _isActive: boolean;
  get isActive(): boolean {
    return this._isActive;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  private _deletedAt: Date | null;
  get deletedAt(): Date | null {
    return this._deletedAt;
  }

  get isDeleted(): boolean {
    return !!this._deletedAt;
  }

  public static create(props: CreateProductProps): Product {
    const vatRate =
      typeof props.vatRate === 'number'
        ? VatRate.create(props.vatRate).orThrow()
        : props.vatRate;

    const criticalStock =
      typeof props.criticalStockQty === 'number'
        ? Quantity.create(props.criticalStockQty).orThrow()
        : props.criticalStockQty;

    const reorderQty =
      typeof props.reorderQty === 'number'
        ? Quantity.create(props.reorderQty).orThrow()
        : props.reorderQty;

    // KDV oranı **sıfır olabilir**: 0 yasal kümenin (`STATUTORY_VAT_RATES`) bir
    // üyesidir ve istisna/muafiyet kapsamındaki malın oranı gerçekten sıfırdır
    // (bazı tıbbi cihazlar, basılı yayın). Burada `hasTax.orThrow()` vardı; DTO
    // ise 0'ı kabul ediyordu → kapı kullanım yerinden **geniş**ti (CLAUDE.md
    // finans kuralı 12) ve 0 gönderen istek, sebebinden kopuk bir "KDV oranı
    // sıfır olamaz" hatasıyla duruyordu. Alış faturası, satış faturası ve işlem
    // satırı 0'ı zaten kabul ediyor; tek istisna bu entity'ydi.
    const now = DateTimeManager.create();

    const barcode = props.barcode
      ? Barcode.create(props.barcode).orThrow()
      : null;

    const imageUrl = props.imageUrl
      ? Img.create(props.imageUrl).orThrow()
      : null;

    const categoryId = props.categoryId
      ? UUID.create(props.categoryId).orThrow()
      : null;

    const supplierId = props.supplierId
      ? UUID.create(props.supplierId).orThrow()
      : null;

    return new Product({
      id: UUID.createOrGenerate(props.id).value,
      name: Name.create(props.name).orThrow().value,
      stockCode: StockCode.create(props.stockCode).orThrow().value,
      barcode: barcode?.value ?? null,
      brand: props.brand ?? null,
      description: props.description ?? null,
      imageUrl: imageUrl?.value ?? null,
      unit: props.unit,
      condition: props.condition ?? null,
      vatRate: vatRate.value,
      criticalStockQty: criticalStock.value,
      reorderQty: reorderQty.value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      organizationId: props.organizationId,
      categoryId: categoryId?.value ?? null,
      supplierId: supplierId?.value ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  public activate(): void {
    this._isActive = true;
    this._updatedAt = DateTimeManager.create();
  }

  public deactivate(): void {
    this._isActive = false;
    this._updatedAt = DateTimeManager.create();
  }

  public update(props: UpdateProductProps): void {
    if (isNotUndefined(props.name))
      this._name = Name.create(props.name).orThrow();

    if (isNotUndefined(props.barcode))
      this._barcode = Barcode.create(props.barcode).instance ?? null;

    if (isNotUndefined(props.brand)) this._brand = props.brand;

    if (isNotUndefined(props.description))
      this._description = props.description;

    if (isNotUndefined(props.imageUrl))
      this._imageUrl = Img.create(props.imageUrl).orThrow();

    if (isNotUndefined(props.unit)) this._unit = props.unit;

    if (isNotUndefined(props.vatRate)) {
      // 0 meşrudur (bkz. `create`): `hasTax.orThrow()` burada dururken sıfır
      // KDV'li bir ürünün oranı **hiç güncellenemiyordu** — oluşturma kapısı
      // 0'ı kabul ettiği için böyle bir ürün var olabiliyor, ama kartı artık
      // düzenlenemiyordu.
      this._vatRate = VatRate.create(props.vatRate).orThrow();
    }

    if (isNotUndefined(props.criticalStockQty)) {
      this._criticalStockQty = Quantity.create(
        props.criticalStockQty
      ).orThrow();
    }
    if (isNotUndefined(props.reorderQty)) {
      this._reorderQty = Quantity.create(props.reorderQty).orThrow();
    }
    if (isNotUndefined(props.categoryId))
      this._categoryId = UUID.create(props.categoryId).instance ?? null;

    if (isNotUndefined(props.supplierId))
      this._supplierId = UUID.create(props.supplierId).instance ?? null;

    this._updatedAt = DateTimeManager.create();
  }

  public softDelete(): void {
    if (this.deletedAt) return;
    const now = DateTimeManager.create();
    this._deletedAt = now;
    this._updatedAt = now;
    this._isActive = false;
  }

  /**
   * Stok değişimini uygun partiye (batch) uygular ve değişen partiyi döner. Hareket
   * kaydı (StockMovement) bu metodun dönüşü değildir: miktarı değiştiren aggregate
   * `StockQuantityChangedEvent` fırlatır, kaydı dinleyici yazar.
   *
   * Parti **her zaman** gereklidir (artışta da): stok seviyesi
   * `Σ product_batches.quantity` olduğu için partisi olmayan bir artış miktarı
   * hiç değiştirmez, yalnız hareket kaydı bırakır — bkz.
   * {@link StockIncreaseRequiresReceiptException}.
   */
  public handleStockChange(props: HandleStockChangeProps): ProductBatch {
    if (props.clinicId !== this.clinicId.value) {
      throw new ProductNotUsableInClinicException({
        productId: this.id.value,
        reason: 'OTHER_CLINIC',
      });
    }
    const isIncrease = Quantity.isDeltaAnIncrease(props.quantityDelta);
    const absQty = Quantity.createAbsFromDelta(props.quantityDelta);

    // 1. Eğer sistemde batch takibi yapılan bir ürünse batch bulmaya çalış
    let targetBatch: ProductBatch | null = null;
    if (props.explicitBatchId) {
      targetBatch =
        props.availableBatches.find(
          (b) => b.id.value === props.explicitBatchId
        ) || null;
    } else if (props.availableBatches.length > 0) {
      targetBatch = props.availableBatches[0];
    }

    if (!targetBatch) {
      // Düşümde düşülecek lot yok; artışta ise maliyeti olmayan bir giriş
      // doğacaktı (eski kod yalnız hareket kaydı yazıp miktarı değiştirmiyordu).
      throw isIncrease
        ? new StockIncreaseRequiresReceiptException({
            productId: this.id.value,
          })
        : new NoLotToDeductException({ productId: this.id.value });
    }

    if (isIncrease) {
      targetBatch.addQuantity({
        qty: absQty,
        performedById: props.performedById,
        notes: props.notes,
      });
    } else {
      targetBatch.deductQuantity({
        qty: absQty,
        performedById: props.performedById,
        notes: props.notes,
      });
    }

    return targetBatch;
  }

  toPersistence(): IProduct {
    return {
      id: this.id.value,
      name: this.name.value,
      stockCode: this.stockCode.value,
      clinicId: this.clinicId.value,
      barcode: this.barcode?.value ?? null,
      brand: this.brand,
      description: this.description,
      imageUrl: this.imageUrl?.value ?? null,
      unit: this.unit,
      condition: this.condition,
      vatRate: this.vatRate.value,
      criticalStockQty: this.criticalStockQty.value,
      reorderQty: this.reorderQty.value,
      organizationId: this.organizationId.value,
      categoryId: this.categoryId?.value ?? null,
      supplierId: this.supplierId?.value ?? null,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }
}
