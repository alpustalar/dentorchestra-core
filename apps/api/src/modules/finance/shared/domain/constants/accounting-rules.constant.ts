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
    VAT_INDUCED_191: '191',
    VAT_CALCULATED_391: '391',
  },
} as const;
