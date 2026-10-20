import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';

const { MANAGEMENT, ADMIN, FINANCIAL } = ResponseGroups;

/**
 * Ürün bazlı stok seviyesi okuma modeli (StockLevel).
 * Kritik stok eşiği bir tedarik/maliyet parametresidir — ProductResponseDto ile
 * aynı hizada MANAGEMENT/FINANCIAL tier'ında tutulur.
 */
export class StockLevelResponseDto {
  // --- Ürün kimliği (aynı klinik personeline açık) ---
  @Expose() productId: string;
  @Expose() productName: string;
  @Expose() stockCode: string;
  @Expose() clinicId: string;

  // --- Mevcut miktar (decimal hassasiyeti için string) ---
  @Expose()
  @Type(() => String)
  totalQuantity: string;

  // --- Kritik eşik ve türev uyarı (yönetim/finans) ---
  @Expose({ groups: [MANAGEMENT, FINANCIAL, ADMIN] })
  @Type(() => String)
  criticalStockQty: string;

  @Expose({ groups: [MANAGEMENT, FINANCIAL, ADMIN] })
  isBelowCritical: boolean;
}
