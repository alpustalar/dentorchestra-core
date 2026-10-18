import { Decimal } from 'decimal.js';
import { Money } from '@src/domain/value-objects/money.vo';
import { VatRate } from '@src/domain/value-objects/vat-rate.vo';
import type { LogSource } from '@src/domain/constants/log-action.constant';

/**
 * TreatmentCharge domain kontratları — entity static `create()` girişi (Props)
 * ve durum geçişi metod girdileri.
 */

/**
 * Satır oluşturma girişi. Fiyat alanları **hesaplanmaz halde** gelir: liste
 * fiyatı tedaviden çözülüp handler tarafından buraya taşınır, indirim/KDV
 * hesabını entity yapar.
 */
export interface CreateTreatmentChargeProps {
  id?: string;
  organizationId: string;
  clinicId: string;
  appointmentId: string;
  patientId: string;
  treatmentId: string;

  description?: string | null;
  quantity: Decimal;

  /** Tedavinin o anki liste fiyatı — satıra dondurulur. */
  listPrice: Money;
  discountRate: Decimal;
  discountReason?: string | null;
  vatRate: VatRate;

  /** Klinik ayarındaki indirim tavanı (%). Entity kuralı buna göre işler. */
  maxDiscountPercent: Decimal;
  /** Aktör kliniği yönetiyor mu? Tavanı yalnız yönetici aşabilir. */
  canExceedDiscountLimit: boolean;

  createdById?: string | null;
  /** Denetim izi: olay entity içinde raise edilir, handler tekrar publish etmez. */
  logSource?: LogSource;
}

/** Mevcut satırın indirimini değiştirme girişi. */
export interface ApplyDiscountProps {
  discountRate: Decimal;
  discountReason?: string | null;
  maxDiscountPercent: Decimal;
  canExceedDiscountLimit: boolean;
  actorId?: string | null;
  logSource?: LogSource;
}

/**
 * Satır iptali girişi. `reason` boş olamaz — HTTP sınırındaki
 * `VoidTreatmentChargeSchema` (min 1, max 300) bunu zaten doğrular.
 */
export interface VoidChargeProps {
  reason: string;
  /**
   * İptali yapan personel. Kayda **kalıcı damga** olarak yazılır (`voidedById`):
   * satır faturanın ticari dayanağı olduğu için "bu işlem neden faturaya
   * girmedi, kim çıkardı" sorusunun kalıcı bir yanıtı olmak zorunda.
   */
  actorId?: string | null;
  logSource?: LogSource;
}
