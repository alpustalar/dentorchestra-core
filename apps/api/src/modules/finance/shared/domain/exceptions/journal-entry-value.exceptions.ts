import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions';
import { ERROR_CODES } from '@common/constants/error-codes.constant';

/**
 * Yevmiye satır tutarı muhasebe invariant'ını ihlal ediyor: negatif tutar, aynı
 * satırda hem borç hem alacak, ya da ikisinin de sıfır olması.
 *
 * Bu üçü daha önce `BadRequestException` ile fırlatılıyordu — yani **domain
 * katmanı NestJS'e bağımlıydı** (CLAUDE.md katman kuralı) ve hata ayrımsız 400
 * dönüyordu: arayüz "satır tutarı hatalı"yı "fiş dengesiz"den ayırt edemiyordu.
 */
export class InvalidJournalLineAmountException extends DomainException<{
  reason: string;
}> {
  public readonly errorCode = ERROR_CODES.JOURNAL_ENTRY.INVALID_LINE_AMOUNT;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(reason: string) {
    super(`Yevmiye satır tutarı geçersiz: ${reason}`, { reason });
  }
}

/** Yevmiye sıra numarası biçimi geçersiz (uzunluk / izinli karakter kümesi). */
export class InvalidJournalEntrySequenceException extends DomainException<{
  reason: string;
}> {
  public readonly errorCode = ERROR_CODES.JOURNAL_ENTRY.INVALID_ENTRY_NO;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(reason: string) {
    super(`Yevmiye fiş numarası geçersiz: ${reason}`, { reason });
  }
}

/**
 * Vergi hesabı girdisi geçersiz (oran 0–100 dışında, geçersiz para nesnesi, ya da
 * verilen vergi tutarı orandan hesaplanan tutarla uyuşmuyor).
 *
 * Eskiden `BadRequestException` ile fırlatılıyordu: domain katmanı NestJS'e
 * bağımlıydı ve hata `errorCode` taşımadığı için arayüz "oran hatalı"yı "tutar
 * uyuşmuyor"dan ayırt edemiyordu — ikisi farklı aksiyon gerektirir.
 */
export class InvalidTaxSpecificationException extends DomainException<{
  reason: string;
}> {
  public readonly errorCode = ERROR_CODES.TAX_PARAMETER.INVALID_SPECIFICATION;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(reason: string) {
    super(`Vergi hesabı girdisi geçersiz: ${reason}`, { reason });
  }
}
