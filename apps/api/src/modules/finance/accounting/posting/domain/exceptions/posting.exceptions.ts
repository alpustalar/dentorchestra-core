import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions';
import { ERROR_CODES } from '@common/constants/error-codes.constant';

export interface PlatformBookingAmountsMismatchMeta extends Record<
  string,
  unknown
> {
  saleAmount: string;
  supplierAmount: string;
  commission: string;
}

/**
 * Tahsilat tutarları kendi içinde tutarsız (komisyon + tedarikçi payı ≠ brüt).
 * Dengesiz fiş yazıp mizanı sessizce bozmaktansa burada durulur.
 */
export class PlatformBookingAmountsMismatchException extends DomainException<PlatformBookingAmountsMismatchMeta> {
  public readonly errorCode =
    ERROR_CODES.POSTING.PLATFORM_BOOKING_AMOUNTS_MISMATCH;

  constructor(meta: PlatformBookingAmountsMismatchMeta) {
    super(
      'Rezervasyon tahsilat tutarları tutarsız: komisyon + tedarikçi payı brüt tutara eşit değil.',
      meta
    );
  }
}

/**
 * Rezervasyon maliyetin **altında** satıldı: sağlayıcının fiilen ücretlendirdiği
 * tutar satış fiyatını aşıyor, yani komisyon negatif.
 *
 * Fiş yazılmaz: negatif bir hasılat satırı (601 alacak) defterde yanlış işaret
 * taşır ve zararın hangi hesapta (ör. 659 Diğer Olağan Gider ve Zararlar)
 * tanınacağı bir **muhasebe kararıdır** — kural 11: geçmişi yorumlayan alanda
 * otomatik onarım yapılmaz. Olay postlanmamış kalır; fişlenmemiş olay süpürmesi
 * (§34) ve tahsilat tarafındaki CRITICAL alarm birlikte bunu insana taşır.
 */
export class PlatformBookingBelowCostException extends DomainException<PlatformBookingAmountsMismatchMeta> {
  public readonly errorCode = ERROR_CODES.POSTING.PLATFORM_BOOKING_BELOW_COST;

  constructor(meta: PlatformBookingAmountsMismatchMeta) {
    super(
      'Rezervasyon maliyetin altında satılmış: tedarikçi payı satış tutarını aşıyor, komisyon negatif.',
      meta
    );
  }
}

export interface PlatformBookingRefundMismatchMeta extends Record<
  string,
  unknown
> {
  refundAmount: string;
  commission: string;
  supplierReleased: string;
  retainedLoss: string;
}

/**
 * İade tutarları kendi içinde tutarsız: geri alınan komisyon + serbest kalan
 * tedarikçi borcu + alıkoyulan ceza, geri giden paraya eşit değil.
 *
 * Emniyet kemeri: üç büyüklük ödeme kaydından tek yerde türetiliyor
 * (`BookingPayment.refundAssessment`), yani buraya düşmesi kaynak taraftaki bir
 * yuvarlama/mantık hatasının işaretidir. Dengesiz fiş yazıp mizanı sessizce
 * bozmaktansa olay postlanmamış bırakılır.
 */
export class PlatformBookingRefundAmountsMismatchException extends DomainException<PlatformBookingRefundMismatchMeta> {
  public readonly errorCode =
    ERROR_CODES.POSTING.PLATFORM_BOOKING_REFUND_MISMATCH;

  constructor(meta: PlatformBookingRefundMismatchMeta) {
    super(
      'Rezervasyon iade tutarları tutarsız: komisyon + serbest kalan tedarikçi borcu + alıkoyulan ceza, iade tutarına eşit değil.',
      meta
    );
  }
}

/**
 * Platform kiracısı (isPlatform) bulunamadı — komisyon postlanacak defter yok.
 * Migration bu satırları kurar; yoksa kurulum eksiktir.
 */
export class PlatformTenantNotConfiguredException extends DomainException {
  public readonly errorCode =
    ERROR_CODES.POSTING.PLATFORM_TENANT_NOT_CONFIGURED;
  public override readonly httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;

  constructor() {
    super(
      'Platform kiracısı bulunamadı (isPlatform). Sağlık turizmi komisyonu ' +
        'postlanamaz — platform organizasyonu ve kliniği kurulmalı.'
    );
  }
}

/**
 * Fişin düşeceği muhasebe dönemi yok.
 *
 * Posting hattındaki bu koşullar önceden `throw new Error(...)` idi: hepsi 500
 * dönüyordu ve `errorCode` taşımadıkları için arayüz "dönem açılmamış" ile
 * "fiş dengesiz"i ayırt edemiyordu. İkisi de operatörün farklı aksiyon aldığı
 * durumlar.
 */
export class NoAccountingPeriodForDateException extends DomainException<{
  date: string;
}> {
  public readonly errorCode = ERROR_CODES.POSTING.NO_PERIOD_FOR_DATE;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(date: Date) {
    super(
      `${date.toISOString()} tarihi için muhasebe dönemi yok; önce dönem açın.`,
      { date: date.toISOString() }
    );
  }
}

/** Hedef dönem kapalı/kilitli — fiş atılamaz. */
export class PeriodNotOpenForPostingException extends DomainException<{
  year: number;
  status: string;
}> {
  public readonly errorCode = ERROR_CODES.POSTING.PERIOD_NOT_OPEN;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(year: number, status: string) {
    super(`Dönem ${year} kapalı/kilitli; fiş atılamaz.`, { year, status });
  }
}

/**
 * Borç ≠ alacak. Bu fişin yazılmasına izin vermek mizanı sessizce bozardı;
 * hata mesajı yerine tutarları da taşır ki fark ekranda görünsün.
 */
export class UnbalancedJournalEntryException extends DomainException<{
  totalDebit: string;
  totalCredit: string;
}> {
  public readonly errorCode = ERROR_CODES.POSTING.UNBALANCED_ENTRY;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(totalDebit: string, totalCredit: string) {
    super(
      'Yevmiye fişi borç ve alacak toplamları eşit olmalıdır. Mizan tutarsızlığı engellendi.',
      { totalDebit, totalCredit }
    );
  }
}

/** Yaprak olmayan (ara/başlık) hesaba fiş atılamaz. */
export class AccountNotPostableException extends DomainException<{
  accountCode: string;
}> {
  public readonly errorCode = ERROR_CODES.POSTING.ACCOUNT_NOT_POSTABLE;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(accountCode: string) {
    super(`Yaprak olmayan hesaba fiş atılamaz: ${accountCode}`, {
      accountCode,
    });
  }
}

/**
 * Hesap pasife alınmış — yeni fiş kabul etmez.
 *
 * `isActive` kolonu vardı ama hiçbir yerde okunmuyordu: pasife alınan hesap
 * fişleri sessizce kabul etmeye devam ediyordu (yani bayrak bir kontrol değil,
 * süstü). Geçmiş hareketler yerinde kalır; kapanan yalnız yeni kayıt yoludur.
 */
export class AccountInactiveException extends DomainException<{
  accountCode: string;
}> {
  public readonly errorCode = ERROR_CODES.POSTING.ACCOUNT_INACTIVE;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(accountCode: string) {
    super(`Pasif hesaba fiş atılamaz: ${accountCode}`, { accountCode });
  }
}

/** Alt defter (cari/party) zorunlu olan hesapta party verilmemiş. */
export class PartyRequiredForAccountException extends DomainException<{
  accountCode: string;
}> {
  public readonly errorCode = ERROR_CODES.POSTING.PARTY_REQUIRED;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(accountCode: string) {
    super(`${accountCode} hesabında alt defter (party) zorunludur.`, {
      accountCode,
    });
  }
}

/** Posting kuralının istediği hesap kodu klinik hesap planında yok. */
export class AccountCodeNotFoundException extends DomainException<{
  accountCode: string;
}> {
  public readonly errorCode = ERROR_CODES.POSTING.ACCOUNT_CODE_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(accountCode: string) {
    super(`Hesap planında kod bulunamadı: ${accountCode}`, { accountCode });
  }
}

/**
 * Fişi üretilecek ekonomik olay okunamadı.
 *
 * Bilerek hata: sessizce atlamak "olay defterde var, fişi yok" durumunu kalıcı
 * ve **görünmez** kılardı — mizan eksik kalır ve bunu fark edecek başka bir
 * mekanizma yoktur. Hata, dinleyicideki CRITICAL uyarısını tetikler.
 */
export class FinancialEventNotFoundForPostingException extends DomainException<{
  financialEventId: string;
}> {
  public readonly errorCode = ERROR_CODES.POSTING.FINANCIAL_EVENT_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(financialEventId: string) {
    super(`Fişlenecek ekonomik olay bulunamadı: ${financialEventId}`, {
      financialEventId,
    });
  }
}

/**
 * Stok hareketinin defter eşlemesi yok.
 *
 * Bilerek hata: eşlemesi olmayan bir tipi varsayılan bir hesaba yazmak, maliyeti
 * **yanlış hesapta** biriktirir ve fiş kendi içinde dengeli olduğu için
 * "Σborç = Σalacak" kontrolü bunu asla yakalamaz. Üretici tarafı aynı haritadan
 * beslendiği için bu hata normalde oluşmaz; oluştuysa iki taraf ayrışmıştır.
 */
export class UnmappedStockMovementTypeException extends DomainException<{
  movementType: string;
  direction: string;
}> {
  public readonly errorCode = ERROR_CODES.POSTING.UNMAPPED_STOCK_MOVEMENT_TYPE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { movementType: string; direction: string }) {
    super(
      `Stok hareketi tipinin defter eşlemesi yok: ${meta.movementType} / ${meta.direction}`,
      meta
    );
  }
}

/**
 * İptal/storno edilecek belgenin ekonomik olayı deftere **henüz işlenmedi**.
 *
 * Olay yazılmış ama fişi yok: Outbox kaydı işlenmeyi bekliyor (ya da fiş DRAFT
 * kaldı). Bu pencerede belge iptali reddedilir — izin verilseydi belge CANCELLED
 * olurken fiş birkaç saniye sonra üretilir ve **iptal edilmiş bir belgenin
 * hasılatı** defterde kalıcı olarak kalırdı; onu götürecek bir storno da hiç
 * atılmazdı (iptal akışı bir daha çalışmaz).
 *
 * Geçici bir durumdur: işleyici fişi ürettiğinde iptal yeniden denenebilir.
 */
export class FinancialEventNotPostedYetException extends DomainException<{
  dedupeKey: string;
  financialEventId: string;
}> {
  public readonly errorCode = ERROR_CODES.POSTING.EVENT_NOT_POSTED_YET;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { dedupeKey: string; financialEventId: string }) {
    super(
      'Belge henüz deftere işlenmedi; fişi üretilmeden iptal edilemez. Birkaç saniye sonra tekrar deneyin.',
      meta
    );
  }
}

/**
 * Ödeme yönteminin hazır değer hesabı eşlemesi yok (ya da o yön için kabul
 * edilmiyor).
 *
 * Bilerek hata: eski kural `CASH` dışındaki her yöntemi **sessizce 102
 * Bankalar'a** yazıyordu. Fiş dengeli olduğu için hiçbir bütünlük kontrolü bunu
 * yakalamaz; sonuç, hiçbir banka ekstresiyle eşleşmeyecek bir 102 hareketi
 * (mutabakatta kalıcı UNMATCHED) ve eksik görünen kasa/kart bakiyesidir.
 *
 * Yazma kapısı aynı kümeden beslendiği için (`INBOUND_PAYMENT_METHODS` /
 * `OUTBOUND_PAYMENT_METHODS`) bu hata normalde oluşmaz; oluştuysa iki taraf
 * ayrışmıştır.
 */
export class UnmappedPaymentMethodException extends DomainException<{
  method: string;
  direction: string;
}> {
  public readonly errorCode = ERROR_CODES.POSTING.UNMAPPED_PAYMENT_METHOD;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { method: string; direction: string }) {
    super(
      `Ödeme yönteminin hazır değer hesabı eşlemesi yok: ${meta.method} (${meta.direction})`,
      meta
    );
  }
}

/**
 * Bir fiş satırı hem **fiş-seviyesi** çevrime hem de **kendi** yabancı para
 * temeline sahip.
 *
 * `original*`/`fxRate` kolonlarını iki ayrı kaynak yazamaz: fiş-seviyesi çevrim
 * (gövde yabancı parada, posting olay tarihli kurla çevirir) ile satır-seviyesi
 * temel (gövde fonksiyonel parada, kuralın taşıdığı kilitli kur) aynı satırda
 * buluşursa hangi kurun geçerli olduğu belirsizleşir ve izlenebilirlik
 * **yanıltıcı** hâle gelir — yanlış kurla saklanmış bir orijinal tutar, hiç
 * saklanmamış olmasından kötüdür.
 *
 * Bugün kurgu gereği karşılaşılmaz (kilitli kurlu kural gövdesini fonksiyonel
 * parada yazar); kontrol, ikisinin bir gün aynı kuralda buluşmasını sessiz
 * bırakmamak için durur.
 */
export class ConflictingFxBasisException extends DomainException<{
  accountCode?: string;
  entryCurrency?: string;
  lineOriginalCurrency?: string;
}> {
  readonly errorCode = ERROR_CODES.POSTING.CONFLICTING_FX_BASIS;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(meta: {
    accountCode?: string;
    entryCurrency?: string;
    lineOriginalCurrency?: string;
  }) {
    super(
      `Fiş satırı çifte yabancı para temeli taşıyor (hesap ${
        meta.accountCode ?? '?'
      }): fiş ${meta.entryCurrency ?? '?'} cinsinden çevriliyor ama satır kendi ${
        meta.lineOriginalCurrency ?? '?'
      } temelini bildiriyor.`,
      meta
    );
  }
}

/**
 * 108 Diğer Hazır Değerler'de o kadar para yok.
 *
 * Sağlayıcı hesap kapaması (`B 102 + B 653 / A 108`) bekleyen kart tahsilatlarını
 * azaltır; bakiyeden fazlası kapatılırsa 108 **alacak bakiyesine** düşer — bir
 * hazır değer hesabı için imkânsız bir durum — ve 102'ye hiç gelmemiş para girer.
 * Fiş kendi içinde dengeli olduğu için Σborç = Σalacak kontrolü uyarmaz; bu yüzden
 * kontrol kaydın önünde durur (§81'deki kasa çekmecesi kapısıyla aynı gerekçe).
 */
export class InsufficientFundsInTransitException extends DomainException<{
  available: string;
  requested: string;
}> {
  public readonly errorCode =
    ERROR_CODES.PROVIDER_SETTLEMENT.INSUFFICIENT_FUNDS_IN_TRANSIT;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { available: string; requested: string }) {
    super(
      `108 Diğer Hazır Değerler bakiyesi yetersiz: bekleyen ${meta.available}, ` +
        `kapatılmak istenen ${meta.requested}. Daha önce girilmiş bir payout ` +
        'olabilir ya da tahsilatların fişi henüz atılmamış olabilir.',
      meta
    );
  }
}
