import { BaseEvent } from '@common/interfaces';
import { INVENTORY_EVENTS } from '@src/domain/constants/events';
import { StockMovementTypeType as StockMovementType } from '@input-type-schemas/StockMovementTypeSchema';
import { StockMovementDirectionType as StockMovementDirection } from '@input-type-schemas/StockMovementDirectionSchema';
import { CurrencyType } from '@input-type-schemas/CurrencySchema';

/**
 * Bir partinin (batch) miktarı değiştiğinde fırlatılır. Stok hareketi (StockMovement)
 * kaydı bu olayın yan etkisidir: miktarı değiştiren akış hareketi kendisi yazmaz,
 * dinleyici yazar.
 *
 * ⚠️ Alanların tümü ilkel (string) tutulur: olay outbox üzerinden gittiğinde JSON'a
 * serileştirilip geri okunur — Decimal/VO alanlar bu yolculuktan sağ çıkmaz.
 * `movementId` olay üretilirken belirlenir; outbox at-least-once teslim ettiğinde
 * dinleyici aynı id'yi görüp mükerrer hareket yazmaz.
 */
export interface StockQuantityChangedEventPayload {
  readonly movementId: string;
  readonly productId: string;
  readonly clinicId: string;
  readonly batchId: string | null;
  readonly type: StockMovementType;
  readonly direction: StockMovementDirection;
  readonly quantity: string;
  /**
   * Hareketin birim maliyeti — partinin alış fiyatı, ondalık string (kuruş
   * ölçeğinde). Hareket kaydının `unitPrice`/`totalAmount` kolonları bununla
   * dolar: parti bağımsız hareketlerde (henüz yok) `null`.
   *
   * Neden olay taşıyor: maliyet yalnız partide duruyor ve hareketi yazan
   * dinleyici partiyi okumuyor. Taşınmadığı sürece **her çıkış hareketi
   * değersiz** kaydediliyordu (yalnız mal kabul girişleri fiyat taşıyordu) →
   * hareketler üzerinden alınan her değer raporu çıkışları eksik sayıyor,
   * tüketilen malın maliyeti (SMM) hiçbir yerden türetilemiyordu.
   */
  readonly unitPrice: string | null;
  readonly currency: CurrencyType;
  readonly performedById: string | null;
  readonly notes: string | null;
}

export class StockQuantityChangedEvent extends BaseEvent {
  static readonly NAME = INVENTORY_EVENTS.STOCK_QUANTITY_CHANGED;

  public readonly movementId: string;
  public readonly productId: string;
  public readonly clinicId: string;
  public readonly batchId: string | null;
  public readonly type: StockMovementType;
  public readonly direction: StockMovementDirection;
  public readonly quantity: string;
  public readonly unitPrice: string | null;
  public readonly currency: CurrencyType;
  public readonly performedById: string | null;
  public readonly notes: string | null;

  constructor(payload: StockQuantityChangedEventPayload) {
    super();
    this.movementId = payload.movementId;
    this.productId = payload.productId;
    this.clinicId = payload.clinicId;
    this.batchId = payload.batchId;
    this.type = payload.type;
    this.direction = payload.direction;
    this.quantity = payload.quantity;
    this.unitPrice = payload.unitPrice;
    this.currency = payload.currency;
    this.performedById = payload.performedById;
    this.notes = payload.notes;
  }
}
