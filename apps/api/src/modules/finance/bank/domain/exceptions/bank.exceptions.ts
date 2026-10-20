import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { HttpStatus } from '@nestjs/common';
import type {
  ChargebackAlreadyRecordedMeta,
  ChargebackAlreadyResolvedMeta,
  ChargebackCollectionCapMeta,
  ChargebackExceedsReversibleMeta,
  ChargebackSourceNotInLedgerMeta,
} from '@shared/modules/bank/interfaces';

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

// ============================================================
// Kart itirazı (chargeback / ters ibraz)
// ============================================================

/**
 * Sağlayıcı vaka numarası boş.
 *
 * Vaka numarası idempotency anahtarının yarısıdır (`@@unique([clinicId, provider,
 * caseReference])`): boş geçerse aynı itiraz ikinci kez girildiğinde DB kısıtı onu
 * ayırt edemez ve 127 **iki kez** dolar, 108 iki kez düşer.
 */
export class ChargebackReferenceRequiredException extends DomainException {
  public readonly errorCode = ERROR_CODES.CARD_CHARGEBACK.REFERENCE_REQUIRED;

  constructor() {
    super('Sağlayıcı vaka numarası zorunludur.');
  }
}

/** Tutar geçersiz: sonsuz/NaN, sıfır ya da negatif (ücret hariç: ≥ 0). */
export class ChargebackInvalidAmountException extends DomainException<{
  amount: string;
}> {
  public readonly errorCode = ERROR_CODES.CARD_CHARGEBACK.INVALID_AMOUNT;

  constructor(amount: string) {
    super(
      `İtiraz tutarı geçersiz (tutar pozitif, ücret negatif olamaz): ${amount}`,
      { amount }
    );
  }
}

/** Tutar kuruştan ince — DB kolonu `Decimal(14,2)` sessizce yuvarlar (§81.3). */
export class ChargebackInvalidPrecisionException extends DomainException<{
  amount: string;
}> {
  public readonly errorCode = ERROR_CODES.CARD_CHARGEBACK.INVALID_PRECISION;

  constructor(amount: string) {
    super(`Tutar en fazla 2 ondalık basamak taşıyabilir (gelen: ${amount}).`, {
      amount,
    });
  }
}

/** Çözüm tarihi açılış tarihinden önce olamaz (DB `resolved_at >= opened_at`). */
export class ChargebackInvalidDateException extends DomainException<{
  openedAt: string;
  resolvedAt: string;
}> {
  public readonly errorCode = ERROR_CODES.CARD_CHARGEBACK.INVALID_DATE;

  constructor(meta: { openedAt: string; resolvedAt: string }) {
    super(
      `İtirazın çözüm tarihi (${meta.resolvedAt}) açılış tarihinden (${meta.openedAt}) önce olamaz.`,
      meta
    );
  }
}

/** Kazanılan itirazda paranın döndüğü kanal (108 / 102) zorunlu. */
export class ChargebackReturnChannelRequiredException extends DomainException {
  public readonly errorCode =
    ERROR_CODES.CARD_CHARGEBACK.RETURN_CHANNEL_REQUIRED;

  constructor() {
    super('Kazanılan itirazda paranın döndüğü kanal zorunludur.');
  }
}

export class CardChargebackNotFoundException extends DomainException<{
  chargebackId: string;
}> {
  public readonly errorCode = ERROR_CODES.CARD_CHARGEBACK.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(chargebackId: string) {
    super('Kart itirazı bulunamadı.', { chargebackId });
  }
}

/** Aynı sağlayıcı vakası zaten kayıtlı (idempotency kısıtı). */
export class ChargebackAlreadyRecordedException extends DomainException<ChargebackAlreadyRecordedMeta> {
  public readonly errorCode = ERROR_CODES.CARD_CHARGEBACK.ALREADY_RECORDED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: ChargebackAlreadyRecordedMeta) {
    super(
      `Bu itiraz zaten kayıtlı (${meta.provider} / ${meta.caseReference}); ` +
        'ikinci kez kaydedilirse 127 iki kez dolar.',
      meta
    );
  }
}

/**
 * Çözümlenmiş itiraz tekrar çözümlenemez.
 *
 * Kazanılan itirazı kaybedilene (ya da tersine) çevirmek ayrı bir ekonomik
 * olaydır — itirazın yeniden açılması / ikinci tur (pre-arbitration). Bu kayıt
 * bir durum makinesidir, düzenlenebilir bir form değil.
 */
export class ChargebackAlreadyResolvedException extends DomainException<ChargebackAlreadyResolvedMeta> {
  public readonly errorCode = ERROR_CODES.CARD_CHARGEBACK.ALREADY_RESOLVED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: ChargebackAlreadyResolvedMeta) {
    super(
      `Bu itiraz zaten sonuçlandırılmış (durum: ${meta.status}); tekrar çözümlenemez.`,
      meta
    );
  }
}

/**
 * Ödeme planına yansıma sonucu yalnız KAYBEDİLEN itirazda anlamlıdır: kazanılan
 * itirazda plan değişmez, açık itirazda henüz sonuç yoktur.
 */
export class ChargebackPlanSyncNotApplicableException extends DomainException<{
  chargebackId: string;
  status: string;
}> {
  public readonly errorCode =
    ERROR_CODES.CARD_CHARGEBACK.PLAN_SYNC_NOT_APPLICABLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { chargebackId: string; status: string }) {
    super(
      `Plan yansıması yalnız kaybedilen itirazda kaydedilir (durum: ${meta.status}).`,
      meta
    );
  }
}

/** İtiraz edilen tahsilat (POS işlemi / taksit) bulunamadı. */
export class ChargebackSourceNotFoundException extends DomainException<{
  sourceType: string;
  sourceId: string;
}> {
  public readonly errorCode = ERROR_CODES.CARD_CHARGEBACK.SOURCE_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(meta: { sourceType: string; sourceId: string }) {
    super('İtiraz edilen kart tahsilatı bulunamadı.', meta);
  }
}

/** Kaynak, itirazın yazıldığı kliniğe ait değil (kiracı sınırı). */
export class ChargebackSourceClinicMismatchException extends DomainException<{
  sourceType: string;
  sourceId: string;
}> {
  public readonly errorCode =
    ERROR_CODES.CARD_CHARGEBACK.SOURCE_CLINIC_MISMATCH;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { sourceType: string; sourceId: string }) {
    super('İtiraz edilen kart tahsilatı bu kliniğe ait değil.', meta);
  }
}

/**
 * Kaynak itiraz edilebilir bir kart tahsilatı değil: başarılı bir SATIŞ
 * olmalıdır (başarısız/askıdaki işlem ya da iade/iptal kaydı değil).
 */
export class ChargebackSourceNotChargeableException extends DomainException<{
  sourceType: string;
  sourceId: string;
  reason: string;
}> {
  public readonly errorCode = ERROR_CODES.CARD_CHARGEBACK.SOURCE_NOT_CHARGEABLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { sourceType: string; sourceId: string; reason: string }) {
    super(`İtiraz edilen kayıt kart tahsilatı değil: ${meta.reason}`, meta);
  }
}

/**
 * Hastasız kart çekimi: muhasebe köprüsü yalnız hastaya bağlı hareket için
 * kurulur, yani bu satış deftere **hiç yazılmamıştır**. Yazılmamış bir tahsilata
 * karşı itiraz kaydetmek, olmayan parayı 108'den düşmek olurdu.
 */
export class ChargebackSourcePatientRequiredException extends DomainException<{
  sourceType: string;
  sourceId: string;
}> {
  public readonly errorCode =
    ERROR_CODES.CARD_CHARGEBACK.SOURCE_PATIENT_REQUIRED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { sourceType: string; sourceId: string }) {
    super(
      'Hastaya bağlı olmayan kart çekimi deftere yazılmamıştır; bu tahsilat için itiraz kaydedilemez.',
      meta
    );
  }
}

/**
 * Tahsilatın ekonomik olayı olay defterinde yok.
 *
 * Defterde olmayan bir tahsilatı geri almak, gelir eksiği değil **olmayan paranın
 * düşülmesi** olurdu. Genellikle muhasebe köprüsü (best-effort) başarısız olmuştur:
 * POS için `POST /pos/transactions/backfill-accounting` ile telafi edilir.
 */
export class ChargebackSourceNotInLedgerException extends DomainException<ChargebackSourceNotInLedgerMeta> {
  public readonly errorCode = ERROR_CODES.CARD_CHARGEBACK.SOURCE_NOT_IN_LEDGER;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: ChargebackSourceNotInLedgerMeta) {
    super(
      'İtiraz edilen tahsilat deftere yazılmamış; önce muhasebe köprüsü telafi edilmeli.',
      meta
    );
  }
}

/** v1 yalnız TRY: yabancı para itirazı kur farkı üretir (§88 ertelemesi). */
export class ChargebackCurrencyNotSupportedException extends DomainException<{
  currency: string;
}> {
  public readonly errorCode =
    ERROR_CODES.CARD_CHARGEBACK.CURRENCY_NOT_SUPPORTED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(currency: string) {
    super(
      `Kart itirazı yalnız TRY tahsilatlar için kaydedilebilir (gelen: ${currency}).`,
      { currency }
    );
  }
}

/**
 * İtiraz tutarı, geri götürülebilir tutarı aşıyor: tahsilat − iade/iptal − aktif
 * itirazlar. Aşılırsa aynı para üç kez (iade + itiraz + itiraz) düşülürdü.
 */
export class ChargebackExceedsCollectionException extends DomainException<ChargebackExceedsReversibleMeta> {
  public readonly errorCode = ERROR_CODES.CARD_CHARGEBACK.EXCEEDS_COLLECTION;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: ChargebackExceedsReversibleMeta) {
    super(
      `İtiraz tutarı geri götürülebilir tutarı aşıyor: geri götürülebilir ${meta.reversible}, ` +
        `aktif itiraz ${meta.activeChargebacks}, istenen ${meta.requested} ` +
        `(en fazla ${meta.available}).`,
      meta
    );
  }
}

/**
 * Bu tahsilat kart itirazı altında: iade/iptal, parayı kart sahibine İKİ KEZ
 * geri götürürdü (biri sağlayıcı kesintisi, biri bizim iademiz).
 *
 * Para geri götüren her yol (iade, iptal, ters ibraz) aynı kümülatif tavanı
 * paylaşır; bir yolun tavanı diğerini bilmiyorsa para iki kez geri gider.
 */
export class CollectionUnderChargebackException extends DomainException<ChargebackCollectionCapMeta> {
  public readonly errorCode =
    ERROR_CODES.CARD_CHARGEBACK.COLLECTION_UNDER_CHARGEBACK;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: ChargebackCollectionCapMeta) {
    super(
      'Bu tahsilatın kart itirazı sürüyor ya da kaybedilmiş; iade/iptal aynı parayı ' +
        `ikinci kez geri götürürdü (tahsilat ${meta.collected}, iade/iptal ${meta.alreadyReversed}, ` +
        `aktif itiraz ${meta.activeChargebacks}, istenen ${meta.requested}).`,
      meta
    );
  }
}

/** Banka hesabı bu kliniğe ait değil (kiracı sınırı) — kart itirazı. */
export class ChargebackBankAccountMismatchException extends DomainException<{
  bankAccountId: string;
}> {
  public readonly errorCode = ERROR_CODES.CARD_CHARGEBACK.BANK_ACCOUNT_MISMATCH;
  public override readonly httpStatus = HttpStatus.FORBIDDEN;

  constructor(bankAccountId: string) {
    super('Seçilen banka hesabı bu kliniğe ait değil.', { bankAccountId });
  }
}
