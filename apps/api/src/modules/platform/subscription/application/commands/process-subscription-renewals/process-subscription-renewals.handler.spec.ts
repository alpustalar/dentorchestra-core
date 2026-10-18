import { ProcessSubscriptionRenewalsHandler } from './process-subscription-renewals.handler';
import { Subscription } from '@modules/platform/subscription/domain/entities/subscription.entity';
import { SubscriptionCharge } from '@modules/platform/subscription/domain/entities/subscription-charge.entity';
import { ISubscriptionCommandRepository } from '@modules/platform/subscription/domain/repositories/subscription/subscription.command.repository';
import { ISubscriptionPaymentMethodCommandRepository } from '@modules/platform/subscription/domain/repositories/subscription-payment-method/subscription-payment-method.command.repository';
import { ISubscriptionChargeCommandRepository } from '@modules/platform/subscription/domain/repositories/subscription-charge/subscription-charge.command.repository';
import {
  IBillingAdapter,
  PaymentResult,
} from '@modules/platform/subscription/infrastructure/adapters/billing-adapter.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { CriticalFailurePayload } from '@common/observability/critical-failure.event';
import { SavedCardChargeModel } from '@modules/platform/subscription/domain/contracts';
import { randomUUID } from 'crypto';
import { DateTimeManager } from '@common/utils';
import { Decimal } from 'decimal.js';

/**
 * Yenileme akışının tek işi kayıtlı karttan para çekmek; bu yüzden testlerin
 * çoğu "ne zaman ÇEKMEZ" sorusunu kilitler. Akış **sahiplen → çek → yaz**:
 * tahsilat satırı paradan önce commit edilir, böylece çekim ile sonuç yazımı
 * arasında süreç ölse bile ikinci bir çekim yapılmaz.
 */
describe('ProcessSubscriptionRenewalsHandler', () => {
  const organizationId = randomUUID();

  const savedCard: SavedCardChargeModel = {
    cardUserKey: 'cuk-1',
    cardToken: 'ctk-1',
    buyer: {
      name: 'Ada',
      surname: 'Lovelace',
      email: 'ada@example.com',
      gsmNumber: '+905551112233',
      ip: '85.34.78.112',
      city: 'Istanbul',
      address: null,
    },
  };

  interface BuildOpts {
    due: Subscription[];
    savedCard?: SavedCardChargeModel | null;
    charge?: { amount: Decimal; currency: string } | null;
    chargeResult?: PaymentResult;
    /** `claim` null dönerse dönem başka bir çalıştırma tarafından alınmış. */
    existingCharge?: SubscriptionCharge | null;
  }

  const makeCharge = (
    subscriptionId: string,
    periodStart: Date
  ): SubscriptionCharge =>
    SubscriptionCharge.claim({
      subscriptionId,
      organizationId,
      periodStart,
      periodEnd: DateTimeManager.addMonths(periodStart, 1),
      amount: new Decimal(100),
      currency: 'TRY',
    });

  const build = (opts: BuildOpts) => {
    const order: string[] = [];

    const chargeSavedCard = jest
      .fn<Promise<PaymentResult>, unknown[]>()
      .mockImplementation(() => {
        order.push('charge');
        return Promise.resolve(
          opts.chargeResult ?? { success: true, iyzicoPaymentId: 'pay-1' }
        );
      });

    // Sahiplenilen satır yakalanır: faz 3 onu `findByIdForUpdate` ile okur.
    let claimed: SubscriptionCharge | null = null;

    const claim = jest
      .fn<Promise<SubscriptionCharge | null>, [SubscriptionCharge]>()
      .mockImplementation((c: SubscriptionCharge) => {
        order.push('claim');
        // existingCharge verildiyse tekillik tuttu → claim null döner.
        claimed = opts.existingCharge === undefined ? c : null;
        return Promise.resolve(claimed);
      });

    const chargeUpdate = jest.fn(
      (c: SubscriptionCharge): Promise<SubscriptionCharge> => {
        order.push(`charge:${c.status}`);
        claimed = c;
        return Promise.resolve(c);
      }
    );

    const chargeRepo = {
      claim,
      findByPeriod: jest.fn().mockResolvedValue(opts.existingCharge ?? null),
      findByIdForUpdate: jest.fn(
        (): Promise<SubscriptionCharge | null> => Promise.resolve(claimed)
      ),
      update: chargeUpdate,
      findUnresolved: jest.fn().mockResolvedValue([]),
    } as unknown as ISubscriptionChargeCommandRepository;

    const subscriptionUpdate = jest.fn(
      (s: Subscription): Promise<Subscription> => {
        order.push('subscription:update');
        return Promise.resolve(s);
      }
    );

    const findByIdForUpdate = jest.fn(
      (id: string): Promise<Subscription | null> =>
        Promise.resolve(opts.due.find((s) => s.id.value === id) ?? null)
    );

    const subscriptionCommandRepo = {
      findDueForRenewal: jest.fn().mockResolvedValue(opts.due),
      findByIdForUpdate,
      findRenewalCharge: jest
        .fn()
        .mockResolvedValue(
          opts.charge === undefined
            ? { amount: new Decimal(100), currency: 'TRY' }
            : opts.charge
        ),
      update: subscriptionUpdate,
    } as unknown as ISubscriptionCommandRepository;

    const paymentMethodCommandRepo = {
      findBySubscriptionId: jest
        .fn()
        .mockResolvedValue(
          opts.savedCard === undefined ? savedCard : opts.savedCard
        ),
    } as unknown as ISubscriptionPaymentMethodCommandRepository;

    const billingAdapter = { chargeSavedCard } as unknown as IBillingAdapter;

    const publish = jest.fn<void, [CriticalFailurePayload]>();
    const criticalFailure = { publish } as unknown as CriticalFailurePublisher;

    const outboxRun = jest.fn((cb: () => Promise<unknown>) => {
      order.push('tx');
      return cb();
    });
    const txManager = { outboxRun } as unknown as TransactionManager;

    const handler = new ProcessSubscriptionRenewalsHandler(
      subscriptionCommandRepo,
      paymentMethodCommandRepo,
      chargeRepo,
      billingAdapter,
      criticalFailure,
      txManager
    );
    return {
      handler,
      subscriptionCommandRepo,
      chargeRepo,
      chargeSavedCard,
      publish,
      outboxRun,
      order,
      claim,
      findByIdForUpdate,
      subscriptionUpdate,
    };
  };

  /** Dönemi geçmiş (gerçekten yenileme günü gelmiş) abonelik. */
  const newSub = () => {
    const sub = Subscription.create({
      billingTarget: 'ORGANIZATION',
      organizationId,
    });
    const now = DateTimeManager.create();
    sub.startNewPeriod(
      DateTimeManager.addMonths(now, -2),
      DateTimeManager.addMonths(now, -1)
    );
    return sub;
  };

  it('kayıtlı kart + başarılı tahsilat → ACTIVE (renew) + yeni dönem', async () => {
    const sub = newSub();
    const t = build({ due: [sub] });

    await t.handler.execute();

    expect(t.chargeSavedCard).toHaveBeenCalledTimes(1);
    expect(sub.status).toBe('ACTIVE');
    expect(sub.currentPeriodEnd).toBeInstanceOf(Date);
  });

  it('tahsilat kaydı paradan ÖNCE açılır ve çekim transaction DIŞINDA yapılır', async () => {
    // Sıra bozulursa (önce çek, sonra kaydet) çekim ile commit arasında süreç
    // ölürse para alınmış ama hiç izi olmayan bir tahsilat doğar.
    const sub = newSub();
    const t = build({ due: [sub] });

    await t.handler.execute();

    const claimIdx = t.order.indexOf('claim');
    const chargeIdx = t.order.indexOf('charge');
    expect(claimIdx).toBeGreaterThanOrEqual(0);
    expect(claimIdx).toBeLessThan(chargeIdx);
    // İki ayrı transaction: sahiplenme ve sonuç yazımı.
    expect(t.outboxRun).toHaveBeenCalledTimes(2);
    // Çekim ikisinin ARASINDA: ilk tx kapandıktan sonra, ikincisi açılmadan önce.
    expect(t.order.filter((o) => o === 'tx')).toHaveLength(2);
    expect(t.order.lastIndexOf('tx')).toBeGreaterThan(chargeIdx);
  });

  it('aynı dönem PENDING satır taşıyorsa kart ÇEKİLMEZ ve alarm üretilir', async () => {
    // PENDING = "çekim yapıldı mı bilinmiyor". Yeniden çekmek mükerrer tahsilattır.
    const sub = newSub();
    const existing = makeCharge(sub.id.value, sub.currentPeriodEnd as Date);
    const t = build({ due: [sub], existingCharge: existing });

    await t.handler.execute();

    expect(t.chargeSavedCard).not.toHaveBeenCalled();
    expect(t.publish).toHaveBeenCalledTimes(1);
    expect(t.publish.mock.calls[0][0]).toMatchObject({
      operation: 'subscription.renewal.unresolved-charge',
      severity: 'CRITICAL',
    });
  });

  it('aynı dönem SUCCEEDED satır taşıyorsa para çekmeden dönem ilerletilir', async () => {
    // Faz 3 düşmüş: para çekilmiş, abonelik ilerlememiş. Defter satırı
    // kurtarmanın kaynağıdır — ikinci çekim YAPILMAZ.
    const sub = newSub();
    const existing = makeCharge(sub.id.value, sub.currentPeriodEnd as Date);
    existing.markSucceeded('pay-onceki');
    const t = build({ due: [sub], existingCharge: existing });

    await t.handler.execute();

    expect(t.chargeSavedCard).not.toHaveBeenCalled();
    expect(sub.status).toBe('ACTIVE');
    expect(sub.providerPaymentId).toBe('pay-onceki');
  });

  it('aynı dönem FAILED satır taşıyorsa aynı satır üzerinde yeniden denenir', async () => {
    // Yeni satır açmak dönem başına tekilliği kırar ve mükerrer çekim kapısını
    // yeniden açardı; deneme sayacı aynı satırda artar.
    const sub = newSub();
    const existing = makeCharge(sub.id.value, sub.currentPeriodEnd as Date);
    existing.markFailed('Yetersiz bakiye');
    const t = build({ due: [sub], existingCharge: existing });

    await t.handler.execute();

    expect(existing.attempts).toBe(2);
    expect(t.chargeSavedCard).toHaveBeenCalledTimes(1);
  });

  it('kayıtlı kart yok → tahsilat denenmez, PAST_DUE', async () => {
    const sub = newSub();
    const t = build({ due: [sub], savedCard: null });

    await t.handler.execute();

    expect(t.chargeSavedCard).not.toHaveBeenCalled();
    expect(t.claim).not.toHaveBeenCalled();
    expect(sub.status).toBe('PAST_DUE');
  });

  it('kayıtlı kart var ama tahsilat başarısız → PAST_DUE', async () => {
    const sub = newSub();
    const t = build({
      due: [sub],
      chargeResult: { success: false, errorMessage: 'Yetersiz bakiye' },
    });

    await t.handler.execute();

    expect(t.chargeSavedCard).toHaveBeenCalledTimes(1);
    expect(sub.status).toBe('PAST_DUE');
  });

  it('cancelAtPeriodEnd planlı → CANCELED (tahsilat denenmez)', async () => {
    const sub = newSub();
    sub.scheduleCancellation();
    const t = build({ due: [sub] });

    await t.handler.execute();

    expect(t.chargeSavedCard).not.toHaveBeenCalled();
    expect(t.claim).not.toHaveBeenCalled();
    expect(sub.status).toBe('CANCELED');
  });

  it('dönemi geçmiş abonelik yoksa hiçbir şey yapılmaz', async () => {
    const t = build({ due: [] });
    await t.handler.execute();
    expect(t.subscriptionUpdate).not.toHaveBeenCalled();
  });

  it('tarama ile işleme arasında dönem ilerlediyse kart ÇEKİLMEZ (mükerrer tahsilat)', async () => {
    // Aday listesine girdikten sonra başka bir çalıştırma aboneliği yenilemiş:
    // kilitli okuma artık dönemi ileride olan hâli döner.
    const stale = newSub();
    const t = build({ due: [stale] });

    const now = DateTimeManager.create();
    const renewed = Subscription.create({
      id: stale.id.value,
      billingTarget: 'ORGANIZATION',
      organizationId,
    });
    renewed.startNewPeriod(now, DateTimeManager.addMonths(now, 1));
    t.findByIdForUpdate.mockResolvedValue(renewed);

    await t.handler.execute();

    expect(t.chargeSavedCard).not.toHaveBeenCalled();
    expect(t.claim).not.toHaveBeenCalled();
  });
});
