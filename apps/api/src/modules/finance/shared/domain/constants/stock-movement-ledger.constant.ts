import { StockMovementDirectionSchema, StockMovementTypeSchema } from '@shared';
import { StockMovementTypeType as StockMovementType } from '@input-type-schemas/StockMovementTypeSchema';
import { StockMovementDirectionType as StockMovementDirection } from '@input-type-schemas/StockMovementDirectionSchema';

const { enum: T } = StockMovementTypeSchema;
const { enum: D } = StockMovementDirectionSchema;

/**
 * Stok hareketinin **deftere** nasıl yansıdığı — tek kaynak.
 *
 * Hem üreten taraf (envanterin köprüsü: "bu hareket için ekonomik olay yazılır
 * mı") hem kural tarafı (posting: "hangi hesaba") buradan okur. İki yerde ayrı
 * liste tutmak CLAUDE.md finans kuralı 12'nin tam ihlali olurdu: üretilen ama
 * hesabı olmayan bir olay sonsuza dek fişsiz kalır (kapanışı bloke eder),
 * hesabı olup üretilmeyen bir tip ise defteri sessizce eksik bırakır.
 *
 * **Stok varlık hesabı 150 (İlk Madde ve Malzeme).** Alış faturası stoğu bu
 * hesaba borçlandırıyor (`lineAccountCode: '150'`); tüketim/zayi onu alacaklandırır.
 * Mal kabulün kendisi fiş üretmez — borç kaydı faturadan gelir, ikisi birlikte
 * yazılırsa stok iki kez borçlanırdı.
 */
export const INVENTORY_STOCK_ACCOUNT_CODE = '150';

/** Sarf malzeme tüketimi — hizmet üretim maliyeti (740.01). */
export const INVENTORY_CONSUMPTION_ACCOUNT_CODE = '740.01';

/** Zayi / sayım açığı — olağandışı gider (689). */
export const INVENTORY_LOSS_ACCOUNT_CODE = '689';

/** Sayım fazlası — olağandışı gelir (679). */
export const INVENTORY_SURPLUS_ACCOUNT_CODE = '679';

/**
 * Hangi hareket tipi defterde hangi karşı hesaba düşer (çıkışta borç, girişte
 * alacak tarafı; 150 her zaman karşı bacak).
 *
 * Haritada **olmayan** tipler bilerek köprülenmez:
 *  - `PURCHASE` — borç kaydı alış faturasından gelir (mükerrer olurdu),
 *  - `TRANSFER_IN` / `TRANSFER_OUT` — klinikler arası transfer iki defter
 *    arasında yer değiştirmedir, tek defterde gider/gelir doğurmaz,
 *  - `RETURN_TO_SUPPLIER` / `RETURN_FROM_PATIENT` — iade, ilgili faturanın
 *    ters kaydıyla yürür (cari + KDV birlikte düzelmeli); stok bacağını tek
 *    başına yazmak faturayla ayrışma üretir.
 * Bu tipler için bugün üretici de yok; eklendiğinde bu harita ile birlikte
 * tasarlanır (registry açılışta kapsamı doğruluyor).
 */
const COUNTER_ACCOUNT_BY_TYPE: Partial<Record<StockMovementType, string>> = {
  [T.USAGE]: INVENTORY_CONSUMPTION_ACCOUNT_CODE,
  [T.WASTE]: INVENTORY_LOSS_ACCOUNT_CODE,
  // Sayım düzeltmesi iki yönlü: açık gider (689), fazla gelir (679).
  // Yön `resolveStockCounterAccount` içinde ayrıştırılır.
  [T.ADJUSTMENT]: INVENTORY_LOSS_ACCOUNT_CODE,
};

/** Bu hareket tipi için ekonomik olay yazılır mı? */
export function isLedgerBridgedStockMovement(type: StockMovementType): boolean {
  return type in COUNTER_ACCOUNT_BY_TYPE;
}

/** Deftere köprülenen hareket tipleri — repo sorgularının süzgeci. */
export const LEDGER_BRIDGED_STOCK_MOVEMENT_TYPES: readonly StockMovementType[] =
  Object.keys(COUNTER_ACCOUNT_BY_TYPE) as StockMovementType[];

/**
 * 150'nin karşı bacağı. Çıkışta (OUT) gider/zarar hesabı borçlanır, girişte (IN)
 * gelir hesabı alacaklanır. Haritada olmayan tip `null` döner — çağıran kural
 * bunu sessizce geçmez, hata verir.
 */
export function resolveStockCounterAccount(
  type: StockMovementType,
  direction: StockMovementDirection
): string | null {
  if (!isLedgerBridgedStockMovement(type)) return null;

  if (direction === D.IN) {
    // Girişte köprülenen tek durum sayım fazlasıdır (satın alma faturadan gelir).
    return type === T.ADJUSTMENT ? INVENTORY_SURPLUS_ACCOUNT_CODE : null;
  }

  return COUNTER_ACCOUNT_BY_TYPE[type] ?? null;
}
