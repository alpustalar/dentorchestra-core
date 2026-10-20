import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../../../packages/shared/common/constants/error-codes.constant';

export class BookingPaymentRefundNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.BOOKING_PAYMENT_REFUND.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(message = 'İade kaydı bulunamadı.') {
    super(message);
  }
}

export class BookingPaymentRefundInvalidTransitionException extends DomainException {
  public readonly errorCode =
    ERROR_CODES.BOOKING_PAYMENT_REFUND.INVALID_TRANSITION;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(transition: string, currentStatus: string) {
    super(
      `İade kaydında geçersiz durum geçişi: ${transition} (mevcut durum: ${currentStatus}).`
    );
  }
}

/**
 * Sağlayıcı çağrısını başlatan girişim ile settle eden girişim aynı değil ya da satır artık
 * PENDING değil: araya başka bir akış (elle karar, yeniden deneme) girmiş. Geçiş yapılmaz —
 * ikinci yazıcı birincinin sonucunu ezmemeli (kural 3).
 */
export class BookingPaymentRefundSettleConflictException extends DomainException {
  public readonly errorCode =
    ERROR_CODES.BOOKING_PAYMENT_REFUND.SETTLE_CONFLICT;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(expectedAttempt: number, currentStatus: string) {
    super(
      `İade sonucu yazılamadı: girişim #${expectedAttempt} artık PENDING değil (mevcut durum: ${currentStatus}).`
    );
  }
}

/**
 * Elle çözülemeyen satır: taze PENDING (çağrı hâlâ sürüyor olabilir) ya da zaten kesinleşmiş.
 * Taze bir PENDING'i çözmek, sağlayıcıda sürmekte olan çağrıyla yarışır.
 */
export class BookingPaymentRefundNotResolvableException extends DomainException {
  public readonly errorCode = ERROR_CODES.BOOKING_PAYMENT_REFUND.NOT_RESOLVABLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(currentStatus: string) {
    super(
      `İade kaydı elle çözülemez (durum: ${currentStatus}). Yalnız doğrulanmamış (UNCONFIRMED) ya da süresi geçmiş (takılmış) bekleyen iadeler çözülür.`
    );
  }
}

export class BookingPaymentRefundNotRetryableException extends DomainException {
  public readonly errorCode = ERROR_CODES.BOOKING_PAYMENT_REFUND.NOT_RETRYABLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(currentStatus: string) {
    super(
      `İade yeniden denenemez (durum: ${currentStatus}). Yalnız sağlayıcının reddettiği ya da operatörün "gerçekleşmedi" dediği (FAILED) iade yeniden denenir.`
    );
  }
}

/** Aynı tahsilat için iade zaten talep edilmiş: tekrar gelen webhook / eşzamanlı istek. */
export class BookingPaymentRefundAlreadyClaimedException extends DomainException {
  public readonly errorCode =
    ERROR_CODES.BOOKING_PAYMENT_REFUND.ALREADY_CLAIMED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(provider: string, chargeProviderRef: string) {
    super(
      `Bu tahsilat için iade zaten talep edilmiş (${provider}:${chargeProviderRef}).`
    );
  }
}

/**
 * "İade gerçekleşmedi" kararı verilemez: o iade için ters kayıt defterde zaten yazılı.
 * Yazılmış bir fişi geri almak storno + yeni anahtar demektir; geçmişi geriye dönük yorumlayan
 * bir muhasebe kararıdır (kural 11), bu komutun işi değildir.
 */
export class BookingPaymentRefundReversalAlreadyRecordedException extends DomainException {
  public readonly errorCode =
    ERROR_CODES.BOOKING_PAYMENT_REFUND.REVERSAL_ALREADY_RECORDED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor() {
    super(
      'Bu iade için ters kayıt defterde zaten yazılı; "iade gerçekleşmedi" kararı verilemez. Düzeltme bir muhasebe kararıdır (storno).'
    );
  }
}

export class BookingPaymentRefundInvalidRefundedAtException extends DomainException {
  public readonly errorCode =
    ERROR_CODES.BOOKING_PAYMENT_REFUND.INVALID_REFUNDED_AT;

  constructor(
    message = 'İade tarihi zorunludur ve gelecekte ya da talep tarihinden önce olamaz.'
  ) {
    super(message);
  }
}

export class BookingPaymentRefundCurrencyNotSupportedException extends DomainException {
  public readonly errorCode =
    ERROR_CODES.BOOKING_PAYMENT_REFUND.CURRENCY_NOT_SUPPORTED;

  constructor(provider: string, currency: string) {
    super(`${provider} iadesi ${currency} cinsinde desteklenmiyor.`);
  }
}
