import { CurrencyType } from '@input-type-schemas/CurrencySchema';
import { PosTransactionKindType } from '@input-type-schemas/PosTransactionKindSchema';

/**
 * PosTransaction domain kontratları — entity static `create()` girişi (Props).
 */
export interface CreatePosTransactionProps {
  // Kimlik bilgileri
  id?: string;
  posDeviceId: string;

  // Kurumsal bağlam
  clinicId: string;
  patientId?: string | null;
  appointmentId?: string | null;
  /** Eğer varsa ilgili ödeme kaydı. */
  paymentId?: string | null;

  /**
   * İşlemi terminalde başlatan personel (Firebase UID — ham string, UUID değil).
   *
   * **Zorunlu, çünkü varsayılanı olamaz.** SALE'de kartı çeken, VOID/REFUND'da ters
   * kaydı atan kişidir; ikisi de yüksek etkili para hareketidir (CLAUDE.md kural 7:
   * kalıcı damga ister). Opsiyonel bırakılsaydı yeni bir POS akışı damgayı sessizce
   * atlar ve kolon süse dönerdi (kural 10). DB kolonu eski satırlar için nullable'dır
   * ama yeni kayıt daima damgalanır.
   */
  initiatedById: string;

  // Finansal veriler
  amount: number;
  currency: CurrencyType;

  // Ters kayıt bilgisi — SALE dışındaki türler orijinal satışa bağlanmak zorundadır
  /** Verilmezse SALE. */
  kind?: PosTransactionKindType;
  originalPosTransactionId?: string;

  // Teknik veriler
  /** Banka veya ödeme kuruluşunun verdiği referans. */
  externalRef?: string | null;

  /** Ham veri (JSON blob) — ileriye dönük debug ve denetim için. */
  rawRequest?: unknown;
}
