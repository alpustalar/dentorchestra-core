import { BookingPayment } from './booking-payment.entity';
import {
  BookingLedgerNotPostableException,
  BookingPaymentInvalidTransitionException,
} from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment.exceptions';
import {
  CreateBookingPaymentProps,
  HotelBookingIntent,
} from '../contracts/booking-payment';

describe('BookingPayment entity — durum makinesi', () => {
  const hotelIntent: HotelBookingIntent = {
    type: 'HOTEL',
    hotelCode: 'H1',
    hotelName: 'Otel Bir',
    checkIn: '2026-07-01',
    checkOut: '2026-07-05',
    holderName: 'Ali',
    holderSurname: 'Veli',
    rooms: [{ rateKey: 'RK-1', paxes: [] }],
  };

  const baseProps: CreateBookingPaymentProps = {
    bookingType: 'HOTEL',
    saleCurrency: 'EUR',
    saleAmount: 120,
    tryAmount: 4200,
    netAmount: 100,
    fxRate: 35,
    intent: hotelIntent,
    clinicId: '11111111-1111-4111-8111-111111111111',
    organizationId: '22222222-2222-4222-8222-222222222222',
    patientId: null,
    leadId: '33333333-3333-4333-8333-333333333333',
    conversationId: 'conv-1',
  };

  it('create → PENDING; tutarlar Decimal; intent tipli okunur', () => {
    const bp = BookingPayment.create(baseProps);
    expect(bp.status).toBe('PENDING');
    expect(bp.validate.status.isPending.value).toBe(true);
    expect(bp.saleAmount.value.toNumber()).toBe(120);
    expect(bp.tryAmount.value.toNumber()).toBe(4200);
    expect(bp.fxRate?.toNumber()).toBe(35);
    expect(bp.bookingIntent.type).toBe('HOTEL');
  });

  it('attachLinks: sağlayıcı link bilgilerini saklar', () => {
    const bp = BookingPayment.create(baseProps);
    bp.attachLinks({
      iyzicoConversationId: bp.id.value,
      iyzicoToken: 'tok',
      iyzicoUrl: 'https://iyzi',
      stripeSessionId: 'cs_1',
      stripeUrl: 'https://stripe',
    });
    expect(bp.iyzicoUrl?.value).toBe('https://iyzi');
    expect(bp.stripeSessionId).toBe('cs_1');
  });

  it('markPaid: PENDING → PAID; provider + ref + paidAt set edilir', () => {
    const bp = BookingPayment.create(baseProps);
    bp.markPaid('STRIPE', 'pi_123');
    expect(bp.status).toBe('PAID');
    expect(bp.paidProvider).toBe('STRIPE');
    expect(bp.paidProviderRef).toBe('pi_123');
    expect(bp.paidAt).toBeInstanceOf(Date);
    expect(bp.validate.status.isSettled.value).toBe(true);
  });

  it('markPaid ikinci kez → hata; ilk çekimin iade referansı korunur', () => {
    // Koşul varlığın KENDİSİNDE: ikinci bildirim `paidProviderRef`'i ezerse ilk
    // çekimin iade referansı kaybolur ve para iadesi imkânsız hâle gelir.
    // (Önce koşul `rules()` sınıfına taşınmıştı ve o sınıfın ÜRETİMDE hiç
    // çağıranı yoktu; testler `rules()`'u çağırdığı için yeşil kalıyordu.)
    const bp = BookingPayment.create(baseProps);
    bp.markPaid('IYZICO', 'tx_1');

    expect(() => bp.markPaid('STRIPE', 'pi_2')).toThrow(
      BookingPaymentInvalidTransitionException
    );
    expect(bp.paidProviderRef).toBe('tx_1');
    expect(bp.paidProvider).toBe('IYZICO');
  });

  it('markBooked yalnız PAID sonrası; PENDING’den → hata', () => {
    const bp = BookingPayment.create(baseProps);
    expect(() => bp.markBooked('BK-0', 'BK-0')).toThrow(
      BookingPaymentInvalidTransitionException
    );
    bp.markPaid('STRIPE', 'pi_1');
    bp.markBooked('BK-1', 'BK-1');
    expect(bp.status).toBe('BOOKED');
    expect(bp.bookingReference).toBe('BK-1');
    expect(bp.validate.status.isSettled.value).toBe(true);
  });

  it('markExpired yalnız PENDING; ödenmişten → hata', () => {
    const bp = BookingPayment.create(baseProps);
    bp.markExpired();
    expect(bp.status).toBe('EXPIRED');

    // Ödenmiş kaydı expire etmek, parası alınmış bir rezervasyonu "ödeme
    // yapılmadı" hâline çekmek demektir.
    const paid = BookingPayment.create(baseProps);
    paid.markPaid('IYZICO', 'tx');
    expect(() => paid.markExpired()).toThrow(
      BookingPaymentInvalidTransitionException
    );
    expect(paid.status).toBe('PAID');
  });

  it('ödeme alınmamışken markRefunded → hata', () => {
    // "İade edildi" demek para bir kez bize geçmişse doğrudur; PENDING kayıtta
    // yanlış izdir (iade raporunda karşılığı olmayan satır üretir).
    const bp = BookingPayment.create(baseProps);

    expect(() =>
      bp.markRefunded({ reason: 'müşteri vazgeçti', retained: null })
    ).toThrow(BookingPaymentInvalidTransitionException);
  });

  it('markFailed + markRefunded: book başarısız → iade akışı', () => {
    const bp = BookingPayment.create(baseProps);
    bp.markPaid('STRIPE', 'pi_1');
    bp.markFailed('rate expired');
    expect(bp.status).toBe('FAILED');
    expect(bp.failureReason).toBe('rate expired');
    bp.markRefunded({ reason: 'iade edildi', retained: null });
    expect(bp.status).toBe('REFUNDED');
    // İade nedeni KENDİ kolonunda: `failureReason` book hatasının nedenini
    // taşır ve üzerine yazmak FAILED → REFUNDED yolunda o izi silerdi.
    expect(bp.failureReason).toBe('rate expired');
    expect(bp.refundReason).toBe('iade edildi');
  });

  describe('fiilî tedarikçi maliyeti (teklif ↔ gerçek)', () => {
    const booked = (): BookingPayment => {
      const bp = BookingPayment.create(baseProps);
      bp.markPaid('STRIPE', 'pi_1');
      bp.markBooked('BK-1', 'BK-1');
      return bp;
    };

    it('fiilî maliyet kaydedilmemişken defter TEKLİFE düşer ve bu UNKNOWN’dır', () => {
      // Önemli: "bilinmiyor" ile "sapma yok" ayrı şeylerdir. Teklifi fiilî
      // maliyet gibi göstermek, sapma raporunu her zaman temiz gösterirdi.
      const bp = booked();

      expect(bp.supplierAmount).toBeNull();
      expect(bp.supplierCost.drift).toBe('UNKNOWN');
      expect(bp.supplierCost.isActual).toBe(false);
      expect(bp.supplierCost.ledgerAmount.toApiFormat()).toBe('100.00');
    });

    it('fiilî maliyet teklifle aynıysa sapma NONE ve defter fiilî tutarı yazar', () => {
      const bp = booked();
      bp.recordSupplierCost({ amount: '100.00', currency: 'EUR' });

      expect(bp.supplierCost.drift).toBe('NONE');
      expect(bp.supplierCost.isActual).toBe(true);
      expect(bp.supplierCost.exceedsSale).toBe(false);
      expect(bp.supplierCost.ledgerAmount.toApiFormat()).toBe('100.00');
    });

    it('sağlayıcı fiyatı yükseltmişse defter FİİLÎ tutarı yazar, sapma DIFFERENT olur', () => {
      // Ödeme linki saatlerce açık kalabildiği için bu beklenen bir olgudur:
      // satış 120'de dondu, HotelBeds 105'e açtı → komisyon 20 değil 15.
      const bp = booked();
      bp.recordSupplierCost({ amount: '105.00', currency: 'EUR' });

      expect(bp.supplierCost.drift).toBe('DIFFERENT');
      expect(bp.supplierCost.ledgerAmount.toApiFormat()).toBe('105.00');
      expect(bp.supplierCost.exceedsSale).toBe(false);
      // Teklif KORUNUR: sapmanın ölçülebilmesi için iki tutar birlikte durur.
      expect(bp.netAmount.toApiFormat()).toBe('100.00');
    });

    it('fiilî maliyet satış fiyatını aşarsa exceedsSale işaretlenir (maliyetin altında satış)', () => {
      const bp = booked();
      bp.recordSupplierCost({ amount: '130.00', currency: 'EUR' });

      expect(bp.supplierCost.exceedsSale).toBe(true);
      expect(bp.supplierCost.ledgerAmount.toApiFormat()).toBe('130.00');
    });

    it('fiilî maliyet başka para birimindeyse karşılaştırılamaz; defter teklife düşer', () => {
      // `Money` farklı para birimlerinde çıkarma yapmaz (bilerek patlar). Burada
      // patlatmak rezervasyonu bozardı → teşhis CURRENCY_MISMATCH, defter teklif.
      const bp = booked();
      bp.recordSupplierCost({ amount: '98.00', currency: 'USD' });

      expect(bp.supplierCost.drift).toBe('CURRENCY_MISMATCH');
      expect(bp.supplierCost.isActual).toBe(false);
      expect(bp.supplierCost.ledgerAmount.toApiFormat()).toBe('100.00');
      expect(bp.supplierCost.ledgerAmount.currency).toBe('EUR');
    });

    it('ödeme alınmamışken fiilî maliyet damgalanamaz', () => {
      const bp = BookingPayment.create(baseProps);

      expect(() =>
        bp.recordSupplierCost({ amount: '100.00', currency: 'EUR' })
      ).toThrow(BookingPaymentInvalidTransitionException);
    });

    it('fiilî maliyet ve para birimi persistence’a taşınır', () => {
      // Mapping kilidi (kural 9): entity’nin hesapladığı ama mapping’in yazmadığı
      // para alanı hata vermez, log üretmez ve geri getirilemez.
      const bp = booked();
      bp.recordSupplierCost({ amount: '105.50', currency: 'EUR' });

      const row = bp.toPersistence();
      expect(row.supplierAmount?.toString()).toBe('105.5');
      expect(row.supplierCurrency).toBe('EUR');

      // Rehidrasyon: satırdan okunan kayıt aynı teşhisi verir.
      const rehydrated = new BookingPayment(row);
      expect(rehydrated.supplierCost.drift).toBe('DIFFERENT');
      expect(rehydrated.supplierAmount?.toApiFormat()).toBe('105.50');
    });
  });

  describe('iade ters kaydının sayıları (refundAssessment)', () => {
    // sale 120 = supplier 100 + komisyon 20 (tahsilat fişinin yazdığı rakamlar).
    const refunded = (
      retained: { amount: string; currency: 'EUR' | 'TRY' } | null,
      supplierActual?: string
    ): BookingPayment => {
      const bp = BookingPayment.create(baseProps);
      bp.markPaid('STRIPE', 'pi_1');
      bp.markBooked('BK-1', 'BK-1');
      if (supplierActual) {
        bp.recordSupplierCost({ amount: supplierActual, currency: 'EUR' });
      }
      bp.markRefunded({ reason: 'iptal', retained });
      return bp;
    };

    it('cezasız iptal: komisyon + tedarikçi borcu = iade tutarı', () => {
      const a = refunded({ amount: '0.00', currency: 'EUR' });

      expect(a.refundAssessment.refundAmount.toApiFormat()).toBe('120.00');
      expect(a.refundAssessment.commission.toApiFormat()).toBe('20.00');
      expect(a.refundAssessment.supplierReleased.toApiFormat()).toBe('100.00');
      expect(a.refundAssessment.retainedLoss.toApiFormat()).toBe('0.00');
      expect(a.refundAssessment.retainedKnown).toBe(true);
    });

    it('cezalı iptal: ceza 320’den düşmez, zarara gider', () => {
      const a = refunded({ amount: '30.00', currency: 'EUR' }).refundAssessment;

      // Fişin denk olmasının tek koşulu: 20 + 70 + 30 = 120.
      expect(a.commission.toApiFormat()).toBe('20.00');
      expect(a.supplierReleased.toApiFormat()).toBe('70.00');
      expect(a.retainedLoss.toApiFormat()).toBe('30.00');
    });

    it('tamamı cezalı iptal: tedarikçi borcu hiç serbest kalmaz', () => {
      const a = refunded({
        amount: '100.00',
        currency: 'EUR',
      }).refundAssessment;

      expect(a.supplierReleased.toApiFormat()).toBe('0.00');
      expect(a.retainedLoss.toApiFormat()).toBe('100.00');
      expect(a.retainedExceedsSupplier).toBe(false);
    });

    it('ceza bilinmiyorsa cezasız varsayılır ama bu GÖRÜNÜR', () => {
      const a = refunded(null).refundAssessment;

      expect(a.retainedKnown).toBe(false);
      expect(a.retainedLoss.toApiFormat()).toBe('0.00');
      expect(a.supplierReleased.toApiFormat()).toBe('100.00');
    });

    it('ceza farklı para biriminde: karşılaştırılamaz, cezasız varsayılır', () => {
      const a = refunded({
        amount: '900.00',
        currency: 'TRY',
      }).refundAssessment;

      expect(a.retainedCurrencyMismatch).toBe(true);
      expect(a.retainedKnown).toBe(false);
      expect(a.retainedLoss.toApiFormat()).toBe('0.00');
    });

    it('ceza tedarikçi maliyetini aşıyorsa işaretlenir (320 negatife düşerdi)', () => {
      const a = refunded({
        amount: '150.00',
        currency: 'EUR',
      }).refundAssessment;

      expect(a.retainedExceedsSupplier).toBe(true);
    });

    it('ters kayıt, defterin FİİLEN yazdığı tedarikçi payını geri alır', () => {
      // Tahsilat fişi fiilî maliyetten (105) yazıldıysa ters kayıt da ondan
      // yazılır; teklife (100) dönmek 320'de 5 EUR kalıntı bırakırdı.
      const a = refunded(
        { amount: '0.00', currency: 'EUR' },
        '105.00'
      ).refundAssessment;

      expect(a.supplierReleased.toApiFormat()).toBe('105.00');
      expect(a.commission.toApiFormat()).toBe('15.00');
    });

    it('maliyetin altında satışta komisyon negatif: ters kayıt yazılamaz', () => {
      // Tahsilat fişi de yazılmamıştı (posting kuralı reddediyor); olmayan bir
      // fişi ters kaydetmek 108'i eksiye düşürürdü.
      const a = refunded(
        { amount: '0.00', currency: 'EUR' },
        '130.00'
      ).refundAssessment;

      expect(a.commissionIsNegative).toBe(true);
    });

    it('iade damgası kalıcıdır (rehidrasyonda korunur)', () => {
      const bp = refunded({ amount: '30.00', currency: 'EUR' });
      const rehydrated = new BookingPayment(bp.toPersistence());

      expect(rehydrated.supplierRetained?.toApiFormat()).toBe('30.00');
      expect(rehydrated.refundedAt).not.toBeNull();
      expect(rehydrated.refundReason).toBe('iptal');
      expect(rehydrated.refundAssessment.retainedLoss.toApiFormat()).toBe(
        '30.00'
      );
    });
  });
});

describe('BookingPayment — fişin para birimi temeli', () => {
  const hotelIntent: HotelBookingIntent = {
    type: 'HOTEL',
    hotelCode: 'H1',
    hotelName: 'Otel Bir',
    checkIn: '2026-07-01',
    checkOut: '2026-07-05',
    holderName: 'Ali',
    holderSurname: 'Veli',
    rooms: [{ rateKey: 'RK-1', paxes: [] }],
  };

  /** 100 EUR net → %20 ile 120 EUR satış; kur 35 → iyzico 4200 TRY çeker. */
  const eurProps: CreateBookingPaymentProps = {
    bookingType: 'HOTEL',
    saleCurrency: 'EUR',
    saleAmount: 120,
    tryAmount: 4200,
    netAmount: 100,
    fxRate: 35,
    intent: hotelIntent,
    clinicId: '11111111-1111-4111-8111-111111111111',
    organizationId: '22222222-2222-4222-8222-222222222222',
    patientId: null,
    leadId: null,
    conversationId: null,
  };

  const booked = (
    props: CreateBookingPaymentProps,
    provider: 'IYZICO' | 'STRIPE',
    supplier?: { amount: string; currency: 'EUR' | 'TRY' | 'USD' }
  ): BookingPayment => {
    const bp = BookingPayment.create(props);
    bp.markPaid(provider, 'ref-1');
    bp.markBooked('BK-1', 'BK-1');
    if (supplier) bp.recordSupplierCost(supplier);
    return bp;
  };

  describe('tryAmount etiketi', () => {
    it('TRY olarak etiketlenir — satış EUR olsa bile', () => {
      // Satış para birimiyle etiketlemek, TRY tutarı taşıyan ama kendini EUR
      // sanan bir Money üretiyordu: `add`/`subtract` guard'ı o noktadan sonra
      // koruma değil tuzak olur.
      const bp = BookingPayment.create(eurProps);
      expect(bp.tryAmount.currency).toBe('TRY');
      expect(bp.saleAmount.currency).toBe('EUR');
    });
  });

  describe('receivedAmount — fiilen hareket eden para', () => {
    it('iyzico → TRY tutarı; Stripe → satış tutarı', () => {
      expect(booked(eurProps, 'IYZICO').receivedAmount.toApiFormat()).toBe(
        '4200.00'
      );
      expect(booked(eurProps, 'IYZICO').receivedAmount.currency).toBe('TRY');
      expect(booked(eurProps, 'STRIPE').receivedAmount.toApiFormat()).toBe(
        '120.00'
      );
      expect(booked(eurProps, 'STRIPE').receivedAmount.currency).toBe('EUR');
    });

    it('çift-çekimde iade edilen kanal ayrı sorulur (amountChargedBy)', () => {
      // Sahiplenilmiş kanal iyzico ama iade edilen ikinci çekim Stripe'tan
      // geldiyse iade tutarı satış cinsindendir; `receivedAmount` o soruyu
      // yanıtlamaz.
      const bp = booked(eurProps, 'IYZICO');
      expect(bp.amountChargedBy('STRIPE').toApiFormat()).toBe('120.00');
      expect(bp.amountChargedBy('STRIPE').currency).toBe('EUR');
    });

    it('tahsilat kanalı yoksa tutar varsayılmaz → hata', () => {
      const bp = BookingPayment.create(eurProps);
      expect(() => bp.receivedAmount).toThrow(
        BookingLedgerNotPostableException
      );
    });
  });

  describe('settledLedgerAmounts', () => {
    it('iyzico + yabancı satış → fiş TRY; 108 fiilen gelen parayı gösterir', () => {
      const bp = booked(eurProps, 'IYZICO', {
        amount: '100.00',
        currency: 'EUR',
      });

      const a = bp.settledLedgerAmounts;

      expect(a.currency).toBe('TRY');
      // Fiilen tahsil edilen: 4200 TRY. Satış cinsinden (120 EUR) beyan edilse
      // posting kuru olay tarihine göre yeniden türetir ve 108'e gelmeyen bir
      // tutar yazılır.
      expect(a.sale.toApiFormat()).toBe('4200.00');
      expect(a.supplier.toApiFormat()).toBe('3500.00'); // 100 × 35
      expect(a.commission.toApiFormat()).toBe('700.00'); // artık
      expect(a.fxRate?.toNumber()).toBe(35);
      expect(a.originalCurrency).toBe('EUR');
      expect(a.supplierOriginal?.toApiFormat()).toBe('100.00');
      expect(a.supplierOriginal?.currency).toBe('EUR');
    });

    it('komisyon ARTIK: üç tutarı ayrı çevirmek fişi dengesiz bırakırdı', () => {
      // Sayılar bilerek seçildi: kur 2.5, maliyet 1.01 EUR, komisyon 1.01 EUR.
      //   maliyet  → 1.01 × 2.5 = 2.525 → 2.53 (yarı yukarı)
      //   komisyon → 1.01 × 2.5 = 2.525 → 2.53
      //   toplam   → 5.06  ≠  satış 2.02 × 2.5 = 5.05
      // Yani üç tutar ayrı ayrı çevrilseydi fiş **bir kuruş dengesiz** olurdu
      // ve posting onu reddederdi (olay append-only → sonsuza dek fişsiz).
      // Komisyon artık olarak türetildiğinde eşitlik tanım gereği sağlanır.
      const bp = booked(
        {
          ...eurProps,
          saleAmount: 2.02,
          tryAmount: 5.05,
          netAmount: 1.01,
          fxRate: 2.5,
        },
        'IYZICO',
        { amount: '1.01', currency: 'EUR' }
      );

      const a = bp.settledLedgerAmounts;

      expect(a.sale.toApiFormat()).toBe('5.05');
      expect(a.supplier.toApiFormat()).toBe('2.53');
      expect(a.commission.toApiFormat()).toBe('2.52'); // 2.53 DEĞİL
      expect(a.supplier.add(a.commission).toApiFormat()).toBe('5.05');
    });

    it('Stripe → satış cinsinde kalır; çevrim posting’e bırakılır', () => {
      const bp = booked(eurProps, 'STRIPE', {
        amount: '100.00',
        currency: 'EUR',
      });

      const a = bp.settledLedgerAmounts;

      expect(a.currency).toBe('EUR');
      expect(a.sale.toApiFormat()).toBe('120.00');
      expect(a.supplier.toApiFormat()).toBe('100.00');
      expect(a.commission.toApiFormat()).toBe('20.00');
      expect(a.fxRate).toBeNull();
      expect(a.supplierOriginal).toBeNull();
    });

    it('TRY satış + iyzico → çevrim yok', () => {
      const bp = booked(
        {
          ...eurProps,
          saleCurrency: 'TRY',
          saleAmount: 4200,
          tryAmount: 4200,
          netAmount: 3500,
          fxRate: 1,
        },
        'IYZICO',
        { amount: '3500.00', currency: 'TRY' }
      );

      const a = bp.settledLedgerAmounts;
      expect(a.currency).toBe('TRY');
      expect(a.fxRate).toBeNull();
      expect(a.commission.toApiFormat()).toBe('700.00');
    });

    it('yabancı satış + iyzico ama kilitli kur yok → fiş yazılamaz (1 varsayılmaz)', () => {
      const bp = booked({ ...eurProps, fxRate: null }, 'IYZICO', {
        amount: '100.00',
        currency: 'EUR',
      });

      expect(() => bp.settledLedgerAmounts).toThrow(
        BookingLedgerNotPostableException
      );
    });

    it('tedarikçi maliyeti başka para biriminde → defter teklife düşer ve kur ona uygulanır', () => {
      // `supplierCost` farklı cinsi zaten reddedip teklife düşüyor; çevrim o
      // tutara uygulanır, yoksa 100 USD "100 EUR" sayılırdı.
      const bp = booked(eurProps, 'IYZICO', {
        amount: '98.00',
        currency: 'USD',
      });

      const a = bp.settledLedgerAmounts;
      expect(a.supplier.toApiFormat()).toBe('3500.00'); // teklif 100 EUR × 35
      expect(a.supplierOriginal?.currency).toBe('EUR');
    });
  });

  describe('refundedLedgerAmounts', () => {
    it('iyzico + yabancı satış → ters kayıt TRY; denge eşitliği korunur', () => {
      const bp = booked(eurProps, 'IYZICO', {
        amount: '100.00',
        currency: 'EUR',
      });
      bp.markRefunded({
        reason: 'müşteri iptal etti',
        retained: { amount: '20.00', currency: 'EUR' },
      });

      const a = bp.refundedLedgerAmounts;

      expect(a.currency).toBe('TRY');
      expect(a.refundAmount.toApiFormat()).toBe('4200.00');
      expect(a.retainedLoss.toApiFormat()).toBe('700.00'); // 20 × 35
      expect(a.supplierReleased.toApiFormat()).toBe('2800.00'); // (100−20) × 35
      expect(a.commission.toApiFormat()).toBe('700.00'); // 4200 − 3500
      // Fişin denk olmasının tek koşulu:
      expect(
        a.commission.add(a.supplierReleased).add(a.retainedLoss).toApiFormat()
      ).toBe(a.refundAmount.toApiFormat());
      expect(a.supplierReleasedOriginal?.toApiFormat()).toBe('80.00');
      expect(a.retainedLossOriginal?.toApiFormat()).toBe('20.00');
    });

    it('ceza bilinmiyorsa sıfır varsayılır ama kur temeli korunur', () => {
      const bp = booked(eurProps, 'IYZICO', {
        amount: '100.00',
        currency: 'EUR',
      });
      bp.markRefunded({ reason: 'iptal', retained: null });

      const a = bp.refundedLedgerAmounts;
      expect(a.retainedLoss.toApiFormat()).toBe('0.00');
      expect(a.supplierReleased.toApiFormat()).toBe('3500.00');
      expect(a.originalCurrency).toBe('EUR');
    });

    it('ceza tedarikçi maliyetini aşıyorsa 320 negatife düşmez', () => {
      const bp = booked(eurProps, 'IYZICO', {
        amount: '100.00',
        currency: 'EUR',
      });
      bp.markRefunded({
        reason: 'iptal',
        retained: { amount: '150.00', currency: 'EUR' },
      });

      const a = bp.refundedLedgerAmounts;
      expect(a.supplierReleased.toApiFormat()).toBe('0.00');
      // Köprü bu hâli adıyla reddediyor; getter negatif üretmemekle yetinir.
      expect(bp.refundAssessment.retainedExceedsSupplier).toBe(true);
    });
  });
});
