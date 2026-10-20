import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { HttpStatus } from '@nestjs/common';

export class InvalidUserUpdateException extends DomainException<{
  userId?: string;
}> {
  readonly errorCode = ERROR_CODES.USER.INVALID_UPDATE;
  constructor(userId?: string) {
    super('Silinmiş bir kullanıcı güncellenemez.', { userId });
  }
}

export class InvalidUserDeletionException extends DomainException<{
  userId?: string;
}> {
  readonly errorCode = ERROR_CODES.USER.INVALID_DELETION;
  constructor() {
    super('Sistem yöneticisi hesabı silinemez.');
  }
}

export class UserNotFoundException extends DomainException {
  readonly errorCode = ERROR_CODES.USER.NOT_FOUND;
  // Not: `httpStatus: HttpStatus.NOT_FOUND` (iki nokta) ATAMA değil tip anotasyonudur;
  // alan tanımsız kalıp taban sınıfın 400'ünü de gölgeler. Eşittir olmalı.
  public override readonly httpStatus = HttpStatus.NOT_FOUND;
  constructor(msg = 'Kullanıcı bulunamadı') {
    super(msg);
  }
}

/**
 * Verilmek istenen yetki Capability tablosunda yok — ya yazım hatası ya da
 * seed'den düşmüş bir modül.
 */
export class CapabilityNotFoundException extends DomainException<{
  capability: string;
}> {
  readonly errorCode = ERROR_CODES.USER.CAPABILITY_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;
  constructor(capability: string) {
    super(`Tanımsız yetki: ${capability}`, { capability });
  }
}

/**
 * Platform (SaaS işletmesi + yetkilendirme tesisatı) kapsamındaki yetkiler kişiye
 * dağıtılamaz. Bkz. PLATFORM_CAPABILITY_MODULES.
 */
export class PlatformCapabilityNotGrantableException extends DomainException<{
  capability: string;
}> {
  readonly errorCode = ERROR_CODES.USER.CAPABILITY_PLATFORM_SCOPED;
  public override readonly httpStatus = HttpStatus.FORBIDDEN;
  constructor(capability: string) {
    super(`"${capability}" platform yetkisidir ve personele devredilemez.`, {
      capability,
    });
  }
}

/**
 * Aktör kendisinde olmayan bir yetkiyi devredemez — aksi hâlde yetkisini
 * personeli üzerinden dolaylı olarak yükseltebilirdi.
 */
export class CapabilityNotHeldByActorException extends DomainException<{
  capability: string;
}> {
  readonly errorCode = ERROR_CODES.USER.CAPABILITY_NOT_HELD_BY_ACTOR;
  public override readonly httpStatus = HttpStatus.FORBIDDEN;
  constructor(capability: string) {
    super(`Sahip olmadığınız bir yetkiyi devredemezsiniz: ${capability}`, {
      capability,
    });
  }
}

/**
 * Yetki hedefin rolünde zaten var; kişisel kayıt açmak yalnız kafa karıştırır
 * (rol değişince "neden hâlâ görüyor" sorusunu doğurur).
 */
export class CapabilityAlreadyInRoleException extends DomainException<{
  capability: string;
}> {
  readonly errorCode = ERROR_CODES.USER.CAPABILITY_ALREADY_IN_ROLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;
  constructor(capability: string) {
    super(`Bu yetki kullanıcının rolünde zaten var: ${capability}`, {
      capability,
    });
  }
}
