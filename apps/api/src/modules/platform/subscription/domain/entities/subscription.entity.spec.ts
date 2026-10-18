import { Subscription } from './subscription.entity';
import { SubscriptionActivatedEvent } from '@modules/platform/subscription/domain/events';
import {
  LogAction,
  LogSource,
  LogType,
} from '@src/domain/constants/log-action.constant';
import { randomUUID } from 'crypto';
import { DefaultValidateOptions } from '@common/domain/constants/default-options.constant';

describe('Subscription entity — polimorfik sahip + yaşam döngüsü', () => {
  const organizationId = randomUUID();
  const clinicId = randomUUID();

  it('ORGANIZATION hedef: clinicId null, org sahibi', () => {
    const sub = Subscription.create({
      billingTarget: 'ORGANIZATION',
      organizationId,
    });
    expect(sub.billingTarget).toBe('ORGANIZATION');
    expect(sub.organizationId.value).toBe(organizationId);
    expect(sub.clinicId).toBeNull();
    expect(sub.toPersistence().clinicId).toBeNull();
  });

  it('CLINIC hedef: clinicId zorunlu ve taşınır', () => {
    const sub = Subscription.create({
      billingTarget: 'CLINIC',
      organizationId,
      clinicId,
    });
    expect(sub.billingTarget).toBe('CLINIC');
    expect(sub.clinicId?.value).toBe(clinicId);
  });

  it('CLINIC hedefte clinicId yoksa hata', () => {
    expect(() =>
      Subscription.create({ billingTarget: 'CLINIC', organizationId })
    ).toThrow(/clinicId/i);
  });

  it('scheduleCancellation → cancelAtPeriodEnd true; undoCancellation geri alır', () => {
    const sub = Subscription.create({
      billingTarget: 'ORGANIZATION',
      organizationId,
    });
    sub.scheduleCancellation();
    expect(sub.cancelAtPeriodEnd).toBe(true);
    sub.undoCancellation();
    expect(sub.cancelAtPeriodEnd).toBe(false);
  });

  it('cancel → CANCELED; ikinci iptali kural sınıfı durdurur', () => {
    const sub = Subscription.create({
      billingTarget: 'ORGANIZATION',
      organizationId,
    });

    sub.rules(DefaultValidateOptions).cancel().orThrow();
    sub.cancel();
    expect(sub.status).toBe('CANCELED');

    // Guard artık entity'de değil `SubscriptionRules`'ta: aynı kural hem yazma
    // tarafında hem entity kurmadan sorgu tarafında işletilebilsin diye.
    expect(() =>
      sub.rules(DefaultValidateOptions).cancel().orThrow()
    ).toThrow();
  });

  it('systemOverride bağlamında ikinci iptal kurala takılmaz', () => {
    const sub = Subscription.create({
      billingTarget: 'ORGANIZATION',
      organizationId,
    });
    sub.cancel();

    // Sistem/bakım akışları iş kurallarını atlar (`shouldValidate` false döner);
    // bu davranışın kazara kaybolmadığını sabitler.
    expect(
      sub.rules({ ...DefaultValidateOptions, systemOverride: true }).cancel()
        .isValid
    ).toBe(true);
  });

  it('confirmPayment → ACTIVE + providerPaymentId + SubscriptionActivatedEvent', () => {
    const sub = Subscription.create({
      billingTarget: 'ORGANIZATION',
      organizationId,
    });
    sub.failPayment({
      action: LogAction.SUBSCRIPTION_PAYMENT_FAILED,
      type: LogType.WARNING,
      source: LogSource.SYSTEM,
    });
    expect(sub.status).toBe('PAST_DUE');

    sub.confirmPayment('iyz-pay-1', {
      action: LogAction.SUBSCRIPTION_ACTIVATED,
      type: LogType.INFO,
      source: LogSource.SYSTEM,
    });
    expect(sub.status).toBe('ACTIVE');
    // Ödeme kimliği KENDİ kolonuna yazılır; `externalId` callback'in korelasyon
    // anahtarıdır (conversationId) ve ezilirse sağlayıcının ikinci bildirimi
    // aboneliği bulamaz.
    expect(sub.providerPaymentId).toBe('iyz-pay-1');
    expect(sub.externalId).toBeNull();
    const events = sub.getDomainEvents();
    expect(events.some((e) => e instanceof SubscriptionActivatedEvent)).toBe(
      true
    );
  });

  it('startNewPeriod → yeni dönem + ACTIVE; expire → EXPIRED', () => {
    const sub = Subscription.create({
      billingTarget: 'ORGANIZATION',
      organizationId,
    });
    const start = new Date('2026-07-01T00:00:00Z');
    const end = new Date('2026-08-01T00:00:00Z');
    sub.startNewPeriod(start, end);
    expect(sub.status).toBe('ACTIVE');
    expect(sub.currentPeriodStart).toEqual(start);
    expect(sub.currentPeriodEnd).toEqual(end);

    sub.expire();
    expect(sub.status).toBe('EXPIRED');
  });

  it('linkExternalId → externalId bağlanır', () => {
    const sub = Subscription.create({
      billingTarget: 'ORGANIZATION',
      organizationId,
    });
    sub.linkExternalId('conv-123');
    expect(sub.externalId).toBe('conv-123');
  });
});
