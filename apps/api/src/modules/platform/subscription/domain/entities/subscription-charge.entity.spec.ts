import { SubscriptionCharge } from './subscription-charge.entity';
import { SubscriptionChargeNotPendingException } from '@modules/platform/subscription/domain/exceptions/subscription.exceptions';
import { DateTimeManager } from '@common/utils';
import { Money } from '@src/domain/value-objects/money.vo';
import { Decimal } from 'decimal.js';
import { randomUUID } from 'crypto';

/**
 * Tahsilat satırının durum makinesi para hareketinin **sırasını** kodlar:
 * satır `PENDING` olarak çekimden önce açılır, sonucu bir kez yazılır. Bu
 * sıra bozulursa (önce çek, sonra kaydet) çekim ile commit arasında süreç
 * ölürse para alınmış ama hiç izi olmayan bir tahsilat doğar — eski akışta
 * tam olarak bu oluyordu ve bir sonraki zamanlanmış çalıştırma kartı ikinci
 * kez çekiyordu.
 */
describe('SubscriptionCharge — tahsilat defteri durum makinesi', () => {
  const subscriptionId = randomUUID();
  const organizationId = randomUUID();
  const periodStart = DateTimeManager.create();

  const claim = (amount = '100.00') =>
    SubscriptionCharge.claim({
      subscriptionId,
      organizationId,
      periodStart,
      periodEnd: DateTimeManager.addMonths(periodStart, 1),
      amount: new Decimal(amount),
      currency: 'TRY',
    });

  it('satır PENDING doğar — kayıt paradan önce gelir', () => {
    const charge = claim();

    expect(charge.isPending).toBe(true);
    expect(charge.providerPaymentId).toBeNull();
    expect(charge.chargedAt).toBeNull();
    expect(charge.attempts).toBe(1);
  });

  it('başarı sağlayıcı kimliğini ve çekim anını damgalar', () => {
    const charge = claim();

    charge.markSucceeded('pay-1');

    expect(charge.isSucceeded).toBe(true);
    expect(charge.providerPaymentId).toBe('pay-1');
    expect(charge.chargedAt).toBeInstanceOf(Date);
  });

  it('aynı satıra ikinci sonuç yazılamaz', () => {
    // Mükerrer bir para kaydı üretme girişimi sessizce geçilmez.
    const charge = claim();
    charge.markSucceeded('pay-1');

    expect(() => charge.markSucceeded('pay-2')).toThrow(
      SubscriptionChargeNotPendingException
    );
    expect(() => charge.markFailed('neden')).toThrow(
      SubscriptionChargeNotPendingException
    );
    expect(charge.providerPaymentId).toBe('pay-1');
  });

  it('başarısız satır AYNI satır üzerinde yeniden denenir, sayaç artar', () => {
    // Yeni satır açmak dönem başına tekillik kısıtını kırar ve mükerrer çekim
    // kapısını yeniden açardı.
    const charge = claim();
    charge.markFailed('Yetersiz bakiye');

    charge.retry(Money.create(new Decimal('120.00'), 'TRY').orThrow());

    expect(charge.isPending).toBe(true);
    expect(charge.attempts).toBe(2);
    expect(charge.failureReason).toBeNull();
    // Tutar yeniden okunur: iki deneme arasında modül eklenmiş olabilir.
    expect(charge.amount.value.toString()).toBe('120');
  });

  it('PENDING satır yeniden denenemez — çekim yapıldı mı bilinmiyor', () => {
    const charge = claim();

    expect(() =>
      charge.retry(Money.create(new Decimal('100.00'), 'TRY').orThrow())
    ).toThrow(SubscriptionChargeNotPendingException);
  });

  it('sağlayıcının çektiği tutar farklıysa fark görünür olur', () => {
    // iyzico'da taksitli ödemede paidPrice > price olabilir; fark bastırılmaz.
    const charge = claim('100.00');

    charge.markSucceeded('pay-1', '118.50');

    expect(charge.paidAmount?.value.toString()).toBe('118.5');
    expect(charge.hasAmountMismatch()).toBe(true);
  });

  it('tutarlar eşitse fark raporlanmaz', () => {
    const charge = claim('100.00');

    charge.markSucceeded('pay-1', '100.00');

    expect(charge.hasAmountMismatch()).toBe(false);
  });

  it('sağlayıcı tutar bildirmezse fark iddia edilmez', () => {
    // Kayıtlı kartla yenilemede sağlayıcıya installments:1 + paidPrice=price
    // gönderiliyor; karşılaştıracak bir şey yok. Yokluğu "fark var" saymak
    // her yenilemede yanlış alarm üretirdi.
    const charge = claim('100.00');

    charge.markSucceeded('pay-1');

    expect(charge.paidAmount).toBeNull();
    expect(charge.hasAmountMismatch()).toBe(false);
  });

  it('recordCompleted zaten gerçekleşmiş tahsilatı SUCCEEDED yazar', () => {
    // Checkout yolunda para biz haberdar olmadan önce çekilir: satır bir
    // kayıttır, rezervasyon değil.
    const charge = SubscriptionCharge.recordCompleted({
      subscriptionId,
      organizationId,
      periodStart,
      periodEnd: DateTimeManager.addMonths(periodStart, 1),
      amount: new Decimal('100.00'),
      currency: 'TRY',
      conversationId: 'conv-1',
      providerPaymentId: 'pay-1',
    });

    expect(charge.isSucceeded).toBe(true);
    expect(charge.conversationId).toBe('conv-1');
    expect(charge.providerPaymentId).toBe('pay-1');
  });

  it('persistence üzerinden hiçbir alan düşmez', () => {
    // Para/iz taşıyan kolonların mapping kilidi (CLAUDE.md kural 9).
    const charge = claim('250.75');
    charge.markSucceeded('pay-9', '250.75');

    const rehydrated = new SubscriptionCharge(charge.toPersistence());

    expect(rehydrated.amount.value.toString()).toBe('250.75');
    expect(rehydrated.paidAmount?.value.toString()).toBe('250.75');
    expect(rehydrated.providerPaymentId).toBe('pay-9');
    expect(rehydrated.status).toBe('SUCCEEDED');
    expect(rehydrated.attempts).toBe(1);
    expect(rehydrated.periodStart).toEqual(charge.periodStart);
    expect(rehydrated.chargedAt).toEqual(charge.chargedAt);
  });
});
