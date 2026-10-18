import { TransactionManager } from './transaction.manager';
import { txStorage } from '@src/infrastructure/transaction/als-storage';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OutboxRepository } from '@src/infrastructure/persistence/prisma/outbox/outbox.repository';

/**
 * TransactionManager'ın sözleşmesi tüm command handler'ları etkiler ama handler
 * spec'leri onu mock'lar — yani bu davranışı yalnız buradaki test korur.
 */
describe('TransactionManager', () => {
  /** $transaction'ı gerçekçi taklit eder: callback biterse commit, atarsa rollback. */
  const makePrisma = () => {
    const state = { committed: false, rolledBack: false };
    const prisma = {
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        try {
          const result = await cb({ __tx: true });
          state.committed = true;
          return result;
        } catch (error) {
          state.rolledBack = true;
          throw error;
        }
      }),
    };
    return { prisma, state };
  };

  const build = () => {
    const { prisma, state } = makePrisma();
    const emitted: { name: string; committedAtEmit: boolean }[] = [];
    const eventEmitter = {
      emitAsync: jest.fn(async (name: string) => {
        emitted.push({ name, committedAtEmit: state.committed });
      }),
    };
    const outboxRepo = { saveEvents: jest.fn().mockResolvedValue(undefined) };
    // Listener hatası sessiz kalmasın diye uyarı yayınlanır (WARNING).
    const criticalFailure = { publish: jest.fn() };

    const manager = new TransactionManager(
      prisma as unknown as PrismaService,
      eventEmitter as unknown as EventEmitter2,
      outboxRepo as unknown as OutboxRepository,
      criticalFailure as never
    );

    return {
      manager,
      prisma,
      state,
      emitted,
      eventEmitter,
      outboxRepo,
      criticalFailure,
    };
  };

  /** İş sırasında ALS store'a event ekleyen yardımcı (publisher'ın yaptığı şey). */
  const addEvent = (name: string) => {
    const store = txStorage.getStore();
    store?.events.push({ name, payload: { name } } as never);
  };

  describe('run', () => {
    it('event COMMIT SONRASI yayınlanır (listener yazılmış veriyi görür)', async () => {
      const { manager, emitted } = build();

      await manager.run(async () => {
        addEvent('foo.created');
      });

      expect(emitted).toEqual([{ name: 'foo.created', committedAtEmit: true }]);
    });

    it('listener hatası iş yazmasını geri sarmaz, akış sürer', async () => {
      const { manager, eventEmitter, state } = build();
      (eventEmitter.emitAsync as jest.Mock)
        .mockRejectedValueOnce(new Error('listener patladı'))
        .mockResolvedValueOnce(undefined);

      await expect(
        manager.run(async () => {
          addEvent('foo.created');
          addEvent('foo.updated');
          return 'ok';
        })
      ).resolves.toBe('ok');

      expect(state.committed).toBe(true);
      expect(state.rolledBack).toBe(false);
      // İlki patlasa da ikincisi yayınlanır
      expect(eventEmitter.emitAsync).toHaveBeenCalledTimes(2);
    });

    it('listener hatası WARNING uyarısı üretir (sessiz düşmez)', async () => {
      const { manager, eventEmitter, criticalFailure } = build();
      (eventEmitter.emitAsync as jest.Mock).mockRejectedValueOnce(
        new Error('listener patladı')
      );

      await manager.run(async () => {
        addEvent('foo.created');
      });

      // `emitDetached` hatayı mikrotask'ta yakalar.
      await Promise.resolve();
      await Promise.resolve();

      expect(criticalFailure.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'events.in-memory-dispatch',
          severity: 'WARNING',
          dedupeKey: 'listener-failed:foo.created',
        })
      );
    });

    /**
     * Kritik olmayan kanal isteği **bekletmez**: commit sonrası yayın, yanıtı bir
     * SMTP/WhatsApp çağrısının arkasına koymamalı. Kritik yan etki outbox'tan
     * gider; beklemek orada (kuyruk işçisinde) doğrudur.
     */
    it('in-memory kanal çağıranı bekletmez', async () => {
      const { manager, eventEmitter } = build();
      let listenerFinished = false;
      (eventEmitter.emitAsync as jest.Mock).mockImplementationOnce(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        listenerFinished = true;
      });

      await manager.run(async () => {
        addEvent('foo.created');
      });

      expect(listenerFinished).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(listenerFinished).toBe(true);
    });

    it('iş patlarsa transaction geri sarar ve hiçbir event yayınlanmaz', async () => {
      const { manager, state, eventEmitter } = build();

      await expect(
        manager.run(async () => {
          addEvent('foo.created');
          throw new Error('iş patladı');
        })
      ).rejects.toThrow('iş patladı');

      expect(state.rolledBack).toBe(true);
      expect(state.committed).toBe(false);
      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });

    it('event sırası korunur', async () => {
      const { manager, emitted } = build();

      await manager.run(async () => {
        addEvent('first');
        addEvent('second');
        addEvent('third');
      });

      expect(emitted.map((e) => e.name)).toEqual(['first', 'second', 'third']);
    });

    it('iç içe run: yeni transaction açılmaz, event dıştaki commit sonrası yayınlanır', async () => {
      const { manager, prisma, emitted } = build();

      await manager.run(async () => {
        addEvent('outer');
        await manager.run(async () => {
          addEvent('inner');
        });
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(emitted.map((e) => e.name)).toEqual(['outer', 'inner']);
      expect(emitted.every((e) => e.committedAtEmit)).toBe(true);
    });

    it('iş bitince ALS store temizlenir (event sızıntısı olmaz)', async () => {
      const { manager } = build();

      await manager.run(async () => {
        expect(txStorage.getStore()).toBeDefined();
      });

      expect(txStorage.getStore()).toBeUndefined();
    });
  });

  describe('publish', () => {
    it('transaction AÇMADAN event yayınlar', async () => {
      const { manager, prisma, eventEmitter } = build();

      await manager.publish(async () => {
        addEvent('meta-lead.received');
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        'meta-lead.received',
        expect.anything()
      );
    });

    it('ALS bağlamı kurar → addEvent düşmez (çıplak publisher çağrısının aksine)', async () => {
      const { manager } = build();
      let storeSeen: unknown;

      await manager.publish(async () => {
        storeSeen = txStorage.getStore();
      });

      expect(storeSeen).toBeDefined();
      expect(txStorage.getStore()).toBeUndefined();
    });

    it('iş patlarsa event yayınlanmaz', async () => {
      const { manager, eventEmitter } = build();

      await expect(
        manager.publish(async () => {
          addEvent('foo');
          throw new Error('iş patladı');
        })
      ).rejects.toThrow('iş patladı');

      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });

    it('run içinde çağrılırsa yeni bağlam kurmaz, event dıştaki commit sonrası gider', async () => {
      const { manager, prisma, emitted } = build();

      await manager.run(async () => {
        await manager.publish(async () => {
          addEvent('inner-publish');
        });
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(emitted).toEqual([
        { name: 'inner-publish', committedAtEmit: true },
      ]);
    });
  });

  describe('outboxRun', () => {
    it('event outbox tablosuna transaction İÇİNDE yazılır, emit edilmez', async () => {
      const { manager, outboxRepo, eventEmitter, state } = build();

      await manager.outboxRun(async () => {
        addEvent('payment.collected');
      });

      expect(outboxRepo.saveEvents).toHaveBeenCalledTimes(1);
      const [savedEvents] = outboxRepo.saveEvents.mock.calls[0];
      expect(savedEvents).toHaveLength(1);
      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
      expect(state.committed).toBe(true);
    });

    it('event yoksa outbox yazması yapılmaz', async () => {
      const { manager, outboxRepo } = build();

      await manager.outboxRun(async () => undefined);

      expect(outboxRepo.saveEvents).not.toHaveBeenCalled();
    });
  });
});
