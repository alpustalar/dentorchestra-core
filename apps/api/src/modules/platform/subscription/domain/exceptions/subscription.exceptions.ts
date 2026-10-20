import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import type { SubscriptionModuleRequiredMeta } from '@shared/modules/subscription/interfaces';

/** Sahip (org veya klinik) için zaten aktif abonelik var. */
export class SubscriptionAlreadyExistsException extends DomainException {
  public readonly errorCode = ERROR_CODES.SUBSCRIPTION.ALREADY_EXISTS;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(message = 'Bu sahip için zaten aktif bir abonelik mevcut.') {
    super(message);
  }
}

export class SubscriptionNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.SUBSCRIPTION.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(message = 'Abonelik bulunamadı.') {
    super(message);
  }
}

/** Ücretli plan/modül için alıcı (buyer) bilgisi zorunlu. */
export class SubscriptionBuyerRequiredException extends DomainException {
  public readonly errorCode = ERROR_CODES.SUBSCRIPTION.BUYER_REQUIRED;

  constructor(message = 'Ücretli işlemler için alıcı bilgisi zorunludur.') {
    super(message);
  }
}

/** CLINIC faturalandırma hedefinde clinicId zorunlu. */
export class SubscriptionClinicRequiredException extends DomainException {
  public readonly errorCode = ERROR_CODES.SUBSCRIPTION.CLINIC_REQUIRED;

  constructor(
    message = 'Klinik-başına faturalandırmada hedef klinik (clinicId) zorunludur.'
  ) {
    super(message);
  }
}

export class SubscriptionModuleNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.SUBSCRIPTION.MODULE_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(moduleKey: string) {
    super(`Modül bulunamadı: ${moduleKey}`);
  }
}

export class SubscriptionModuleNotAvailableException extends DomainException {
  public readonly errorCode = ERROR_CODES.SUBSCRIPTION.MODULE_NOT_AVAILABLE;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(moduleKey: string) {
    super(`Modül şu an kullanılabilir değil: ${moduleKey}`);
  }
}

/** Admin modül oluştururken aynı key mevcut. */
export class SubscriptionModuleAlreadyExistsException extends DomainException {
  public readonly errorCode = ERROR_CODES.SUBSCRIPTION.MODULE_ALREADY_EXISTS;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(moduleKey: string) {
    super(`Bu anahtarla bir modül zaten var: ${moduleKey}`);
  }
}

export class SubscriptionPlanNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.SUBSCRIPTION.PLAN_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(planId: string) {
    super(`Plan tanımı bulunamadı: ${planId}`);
  }
}

/**
 * Kiracının aboneliğinde erişim için gereken modül yok (veya abonelik pasif). 402 → frontend
 * "Modül ekle / Plan yükselt" akışını meta ile açar.
 */
export class SubscriptionModuleRequiredException extends DomainException<SubscriptionModuleRequiredMeta> {
  public readonly errorCode = ERROR_CODES.SUBSCRIPTION.MODULE_REQUIRED;
  public override readonly httpStatus = HttpStatus.PAYMENT_REQUIRED;

  constructor(
    meta: SubscriptionModuleRequiredMeta,
    message = `Bu özellik için '${meta.requiredModule}' modülü aboneliğinizde bulunmalı.`
  ) {
    super(message, meta);
  }
}

/**
 * Tahsilat satırı beklenen durumda değil.
 *
 * Satır `PENDING` doğar ve sonucu bir kez yazılır; ikinci kez yazmaya çalışmak
 * (ör. aynı sağlayıcı bildirimi iki kez işlenirse) mükerrer bir para kaydı
 * üretme girişimidir ve sessizce geçilmez.
 */
export class SubscriptionChargeNotPendingException extends DomainException {
  public readonly errorCode = ERROR_CODES.SUBSCRIPTION.CHARGE_NOT_PENDING;

  constructor(chargeId: string, status: string) {
    super(
      `Abonelik tahsilat kaydı beklenen durumda değil (id: ${chargeId}, durum: ${status}).`
    );
  }
}

/**
 * Aboneliğin kalemleri farklı para birimleri taşıyor.
 *
 * Tahsil edilecek tutar kalemlerin toplamıdır; farklı para birimli kalemleri
 * toplamak **anlamsız bir sayı** üretir (eskiden toplanıp ilk kalemin para
 * birimiyle etiketleniyordu). Çekim yapmak yerine durulur: doğru çözüm ya tek
 * para birimi zorlamak ya da para birimi başına ayrı tahsilattır — ikisi de
 * ürün kararıdır.
 */
export class SubscriptionChargeCurrencyMismatchException extends DomainException {
  public readonly errorCode = ERROR_CODES.SUBSCRIPTION.CHARGE_CURRENCY_MISMATCH;

  constructor(subscriptionId: string, currencies: string[]) {
    super(
      `Abonelik kalemleri farklı para birimleri taşıyor; otomatik tahsilat yapılamaz (id: ${subscriptionId}, para birimleri: ${currencies.join(', ')}).`
    );
  }
}
