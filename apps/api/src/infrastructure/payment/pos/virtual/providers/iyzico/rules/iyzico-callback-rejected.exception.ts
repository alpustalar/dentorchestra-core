import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions';
import { ERROR_CODES } from '@common/constants/error-codes.constant';
import { IyzicoCallbackBindingFailure } from './iyzico-callback-binding.rule';

/**
 * Bildirimin **uygulanmama** nedeni. Bağ kanıtlanamadı (üç hâl, bkz.
 * {@link checkIyzicoCallbackBinding}) ya da bağ kanıtlandı ama sağlayıcının
 * bildirdiği tutar kaydın beklediğinden farklı.
 */
export type IyzicoCallbackRejection =
  | IyzicoCallbackBindingFailure
  /** Gövdenin iddia ettiği kayıt yok. */
  | 'RECORD_NOT_FOUND'
  /** Sepet tutarı / para birimi kaydın beklediğiyle uyuşmuyor. */
  | 'AMOUNT_MISMATCH';

export interface IyzicoCallbackRejectedMeta extends Record<string, unknown> {
  /** Callback'in güncellemeye çalıştığı kaydın kimliği (gövdeden gelen değer). */
  recordId: string;
  /** Hangi akış: sanal POS taksiti / rezervasyon / abonelik. */
  flow: string;
  reason: IyzicoCallbackRejection;
}

/**
 * Ödeme bildirimi bu kayda **uygulanmadı**.
 *
 * Gerekçenin tamamı {@link checkIyzicoCallbackBinding} içinde. Tek bir sınıf
 * olarak duruyor çünkü üç callback de (sanal POS, rezervasyon, abonelik) aynı
 * sağlayıcı hesabından gelen token'ları işliyor: üç kopya exception, birinde
 * yapılan düzeltmenin diğer ikisine geçmemesi demektir — bu turun bulgusu tam
 * olarak buydu (bağ kontrolü bir callback'te vardı, ikisinde yoktu).
 */
export class IyzicoCallbackRejectedException extends DomainException<IyzicoCallbackRejectedMeta> {
  public readonly errorCode = ERROR_CODES.IYZICO.CALLBACK_REJECTED;
  public override readonly httpStatus = HttpStatus.FORBIDDEN;

  constructor(meta: IyzicoCallbackRejectedMeta) {
    super(
      'Ödeme bildirimi bu kayda uygulanmadı: kayıtla bağı ya da tutarı doğrulanamadı.',
      meta
    );
  }
}
