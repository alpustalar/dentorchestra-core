import { DomainException } from '@src/domain/exceptions';
import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../../../../../../../../../packages/shared/common/constants/error-codes.constant';

export class JournalEntryUniqueConstraintException extends DomainException {
  public errorCode = ERROR_CODES.JOURNAL_ENTRY.UNIQUE_CONSTRAINT_VIOLATION;
  public override httpStatus = HttpStatus.CONFLICT;
  constructor() {
    super('Bu finansal olay için yevmiye fişi zaten mevcut.');
  }
}

export class JournalEntryNotFoundException extends DomainException<{
  entryId: string;
}> {
  public readonly errorCode = ERROR_CODES.JOURNAL_ENTRY.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(entryId: string) {
    super(`Yevmiye fişi bulunamadı: ${entryId}`, { entryId });
  }
}

/**
 * Aşağıdaki dördü daha önce `BadRequestException` idi — yani **domain entity**
 * NestJS'e bağımlıydı (CLAUDE.md katman kuralı ihlali) ve hepsi ayrımsız 400
 * dönüyordu. Fiş yaşam döngüsünün bu durumları farklı: "dengesiz fiş" düzeltme
 * ister, "zaten storno" ise idempotent bir tekrar denemedir.
 */
export class JournalEntryNonPositiveTotalException extends DomainException {
  public readonly errorCode = ERROR_CODES.JOURNAL_ENTRY.NON_POSITIVE_TOTAL;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(message = 'Fiş toplamı sıfır veya negatif olamaz.') {
    super(message);
  }
}

export class JournalEntryNotDraftException extends DomainException {
  public readonly errorCode = ERROR_CODES.JOURNAL_ENTRY.NOT_DRAFT;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(message = 'Yalnızca taslak fişler POST edilebilir.') {
    super(message);
  }
}

export class JournalEntryNotPostedException extends DomainException {
  public readonly errorCode = ERROR_CODES.JOURNAL_ENTRY.NOT_POSTED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(message = 'Yalnızca POSTED fişler storno edilebilir.') {
    super(message);
  }
}

export class JournalEntryAlreadyReversedException extends DomainException {
  public readonly errorCode = ERROR_CODES.JOURNAL_ENTRY.ALREADY_REVERSED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(message = 'Fiş zaten storno edilmiş.') {
    super(message);
  }
}

/**
 * Fiş ikiden az satır taşıyor. Çift taraflı kayıtta en az bir borç + bir alacak
 * satırı bulunmak zorundadır; tek satırlı "fiş" tanım gereği dengesizdir.
 */
export class JournalEntryInsufficientLinesException extends DomainException<{
  lineCount: number;
}> {
  public readonly errorCode = ERROR_CODES.JOURNAL_ENTRY.INSUFFICIENT_LINES;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(lineCount: number) {
    super(`Fiş en az iki satır içermelidir (gelen: ${lineCount}).`, {
      lineCount,
    });
  }
}

/**
 * Aynı dönemde aynı yevmiye numarası. DB kısıtı (`[clinicId, periodId, entryNo]`)
 * emniyet kemeridir: numara normalde dönem satırındaki sayaçtan kilit altında
 * tahsis edilir, çakışma olmamalıdır. Tetiklenirse tahsis yolu baypas edilmiş ya
 * da sayaç geri gitmiş demektir — `eventId` mükerrerliğiyle (idempotent tekrar)
 * karıştırılmamalıdır: bu bir veri bütünlüğü arızasıdır, normal bir yarış değil.
 */
export class JournalEntryNumberCollisionException extends DomainException<{
  periodId: string;
  entryNo: string | null;
}> {
  public readonly errorCode = ERROR_CODES.JOURNAL_ENTRY.NUMBER_COLLISION;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(periodId: string, entryNo: string | null) {
    super(
      `Yevmiye numarası bu dönemde zaten kullanılmış (dönem=${periodId}, no=${entryNo ?? '-'}).`,
      { periodId, entryNo }
    );
  }
}
