/**
 * Alış faturası karşı hesap kümesini TEK KAYNAKTAN okur:
 * `packages/shared/common/constants/purchase-invoice-account.constant.ts`.
 *
 * Tarama betiği saf Node (.cjs) olduğu için TS sabitini import edemez. Kümeyi betiğe kopyalamak
 * (CLAUDE.md finans kuralı 12 — kopya liste yazılmaz) kaynak değiştiğinde taramanın sessizce
 * YANLIŞ soru sormasına yol açardı; bu yüzden kaynak dosya metin olarak okunur. Eşleşmeyi bir
 * jest testi zorlar (`finance-invariants.script.spec.ts`).
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'shared',
  'common',
  'constants',
  'purchase-invoice-account.constant.ts'
);

function loadPurchaseInvoiceAccountCodes() {
  const text = fs.readFileSync(SOURCE, 'utf8');
  const match = text.match(
    /PURCHASE_INVOICE_LINE_ACCOUNT_CODES\s*=\s*\[([\s\S]*?)\]\s*as const/
  );
  if (!match) {
    throw new Error(
      'PURCHASE_INVOICE_LINE_ACCOUNT_CODES kaynakta bulunamadı: ' + SOURCE
    );
  }

  // Yalnız tırnaklı hesap kodları ('150', '740.01'); yorum satırları sayılmaz.
  const codes = [...match[1].matchAll(/'(\d+(?:\.\d+)?)'/g)].map((m) => m[1]);
  if (codes.length === 0) {
    throw new Error('PURCHASE_INVOICE_LINE_ACCOUNT_CODES boş okundu.');
  }
  return codes;
}

module.exports = { loadPurchaseInvoiceAccountCodes };
