import { ERROR_CODES } from '@common/constants/error-codes.constant';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { HttpStatus } from '@nestjs/common';
import type { InsufficientCashMeta } from '@shared/modules/cash-register/interfaces';

export class CashRegisterNotFoundException extends DomainException<{
  cashRegisterId?: string;
}> {
  readonly errorCode = ERROR_CODES.CASH_REGISTER.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(cashRegisterId?: string) {
    super('Kasa bulunamadı.', { cashRegisterId });
  }
}

export class CashRegisterArchivedException extends DomainException<{
  cashRegisterId?: string;
}> {
  readonly errorCode = ERROR_CODES.CASH_REGISTER.ARCHIVED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(cashRegisterId?: string) {
    super('Arşivlenmiş bir kasada bu işlem yapılamaz.', { cashRegisterId });
  }
}

export class CashSessionNotFoundException extends DomainException<{
  cashSessionId?: string;
}> {
  readonly errorCode = ERROR_CODES.CASH_SESSION.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(cashSessionId?: string) {
    super('Kasa oturumu bulunamadı.', { cashSessionId });
  }
}

export class CashSessionNotOpenException extends DomainException<{
  currentStatus?: string;
}> {
  readonly errorCode = ERROR_CODES.CASH_SESSION.NOT_OPEN;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(currentStatus?: string) {
    super('İşlem için kasa oturumunun açık (OPEN) olması gerekir.', {
      currentStatus,
    });
  }
}

export class CashSessionAlreadyOpenException extends DomainException<{
  cashRegisterId?: string;
  openSessionId?: string;
}> {
  readonly errorCode = ERROR_CODES.CASH_SESSION.ALREADY_OPEN;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { cashRegisterId?: string; openSessionId?: string }) {
    super(
      'Bu kasada zaten açık bir oturum var. Yeni oturum açmadan önce kapatın.',
      meta
    );
  }
}

export class CashInvalidAmountException extends DomainException<{
  amount?: number;
}> {
  readonly errorCode = ERROR_CODES.CASH_SESSION.INVALID_AMOUNT;

  constructor(message = 'Tutar sıfırdan büyük olmalıdır.', amount?: number) {
    super(message, { amount });
  }
}

/**
 * Tutar kuruştan (2 hane) daha ince. DB kolonu `Decimal(14,2)`: fazla hane
 * sessizce yuvarlanır ve kasada sayılan para ile kayıt ayrışır — sayım farkı
 * gerçek olmayan bir açık/fazla gösterir.
 */
export class CashInvalidPrecisionException extends DomainException<{
  amount: string;
}> {
  public readonly errorCode = ERROR_CODES.CASH_SESSION.INVALID_PRECISION;

  constructor(amount: string) {
    super(`Tutar en fazla 2 ondalık basamak taşıyabilir (gelen: ${amount}).`, {
      amount,
    });
  }
}

/**
 * Açılış nakdi bir **hareket** olarak kaydedilemez.
 *
 * Açılış nakdi oturumun kendi kolonunda (`openingFloat`) yaşar ve kapanışta
 * `beklenen = openingFloat + girişler − çıkışlar` formülüne zaten dahildir.
 * Aynı tutar bir de `OPENING_FLOAT` hareketi olarak girilirse beklenen tutar
 * iki kez şişer ve gerçek bir kasa açığı "denk" görünür.
 */
export class CashOpeningFloatNotAMovementException extends DomainException {
  public readonly errorCode =
    ERROR_CODES.CASH_SESSION.OPENING_FLOAT_NOT_A_MOVEMENT;

  constructor() {
    super(
      'Açılış nakdi hareket olarak kaydedilemez; oturum açılışında belirtilir.'
    );
  }
}

/**
 * Çekmecede o kadar nakit yok.
 *
 * Kasadan çıkış (iade ödemesi, gider, bankaya yatırma, manuel çıkış) fiziken
 * ancak çekmecedeki para kadar olabilir. Kontrol yokken çıkış kaydı çekmeceyi
 * **eksiye** düşürüyordu ve bu, kapanışta gerçek olmayan bir "sayım fazlası"na
 * dönüşüyordu: beklenen tutar negatif olduğu için `fark = sayım − beklenen`
 * pozitif çıkıyor, köprü onu 100 Kasa borç / 679 Diğer Olağandışı Gelir olarak
 * fişliyordu — yani hiç var olmamış bir gelir. Fiş kendi içinde dengeli olduğu
 * için Σborç = Σalacak kontrolü de uyarmıyordu.
 */
export class InsufficientCashInDrawerException extends DomainException<InsufficientCashMeta> {
  public readonly errorCode = ERROR_CODES.CASH_SESSION.INSUFFICIENT_CASH;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: InsufficientCashMeta) {
    super(
      `Kasada yeterli nakit yok: çekmecede ${meta.available} ${meta.currency}, ` +
        `istenen çıkış ${meta.requested} ${meta.currency}.`,
      meta
    );
  }
}
