import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '@common/constants/error-codes.constant';

export class AccountNotFoundInChartException extends DomainException<{
  code: string;
}> {
  readonly errorCode = ERROR_CODES.ACCOUNTING.ACCOUNT_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;
  constructor(code: string) {
    super(`Hesap planında kod bulunamadı: ${code}`, { code });
  }
}

export class AccountTemplateMismatchException extends DomainException<{
  code: string;
  parentCode: string;
}> {
  readonly errorCode = ERROR_CODES.ACCOUNTING.TEMPLATE_MISMATCH;
  constructor(code?: string, parentCode?: string) {
    super(`Alt hesabın tipi/yönü, üst hesap ile uyuşmuyor.`, {
      code,
      parentCode,
    });
  }
}

export class CannotCreateChildException extends DomainException<{
  code: string;
}> {
  readonly errorCode = ERROR_CODES.ACCOUNTING.CANNOT_CREATE_CHILD;
  constructor(code?: string) {
    super(
      `Doğrudan kayıt alan hesabın altına alt hesap açılamaz. Önce bu hesabın postable özelliğini kapatmalısınız.`,
      { code }
    );
  }
}

export class InvalidAccountNameException extends DomainException<{
  name: string;
}> {
  readonly errorCode = ERROR_CODES.ACCOUNTING.INVALID_NAME;
  constructor(name?: string) {
    super(`Hesap adı geçersiz. 2-200 karakter arasında olmalıdır.`, { name });
  }
}

/**
 * Hesap kodu biçimi geçersiz. Bu bir **domain** hatasıdır; daha önce VO içinde
 * NestJS'in `BadRequestException`'ı fırlatılıyordu — hem katman ihlaliydi hem de
 * VO entity constructor'ında (DB'den hidrasyon yolunda) çağrıldığı için bozuk bir
 * satır okumak kullanıcıya "geçersiz istek" olarak dönüyordu.
 */
export class InvalidAccountCodeException extends DomainException<{
  code: string;
}> {
  override readonly errorCode = ERROR_CODES.ACCOUNTING.INVALID_ACCOUNT_CODE;

  constructor(code: string) {
    super(
      `Geçersiz hesap kodu: "${code}". Yalnız rakam ve '.' içerebilir (ör. 120.01.001).`,
      { code }
    );
  }
}

/**
 * Şablonda bir düğüm, şablonda bulunmayan bir `parentCode`'a işaret ediyor.
 * Sessizce kök hesaba dönüştürmek hesap ağacını bozardı ve kimse fark etmezdi.
 */
export class AccountTemplateParentMissingException extends DomainException<{
  code: string;
  parentCode: string;
}> {
  readonly errorCode = ERROR_CODES.ACCOUNTING.TEMPLATE_PARENT_MISSING;

  constructor(code: string, parentCode: string) {
    super(
      `Hesap planı şablonu bozuk: "${code}" hesabının üst hesabı "${parentCode}" şablonda yok.`,
      { code, parentCode }
    );
  }
}

/**
 * Alt hesabın kodu üst hesabın kodunu önek olarak taşımıyor (ör. '600' altına
 * '700.01'). Ağaç (`parentId`) ile kod hiyerarşisi ayrışırsa, kod önekine göre
 * toplayan rapor ile ağaca göre toplayan rapor aynı defterde farklı sonuç verir.
 */
export class AccountCodeHierarchyMismatchException extends DomainException<{
  code: string;
  parentCode: string;
}> {
  readonly errorCode = ERROR_CODES.ACCOUNTING.CODE_HIERARCHY_MISMATCH;

  constructor(code: string, parentCode: string) {
    super(
      `"${code}" kodu "${parentCode}" hesabının altına açılamaz: alt hesap kodu üst hesabın koduyla başlamalıdır.`,
      { code, parentCode }
    );
  }
}
