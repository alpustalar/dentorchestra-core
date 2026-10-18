import {
  FUNDS_ACCOUNT_BY_PAYMENT_METHOD,
  INBOUND_PAYMENT_METHODS,
  OUTBOUND_PAYMENT_METHODS,
  resolvePaymentFundsAccount,
} from './payment-method-ledger.constant';

/**
 * Yöntem → hazır değer hesabı eşlemesi. Asıl koruma, **varsayılan hesabın
 * olmaması**: eski kural tanımadığı her yöntemi sessizce 102 Bankalar'a
 * yazıyordu ve fiş dengeli olduğu için hata hiçbir kontrole yakalanmıyordu.
 */
describe('resolvePaymentFundsAccount', () => {
  it('tahsilat: nakit → 100, havale → 102, kart → 108', () => {
    expect(resolvePaymentFundsAccount('CASH', 'INBOUND')).toBe('100');
    expect(resolvePaymentFundsAccount('BANK_TRANSFER', 'INBOUND')).toBe('102');
    expect(resolvePaymentFundsAccount('POS_CARD', 'INBOUND')).toBe('108');
  });

  it('ödeme: nakit → 100, havale → 102', () => {
    expect(resolvePaymentFundsAccount('CASH', 'OUTBOUND')).toBe('100');
    expect(resolvePaymentFundsAccount('BANK_TRANSFER', 'OUTBOUND')).toBe('102');
  });

  it('ödemede KART kabul edilmez (108 bizim kart ALACAĞIMIZDIR)', () => {
    expect(resolvePaymentFundsAccount('POS_CARD', 'OUTBOUND')).toBeNull();
  });

  it('eşlemesi olmayan yöntem varsayılan hesaba DÜŞMEZ', () => {
    expect(resolvePaymentFundsAccount('CHECK', 'INBOUND')).toBeNull();
    expect(resolvePaymentFundsAccount('', 'INBOUND')).toBeNull();
    expect(resolvePaymentFundsAccount('cash', 'INBOUND')).toBeNull();
  });

  it('her kabul edilen yöntemin bir hesabı var (küme ↔ eşleme tutarlı)', () => {
    for (const method of INBOUND_PAYMENT_METHODS) {
      expect(FUNDS_ACCOUNT_BY_PAYMENT_METHOD[method]).toBeTruthy();
    }
    for (const method of OUTBOUND_PAYMENT_METHODS) {
      expect(FUNDS_ACCOUNT_BY_PAYMENT_METHOD[method]).toBeTruthy();
    }
  });

  it('çıkış kümesi giriş kümesinin alt kümesidir', () => {
    for (const method of OUTBOUND_PAYMENT_METHODS) {
      expect(INBOUND_PAYMENT_METHODS).toContain(method);
    }
  });
});
