import { QueryResponse } from '@shared/common/response/response.interface';
import type { CurrencyType } from '@input-type-schemas/CurrencySchema';

/**
 * Hekim bazında tahsil edilmiş ciro satırı (hekim adı çağırana ait).
 *
 * Satır anahtarı (hekim + para birimi): farklı para birimlerindeki tahsilatları
 * tek satırda toplamak anlamsız bir ciro üretiyordu.
 */
export interface ProviderRevenueLine {
  providerId: string | null; // null = atanmamış ödemeler
  currency: CurrencyType;
  collected: string; // tahsil edilmiş toplam
  count: number; // tahsil edilen taksit adedi
}

/** Para birimi başına genel toplam. */
export interface ProviderRevenueTotal {
  currency: CurrencyType;
  collected: string;
}

export interface ProviderRevenueReport {
  clinicId: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  lines: ProviderRevenueLine[]; // ciro azalan sırada
  totals: ProviderRevenueTotal[];
}

export type GetProviderRevenueResponse = QueryResponse<ProviderRevenueReport>;
