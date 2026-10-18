import { HandleSubscriptionCallbackHandler } from './handle-subscription-callback.handler';
import { HandleSubscriptionCallbackCommand } from './handle-subscription-callback.command';
import { Subscription } from '@modules/platform/subscription/domain/entities/subscription.entity';
import { ISubscriptionCommandRepository } from '@modules/platform/subscription/domain/repositories/subscription/subscription.command.repository';
import { ISubscriptionPaymentMethodCommandRepository } from '@modules/platform/subscription/domain/repositories/subscription-payment-method/subscription-payment-method.command.repository';
import {
  CapturedSavedCard,
  IBillingAdapter,
  PaymentResult,
} from '@modules/platform/subscription/infrastructure/adapters/billing-adapter.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { ISubscriptionChargeCommandRepository } from '@modules/platform/subscription/domain/repositories/subscription-charge/subscription-charge.command.repository';
import { Decimal } from 'decimal.js';
import { randomUUID } from 'crypto';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { CriticalFailurePayload } from '@common/observability/critical-failure.event';
import { IyzicoCallbackRejectedException } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/rules/iyzico-callback-rejected.exception';

describe('HandleSubscriptionCallbackHandler', () => {
  const organizationId = randomUUID();

  const capturedCard: CapturedSavedCard = {
    cardUserKey: 'cuk-1',
    cardToken: 'ctk-1',
    maskedNumber: '552608******0006',
    cardAssociation: 'MASTER_CARD',
    cardFamily: 'Bonus',
    buyer: {
      id: organizationId,
      name: 'Ada',
      surname: 'Lovelace',
      email: 'ada@example.com',
      gsmNumber: '+905551112233',
      ip: '85.34.78.112',
      city: 'Istanbul',
      address: 'Kadikoy',
    },
  };

  const build = (result: PaymentResult) => {
    const subscription = Subscription.create({
      billingTarget: 'ORGANIZATION',
      organizationId,
      externalId: 'conv-1',
    });

    // Okuma kilitli ve transaction içinde: iyzico callback + webhook aynı anda gelirse
    // dönem iki kez başlatılmamalı.
    const update = jest.fn((s: Subscription) => Promise.resolve(s));
    const subscriptionCommandRepo = {
      findByExternalIdForUpdate: jest.fn().mockResolvedValue(subscription),
      // Tahsil edilen tutar aboneliğin aktif kalemlerinin toplamıdır; tahsilat
      // defterine yazılacak tutar buradan okunur.
      findRenewalCharge: jest
        .fn()
        .mockResolvedValue({ amount: new Decimal(100), currency: 'TRY' }),
      update,
    } as unknown as ISubscriptionCommandRepository;

    const claimCharge = jest.fn((c: unknown) => Promise.resolve(c));
    const subscriptionChargeRepo = {
      claim: claimCharge,
      findByPeriod: jest.fn().mockResolvedValue(null),
      findByIdForUpdate: jest.fn().mockResolvedValue(null),
      update: jest.fn((c: unknown) => Promise.resolve(c)),
      findUnresolved: jest.fn().mockResolvedValue([]),
    } as unknown as ISubscriptionChargeCommandRepository;

    const upsertBySubscriptionId = jest.fn();
    const paymentMethodCommandRepo = {
      upsertBySubscriptionId,
    } as unknown as ISubscriptionPaymentMethodCommandRepository;

    const billingAdapter = {
      handlePaymentResult: jest.fn().mockResolvedValue(result),
    } as unknown as IBillingAdapter;

    const txManager = {
      outboxRun: jest.fn((cb: () => Promise<unknown>) => cb()),
    } as unknown as TransactionManager;

    const publish = jest.fn<void, [CriticalFailurePayload]>();
    const criticalFailure = {
      publish,
    } as unknown as CriticalFailurePublisher;

    const handler = new HandleSubscriptionCallbackHandler(
      subscriptionCommandRepo,
      paymentMethodCommandRepo,
      subscriptionChargeRepo,
      billingAdapter,
      criticalFailure,
      txManager
    );
    return {
      handler,
      subscription,
      subscriptionCommandRepo,
      upsertBySubscriptionId,
      claimCharge,
      publish,
      update,
    };
  };

  const command = new HandleSubscriptionCallbackCommand('token-1', 'conv-1');

  it('başarılı ödeme + kayıtlı kart → ACTIVE + ilk dönem + kayıtlı kart persist', async () => {
    const t = build({
      success: true,
      iyzicoPaymentId: 'pay-1',
      // Sağlayıcı yankısı: bildirimin bu aboneliğe ait olduğunun kanıtı.
      conversationId: 'conv-1',
      savedCard: capturedCard,
    });

    await t.handler.execute(command);

    expect(t.subscription.status).toBe('ACTIVE');
    expect(t.subscription.currentPeriodEnd).toBeInstanceOf(Date);
    expect(t.subscription.providerPaymentId).toBe('pay-1');
    // Korelasyon anahtarı KORUNUR: sağlayıcının ikinci bildirimi (iyzico aynı
    // ödeme için callback + webhook gönderiyor) aboneliği hâlâ bulabilmeli.
    expect(t.subscription.externalId).toBe('conv-1');
    // Tahsilat deftere yazılır — tek iz audit log satırı olmamalı.
    expect(t.claimCharge).toHaveBeenCalledTimes(1);
    expect(t.upsertBySubscriptionId).toHaveBeenCalledTimes(1);
    expect(t.upsertBySubscriptionId).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: t.subscription.id.value,
        cardUserKey: 'cuk-1',
        cardToken: 'ctk-1',
        buyerEmail: 'ada@example.com',
        buyerIp: '85.34.78.112',
      })
    );
  });

  it('başarılı ödeme ama kart saklanmadı → dönem açılır, kart persist edilmez', async () => {
    const t = build({
      success: true,
      iyzicoPaymentId: 'pay-1',
      conversationId: 'conv-1',
    });

    await t.handler.execute(command);

    expect(t.subscription.status).toBe('ACTIVE');
    expect(t.subscription.currentPeriodEnd).toBeInstanceOf(Date);
    expect(t.upsertBySubscriptionId).not.toHaveBeenCalled();
  });

  it('başarısız ödeme → PAST_DUE, kart persist edilmez, dönem açılmaz', async () => {
    const t = build({
      success: false,
      errorMessage: 'Kart reddedildi',
      conversationId: 'conv-1',
    });

    await t.handler.execute(command);

    expect(t.subscription.status).toBe('PAST_DUE');
    expect(t.subscription.currentPeriodEnd).toBeNull();
    expect(t.upsertBySubscriptionId).not.toHaveBeenCalled();
  });
  it('yinelenen bildirim dönemi İKİNCİ KEZ başlatmaz ama kartı yine kaydeder', async () => {
    // iyzico aynı ödeme için callback + webhook gönderiyor. Eskiden ikinci
    // bildirim aboneliği HİÇ bulamıyordu (korelasyon anahtarı ödeme kimliğiyle
    // ezildiği için) → 404 + o bildirimde gelen kayıtlı kart kaybı → sonraki
    // yenileme kartsız (PAST_DUE). Artık bulunuyor ve idempotent işleniyor.
    const t = build({
      success: true,
      iyzicoPaymentId: 'pay-1',
      // Sağlayıcı yankısı: bildirimin bu aboneliğe ait olduğunun kanıtı.
      conversationId: 'conv-1',
      savedCard: capturedCard,
    });

    await t.handler.execute(command);
    const periodEndAfterFirst = t.subscription.currentPeriodEnd;

    await t.handler.execute(command);

    // Dönem yeniden başlatılmadı.
    expect(t.subscription.currentPeriodEnd).toEqual(periodEndAfterFirst);
    // Tahsilat defterine ikinci satır yazılmadı.
    expect(t.claimCharge).toHaveBeenCalledTimes(1);
    // Kart ise her bildirimde yazılır (upsert): kartı taşıyan bildirim
    // ikincisi olabilir ve yutulursa otomatik tahsilat imkânsız kalır.
    expect(t.upsertBySubscriptionId).toHaveBeenCalledTimes(2);
  });

  describe('bildirim ↔ abonelik bağı', () => {
    it('başka bir ödemenin yankısı geldiğinde abonelik aktive EDİLMEZ', async () => {
      // Uç @Public: `conversationId` gövdeden, sonuç `token` ile sağlayıcıdan
      // geliyor. Bağlanmazsa başka bir ödemenin geçerli token'ı ödenmemiş bir
      // aboneliği aktive etmeye yeter.
      const t = build({
        success: true,
        iyzicoPaymentId: 'pay-1',
        conversationId: 'baska-bir-odeme',
      });

      await expect(t.handler.execute(command)).rejects.toThrow(
        IyzicoCallbackRejectedException
      );

      // Fatura dönemi başlatılmadı ve hiçbir şey yazılmadı: ödeme bu aboneliğe
      // ait olmadığı için abonelik ilerlemez.
      expect(t.subscription.currentPeriodEnd).toBeNull();
      expect(t.subscription.providerPaymentId).toBeNull();
      expect(t.update).not.toHaveBeenCalled();
      expect(t.publish).toHaveBeenCalledTimes(1);
      expect(t.publish.mock.calls[0][0].errorMessage).toBe(
        'CONVERSATION_MISMATCH'
      );
    });

    it('yankı HİÇ gelmezse fail-closed: kanıtsız bildirim kabul edilmez', async () => {
      // Abonelikte yerel token kanıtı yok (token saklanmıyor) → tek kanıt
      // sağlayıcının yankısı. Yokken kabul etmek, kontrolün hiç olmamasıyla
      // aynı şey olurdu.
      const t = build({ success: true, iyzicoPaymentId: 'pay-1' });

      await expect(t.handler.execute(command)).rejects.toThrow(
        IyzicoCallbackRejectedException
      );
      expect(t.publish.mock.calls[0][0].errorMessage).toBe(
        'NO_BINDING_EVIDENCE'
      );
    });

    it('başarısız ödeme bildirimi de bağ kontrolünden geçer', async () => {
      // Aksi halde saldırgan, başka bir ödemenin başarısız token'ıyla bir
      // aboneliği PAST_DUE'ya düşürebilirdi (hizmet kesintisi).
      const t = build({
        success: false,
        errorMessage: 'Kart reddedildi',
        conversationId: 'baska-bir-odeme',
      });

      await expect(t.handler.execute(command)).rejects.toThrow(
        IyzicoCallbackRejectedException
      );
      expect(t.update).not.toHaveBeenCalled();
    });
  });
});
