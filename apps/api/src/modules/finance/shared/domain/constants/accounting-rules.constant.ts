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
    /// Müşteriye iade edilecek tahsilat (336 Diğer Çeşitli Borçlar): çift çekim ve başarısız
    /// rezervasyonun parası. Gelir DEĞİL — iade doğrulanana kadar müşteriye borçtur. v1'de 336
    /// YALNIZ bu akışa ayrıdır (127 gibi); ikinci bir kullanım doğarsa alt hesap bir şablon kararıdır.
    RETURNABLE_CHARGES_336: '336',
    VAT_INDUCED_191: '191',
    VAT_CALCULATED_391: '391',
  },
} as const;
