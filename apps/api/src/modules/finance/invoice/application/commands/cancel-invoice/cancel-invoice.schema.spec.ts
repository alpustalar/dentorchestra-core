import { CancelInvoiceSchema } from '@shared/modules/invoice/schemas/commands';
import { CancelPurchaseInvoiceSchema } from '@shared/modules/purchase-invoice/schemas/commands';

/**
 * İptal gerekçesi kapıda zorlanır: iptal defterde storno üreten yüksek etkili bir
 * işlemdir ve kalıcı damgasının gerekçesi "neden" sorusunu yanıtlamak zorunda
 * (CLAUDE.md finans kuralı 7). Boş/tek harflik gerekçe denetimde işe yaramaz.
 */
describe('Cancel (satış/alış faturası) şemaları', () => {
  it.each([
    ['CancelInvoiceSchema', CancelInvoiceSchema],
    ['CancelPurchaseInvoiceSchema', CancelPurchaseInvoiceSchema],
  ])('%s: anlamlı gerekçe kabul edilir', (_name, schema) => {
    const parsed = schema.parse({ reason: 'Tutar hatalı girildi' });
    expect(parsed.reason).toBe('Tutar hatalı girildi');
  });

  it.each([
    ['CancelInvoiceSchema', CancelInvoiceSchema],
    ['CancelPurchaseInvoiceSchema', CancelPurchaseInvoiceSchema],
  ])('%s: gerekçe zorunlu', (_name, schema) => {
    expect(schema.safeParse({}).success).toBe(false);
  });

  it.each([
    ['CancelInvoiceSchema', CancelInvoiceSchema],
    ['CancelPurchaseInvoiceSchema', CancelPurchaseInvoiceSchema],
  ])('%s: kısa gerekçe reddedilir', (_name, schema) => {
    expect(schema.safeParse({ reason: 'yok' }).success).toBe(false);
  });

  it.each([
    ['CancelInvoiceSchema', CancelInvoiceSchema],
    ['CancelPurchaseInvoiceSchema', CancelPurchaseInvoiceSchema],
  ])('%s: yalnız boşluktan oluşan gerekçe reddedilir', (_name, schema) => {
    expect(schema.safeParse({ reason: '          ' }).success).toBe(false);
  });

  it.each([
    ['CancelInvoiceSchema', CancelInvoiceSchema],
    ['CancelPurchaseInvoiceSchema', CancelPurchaseInvoiceSchema],
  ])('%s: aşırı uzun gerekçe reddedilir', (_name, schema) => {
    expect(schema.safeParse({ reason: 'a'.repeat(1001) }).success).toBe(false);
  });
});
