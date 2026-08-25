import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '@common/constants/error-codes.constant';

/**
 * Duffel token'ı tanımlı değil. Token bilinçli olarak opsiyonel env'dir: eksikliği
 * uygulamanın tamamını değil, yalnız uçuş uçlarını devre dışı bırakır.
 */
export class DuffelCredentialsMissingException extends DomainException {
  public readonly errorCode = ERROR_CODES.DUFFEL.CREDENTIALS_MISSING;
  public override readonly httpStatus = HttpStatus.SERVICE_UNAVAILABLE;

  constructor() {
    super('Uçuş sağlayıcısı yapılandırılmamış (DUFFEL_ACCESS_TOKEN eksik).');
  }
}

/** Duffel API'sinden gelen ham hata — sağlayıcı mesajı `meta`'da taşınır. */
export class DuffelApiException extends DomainException<{
  operation: string;
  providerMessage: string;
}> {
  public readonly errorCode = ERROR_CODES.DUFFEL.API_ERROR;
  public override readonly httpStatus = HttpStatus.BAD_GATEWAY;

  constructor(operation: string, providerMessage: string) {
    super(`Uçuş servisi hatası (${operation}): ${providerMessage}`, {
      operation,
      providerMessage,
    });
  }
}

/** Teklif ödeme tamamlanmadan bayatladı — hastaya yeniden arama önerilir. */
export class FlightOfferExpiredException extends DomainException {
  public readonly errorCode = ERROR_CODES.DUFFEL.OFFER_EXPIRED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(
    message = 'Seçilen uçuş teklifinin süresi doldu. Lütfen tekrar arama yapın.'
  ) {
    super(message);
  }
}

/** Tutulan koltuğun ödeme süresi doldu; Duffel yeri serbest bıraktı. */
export class FlightHoldExpiredException extends DomainException<{
  holdExpiresAt: string;
}> {
  public readonly errorCode = ERROR_CODES.DUFFEL.HOLD_EXPIRED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(holdExpiresAt: string) {
    super('Tutulan uçuş koltuğunun ödeme süresi doldu.', { holdExpiresAt });
  }
}

/**
 * Duffel teklifi sistemin desteklemediği bir para biriminde döndü. Sessizce yanlış
 * kolona yazmak yerine açıkça reddedilir (Currency enum'u TRY/USD/EUR/GBP).
 */
export class FlightUnsupportedCurrencyException extends DomainException<{
  currency: string;
  supported: string[];
}> {
  public readonly errorCode = ERROR_CODES.DUFFEL.UNSUPPORTED_CURRENCY;

  constructor(currency: string, supported: string[]) {
    super(`Uçuş teklifi desteklenmeyen para biriminde: ${currency}.`, {
      currency,
      supported,
    });
  }
}

export class FlightBookingNotFoundException extends DomainException<{
  bookingId: string;
}> {
  public readonly errorCode = ERROR_CODES.DUFFEL_FLIGHT_BOOKING.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(bookingId: string) {
    super('Uçuş rezervasyonu bulunamadı.', { bookingId });
  }
}

export class FlightBookingAlreadyCancelledException extends DomainException<{
  bookingId: string;
}> {
  public readonly errorCode =
    ERROR_CODES.DUFFEL_FLIGHT_BOOKING.ALREADY_CANCELLED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(bookingId: string) {
    super('Uçuş rezervasyonu zaten iptal edilmiş.', { bookingId });
  }
}

/** Durum makinesi ihlali (ör. HELD olmayan kaydı ödemeye çalışmak). */
export class FlightBookingInvalidStateException extends DomainException<{
  bookingId: string;
  status: string;
  expected: string;
}> {
  public readonly errorCode = ERROR_CODES.DUFFEL_FLIGHT_BOOKING.INVALID_STATE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(bookingId: string, status: string, expected: string) {
    super(
      `Uçuş rezervasyonu bu işlem için uygun durumda değil (${status}; beklenen: ${expected}).`,
      { bookingId, status, expected }
    );
  }
}

export class FlightPassengersRequiredException extends DomainException {
  public readonly errorCode = ERROR_CODES.DUFFEL_FLIGHT_BOOKING.NO_PASSENGERS;

  constructor() {
    super('Uçuş rezervasyonu için en az bir yolcu gereklidir.');
  }
}
