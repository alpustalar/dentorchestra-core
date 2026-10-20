import { PURCHASE_INVOICE_LINE_ACCOUNT_CODES } from '@shared/common/constants';
/* eslint-disable @typescript-eslint/no-require-imports */
// Betikler saf Node (.cjs): tip bildirimi yok, çağrı yerinde tiplenir.
const { loadPurchaseInvoiceAccountCodes } =
  require('../../../../../../scripts/lib/purchase-invoice-account-codes.cjs') as {
    loadPurchaseInvoiceAccountCodes: () => string[];
  };
const { CHECKS } =
  require('../../../../../../scripts/finance-invariants.cjs') as {
    CHECKS: { key: string; title: string; why: string; sql: string }[];
  };

/**
 * `pnpm finans:degismezler` saf Node (.cjs) olduğu için TS sabitini import edemez; alış faturası
 * karşı hesap kümesini kaynak dosyadan metin olarak okur. Okuyucu kaynağı yanlış ayrıştırırsa tarama
 * SESSİZCE yanlış soruyu sorardı ("kabul kümesi dışı" = her şey ya da hiçbir şey). Bu test iki
 * tarafın aynı kümeyi gördüğünü kilitler (CLAUDE.md finans kuralı 12: kopya liste yazılmaz).
 */
describe('finans:degismezler ↔ alış faturası hesap kümesi', () => {
  it('betiğin okuduğu küme sabitin kendisiyle aynıdır (sıra dahil)', () => {
    expect(loadPurchaseInvoiceAccountCodes()).toEqual([
      ...PURCHASE_INVOICE_LINE_ACCOUNT_CODES,
    ]);
  });

  it('kümeyi kullanan kontrolün SQL’i her kodu içerir', () => {
    const check = CHECKS.find(
      (c) => c.key === 'alis-faturasi-hesap-kumesi-disi'
    );

    expect(check).toBeDefined();
    for (const code of PURCHASE_INVOICE_LINE_ACCOUNT_CODES) {
      expect(check!.sql).toContain(`'${code}'`);
    }
    // 329 ve banka kümede değil → SQL’de "izinli" olarak görünmez.
    expect(check!.sql).not.toContain("'329'");
    expect(check!.sql).not.toContain("'102'");
  });
});

describe('finans:degismezler — kontrol listesi bütünlüğü', () => {
  const checks = CHECKS as {
    key: string;
    title: string;
    why: string;
    sql: string;
  }[];

  it('anahtarlar benzersizdir ve her kontrol başlık + gerekçe + sorgu taşır', () => {
    expect(new Set(checks.map((c) => c.key)).size).toBe(checks.length);
    for (const check of checks) {
      expect(check.title.length).toBeGreaterThan(0);
      expect(check.why.length).toBeGreaterThan(20);
      expect(check.sql).toMatch(/SELECT/i);
    }
  });

  it('yıl sonu kapanışı / GRNI kontrollerinin yedisi de listede', () => {
    const keys = checks.map((c) => c.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'grni-329-yalniz-duzeltme-fisi',
        'grni-329-bakiye',
        'kapanmis-yil-sonuc-bakiyeli',
        'kapanis-sirasi',
        'mal-kabul-gunlugu-sayac',
        'mal-kabul-gunlugu-satirsiz',
        'alis-faturasi-hesap-kumesi-disi',
      ])
    );
  });
});
