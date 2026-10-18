import { Payment as IPayment, PaymentInstallment } from '@shared';
import {
  ArAgingData,
  ArAgingFilter,
  CollectedInstallmentRow,
  CollectedPaymentRow,
  FindCollectedPaymentsFilter,
  FindSettledInstallmentsFilter,
  InstallmentLedgerRow,
  ProviderRevenueFilterData,
  SettledInstallmentRow,
} from '@modules/finance/payment/domain/contracts/payment';

export const PAYMENT_QUERY_REPOSITORY = Symbol('IPaymentQueryRepository');

/** Okuma tarafı: entity değil, plain model / read-model döner. */
export interface IPaymentQueryRepository {
  findByAppointmentId(appointmentId: string): Promise<IPayment | null>;
  /** Ödeme + taksitleri (read-model) — taksit listesi doğrudan yanıta gider. */
  findPaymentWithInstallments(
    paymentId: string
  ): Promise<PaymentWithInstallments | null>;

  /** AR aging: şubenin açık taksitleri + tahsil edilmiş toplamı (yönetim raporu). */
  arAging(filter: ArAgingFilter): Promise<ArAgingData>;

  /** Hekim cirosu: tahsil edilmiş taksitlerin hekim boyutu (yönetim raporu). */
  providerRevenue(
    filter: ProviderRevenueFilterData
  ): Promise<CollectedInstallmentRow[]>;

  /**
   * Verilen aralıkta en az bir taksiti tahsil edilmiş ödemeler. Fatura eksiği
   * taramasının kaynağıdır; faturanın varlığını bu modül bilmez (bounded
   * context) — eşleştirme invoice modülünde yapılır.
   */
  findCollectedPayments(
    filter: FindCollectedPaymentsFilter
  ): Promise<CollectedPaymentRow[]>;

  /**
   * Tek taksitin cari defteri besleyen hâli — durum süzgeci YOK: cari kaydını
   * yazan taraf taksitin o anki nihai durumunu görmek zorundadır.
   */
  findInstallmentForLedger(
    installmentId: string
  ): Promise<InstallmentLedgerRow | null>;

  /**
   * Aralıkta sonuçlanmış (tahsil/iade) taksitler. Cari defter mutabakatının
   * kaynak tarafıdır; defterin ne yazdığını bu modül BİLMEZ (bounded context)
   * — eşleştirme finance-ledger modülünde yapılır.
   */
  findSettledInstallments(
    filter: FindSettledInstallmentsFilter
  ): Promise<SettledInstallmentRow[]>;
}

/** Ödeme başlığı + taksit satırları (okuma modeli). */
export type PaymentWithInstallments = IPayment & {
  installments: PaymentInstallment[];
};
