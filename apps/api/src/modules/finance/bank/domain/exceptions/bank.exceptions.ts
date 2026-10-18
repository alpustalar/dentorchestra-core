import { ERROR_CODES } from '@common/constants/error-codes.constant';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { HttpStatus } from '@nestjs/common';

export class BankAccountNotFoundException extends DomainException<{
  bankAccountId?: string;
}> {
  readonly errorCode = ERROR_CODES.BANK_ACCOUNT.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(bankAccountId?: string) {
    super('Banka hesabı bulunamadı.', { bankAccountId });
  }
}

export class BankAccountArchivedException extends DomainException<{
  bankAccountId?: string;
}> {
  readonly errorCode = ERROR_CODES.BANK_ACCOUNT.ARCHIVED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(bankAccountId?: string) {
    super('Arşivlenmiş bir banka hesabında bu işlem yapılamaz.', {
      bankAccountId,
    });
  }
}

export class BankStatementNotFoundException extends DomainException<{
  bankStatementId?: string;
}> {
  readonly errorCode = ERROR_CODES.BANK_STATEMENT.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(bankStatementId?: string) {
    super('Banka ekstresi bulunamadı.', { bankStatementId });
  }
}

export class BankStatementEmptyLinesException extends DomainException {
  readonly errorCode = ERROR_CODES.BANK_STATEMENT.EMPTY_LINES;

  constructor(message = 'Ekstre en az bir hareket satırı içermelidir.') {
    super(message);
  }
}

export class BankStatementLineNotFoundException extends DomainException<{
  lineId?: string;
}> {
  readonly errorCode = ERROR_CODES.BANK_STATEMENT.LINE_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(lineId?: string) {
    super('Ekstre satırı bulunamadı.', { lineId });
  }
}

/**
 * Mutabakat durumu MATCHED olarak işaretlenirken eşleşme referansı (matchedRef)
 * boş bırakıldı. MATCHED bir satırın hangi 102 defter kaydına bağlandığı
 * izlenebilir olmalıdır — referanssız bir MATCHED kaydı denetim izini kırar.
 */
export class BankStatementLineMatchRefRequiredException extends DomainException<{
  lineId?: string;
}> {
  readonly errorCode = ERROR_CODES.BANK_STATEMENT.MATCH_REF_REQUIRED;

  constructor(lineId?: string) {
    super(
      'Eşleşti (MATCHED) durumundaki işlemler için eşleşme referansı (matchedRef) zorunludur.',
      { lineId }
    );
  }
}

export class BankStatementLineMatchNoteTooLongException extends DomainException<{
  lineId?: string;
}> {
  readonly errorCode = ERROR_CODES.BANK_STATEMENT.MATCH_NOTE_TOO_LONG;

  constructor(lineId?: string) {
    super('Mutabakat notu 500 karakteri geçemez.', { lineId });
  }
}

/**
 * Ekstrenin kendi içinde tutarsız olması: `açılış + Σ hareket ≠ kapanış`.
 *
 * Mutabakatın tamamı bu dosyanın doğru olduğu varsayımına dayanır. CSV
 * ayrıştırmasında bir satır düşerse ya da iki kez okunursa hiçbir yerde hata
 * oluşmaz; eksik/fazla hareket "bankada yok" gibi görünür ve defterle farkı
 * aylarca kovalanır. Banka ekstresi kuruşu kuruşuna denk gelir — tolerans yok.
 */
export class BankStatementBalanceMismatchException extends DomainException<{
  openingBalance: string;
  closingBalance: string;
  lineTotal: string;
  difference: string;
}> {
  readonly errorCode = ERROR_CODES.BANK_STATEMENT.BALANCE_MISMATCH;

  constructor(meta: {
    openingBalance: string;
    closingBalance: string;
    lineTotal: string;
    difference: string;
  }) {
    super(
      `Ekstre kendi içinde tutarsız: açılış (${meta.openingBalance}) + hareketler (${meta.lineTotal}) ≠ kapanış (${meta.closingBalance}); fark ${meta.difference}.`,
      meta
    );
  }
}

/**
 * Aynı defter hareketi ikinci bir ekstre satırına bağlanamaz.
 *
 * Oto-eşleştirme bunu zaten engelliyordu; elle mutabakat yolunda kontrol yoktu.
 * İki ekstre satırı aynı 102 hareketine bağlanınca mutabakat özeti o hareketi
 * iki kez "mutabık" sayar ve gerçekten mutabık olmayan bir hareket gizlenir.
 */
export class BankStatementLineMatchRefAlreadyUsedException extends DomainException<{
  matchedRef: string;
  usedByLineId?: string;
}> {
  readonly errorCode = ERROR_CODES.BANK_STATEMENT.MATCH_REF_ALREADY_USED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { matchedRef: string; usedByLineId?: string }) {
    super(
      'Bu defter hareketi başka bir ekstre satırıyla zaten eşleştirilmiş.',
      meta
    );
  }
}

/** Ekstre tutarı kuruştan ince — DB `Decimal(16,2)` sessizce yuvarlar. */
export class BankStatementInvalidPrecisionException extends DomainException<{
  amount: string;
}> {
  readonly errorCode = ERROR_CODES.BANK_STATEMENT.INVALID_PRECISION;

  constructor(amount: string) {
    super(`Tutar en fazla 2 ondalık basamak taşıyabilir (gelen: ${amount}).`, {
      amount,
    });
  }
}

/**
 * Sağlayıcı payout referansı boş.
 *
 * Referans idempotency anahtarının yarısıdır (`@@unique([clinicId, provider,
 * reference])`): boş geçerse aynı payout ikinci kez girildiğinde DB kısıtı onu
 * ayırt edemez ve 108 **iki kez** kapanır (bakiye eksiye düşer, 102 fazla yazılır).
 */
export class SettlementReferenceRequiredException extends DomainException {
  public readonly errorCode =
    ERROR_CODES.PROVIDER_SETTLEMENT.REFERENCE_REQUIRED;

  constructor() {
    super('Sağlayıcı payout referansı zorunludur.');
  }
}

/** Tutar geçersiz: sonsuz/NaN, sıfır ya da negatif (komisyon hariç: ≥ 0). */
export class SettlementInvalidAmountException extends DomainException<{
  amount: string;
}> {
  public readonly errorCode = ERROR_CODES.PROVIDER_SETTLEMENT.INVALID_AMOUNT;

  constructor(amount: string) {
    super(
      `Hesap kapaması tutarı geçersiz (brüt ve net pozitif, komisyon negatif olamaz): ${amount}`,
      { amount }
    );
  }
}

/** Tutar kuruştan ince — DB kolonu `Decimal(14,2)` sessizce yuvarlar (§81.3). */
export class SettlementInvalidPrecisionException extends DomainException<{
  amount: string;
}> {
  public readonly errorCode = ERROR_CODES.PROVIDER_SETTLEMENT.INVALID_PRECISION;

  constructor(amount: string) {
    super(`Tutar en fazla 2 ondalık basamak taşıyabilir (gelen: ${amount}).`, {
      amount,
    });
  }
}

/**
 * Brüt ≠ net + komisyon.
 *
 * Bu eşitlik fişin dengesidir (`B 102 + B 653 = A 108`). Tolerans **yok**: tutar
 * bizim hesabımız değil, sağlayıcının kendi payout raporundan okunuyor; tutmuyorsa
 * veri girişi hatalıdır. Ret, kaynağın tutarı hâlâ düzeltebildiği yerde verilir —
 * olay gövdesi append-only olduğu için yazıldıktan sonra düzeltilemez ve olay
 * sonsuza kadar fişlenemez kalırdı (§53 ile aynı gerekçe).
 */
export class SettlementAmountMismatchException extends DomainException<{
  grossAmount: string;
  netAmount: string;
  commissionAmount: string;
}> {
  public readonly errorCode = ERROR_CODES.PROVIDER_SETTLEMENT.AMOUNT_MISMATCH;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: {
    grossAmount: string;
    netAmount: string;
    commissionAmount: string;
  }) {
    super(
      `Brüt tutar net + komisyona eşit olmalı: ${meta.grossAmount} ≠ ` +
        `${meta.netAmount} + ${meta.commissionAmount}.`,
      meta
    );
  }
}

/** Aynı sağlayıcı payout'u zaten kayıtlı (idempotency kısıtı). */
export class ProviderSettlementAlreadyRecordedException extends DomainException<{
  provider: string;
  reference: string;
}> {
  public readonly errorCode = ERROR_CODES.PROVIDER_SETTLEMENT.ALREADY_RECORDED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { provider: string; reference: string }) {
    super(
      `Bu payout zaten kayıtlı (${meta.provider} / ${meta.reference}); ` +
        'ikinci kez kaydedilirse 108 iki kez kapanır.',
      meta
    );
  }
}

/** Banka hesabı bu kliniğe ait değil (kiracı sınırı). */
export class SettlementBankAccountMismatchException extends DomainException<{
  bankAccountId: string;
}> {
  public readonly errorCode =
    ERROR_CODES.PROVIDER_SETTLEMENT.BANK_ACCOUNT_MISMATCH;
  public override readonly httpStatus = HttpStatus.FORBIDDEN;

  constructor(bankAccountId: string) {
    super('Seçilen banka hesabı bu kliniğe ait değil.', { bankAccountId });
  }
}
