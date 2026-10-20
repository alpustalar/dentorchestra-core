export const ACCOUNTING_RULES = {
  // Gelir tablosu, gider ve maliyetleri içeren sonuç hesaplarının ana kırılımları
  RESULT_ACCOUNT_PREFIXES: ['6', '7'] as const,

  // Dönem net kâr/zarar özeti havuz hesap grubu (Kapanış döngüsünde filtrelenir)
  SUMMARY_ACCOUNT_PREFIX: '69',

  // Ana dengeleme ve devir hesap kodları
  TARGET_ACCOUNTS: {
    POOL_690: '690',
    NET_PROFIT_590: '590',
    NET_LOSS_591: '591',
    CASH_100: '100',
    BANKS_102: '102',
    POS_108: '108',
    /// Sağlayıcı (POS/banka/ödeme kuruluşu) komisyonu — 108 kapanırken gider yazılır.
    PROVIDER_COMMISSION_653: '653',
    /// Kart itirazı ara hesabı (127 Diğer Ticari Alacaklar): sağlayıcı parayı kesti,
    /// itirazın sonucu belli değil. v1'de 127 YALNIZ bu akışa ayrıdır; başka bir
    /// kullanım doğarsa alt hesap açmak bir şablon kararıdır (kural 11).
    CHARGEBACK_HOLD_127: '127',
    /// Platform rezervasyon itirazı KAYBEDİLİNCE zarar hesabı (659 başlığının altında). 689'un
    /// alt hesabı DEĞİL: şablon bekçisi postlanabilir hesabın altına alt hesap açılmasını yasaklar.
    /// 659 yalnız başlıktır (postlanamaz), fişler 659.01'e yazılır.
    PLATFORM_CHARGEBACK_LOSS_659_01: '659.01',
    /// Müşteriye iade edilecek tahsilat (336 Diğer Çeşitli Borçlar): çift çekim ve başarısız
    /// rezervasyonun parası. Gelir DEĞİL — iade doğrulanana kadar müşteriye borçtur. v1'de 336
    /// YALNIZ bu akışa ayrıdır (127 gibi); ikinci bir kullanım doğarsa alt hesap bir şablon kararıdır.
    RETURNABLE_CHARGES_336: '336',
    /// Yıl sonu GRNI tahakkuku (mal geldi, fatura gelmedi) karşı hesabı (329 Diğer Ticari Borçlar).
    /// 320 DEĞİL: 320'ye tedarikçi carisiyle yazılan tahakkuk cari ekstrelerde faturada olmayan bir borç
    /// gösterirdi. YALNIZ yıl sonu tahakkuk ve ters kayıt adımları (`ADJUSTING` fişler) yazar; alış faturası
    /// kabul kümesinde (`PURCHASE_INVOICE_LINE_ACCOUNT_CODES`) YOKTUR — `finans:degismezler` zorlar.
    GRNI_ACCRUAL_329: '329',
    /// Yıl sonu devri hedefleri (öz kaynak): şirket → 570/580, şahıs işletmesi → 500. Yalnız yıl sonu
    /// devir adımı (`EQUITY_CARRYFORWARD`, ertesi yılın 1 Ocak'ı) bu hesaplara kapanış fişi yazar.
    RETAINED_EARNINGS_570: '570',
    RETAINED_LOSSES_580: '580',
    CAPITAL_500: '500',
    VAT_INDUCED_191: '191',
    VAT_CALCULATED_391: '391',
  },
} as const;
