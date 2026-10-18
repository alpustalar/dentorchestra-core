import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '@common/constants/error-codes.constant';

/**
 * Aynı `dedupeKey` ile eşzamanlı ikinci bir kayıt denendi ve kazananı okuma da
 * başarısız oldu. Normal yarışta bu hata görülmez: `appendIfAbsent` çakışmayı
 * transaction'ı bozmadan yutar ve kazananın kaydı okunur.
 */
export class FinancialEventUniqueConstraintException extends DomainException<{
  dedupeKey: string;
}> {
  readonly errorCode = ERROR_CODES.ACCOUNTING.EVENT_DEDUPE_CONFLICT;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(dedupeKey: string) {
    super(
      'Finansal olay idempotency anahtarı çakıştı ancak mevcut kayıt okunamadı.',
      { dedupeKey }
    );
  }
}

/**
 * `dedupeKey` başka bir kliniğin olayına ait.
 *
 * Anahtar global tekil olduğu için çakışan kayıt sessizce "zaten var" sayılsaydı
 * bu kliniğin ekonomik olayı **hiç yazılmadan** başarı dönerdi: para defterden
 * düşerdi. Bu yüzden çakışma kapıda durdurulur.
 */
export class FinancialEventDedupeKeyCollisionException extends DomainException<{
  dedupeKey: string;
  requestedClinicId: string;
  existingClinicId: string;
}> {
  readonly errorCode = ERROR_CODES.ACCOUNTING.EVENT_DEDUPE_KEY_COLLISION;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: {
    dedupeKey: string;
    requestedClinicId: string;
    existingClinicId: string;
  }) {
    super(
      'Finansal olay idempotency anahtarı başka bir kliniğin kaydına ait.',
      meta
    );
  }
}

/**
 * Olay gövdesi (payload) o olay tipinin posting kuralının beklediği şekle uymuyor.
 *
 * Olay defteri append-only: yanlış gövde bir kez yazıldığında düzeltilemez ve
 * fiş ya hiç üretilemez ya da yanlış üretilir. Bu yüzden doğrulama yazma anında,
 * kayıt kalıcılaşmadan önce yapılır.
 */
export class FinancialEventPayloadInvalidException extends DomainException<{
  type: string;
  issues: string[];
}> {
  readonly errorCode = ERROR_CODES.ACCOUNTING.EVENT_PAYLOAD_INVALID;

  constructor(type: string, issues: string[]) {
    super(`Finansal olay gövdesi geçersiz (${type}): ${issues.join('; ')}`, {
      type,
      issues,
    });
  }
}

/** Ekonomik olayın tarihi gelecekte olamaz (ileri tarihli defter kaydı). */
export class FinancialEventFutureDateException extends DomainException<{
  occurredAt: string;
}> {
  readonly errorCode = ERROR_CODES.ACCOUNTING.EVENT_OCCURRED_IN_FUTURE;

  constructor(occurredAt: Date) {
    super('Ekonomik olayın tarihi gelecekte olamaz.', {
      occurredAt: occurredAt.toISOString(),
    });
  }
}

/**
 * Satıcı ödemesinde verilen cari (party) bu kliniğe ait değil.
 *
 * `partyId` doğrudan 320 fiş satırına yazıldığı için, doğrulanmazsa başka bir
 * şubenin (hatta başka bir kiracının) cari bakiyesi bu kliniğin defterinden
 * kapatılmış görünürdü.
 */
export class SupplierPartyClinicMismatchException extends DomainException<{
  partyId: string;
  clinicId: string;
}> {
  readonly errorCode = ERROR_CODES.ACCOUNTING.PARTY_CLINIC_MISMATCH;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(meta: { partyId: string; clinicId: string }) {
    super('Cari bu kliniğe ait değil.', meta);
  }
}

/** Ödeme yapılan cari satıcı (SUPPLIER) rolünde değil. */
export class SupplierPartyNotSupplierException extends DomainException<{
  partyId: string;
}> {
  readonly errorCode = ERROR_CODES.ACCOUNTING.PARTY_NOT_SUPPLIER;

  constructor(partyId: string) {
    super('Satıcı ödemesi yalnız SUPPLIER rolündeki cariye yapılabilir.', {
      partyId,
    });
  }
}

/**
 * Dönem kapatılamaz: aralıkta fişlenmemiş ekonomik olay var (doc 04 §5 adım 1).
 *
 * Kapanış fişleri o anki mizandan üretilir; dönem kapandıktan sonra bu olaylar
 * artık fişlenemeyeceği için mizan kalıcı olarak eksik kalırdı. Çözüm: önce
 * fişlenmemiş olayları işle (backfill), sonra dönemi kapat.
 */
export class UnpostedFinancialEventsException extends DomainException<{
  clinicId: string;
  unpostedCount: number;
  from: string;
  to: string;
}> {
  readonly errorCode = ERROR_CODES.POSTING.UNPOSTED_FINANCIAL_EVENTS;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: {
    clinicId: string;
    unpostedCount: number;
    from: string;
    to: string;
  }) {
    super(
      `Dönem kapatılamaz: ${meta.unpostedCount} ekonomik olay henüz fişlenmedi. ` +
        'Önce fişlenmemiş olayları işleyin.',
      meta
    );
  }
}
