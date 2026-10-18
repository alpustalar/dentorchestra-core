import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '@common/constants/error-codes.constant';

export class PosDeviceNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.POS.DEVICE_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(message = 'POS cihazı bulunamadı veya aktif değil.') {
    super(message);
  }
}

export class PosTransactionNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.POS.TRANSACTION_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(externalRef: string) {
    super(`POS işlemi bulunamadı: externalRef=${externalRef}`);
  }
}

export class OriginalPosTransactionNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.POS.ORIGINAL_TRANSACTION_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(message = 'Orijinal POS işlemi bulunamadı.') {
    super(message);
  }
}

export class PosTransactionNotRefundableException extends DomainException {
  public readonly errorCode = ERROR_CODES.POS.NOT_REFUNDABLE;

  constructor(message = 'Yalnızca başarılı işlemler iade edilebilir.') {
    super(message);
  }
}

export class PosTransactionNotVoidableException extends DomainException {
  public readonly errorCode = ERROR_CODES.POS.NOT_VOIDABLE;

  constructor(message = 'Yalnızca başarılı işlemler iptal edilebilir.') {
    super(message);
  }
}

/**
 * Satış zaten geri alınmış (canlı bir iptal ya da iade kaydı var). İki eşzamanlı
 * iptal isteğinden yarışı kaybeden taraf da bu hatayı alır: kilit altındaki kontrol
 * yakalayamazsa `active_void_original_id` unique kısıtı INSERT'te yakalar.
 */
export class PosTransactionAlreadyReversedException extends DomainException {
  public readonly errorCode = ERROR_CODES.POS.ALREADY_REVERSED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(message = 'Bu işlem daha önce iptal edilmiş veya iade edilmiş.') {
    super(message);
  }
}

export class PosTransactionReversalRequiresOriginalException extends DomainException {
  public readonly errorCode = ERROR_CODES.POS.REVERSAL_REQUIRES_ORIGINAL;

  constructor(
    message = 'İptal/iade kaydı bir orijinal POS işlemine bağlanmak zorundadır.'
  ) {
    super(message);
  }
}

export class PosTransactionMissingExternalRefException extends DomainException {
  public readonly errorCode = ERROR_CODES.POS.MISSING_EXTERNAL_REF;

  constructor(
    message = 'Orijinal işlemin PAX referansı (HostRefNum) bulunamadı.'
  ) {
    super(message);
  }
}

export class RefundAmountExceedsOriginalException extends DomainException {
  public readonly errorCode = ERROR_CODES.POS.REFUND_AMOUNT_EXCEEDS_ORIGINAL;

  constructor(message = 'İade tutarı orijinal işlem tutarını aşamaz.') {
    super(message);
  }
}

export class PosDeviceProviderMismatchException extends DomainException {
  public readonly errorCode = ERROR_CODES.POS.PROVIDER_MISMATCH;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(expected: string, actual: string, detail?: string) {
    super(
      detail ??
        `POS işlemi ${expected} sağlayıcısı bekliyor; cihaz ${actual} olarak yapılandırılmış.`
    );
  }
}

export class PosDeviceMissingDeviceUniqueIdException extends DomainException {
  public readonly errorCode = ERROR_CODES.POS.MISSING_DEVICE_UNIQUE_ID;

  constructor(
    message = 'iyzico Terminal cihazı için deviceUniqueId tanımlı değil.'
  ) {
    super(message);
  }
}

export class ClinicIyzicoTerminalConfigNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.POS.IYZICO_TERMINAL_CONFIG_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(
    message = 'Kliniğe ait iyzico Terminal kimlik bilgileri bulunamadı.'
  ) {
    super(message);
  }
}

export class PosTransactionMissingPaymentDateException extends DomainException {
  public readonly errorCode = ERROR_CODES.POS.MISSING_PAYMENT_DATE;

  constructor(
    message = 'Orijinal işlemin iyzico ödeme tarihi (paymentDate) bulunamadı.'
  ) {
    super(message);
  }
}

/**
 * Cihaz, işlemin yürütüldüğü kliniğe ait değil.
 *
 * Yetki kontrolü `clinicId`'yi doğruluyor, cihaz ise ayrı bir alandan
 * (`posDeviceId`) geliyordu: kendi kliniğinin id'sini yazıp BAŞKA kliniğin
 * terminal id'sini göndermek mümkündü. Kart o kliniğin cihazında (yani onun
 * üye işyeri hesabında) çekilir, kayıt ise çağıranın defterine düşerdi —
 * hem kiracı ihlali hem defter-gerçeklik uyuşmazlığı.
 */
export class PosDeviceClinicMismatchException extends DomainException<{
  deviceClinicId: string;
  requestedClinicId: string;
}> {
  public readonly errorCode = ERROR_CODES.POS.DEVICE_CLINIC_MISMATCH;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(deviceClinicId: string, requestedClinicId: string) {
    super('POS cihazı bu kliniğe ait değil.', {
      deviceClinicId,
      requestedClinicId,
    });
  }
}

/** Pasif cihazda işlem yürütülemez. (Önceden çıplak `Error` idi → 500 dönüyordu.) */
export class PosDeviceInactiveException extends DomainException {
  public readonly errorCode = ERROR_CODES.POS.DEVICE_INACTIVE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(message = 'POS cihazı aktif değil.') {
    super(message);
  }
}

/** İptal/iade edilecek orijinal işlem, çağıranın kliniğine ait değil. */
export class PosTransactionClinicMismatchException extends DomainException<{
  transactionClinicId: string;
  requestedClinicId: string;
}> {
  public readonly errorCode = ERROR_CODES.POS.TRANSACTION_CLINIC_MISMATCH;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(transactionClinicId: string, requestedClinicId: string) {
    super('POS işlemi bu kliniğe ait değil.', {
      transactionClinicId,
      requestedClinicId,
    });
  }
}

/**
 * İşlem zaten sonuçlanmış; ikinci kez sonuçlandırılamaz.
 *
 * POS işlemi yalnız PENDING'den terminal duruma geçebilir. Bu değişmez hem
 * callback hem mutabakat taramasının yorumlarında "var" sayılıyordu ama entity
 * bunu hiç zorlamıyordu: cihazın tekrar gönderdiği bir callback `markSuccess`'i
 * yeniden çalıştırıyor, `PosPaymentSyncService` de o an PENDING olan **bir
 * sonraki taksiti** ödenmiş işaretliyordu — tek çekimle iki taksit kapanıyordu.
 */
export class PosTransactionAlreadySettledException extends DomainException<{
  posTransactionId: string;
  status: string;
}> {
  public readonly errorCode = ERROR_CODES.POS.TRANSACTION_ALREADY_SETTLED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(posTransactionId: string, status: string) {
    super('POS işlemi zaten sonuçlanmış.', { posTransactionId, status });
  }
}

/**
 * Tutar kuruştan (2 hane) daha ince: DB kolonu `Decimal(10,2)` ve cihaza giden
 * tutar minor-unit'e çevrildiği için fazla hane **sessizce** yuvarlanır —
 * çekilen tutar ile kayda geçen tutar ayrışır.
 */
export class PosAmountInvalidPrecisionException extends DomainException<{
  amount: string;
}> {
  public readonly errorCode = ERROR_CODES.POS.INVALID_PRECISION;

  constructor(amount: string) {
    super(`Tutar en fazla 2 ondalık basamak taşıyabilir (gelen: ${amount}).`, {
      amount,
    });
  }
}
