import { Payment } from '@modules/finance/payment/domain/entities/payment.entity';
import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';

export const PAYMENT_COMMAND_REPOSITORY = Symbol('IPaymentCommandRepository');

export interface IPaymentCommandRepository extends IBaseCommandRepository<Payment> {
  /**
   * Taksitin ait olduğu ödemeyi, satırı `FOR UPDATE` kilitleyerek yükler. Taksit
   * durum geçişleri (tahsil/iade/iptal/başarısız) para hareketidir ve POS callback'i
   * ile manuel işlem yarışabilir; kilit olmadan iki eşzamanlı geçiş birbirinin
   * üzerine yazar. Yalnız aktif transaction içinde çağrılır.
   */
  findByInstallmentIdForUpdate(installmentId: string): Promise<Payment | null>;

  /**
   * Ödemeyi satırı `FOR UPDATE` kilitleyerek yükler. Hangi taksit olduğu henüz
   * bilinmeyen bir geçiş içindir (kart itirazında POS satışı bir plana bağlıdır
   * ama hangi taksidi ödediği tutar eşleşmesiyle bulunur). Yalnız aktif
   * transaction içinde çağrılır.
   */
  findByIdForUpdate(paymentId: string): Promise<Payment | null>;
}
