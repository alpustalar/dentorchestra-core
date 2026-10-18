import { CurrencyType } from '@input-type-schemas/CurrencySchema';
import { PaymentMethodType } from '@input-type-schemas/PaymentMethodSchema';
import { Money } from '@src/domain/value-objects/money.vo';
import { LogSource } from '@src/domain/constants/log-action.constant';

/**
 * Payment domain kontratları — entity static `create()` girişi (Props) ve durum
 * geçişi metod girdileri.
 */

// ==========================================
// TAKSİTLENDİRME VE PLANLAMA
// ==========================================

/**
 * Ödeme planı kırılımı — kullanıcının serbestçe girdiği taksit satırı.
 * (create-payment-plan komutu tarafından tüketilir.)
 */
export interface InstallmentPlanItem {
  amount: number;
  method: string;
  dueDate?: Date;
  note?: string;
}

export interface CreateInstallmentPlanData {
  clinicId: string;
  patientId: string;
  appointmentId?: string;
  providerId?: string;
  currency: CurrencyType;
  installments: InstallmentPlanItem[];
}

/** Entity `create()`e beslenen tek taksit girişi. `installmentNo` handler'da üretilir (her zaman pozitif, sıralı). */
export interface CreateInstallmentProps {
  id: string;
  installmentNo: number;
  /** Taksit tutarı — Money VO (negatiflik/sonluluk VO'da korunur). */
  money: Money;
  method?: PaymentMethodType;
  dueDate?: Date | null;
  note?: string | null;
}

/**
 * Taksit durum geçişlerinin ortak audit girdisi. Event'ler entity içinde raise
 * edildiği için (bkz. CLAUDE.md "Events Raised in Entity") aktör/kanal bilgisi
 * handler'dan buradan taşınır; `details` verilmezse varsayılan metin yazılır.
 */
export interface InstallmentTransitionProps {
  installmentId: string;
  actorId: string;
  logSource: LogSource;
  details?: string;
}

/** Taksit tahsilatı (POS/sanal POS callback'i veya elle tahsilat). */
export type CompleteInstallmentProps = InstallmentTransitionProps;

/** Taksit tahsilat denemesinin başarısızlığı — taksit yeniden denenebilir olur. */
export type FailInstallmentProps = InstallmentTransitionProps;

/** Taksit iadesi. */
export type RefundInstallmentProps = InstallmentTransitionProps;

// ==========================================
// ÖDEME VE TAHSİLAT
// ==========================================

export interface CreatePaymentProps {
  id?: string;
  clinicId: string;
  patientId: string;
  appointmentId?: string | null;
  providerId?: string | null;
  /** Toplam tutar — Money VO; taksitlerin toplamıyla eşleşmesi entity'de doğrulanır. */
  totalAmount: Money;
  /** En az bir taksit kırılımı veya peşinat olmalıdır — entity `create()` bunu doğrular. */
  installments: CreateInstallmentProps[];
}

export interface CreateSinglePaymentData {
  clinicId: string;
  patientId: string;
  appointmentId?: string;
  providerId?: string;
  amount: number;
  currency: CurrencyType;
  method?: PaymentMethodType;
  dueDate?: Date;
}
