import {
  BookingPayment as IBookingPayment,
  BookingPaymentStatusSchema,
} from '@shared/generated-zod';
import { AggregateRoot } from '@common/domain/aggregate-root';
import {
  BookingIntent,
  BookingPaymentLinks,
  BookingPaymentProviderValue,
  BookingPaymentStatusValue,
  BookingPaymentTypeValue,
  BookingLedgerBasis,
  BookingRefundAssessment,
  BookingRefundedLedgerAmounts,
  BookingSettledLedgerAmounts,
  CreateBookingPaymentProps,
  MarkRefundedProps,
  RecordSupplierCostProps,
  SupplierCostAssessment,
} from '../contracts/booking-payment';
import {
  BookingLedgerNotPostableException,
  BookingPaymentInvalidTransitionException,
} from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment.exceptions';
import { PaymentProviders } from '@common/constants/payment-provider.constant';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { Url } from '@src/domain/value-objects/url.vo';
import { Money } from '@src/domain/value-objects/money.vo';
import { isNotUndefined } from '@common/utils/is-not-undefined';
import { Currency } from '@src/domain/value-objects/currency.vo';
import { Decimal } from 'decimal.js';
import { Guard } from '@common/domain/guards';

/**
 * Sağlık turizmi ödeme-önce (payment-first) tahsilat saga kaydı. Hasta ödeme yapmadan
 * HotelBeds rezervasyonu açılmaz. Durum makinesi:
 * PENDING → (ödeme) PAID → (HotelBeds book) BOOKED | (hata) FAILED ; PENDING → EXPIRED ;
 * herhangi → REFUNDED. Çift-çekim (iki link de ödenirse) ikinci ödeme iade edilir.
 */
export class BookingPayment extends AggregateRoot {
  constructor(data: IBookingPayment) {
    const currency = Currency.fromTrusted(data.saleCurrency);
    super();
    this._id = UUID.fromTrusted(data.id);
    this._bookingType = data.bookingType;
    this._status = data.status;
    this._saleCurrency = currency;
    this._saleAmount = Money.fromTrusted(data.saleAmount, currency.value);
    // `tryAmount` adı gibi **TRY**'dir: satış EUR olsa bile iyzico bu tutarı
    // TRY çeker. Satış para birimiyle etiketlemek, TRY tutarı taşıyan ama
    // kendini EUR sanan bir Money üretiyordu — `add`/`subtract` guard'ı o
    // noktadan sonra koruma değil tuzak olur (iki "EUR" sorunsuz toplanır).
    this._tryAmount = Money.fromTrusted(data.tryAmount, Currency.enum.TRY);
    this._netAmount = Money.fromTrusted(data.netAmount, currency.value);
    // Sağlayıcının FİİLEN ücretlendirdiği maliyet; kendi para birimini taşır
    // (sağlayıcı teklifi başka bir birimde açabilir → o zaman çıkarılamaz).
    this._supplierAmount =
      data.supplierAmount !== null && data.supplierCurrency !== null
        ? Money.fromTrusted(data.supplierAmount, data.supplierCurrency)
        : null;
    // Sağlayıcının iptalde alıkoyduğu ceza; kendi para birimini taşır.
    this._supplierRetained =
      data.supplierRetainedAmount !== null &&
      data.supplierRetainedCurrency !== null
        ? Money.fromTrusted(
            data.supplierRetainedAmount,
            data.supplierRetainedCurrency
          )
        : null;
    this._refundedAt = data.refundedAt;
    this._refundReason = data.refundReason;
    this._fxRate = data.fxRate;
    this._intent = data.intent;
    this._iyzicoConversationId = data.iyzicoConversationId;
    this._iyzicoToken = data.iyzicoToken;
    this._iyzicoUrl = Url.create(data.iyzicoUrl).instance ?? null;
    this._stripeSessionId = data.stripeSessionId;
    this._stripeUrl = Url.create(data.stripeUrl).instance ?? null;
    this._paidProvider = data.paidProvider;
    this._paidProviderRef = data.paidProviderRef;
    this._paidAt = data.paidAt;
    this._bookingReference = data.bookingReference;
    this._bookingId = data.bookingId;
    this._failureReason = data.failureReason;
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._patientId = data.patientId ? UUID.fromTrusted(data.patientId) : null;
    this._leadId = data.leadId ? UUID.fromTrusted(data.leadId) : null;
    this._conversationId = data.conversationId;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _bookingType: BookingPaymentTypeValue;
  get bookingType(): BookingPaymentTypeValue {
    return this._bookingType;
  }

  private _status: BookingPaymentStatusValue;
  get status(): BookingPaymentStatusValue {
    return this._status;
  }

  private _saleCurrency: Currency;
  get saleCurrency(): Currency {
    return this._saleCurrency;
  }

  private _saleAmount: Money;
  get saleAmount(): Money {
    return this._saleAmount;
  }

  private _tryAmount: Money;
  get tryAmount(): Money {
    return this._tryAmount;
  }

  private _netAmount: Money;
  get netAmount(): Money {
    return this._netAmount;
  }

  private _supplierAmount: Money | null;
  /** Sağlayıcının fiilen ücretlendirdiği maliyet; öğrenilemediyse null. */
  get supplierAmount(): Money | null {
    return this._supplierAmount;
  }

  private _supplierRetained: Money | null;
  /** Sağlayıcının iptal cezası olarak alıkoyduğu tutar; bildirilmediyse null. */
  get supplierRetained(): Money | null {
    return this._supplierRetained;
  }

  private _refundedAt: Date | null;
  /** İadenin kendi tarihi (tahsilat tarihinden bağımsız ekonomik olay). */
  get refundedAt(): Date | null {
    return this._refundedAt;
  }

  private _refundReason: string | null;
  get refundReason(): string | null {
    return this._refundReason;
  }

  private _fxRate: Decimal | null;
  get fxRate(): Decimal | null {
    return this._fxRate;
  }

  private _intent: IBookingPayment['intent'];
  get intent(): IBookingPayment['intent'] {
    return this._intent;
  }

  /** Tipli rezervasyon niyeti (replay için). */
  get bookingIntent(): BookingIntent {
    return this._intent as unknown as BookingIntent;
  }

  private _iyzicoConversationId: string | null;
  get iyzicoConversationId(): string | null {
    return this._iyzicoConversationId;
  }

  private _iyzicoToken: string | null;
  get iyzicoToken(): string | null {
    return this._iyzicoToken;
  }

  private _iyzicoUrl: Url | null;
  get iyzicoUrl(): Url | null {
    return this._iyzicoUrl;
  }

  private _stripeSessionId: string | null;
  get stripeSessionId(): string | null {
    return this._stripeSessionId;
  }

  private _stripeUrl: Url | null;
  get stripeUrl(): Url | null {
    return this._stripeUrl;
  }

  private _paidProvider: BookingPaymentProviderValue | null;
  get paidProvider(): BookingPaymentProviderValue | null {
    return this._paidProvider;
  }

  private _paidProviderRef: string | null;
  get paidProviderRef(): string | null {
    return this._paidProviderRef;
  }

  private _paidAt: Date | null;
  get paidAt(): Date | null {
    return this._paidAt;
  }

  private _bookingReference: string | null;
  get bookingReference(): string | null {
    return this._bookingReference;
  }

  private _bookingId: string | null;
  get bookingId(): string | null {
    return this._bookingId;
  }

  private _failureReason: string | null;
  get failureReason(): string | null {
    return this._failureReason;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _patientId: UUID | null;
  get patientId(): UUID | null {
    return this._patientId;
  }

  private _leadId: UUID | null;
  get leadId(): UUID | null {
    return this._leadId;
  }

  private _conversationId: string | null;
  get conversationId(): string | null {
    return this._conversationId;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ------------------------------------------------------------------ factory

  public get validate() {
    return {
      status: {
        isPaid: this.isPaid,
        isPending: this.isPending,
        isSettled: this.isSettled,
      },
    };
  }

  // ------------------------------------------------------------ state machine

  private get isPaid() {
    const is = this._status === BookingPaymentStatusSchema.enum.PAID;
    return Guard.monitor(is, is, () => new Error('Ödeme tamamlanmamış'));
  }

  private get isPending() {
    const is = this._status === BookingPaymentStatusSchema.enum.PENDING;
    return Guard.monitor(
      is,
      is,
      () => new Error('Rezervasyon beklemede değil')
    );
  }

  private get isSettled() {
    const is =
      this._status === BookingPaymentStatusSchema.enum.PAID ||
      this._status === BookingPaymentStatusSchema.enum.BOOKED;
    return Guard.monitor(is, is, () => new Error('Rezervasyon tamamlanmamış'));
  }

  public static create(props: CreateBookingPaymentProps): BookingPayment {
    const now = DateTimeManager.create();
    return new BookingPayment({
      id: UUID.createOrGenerate(props.id).value,
      bookingType: props.bookingType,
      status: BookingPaymentStatusSchema.enum.PENDING,
      saleCurrency: props.saleCurrency,
      saleAmount: new Decimal(props.saleAmount),
      tryAmount: new Decimal(props.tryAmount),
      netAmount: new Decimal(props.netAmount),
      // Fiilî maliyet rezervasyon açılınca öğrenilir; teklifi kopyalamak
      // "sapma yok" demek olurdu (kural 9 — uydurulmuş alan sessiz veri kaybı).
      supplierAmount: null,
      supplierCurrency: null,
      // İptal ekonomisi ve iade damgası yalnız iade gerçekleşirse doldurulur.
      supplierRetainedAmount: null,
      supplierRetainedCurrency: null,
      refundedAt: null,
      refundReason: null,
      fxRate: props.fxRate === null ? null : new Decimal(props.fxRate),
      intent: props.intent as unknown as IBookingPayment['intent'],
      iyzicoConversationId: null,
      iyzicoToken: null,
      iyzicoUrl: null,
      stripeSessionId: null,
      stripeUrl: null,
      paidProvider: null,
      paidProviderRef: null,
      paidAt: null,
      bookingReference: null,
      bookingId: null,
      failureReason: null,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      patientId: props.patientId
        ? UUID.create(props.patientId).orThrow().value
        : null,
      leadId: props.leadId ? UUID.create(props.leadId).orThrow().value : null,
      conversationId: props.conversationId,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Durum geçişi kapısı.
   *
   * Önceden bu koşullar `BookingPaymentRules` sınıfında duruyordu ama **hiçbir
   * çağıranı yoktu**; üç handler kendi içinde satır içi kontrol yapıyor, dördüncü
   * bir çağıran korumasız kalıyordu. Kural tek yerde ve varlığın içinde (kural 10).
   */
  private assertStatusIn(
    transition: string,
    allowed: readonly BookingPaymentStatusValue[]
  ): void {
    if (!allowed.includes(this._status)) {
      throw new BookingPaymentInvalidTransitionException(
        transition,
        this._status
      );
    }
  }

  /** initiate sırasında üretilen sağlayıcı link bilgilerini saklar. */
  public attachLinks(links: BookingPaymentLinks): void {
    if (isNotUndefined(links.iyzicoConversationId)) {
      this._iyzicoConversationId = links.iyzicoConversationId;
    }
    if (isNotUndefined(links.iyzicoToken))
      this._iyzicoToken = links.iyzicoToken;

    if (isNotUndefined(links.iyzicoUrl))
      this._iyzicoUrl = links.iyzicoUrl
        ? Url.create(links.iyzicoUrl).orThrow()
        : null;

    if (isNotUndefined(links.stripeSessionId)) {
      this._stripeSessionId = links.stripeSessionId;
    }
    if (isNotUndefined(links.stripeUrl)) {
      this._stripeUrl = links.stripeUrl
        ? Url.create(links.stripeUrl).orThrow()
        : null;
    }

    this._updatedAt = DateTimeManager.create();
  }

  /**
   * PENDING → PAID. `providerRef` iade için saklanır.
   *
   * Koşul varlığın KENDİSİNDE zorlanır: ikinci bir ödeme bildirimi bu metoda
   * ulaşırsa `paidProviderRef` ezilir ve **ilk çekimin iade referansı kaybolur**
   * — para iadesi teknik olarak imkânsız hâle gelir.
   */
  public markPaid(
    provider: BookingPaymentProviderValue,
    providerRef: string
  ): void {
    this.assertStatusIn('markPaid', [BookingPaymentStatusSchema.enum.PENDING]);

    const now = DateTimeManager.create();

    this._status = BookingPaymentStatusSchema.enum.PAID;
    this._paidProvider = provider;
    this._paidProviderRef = providerRef;
    this._paidAt = now;
    this._updatedAt = now;
  }

  /** PAID → BOOKED. HotelBeds rezervasyonu tamamlandı. */
  public markBooked(reference: string, bookingId?: string | null): void {
    this.assertStatusIn('markBooked', [BookingPaymentStatusSchema.enum.PAID]);

    this._status = BookingPaymentStatusSchema.enum.BOOKED;
    this._bookingReference = reference;
    this._bookingId = bookingId ?? null;
    this._updatedAt = DateTimeManager.create();
  }

  /**
   * Sağlayıcının rezervasyonu açarken **fiilen** ücretlendirdiği maliyeti damgalar.
   *
   * Satış fiyatı teklif anındaki fiyattan türetilir ve ödeme linki saatlerce
   * açık kalabilir; sağlayıcı rezervasyonu o anki fiyatla açar. Fiilî tutar
   * kaydedilmezse defterdeki tedarikçi borcu (320) sağlayıcının faturalayacağı
   * tutarı göstermez ve fark komisyonu **sessizce** yer.
   *
   * BOOKED durumunda da kabul edilir: rezervasyon damgası ile maliyet damgası
   * aynı transaction'da atılır ama mükerrer bildirim yolunda kayıt zaten BOOKED
   * olabilir (idempotent — aynı değer yeniden yazılır).
   */
  public recordSupplierCost(props: RecordSupplierCostProps): void {
    this.assertStatusIn('recordSupplierCost', [
      BookingPaymentStatusSchema.enum.PAID,
      BookingPaymentStatusSchema.enum.BOOKED,
    ]);

    this._supplierAmount = Money.create(props.amount, props.currency).orThrow();
    this._updatedAt = DateTimeManager.create();
  }

  /**
   * Teklif ↔ fiilî maliyet teşhisi; defterin hangi tutarı yazacağını da söyler.
   *
   * Tek yerde durur çünkü iki tüketicisi var: defter satırı (hangi tutar) ve
   * operasyon alarmı (sapma var mı). İkisini ayrı ayrı hesaplamak, birinin
   * fiilî tutarı yazıp diğerinin teklife bakması riskini üretir.
   */
  public get supplierCost(): SupplierCostAssessment {
    const quote = this._netAmount;
    const actual = this._supplierAmount;

    if (!actual) {
      return {
        ledgerAmount: quote,
        isActual: false,
        drift: 'UNKNOWN',
        exceedsSale: false,
      };
    }

    // Para birimi farklıysa çıkarma bile yapılamaz (Money bilerek patlar);
    // defter teklife düşer ve fark elle çözülmek üzere alarma gider.
    if (actual.currency !== quote.currency) {
      return {
        ledgerAmount: quote,
        isActual: false,
        drift: 'CURRENCY_MISMATCH',
        exceedsSale: false,
      };
    }

    return {
      ledgerAmount: actual,
      isActual: true,
      drift: actual.equals(quote) ? 'NONE' : 'DIFFERENT',
      exceedsSale: actual.isGreaterThan(this._saleAmount),
    };
  }

  /** PAID → FAILED. Ödeme alındı ama HotelBeds book başarısız → iade beklenir. */
  public markFailed(reason: string): void {
    this.assertStatusIn('markFailed', [BookingPaymentStatusSchema.enum.PAID]);

    this._status = BookingPaymentStatusSchema.enum.FAILED;
    this._failureReason = reason;
    this._updatedAt = DateTimeManager.create();
  }

  /**
   * PENDING → EXPIRED (link süresi doldu, ödeme yapılmadı).
   *
   * Koşul kritik: ödenmiş bir kaydı expire etmek, parası alınmış bir rezervasyonu
   * "ödeme yapılmadı" hâline çekmek demektir.
   */
  public markExpired(): void {
    this.assertStatusIn('markExpired', [
      BookingPaymentStatusSchema.enum.PENDING,
    ]);

    this._status = BookingPaymentStatusSchema.enum.EXPIRED;
    this._updatedAt = DateTimeManager.create();
  }

  /**
   * Para bize geçmişken geri verildi. PAID (rezervasyon açılmadan), BOOKED
   * (sonradan iptal) ve FAILED (book başarısız → iade) durumlarından gelinir;
   * ödeme hiç alınmamışken (PENDING/EXPIRED) "iade edildi" demek yanlış izdir.
   */
  public markRefunded(props: MarkRefundedProps): void {
    this.assertStatusIn('markRefunded', [
      BookingPaymentStatusSchema.enum.PAID,
      BookingPaymentStatusSchema.enum.BOOKED,
      BookingPaymentStatusSchema.enum.FAILED,
    ]);

    const now = DateTimeManager.create();
    this._status = BookingPaymentStatusSchema.enum.REFUNDED;
    // Kendi kolonuna yazılır: `failureReason` book hatasının nedenini taşır ve
    // FAILED → REFUNDED yolunda üzerine yazmak o izi silerdi.
    this._refundReason = props.reason;
    this._refundedAt = now;
    this._supplierRetained = props.retained
      ? Money.create(props.retained.amount, props.retained.currency).orThrow()
      : null;
    this._updatedAt = now;
  }

  /**
   * İade ters kaydının sayıları. Tek yerde durur çünkü iki tüketicisi var:
   * defter satırları ve operasyon alarmı — ikisini ayrı hesaplamak, birinin
   * cezayı sayıp diğerinin saymaması riskini üretir (bkz. {@link supplierCost}).
   *
   * Tedarikçi payı **defterin fiilen yazdığı** tutardan (`supplierCost
   * .ledgerAmount`) türetilir, "gerçek" maliyetten değil: ters kayıt var olan
   * fişi geri almak zorundadır. Tahsilat fişi teklife düşmüşse ters kayıt da
   * teklife düşer, aksi halde 320'de kapanmayan bir kalıntı bırakırdı.
   */
  public get refundAssessment(): BookingRefundAssessment {
    const sale = this._saleAmount;
    const posted = this.supplierCost.ledgerAmount;
    const zero = Money.fromTrusted(0, sale.currency);

    // Komisyon negatifse tahsilat fişi HİÇ yazılmamıştır (posting kuralı
    // maliyetin altında satışı reddediyor). Olmayan bir fişi ters kaydetmek
    // 108'i eksiye düşürürdü → ters kayıt kuralı da aynı gerekçeyle reddeder.
    const commissionIsNegative = posted.isGreaterThan(sale);
    const commission = commissionIsNegative ? zero : sale.subtract(posted);

    const retained = this._supplierRetained;
    const retainedCurrencyMismatch =
      retained !== null && retained.currency !== sale.currency;
    const retainedKnown = retained !== null && !retainedCurrencyMismatch;
    // Bilinmeyen ceza sıfır **varsayılır**: alternatifi ters kaydı hiç yazmamak
    // olurdu ve o zaman 108 giden parayı, 601 kazanılmamış komisyonu, 320 artık
    // olmayan borcu gösterirdi — üç hesap yerine bir hesabı (320) eksik
    // bırakmak daha az yanlıştır. Varsayım alarmla duyurulur.
    const retainedLoss = retainedKnown && retained ? retained : zero;
    const retainedExceedsSupplier = retainedLoss.isGreaterThan(posted);
    const supplierReleased = retainedExceedsSupplier
      ? zero
      : posted.subtract(retainedLoss);

    return {
      refundAmount: sale,
      commission,
      supplierReleased,
      retainedLoss,
      retainedKnown,
      retainedCurrencyMismatch,
      retainedExceedsSupplier,
      commissionIsNegative,
    };
  }

  /**
   * Belirtilen kanalın hastadan **fiilen çektiği** tutar: iyzico TRY
   * (`tryAmount`), Stripe satış cinsinden (`saleAmount`).
   *
   * Bu ayrım üç yerde ayrı ayrı yazılıyordu (çift-çekim iadesi, iptal iadesi,
   * defter köprüsü); biri değişip diğeri kalsa sağlayıcıya yanlış tutar gider
   * ya da defter gelmeyen parayı yazar. Kanal parametre olarak alınır çünkü
   * çift-çekimde iade edilen kanal, kaydın sahiplenilmiş kanalı **değildir**.
   */
  public amountChargedBy(provider: BookingPaymentProviderValue): Money {
    return provider === PaymentProviders.IYZICO
      ? this._tryAmount
      : this._saleAmount;
  }

  /**
   * Paranın bu kayıt için fiilen hareket ettiği tutar = sahiplenilmiş kanalın
   * çektiği tutar. Kanal yoksa tutar da bilinmiyor: varsayım yapmak defterin
   * kasa satırına gelmeyen bir parayı yazar.
   */
  public get receivedAmount(): Money {
    if (!this._paidProvider) {
      throw new BookingLedgerNotPostableException({
        bookingPaymentId: this._id.value,
        reason: 'FX_RATE_MISSING',
        paidProvider: null,
        saleCurrency: this._saleCurrency.value,
      });
    }
    return this.amountChargedBy(this._paidProvider);
  }

  /**
   * Fişin para birimi temeli: hangi cinste yazılacak ve satış cinsinden o cinse
   * hangi kurla çevrilecek.
   *
   * Kritik olan şu: kur **burada kilitlidir** (`fxRate`, link üretilirken
   * alınmıştı ve hastaya o kurla TRY çekildi). Fişi satış cinsinden beyan
   * etseydik posting kuru olay tarihine göre TCMB'den **yeniden türetirdi** ve
   * 108 hesabına fiilen gelmemiş bir tutar yazılırdı. Kasa hesabı yorum kabul
   * etmez.
   */
  private get ledgerBasis(): BookingLedgerBasis {
    const provider = this._paidProvider;

    // Kanal bilinmiyorsa paranın hangi cinste hareket ettiği de bilinmiyor.
    // Varsayım yapmak (satış cinsi / TRY) dengeyi bozmaz → hiçbir kontrol
    // yakalamaz; bu yüzden adıyla durur.
    if (!provider) {
      throw new BookingLedgerNotPostableException({
        bookingPaymentId: this._id.value,
        reason: 'FX_RATE_MISSING',
        paidProvider: null,
        saleCurrency: this._saleCurrency.value,
      });
    }

    if (provider !== PaymentProviders.IYZICO) {
      // Stripe satış cinsinden çeker → çevrim yok; yabancı para ise posting
      // fonksiyonel paraya kendi çevirir (Model A, olay tarihli TCMB kuru).
      return {
        currency: this._saleCurrency.value,
        fxRate: null,
        originalCurrency: null,
      };
    }

    if (this._saleCurrency.value === Currency.enum.TRY) {
      return {
        currency: Currency.enum.TRY,
        fxRate: null,
        originalCurrency: null,
      };
    }

    // Yabancı satış + iyzico → kilitli kur **zorunlu**. Link yalnız kur
    // çözülebildiğinde üretildiği için burada null olmaması gerekir; olduysa
    // kaydın kendisi tutarsızdır ve "1 kabul et" tutarı kur katı kadar yanlış
    // yazar.
    if (!this._fxRate) {
      throw new BookingLedgerNotPostableException({
        bookingPaymentId: this._id.value,
        reason: 'FX_RATE_MISSING',
        paidProvider: provider,
        saleCurrency: this._saleCurrency.value,
      });
    }

    return {
      currency: Currency.enum.TRY,
      fxRate: this._fxRate,
      originalCurrency: this._saleCurrency.value,
    };
  }

  /**
   * Tahsilat fişinin sayıları, **fiş para biriminde**.
   *
   * Komisyon bilerek artıktır (`sale − supplier`): üç tutarı ayrı ayrı çevirmek
   * kuruş artığı bırakır ve `commission + supplier = sale` eşitliği (posting
   * kuralının denge koşulu) bozulur.
   */
  public get settledLedgerAmounts(): BookingSettledLedgerAmounts {
    const basis = this.ledgerBasis;
    const sale = this.receivedAmount;
    const posted = this.supplierCost.ledgerAmount;

    const supplier = basis.fxRate
      ? posted.convert(basis.fxRate, basis.currency)
      : posted;

    return {
      currency: basis.currency,
      sale,
      supplier,
      // Maliyetin altında satışta `Money.subtract` patlardı; posting kuralı da
      // aynı hâli zaten reddediyor (`PlatformBookingBelowCostException`) —
      // burada sıfır dönüp kararı kurala bırakmak, hatanın defter tarafında ve
      // hesaplarıyla birlikte raporlanmasını sağlar.
      commission: supplier.isGreaterThan(sale)
        ? Money.fromTrusted(0, basis.currency)
        : sale.subtract(supplier),
      fxRate: basis.fxRate,
      originalCurrency: basis.originalCurrency,
      supplierOriginal: basis.fxRate ? posted : null,
    };
  }

  /**
   * İade ters kaydının sayıları, **fiş para biriminde**.
   *
   * Çevrim yalnız iki büyüklüğe uygulanır (defterin yazdığı tedarikçi maliyeti
   * ve ceza); komisyon artık olarak türetilir. Böylece
   * `commission + supplierReleased + retainedLoss = refundAmount` eşitliği
   * çevrim yuvarlamasından bağımsız tutar — üçünü ayrı çevirmek bir kuruşluk
   * artıkla fişi dengesiz yapardı.
   */
  public get refundedLedgerAmounts(): BookingRefundedLedgerAmounts {
    const basis = this.ledgerBasis;
    const assessment = this.refundAssessment;

    const refundAmount = this.receivedAmount;
    const postedOriginal = this.supplierCost.ledgerAmount;
    const retainedOriginal = assessment.retainedLoss;

    const posted = basis.fxRate
      ? postedOriginal.convert(basis.fxRate, basis.currency)
      : postedOriginal;
    const retainedLoss = basis.fxRate
      ? retainedOriginal.convert(basis.fxRate, basis.currency)
      : retainedOriginal;

    // Sıra: `retainedExceedsSupplier` / `commissionIsNegative` satış cinsinden
    // ölçülür (`refundAssessment`) ve köprü fişi o ölçütle reddeder. Kur pozitif
    // olduğu için çevrim sıralamayı korur → iki ölçüt aynı kararı verir.
    const supplierReleased = assessment.retainedExceedsSupplier
      ? Money.fromTrusted(0, basis.currency)
      : posted.subtract(retainedLoss);
    const commission = assessment.commissionIsNegative
      ? Money.fromTrusted(0, basis.currency)
      : refundAmount.subtract(posted);

    return {
      currency: basis.currency,
      refundAmount,
      commission,
      supplierReleased,
      retainedLoss,
      fxRate: basis.fxRate,
      originalCurrency: basis.originalCurrency,
      // Orijinal cinsten serbest kalan borç: `refundAssessment` onu zaten
      // (ceza maliyeti aşıyorsa sıfırlayarak) hesaplıyor — ikinci bir çıkarma
      // yazmak `subtract`'ın negatif guard'ına çarpardı.
      supplierReleasedOriginal: basis.fxRate
        ? assessment.supplierReleased
        : null,
      retainedLossOriginal: basis.fxRate ? retainedOriginal : null,
    };
  }

  // --------------------------------------------------------------- persistence

  public toPersistence(): IBookingPayment {
    return {
      id: this.id.value,
      bookingType: this.bookingType,
      status: this.status,
      saleCurrency: this.saleCurrency.value,
      saleAmount: this.saleAmount.value,
      tryAmount: this.tryAmount.value,
      netAmount: this.netAmount.value,
      supplierAmount: this.supplierAmount?.value ?? null,
      supplierCurrency: this.supplierAmount?.currency ?? null,
      supplierRetainedAmount: this.supplierRetained?.value ?? null,
      supplierRetainedCurrency: this.supplierRetained?.currency ?? null,
      refundedAt: this.refundedAt,
      refundReason: this.refundReason,
      fxRate: this.fxRate,
      intent: this.intent,
      iyzicoConversationId: this.iyzicoConversationId,
      iyzicoToken: this.iyzicoToken,
      iyzicoUrl: this.iyzicoUrl?.value ?? null,
      stripeSessionId: this.stripeSessionId,
      stripeUrl: this.stripeUrl?.value ?? null,
      paidProvider: this.paidProvider,
      paidProviderRef: this.paidProviderRef,
      paidAt: this.paidAt,
      bookingReference: this.bookingReference,
      bookingId: this.bookingId,
      failureReason: this.failureReason,
      clinicId: this.clinicId.value,
      organizationId: this.organizationId.value,
      patientId: this.patientId?.value ?? null,
      leadId: this.leadId?.value ?? null,
      conversationId: this.conversationId,
      createdAt: this.createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }
}
