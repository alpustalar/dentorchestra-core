import { QueryResponse } from '@shared/common/response/response.interface';
import type { CurrencyType } from '@input-type-schemas/CurrencySchema';

/**
 * Yaşlandırma kovası — açık taksitlerin vade yaşına göre dağılımı.
 *
 * Kovalar **para birimi başına** üretilir: aynı kasada TRY ve EUR tahsil eden
 * kliniklerde tek kovaya toplamak farklı birimleri toplayıp anlamsız bir tutar
 * yazıyordu.
 */
export interface ArAgingBucket {
  label: ArAgingBucketLabel;
  currency: CurrencyType;
  count: number;
  amount: string;
}

export type ArAgingBucketLabel =
  | 'NOT_DUE' // vadesi gelmemiş
  | 'D0_30' // 0-30 gün gecikmiş
  | 'D31_60'
  | 'D61_90'
  | 'D90_PLUS';

/** Hasta bazlı açık taksit riski (ad çözümü çağırana ait — bounded context). */
export interface ArAgingPatientRisk {
  patientId: string;
  currency: CurrencyType;
  outstanding: string; // toplam açık tutar
  overdue: string; // vadesi geçmiş açık tutar
  oldestDueDate: Date | null; // en eski açık vade
}

/** Para birimi başına özet — birimler arası toplam ALINMAZ (kur bilgisi yok). */
export interface ArAgingSummary {
  currency: CurrencyType;
  totalOutstanding: string; // açık (PENDING/OVERDUE) toplam
  totalOverdue: string; // vadesi geçmiş açık toplam
  totalCollected: string; // tahsil edilmiş (COMPLETED) toplam
  collectionRate: string; // tahsilat / (tahsilat + açık), 0..1
}

export interface ArAgingReport {
  clinicId: string;
  asOf: Date;
  buckets: ArAgingBucket[];
  patients: ArAgingPatientRisk[]; // overdue azalan sırada
  summaries: ArAgingSummary[]; // para birimi başına
}

export type GetArAgingResponse = QueryResponse<ArAgingReport>;
