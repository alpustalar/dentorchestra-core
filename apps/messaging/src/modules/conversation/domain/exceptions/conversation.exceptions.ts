import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../packages/shared/common/constants/error-codes.constant';
import type { ServiceWindowClosedMeta } from '@shared/modules/messaging/interfaces';

/**
 * WhatsApp 24 saatlik servis penceresi kapalı: hasta son 24 saatte yazmadıysa
 * serbest metin/medya gönderilemez, yalnız onaylı şablon gönderilebilir (Meta
 * kuralı). Telegram ve Instagram'da böyle bir kısıt yok.
 *
 * Tipli olmasının sebebi arayüzün bu duruma **özel davranması**: mesaj kutusu
 * kilitlenip kullanıcı şablon gönderimine yönlendirilir. Düz bir 400'de frontend
 * hata metnini string olarak eşleştirmek zorunda kalırdı — metin her
 * değiştiğinde sessizce bozulan bir bağ.
 */
export class ServiceWindowClosedException extends DomainException<ServiceWindowClosedMeta> {
  public readonly errorCode = ERROR_CODES.MESSAGING.SERVICE_WINDOW_CLOSED;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(meta: ServiceWindowClosedMeta) {
    super(
      '24 saatlik servis penceresi kapalı; yalnızca onaylı şablon mesaj gönderilebilir.',
      meta
    );
  }
}

/**
 * Aktör bu kliniğin yazışmalarına erişemez.
 *
 * `meta` bilerek **yalnız `clinicId`** taşır: yazışmanın var olup olmadığı,
 * kime ait olduğu gibi bilgiler sızdırılmaz (varlık sızıntısı da bir sızıntıdır).
 */
export class ConversationAccessDeniedException extends DomainException<{
  clinicId: string;
}> {
  public readonly errorCode = ERROR_CODES.MESSAGING.CLINIC_ACCESS_DENIED;
  public override readonly httpStatus = HttpStatus.FORBIDDEN;

  constructor(clinicId: string) {
    super('Bu kliniğin yazışmalarına erişim yetkiniz yok.', { clinicId });
  }
}

/**
 * Yazışma bulunamadı.
 *
 * **Başka kliniğe ait yazışma da bu hatayı alır** — 403 değil. Aktörün hedef
 * kliniğe erişimi zaten `assertActorCanAccessClinic` ile doğrulanmış oluyor;
 * bu noktadan sonra "kayıt var ama senin değil" demek, geçerli yazışma id'lerini
 * kiracılar arasında tarayıp doğrulamaya (enumeration) izin verirdi. Var olmayan
 * id ile başka kiracının id'si dışarıdan **ayırt edilemez** olmalı.
 */
export class ConversationNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.MESSAGING.CONVERSATION_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(message = 'Yazışma bulunamadı.') {
    super(message);
  }
}

/**
 * Mesaj bulunamadı. Yazışmayla eşleşmeyen mesaj id'si de buraya düşer
 * (bkz. [ConversationNotFoundException] — aynı sızıntı gerekçesi).
 */
export class MessageNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.MESSAGING.MESSAGE_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(message = 'Mesaj bulunamadı.') {
    super(message);
  }
}

/**
 * Kontak pazarlama mesajlarından çıkmış; MARKETING kategorili şablon gönderilemez.
 *
 * Uyum (compliance) kısıtı — girdi hatalı değil, kontağın durumu gönderime engel.
 * Bu yüzden 400 değil 422.
 */
export class MarketingOptOutException extends DomainException {
  public readonly errorCode = ERROR_CODES.MESSAGING.MARKETING_OPT_OUT;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(
    message = 'Kontak pazarlama mesajlarından çıkmış; MARKETING şablonu gönderilemez.'
  ) {
    super(message);
  }
}
