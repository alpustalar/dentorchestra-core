import { LogSource } from '@src/domain/constants/log-action.constant';

/**
 * ClinicPaymentGateway domain kontratları. Entity static `create()` girişi (Props).
 */

/**
 * `iyzicoSubMerchantKey` iyzico'nun alt üye işyeri (Sub-Merchant) API yanıtından
 * gelir — kullanıcı girdisi değildir (bkz. RegisterClinicPaymentGatewayHandler),
 * bu yüzden format doğrulaması burada değil sağlayıcı entegrasyonunda yaşar.
 *
 * Denetim alanları (`maskedIban`, `actorId`, `source`) zorunlu: bu kayıt
 * kliniğin hak edişlerinin yatacağı hesabı belirler ve IBAN yerelde
 * saklanmadığı için değişikliğin tek kalıcı izi audit log'dur.
 */
export interface CreateClinicPaymentGatewayProps {
  id?: string;
  clinicId: string;
  iyzicoSubMerchantKey: string;
  /** Yalnız son 4 hane (ör. `**** 1234`) — tam IBAN log'a yazılmaz. */
  maskedIban: string;
  actorId: string;
  source: LogSource;
}

/** Mevcut altyapı kaydının yeniden kaydı/güncellenmesi. */
export interface UpdateClinicPaymentGatewayProps {
  iyzicoSubMerchantKey: string;
  maskedIban: string;
  actorId: string;
  source: LogSource;
}
