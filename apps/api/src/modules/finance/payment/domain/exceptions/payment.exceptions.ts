import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { CurrencyType } from '@input-type-schemas/CurrencySchema';

export class PaymentNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.PAYMENT.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(paymentId: string) {
    super(`Ödeme bulunamadı: paymentId=${paymentId}`);
  }
}

export class InstallmentNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.PAYMENT.INSTALLMENT_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(installmentId: string) {
    super(`Taksit bulunamadı: ${installmentId}`);
  }
}

/**
 * Taksit tahsil edilebilir durumda değil (iptal edilmiş, iade edilmiş ya da
 * ters ibraz edilmiş).
 *
 * Bu bir **invariant**'tır, politika değil: iade edilmiş bir taksiti yeniden
 * "tahsil edildi" yapmak aynı parayı ikinci kez gelir yazar. Ters ibraz edilmiş
 * taksit için de aynısı geçerlidir — o paranın yeniden tahsili yeni (telafi)
 * taksit üzerinden yapılır. Bu yüzden entity içinde zorlanır ve
 * `systemOverride` ile atlanamaz.
 */
export class InstallmentNotCollectibleException extends DomainException<{
  installmentId: string;
  status: string;
}> {
  public readonly errorCode = ERROR_CODES.PAYMENT.INSTALLMENT_NOT_COLLECTIBLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { installmentId: string; status: string }) {
    super(
      `Taksit tahsil edilebilir durumda değil (durum: ${meta.status}).`,
      meta
    );
  }
}

/**
 * Tahsil edilmemiş bir taksit iade edilemez: olmayan parayı geri vermek, defterde
 * karşılığı olmayan bir ters kayıt (gelir eksiği) üretir.
 */
export class InstallmentNotRefundableException extends DomainException<{
  installmentId: string;
  status: string;
}> {
  public readonly errorCode = ERROR_CODES.PAYMENT.INSTALLMENT_NOT_REFUNDABLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { installmentId: string; status: string }) {
    super(
      `Yalnız tahsil edilmiş (COMPLETED) taksit iade edilebilir (durum: ${meta.status}).`,
      meta
    );
  }
}

/** Tahsil edilmiş/iade edilmiş taksit iptal edilemez — iade yolu kullanılır. */
export class InstallmentNotCancellableException extends DomainException<{
  installmentId: string;
  status: string;
}> {
  public readonly errorCode = ERROR_CODES.PAYMENT.INSTALLMENT_NOT_CANCELLABLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { installmentId: string; status: string }) {
    super(
      `Tahsil edilmiş veya iade edilmiş taksit iptal edilemez (durum: ${meta.status}). İade yolunu kullanın.`,
      meta
    );
  }
}

/**
 * Tahsil edilmiş bir taksit "başarısız" işaretlenemez: durum PENDING'e çekilince
 * taksit açık alacak sayılır ama tahsilatın cari/defter kaydı yerinde kalır —
 * rapor ile defter kalıcı olarak çelişir.
 */
export class InstallmentNotFailableException extends DomainException<{
  installmentId: string;
  status: string;
}> {
  public readonly errorCode = ERROR_CODES.PAYMENT.INSTALLMENT_NOT_FAILABLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { installmentId: string; status: string }) {
    super(
      `Tahsil edilmiş veya iade edilmiş taksit başarısız olarak işaretlenemez (durum: ${meta.status}).`,
      meta
    );
  }
}

/**
 * Yalnız tahsil edilmiş (COMPLETED) taksit ters ibraz edilebilir: sağlayıcı
 * olmayan bir tahsilatı geri alamaz; alınmamış parayı "geri alınmış" yazmak
 * defterde karşılığı olmayan bir ters kayıt üretir.
 */
export class InstallmentNotChargeableBackException extends DomainException<{
  installmentId: string;
  status: string;
}> {
  public readonly errorCode =
    ERROR_CODES.PAYMENT.INSTALLMENT_NOT_CHARGEABLE_BACK;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { installmentId: string; status: string }) {
    super(
      `Yalnız tahsil edilmiş (COMPLETED) taksit ters ibraz edilebilir (durum: ${meta.status}).`,
      meta
    );
  }
}

/**
 * Telafi taksidi iptal edilemez.
 *
 * Telafi taksidi, ters ibrazla geri alınan paranın hâlâ **geçerli hasta borcu**
 * olduğunu temsil eder. Bu borcun silinmesi (değersiz alacak: 128/129/654 ya da
 * 689) ayrı bir muhasebe kararıdır ve henüz bir akışı yoktur — taksidi iptal
 * etmek, 120'yi açık bırakıp ödeme planını "borç yok" göstermek demektir.
 */
export class RecoveryInstallmentNotCancellableException extends DomainException<{
  installmentId: string;
  recoversInstallmentId: string;
}> {
  public readonly errorCode =
    ERROR_CODES.PAYMENT.RECOVERY_INSTALLMENT_NOT_CANCELLABLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { installmentId: string; recoversInstallmentId: string }) {
    super(
      'Ters ibrazın telafi taksidi iptal edilemez: borç geçerliliğini koruyor. ' +
        'Değersiz alacak olarak silmek ayrı bir muhasebe kararıdır.',
      meta
    );
  }
}

/**
 * Taksit tutarı kuruştan (2 hane) daha ince: DB kolonu `Decimal(10,2)` olduğu
 * için fazla hane **sessizce** yuvarlanır ve taksitler toplamı ana tutarla
 * eşleşmez (bellekte tutan invariant diskte bozulur).
 */
export class PaymentInvalidPrecisionException extends DomainException<{
  amount: string;
}> {
  public readonly errorCode = ERROR_CODES.PAYMENT.INVALID_PRECISION;

  constructor(amount: string) {
    super(`Tutar en fazla 2 ondalık basamak taşıyabilir (gelen: ${amount}).`, {
      amount,
    });
  }
}

export class CompletedInstallmentNotFoundException extends DomainException {
  public readonly errorCode =
    ERROR_CODES.PAYMENT.COMPLETED_INSTALLMENT_NOT_FOUND;

  constructor(message = 'Tamamlanmış taksit bulunamadı.') {
    super(message);
  }
}

export class PaymentNotRefundableException extends DomainException<{
  status?: string;
}> {
  public readonly errorCode = ERROR_CODES.PAYMENT.NOT_REFUNDABLE;

  constructor(status?: string) {
    super(`İptal edilmiş veya bekleyen ödemeler iade edilemez.`, { status });
  }
}

export class PaymentNotCancellableException extends DomainException<{
  status: string;
}> {
  public readonly errorCode = ERROR_CODES.PAYMENT.NOT_CANCELLABLE;

  constructor(status?: string) {
    super(
      'Tamamlanmış veya iade süreci başlamış ödemeler iptal edilemez. İade metodunu kullanın.',
      { status }
    );
  }
}

export class InvalidInstallmentPlanException extends DomainException {
  public readonly errorCode = ERROR_CODES.PAYMENT.INVALID_INSTALLMENT_PLAN;

  constructor(
    message = 'Ödeme oluşturulabilmesi için en az bir taksit planı girilmelidir.'
  ) {
    super(message);
  }
}

export class InstallmentTotalMismatchException extends DomainException {
  public readonly errorCode = ERROR_CODES.PAYMENT.INSTALLMENT_TOTAL_MISMATCH;

  constructor(
    message: string,
    props: {
      totalInstallmentAmount: string;
      totalInstallmentCurrency: CurrencyType;
      propsTotalAmount: string;
      propsCurrency: CurrencyType;
    }
  ) {
    super(message, props);
  }
}

/**
 * Ödeme sağlayıcısı (iyzico SDK vb.) işlemi başarısız döndürdüğünde fırlatılır.
 * Payment domain'i provider'a özgü isimden habersiz kalsın diye jeneriktir.
 */
export class PaymentProviderFailedException extends DomainException<{
  sdkErrorMessage?: string;
}> {
  public readonly errorCode = ERROR_CODES.PAYMENT.PROVIDER_FAILED;

  constructor(sdkErrorMessage?: string) {
    super(`İşlem gerçekleştirilemedi: 'Bilinmeyen hata`, { sdkErrorMessage });
  }
}

/**
 * Tahsilat tutarı ne açıkça verildi ne de randevunun işlem satırlarından
 * türetilebildi. Sessizce 0 yazmak yerine akış durdurulur — tutarsız bir
 * tahsilat kaydı, mutabakatı sonradan çözülemez hale getirir.
 */
export class PaymentAmountUnresolvableException extends DomainException {
  public readonly errorCode = ERROR_CODES.PAYMENT.AMOUNT_UNRESOLVABLE;

  constructor(appointmentId?: string) {
    super(
      appointmentId
        ? `Tahsilat tutarı çözülemedi: randevunun ücretlendirilmiş işlem satırı yok (${appointmentId}). Tutarı açıkça gönderin ya da işlem satırı ekleyin.`
        : 'Tahsilat tutarı çözülemedi: tutar veya tutarın türetileceği randevu gönderilmelidir.'
    );
  }
}

/**
 * Tahsilat tutarı işlem satırlarından türetilirken para birimi uyuşmazlığı.
 *
 * Tutar satırlardan, para birimi ise istemciden alınıyordu: satırlar EUR iken
 * istemci TRY gönderdiğinde EUR tutar TRY olarak kaydediliyor, cari defter ve
 * muhasebe bu yanlış birimi devralıyor, fatura ise (kendi uyuşmazlık kontrolü
 * sayesinde) hiç kesilemiyordu. Tutar ve para birimi **aynı kaynaktan** gelir.
 */
export class PaymentChargeCurrencyMismatchException extends DomainException<{
  chargesCurrency: string;
  requestedCurrency: string;
}> {
  public readonly errorCode = ERROR_CODES.PAYMENT.CURRENCY_MISMATCH;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { chargesCurrency: string; requestedCurrency: string }) {
    super(
      `İşlem satırları ${meta.chargesCurrency} para biriminde; tahsilat ${meta.requestedCurrency} olarak oluşturulamaz.`,
      meta
    );
  }
}
