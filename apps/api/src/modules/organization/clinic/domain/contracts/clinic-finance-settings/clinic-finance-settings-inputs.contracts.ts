import { Decimal } from 'decimal.js';
import { CurrencyType as Currency } from '@input-type-schemas/CurrencySchema';
import { RoundingDirectionType as RoundingDirection } from '@input-type-schemas/RoundingDirectionSchema';
import { BusinessTypeType as BusinessType } from '@input-type-schemas/BusinessTypeSchema';
import { PayoutTriggerType as PayoutTrigger } from '@input-type-schemas/PayoutTriggerSchema';

// ==========================================
// KLİNİK FİNANS AYARLARI (SATELLITE) SÖZLEŞMESİ
// ==========================================
// 1:1 Clinic satellite — fonksiyonel para birimi, KDV, taksit ve mali yıl
// gibi şube-bazlı finansal davranış ayarlarını taşır. Satır yoksa DB default'ları
// (TRY, %20 KDV vb.) geçerli kabul edilir.
//
// Sayısal invariant'lar (fiscalYearStartMonth 1-12, installmentCount ≥1,
// maxNegativeBalanceAmount ≥0, maxDiscountPercent 0-100) entity'nin kendi
// businessRulesValidator'ında (clinic-finance-settings.entity.ts) zaten
// koşuluyor; burada tekrar edilmez.

export interface CreateClinicFinanceSettingsProps {
  id?: string;
  clinicId: string; // Klinik ID zorunludur

  defaultCurrency?: Currency;
  roundingType?: RoundingDirection;
  providerPayoutTrigger?: PayoutTrigger;
  invoicePrefix?: string;
  autoCreateInvoice?: boolean;
  autoSendDebtReminder?: boolean;
  defaultVatRate?: Decimal;
  useCostTracking?: boolean;
  allowNegativeBalance?: boolean;
  maxNegativeBalanceAmount?: Decimal;
  maxInstallmentCount?: number;
  maxDiscountPercent?: Decimal;
  isEInvoiceActive?: boolean;
  fiscalYearStartMonth?: number;
  /** İşletme biçimi. Kayıt akışında zorunlu verilir; satır başka yoldan açılırsa boş kalabilir. */
  businessType?: BusinessType | null;
}

export interface ChangeBusinessTypeProps {
  businessType: BusinessType;
  /** Klinikte kapanmış (CLOSED) mali yıl var mı? Karar çağıranın: dönem modülü bilir. */
  hasClosedPeriod: boolean;
}
