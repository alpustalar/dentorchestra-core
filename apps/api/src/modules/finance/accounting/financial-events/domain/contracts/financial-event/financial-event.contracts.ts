import { FinancialEventTypeType as FinancialEventType } from '@input-type-schemas/FinancialEventTypeSchema';
import { InputJsonValueType as InputJsonValue } from '@input-type-schemas/InputJsonValueSchema';

// ==========================================
// 1. SORGULAMA SÖZLEŞMELERİ (FILTERS)
// ==========================================

export interface FindFinancialEventsFilter {
  /**
   * Satır kapsamı — **zorunlu**. Yetki kontrolü klinik seviyesinde yapıldığı için
   * (`canAccessClinicFinances`) filtre de klinik seviyesinde olmak zorundadır:
   * yalnız `organizationId` ile filtrelenirse tek şubeye erişimi olan personel
   * organizasyondaki **tüm** şubelerin finansal olaylarını okur.
   */
  clinicId: string;
  /** Kiracı güvenlik ağı — kapsam her zaman `clinicId`'den çözülür. */
  organizationId: string;
  type?: FinancialEventType;
  sourceModule?: string;
  sourceRefId?: string; // Kaynak ID'ler harici sistemlerden (Örn: Meta, Stripe) gelebileceği için string
}

// ==========================================
// 2. KAYIT SÖZLEŞMELERİ (PROPS)
// ==========================================

export interface RecordFinancialEventProps {
  id?: string;
  clinicId: string; // defter sahibi şube (source-of-truth)
  organizationId: string; // denormalize — konsolide raporlama
  type: FinancialEventType;
  occurredAt?: Date;

  // JSON payload için projedeki orijinal InputJsonValue tipi:
  payload: InputJsonValue;

  sourceModule: string; // boş olamaz — @shared RecordFinancialEvent DTO'sunda (HTTP sınırı) doğrulanır
  sourceRefId?: string | null;
  dedupeKey?: string | null;
  performedById?: string | null; // İşlemi yapan kullanıcı ID'si
}
