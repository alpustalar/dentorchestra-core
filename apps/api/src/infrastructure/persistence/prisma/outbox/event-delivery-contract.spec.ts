import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  EventEmitter2,
  EventEmitterModule,
  OnEvent,
} from '@nestjs/event-emitter';
import { OnDomainEvent } from '@common/decorators';

const BARE_EVENT = 'spec.bare-on-event';
const BARE_FAILING_EVENT = 'spec.bare-on-event-failing';
const GUARDED_EVENT = 'spec.on-domain-event';
const GUARDED_FAILING_EVENT = 'spec.on-domain-event-failing';

const FAILURE = 'dinleyici patladı';

/** Çıplak `@OnEvent(..., { async: true })` — tüm kod tabanının eski hâli. */
@Injectable()
class BareListener {
  started: string[] = [];

  @OnEvent(BARE_EVENT, { async: true })
  async handle(): Promise<void> {
    this.started.push('ok');
    await Promise.resolve();
  }

  @OnEvent(BARE_FAILING_EVENT, { async: true })
  async fail(): Promise<void> {
    this.started.push('fail');
    return Promise.reject(new Error(FAILURE));
  }
}

@Injectable()
class GuardedListener {
  started: string[] = [];

  @OnDomainEvent(GUARDED_EVENT)
  async handle(): Promise<void> {
    this.started.push('ok');
    await Promise.resolve();
  }

  @OnDomainEvent(GUARDED_FAILING_EVENT)
  async fail(): Promise<void> {
    this.started.push('fail');
    return Promise.reject(new Error(FAILURE));
  }
}

/**
 * Outbox'ın teslim sözleşmesini **ölçen** test. `OutboxProcessor` kaydı
 * `emitAsync` çözülünce "işlendi" sayıyor; dolayısıyla "emitAsync ne zaman
 * çözülür ve hata çağırana ulaşır mı" bir altyapı ayrıntısı değil, para taşıyan
 * bir sözleşmedir. Burada hem framework'ün varsayılan davranışı (kayıt olarak)
 * hem kapının garantisi doğrulanır.
 */
describe('event teslim sözleşmesi (@OnDomainEvent)', () => {
  let emitter: EventEmitter2;
  let bare: BareListener;
  let guarded: GuardedListener;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [BareListener, GuardedListener],
    }).compile();

    await moduleRef.init();

    emitter = moduleRef.get(EventEmitter2);
    bare = moduleRef.get(BareListener);
    guarded = moduleRef.get(GuardedListener);
  });

  it('çıplak @OnEvent: `await emitAsync` dinleyici HENÜZ BAŞLAMADAN çözülür', async () => {
    await emitter.emitAsync(BARE_EVENT, {});

    // Teslim edilmedi — yalnız `setImmediate` kuyruğuna atıldı. Outbox tam bu
    // noktada kaydı kapatıyordu: araya düşen bir yeniden başlatma işi kaybettirir.
    expect(bare.started).toEqual([]);

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(bare.started).toEqual(['ok']);
  });

  it('çıplak @OnEvent: dinleyicinin hatası çağırana hiç ulaşmaz', async () => {
    await expect(
      emitter.emitAsync(BARE_FAILING_EVENT, {})
    ).resolves.toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(bare.started).toEqual(['fail']); // çalıştı ve patladı — çağıran bilmiyor
  });

  it('@OnDomainEvent: `await emitAsync` dinleyici bitene kadar bekler', async () => {
    await emitter.emitAsync(GUARDED_EVENT, {});

    expect(guarded.started).toEqual(['ok']);
  });

  it('@OnDomainEvent: dinleyicinin hatası çağırana ulaşır', async () => {
    await expect(emitter.emitAsync(GUARDED_FAILING_EVENT, {})).rejects.toThrow(
      FAILURE
    );
    expect(guarded.started).toEqual(['fail']);
  });
});



