import { IyzicoTransaction } from './iyzico-transaction.entity';

/**
 * Sanal POS işleminin sakladığı sağlayıcı yanıtı, bir dönem **non-3DS çekim
 * yapmaya yeten** kart saklama token'larını (`cardToken` + `cardUserKey`) ham
 * olarak taşıyordu — hem DB'de hem (yönetim/admin grubuna) HTTP yanıtında.
 *
 * Bu suite maskelemenin **yazma sınırında** durduğunu kilitler: DTO'da süzmek
 * tek bir okuyucuyu korurdu, burada maskelemek her okuyucuyu korur.
 */
describe('IyzicoTransaction — sağlayıcı ham yanıtı maskelenir', () => {
  const props = {
    installmentId: '11111111-1111-4111-8111-111111111111',
    conversationId: '22222222-2222-4222-8222-222222222222',
    token: 'token-abc',
  };

  /** iyzico checkout retrieve yanıtının gerçek şekli (kısaltılmış). */
  const checkoutResult = {
    status: 'success',
    paymentStatus: 'SUCCESS',
    token: 'token-abc',
    price: '100.00',
    paidPrice: '100.00',
    cardUserKey: 'cuk-live',
    cardToken: 'ctk-live',
    paymentCard: {
      cardToken: 'ctk-live',
      cardUserKey: 'cuk-live',
      binNumber: '552608',
      lastFourDigits: '0006',
      cardAssociation: 'MASTER_CARD',
    },
    buyer: { email: 'ada@example.com', gsmNumber: '+905551112233' },
  };

  const raw = (tx: IyzicoTransaction) =>
    tx.rawResponse as unknown as Record<string, unknown>;

  it('başarılı geçiş: kart token’ları maskelenir', () => {
    const tx = IyzicoTransaction.create(props);
    tx.markAsSuccess({
      iyzicoPaymentId: 'pay-1',
      iyzicoPaymentTransactionId: 'txi-1',
      rawResponse: checkoutResult,
    });

    expect(raw(tx).cardToken).toBe('[REDACTED]');
    expect(raw(tx).cardUserKey).toBe('[REDACTED]');
    expect(raw(tx).token).toBe('[REDACTED]');
    const card = raw(tx).paymentCard as Record<string, unknown>;
    expect(card.cardToken).toBe('[REDACTED]');
    expect(card.cardUserKey).toBe('[REDACTED]');
  });

  it('tanı değeri KORUNUR: durum, tutar, maskeli kart bilgisi', () => {
    // Her şeyi maskelemek blob'u işe yaramaz yapar; blob sağlayıcı
    // itirazlarında tek adli izdir.
    const tx = IyzicoTransaction.create(props);
    tx.markAsSuccess({
      iyzicoPaymentId: 'pay-1',
      iyzicoPaymentTransactionId: 'txi-1',
      rawResponse: checkoutResult,
    });

    expect(raw(tx).paymentStatus).toBe('SUCCESS');
    expect(raw(tx).paidPrice).toBe('100.00');
    const card = raw(tx).paymentCard as Record<string, unknown>;
    expect(card.lastFourDigits).toBe('0006');
    expect(card.binNumber).toBe('552608');
  });

  it('başarısız ve iade geçişleri de aynı kapıdan geçer', () => {
    const failed = IyzicoTransaction.create(props);
    failed.markAsFailed({
      errorCode: '5007',
      errorMessage: 'Yetersiz bakiye',
      rawResponse: checkoutResult,
    });
    expect(raw(failed).cardToken).toBe('[REDACTED]');

    const refunded = IyzicoTransaction.create(props);
    refunded.markAsSuccess({
      iyzicoPaymentId: 'pay-1',
      iyzicoPaymentTransactionId: 'txi-1',
      rawResponse: { status: 'success' },
    });
    refunded.markAsRefunded({ rawResponse: checkoutResult });
    expect(raw(refunded).cardToken).toBe('[REDACTED]');
  });

  it('kaydın KENDİ token kolonu maskelenmez (callback bağı ona bakıyor)', () => {
    // `raw_response` içindeki `token` maskelenir ama `token` kolonu, §73'teki
    // bağ kontrolünün yerel kanıtıdır — maskelenirse o kontrol çalışmaz.
    const tx = IyzicoTransaction.create(props);
    tx.markAsSuccess({
      iyzicoPaymentId: 'pay-1',
      iyzicoPaymentTransactionId: 'txi-1',
      rawResponse: checkoutResult,
    });

    expect(tx.token).toBe('token-abc');
    expect(tx.toPersistence().token).toBe('token-abc');
  });

  it('girdi nesnesi mutasyona uğramaz (kart token’ları ayrıca okunuyor)', () => {
    // `extractSavedCard` aynı nesneden token'ları çıkarıyor; maskeleme kopya
    // üretmezse kayıtlı kart saklanamaz hâle gelirdi.
    const tx = IyzicoTransaction.create(props);
    tx.markAsSuccess({
      iyzicoPaymentId: 'pay-1',
      iyzicoPaymentTransactionId: 'txi-1',
      rawResponse: checkoutResult,
    });

    expect(checkoutResult.cardToken).toBe('ctk-live');
    expect(checkoutResult.paymentCard.cardUserKey).toBe('cuk-live');
  });
});
