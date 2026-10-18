import { EventEmitter2 } from '@nestjs/event-emitter';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { OutboxProcessor } from '@src/infrastructure/persistence/prisma/outbox/outbox.processor';
import {
  ClaimedOutboxRecord,
  OutboxRepository,
} from '@src/infrastructure/persistence/prisma/outbox/outbox.repository';
import { OUTBOX_MAX_ATTEMPTS } from '@src/infrastructure/persistence/prisma/outbox/outbox.constants';

type AlarmInput = Parameters<CriticalFailurePublisher['publish']>[0];

const record = (
  overrides: Partial<ClaimedOutboxRecord> = {}
): ClaimedOutboxRecord => ({
  id: 'outbox-1',
  type: 'financial-event.recorded',
  payload: { financialEventId: 'fe-1' },
  attempts: 1,
  ...overrides,
});

describe('OutboxProcessor', () => {
  let claimPending: jest.Mock;
  let markProcessed: jest.Mock;
  let markFailed: jest.Mock;
  let emitAsync: jest.Mock;
  let listenerCount: jest.Mock;
  let publish: jest.Mock;
  let processor: OutboxProcessor;

  const alarms = (): AlarmInput[] =>
    publish.mock.calls.map(([input]) => input as AlarmInput);

  beforeEach(() => {
    claimPending = jest.fn().mockResolvedValue([]);
    markProcessed = jest.fn().mockResolvedValue(undefined);
    markFailed = jest.fn().mockResolvedValue(undefined);
    emitAsync = jest.fn().mockResolvedValue([]);
    listenerCount = jest.fn().mockReturnValue(1);
    publish = jest.fn();

    const repo = {
      claimPending,
      markProcessed,
      markFailed,
    } as unknown as OutboxRepository;

    processor = new OutboxProcessor(
      repo,
      { emitAsync, listenerCount } as unknown as EventEmitter2,
      { publish } as unknown as CriticalFailurePublisher
    );
  });

  const run = () => processor.process();

  it('sahiplenilen kaydı yayınlar ve yalnız başarıda kapatır', async () => {
    claimPending.mockResolvedValue([record()]);

    await run();

    expect(emitAsync).toHaveBeenCalledWith('financial-event.recorded', {
      financialEventId: 'fe-1',
    });
    expect(markProcessed).toHaveBeenCalledWith('outbox-1');
    expect(markFailed).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  /**
   * Eski hâlin kalbi burasıydı: dinleyici patlasa bile kayıt `processedAt` ile
   * kapanıyordu (hata hiç görünmüyordu). Artık kapanmaz — açık kalır, yeniden denenir.
   */
  it('dinleyici hata verirse kaydı KAPATMAZ, hatayı damgalar ve uyarır', async () => {
    claimPending.mockResolvedValue([record({ attempts: 2 })]);
    emitAsync.mockRejectedValue(new Error('dönem kapalı'));

    await run();

    expect(markProcessed).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith({
      id: 'outbox-1',
      error: 'dönem kapalı',
      deadLetter: false,
    });
    expect(alarms()[0]).toMatchObject({
      operation: 'outbox.deliver',
      severity: 'WARNING',
      dedupeKey: 'outbox-delivery-failed:outbox-1',
      context: { attempts: 2 },
    });
  });

  it('deneme hakkı tükenince ölü mektuba düşürür ve CRITICAL uyarır', async () => {
    claimPending.mockResolvedValue([record({ attempts: OUTBOX_MAX_ATTEMPTS })]);
    emitAsync.mockRejectedValue(new Error('provider timeout'));

    await run();

    expect(markFailed).toHaveBeenCalledWith({
      id: 'outbox-1',
      error: 'provider timeout',
      deadLetter: true,
    });
    expect(alarms()[0]).toMatchObject({
      severity: 'CRITICAL',
      dedupeKey: 'outbox-dead-letter:outbox-1',
    });
  });

  it('dinleyicisi olmayan event sessizce kapatılmaz', async () => {
    claimPending.mockResolvedValue([record()]);
    listenerCount.mockReturnValue(0);

    await run();

    expect(emitAsync).not.toHaveBeenCalled();
    expect(markProcessed).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'outbox-1', deadLetter: false })
    );
    const [failure] = markFailed.mock.calls[0] as [{ error: string }];
    expect(failure.error).toContain('dinleyici yok');
  });

  it('kayıtlar sahiplenme sırasıyla, sırayla teslim edilir', async () => {
    const delivered: string[] = [];
    claimPending.mockResolvedValue([
      record({ id: 'a', type: 'first' }),
      record({ id: 'b', type: 'second' }),
    ]);
    emitAsync.mockImplementation(async (type: string) => {
      await new Promise((resolve) =>
        setTimeout(resolve, type === 'first' ? 5 : 0)
      );
      delivered.push(type);
      return [];
    });

    await run();

    expect(delivered).toEqual(['first', 'second']);
  });

  it('hata damgası yazılamazsa kayıt açık kalır (uyarı yine çıkar)', async () => {
    claimPending.mockResolvedValue([record()]);
    emitAsync.mockRejectedValue(new Error('boom'));
    markFailed.mockRejectedValue(new Error('db down'));

    await expect(run()).resolves.toBeUndefined();

    expect(markProcessed).not.toHaveBeenCalled();
    expect(alarms()).toHaveLength(1);
  });

  it('sahiplenecek kayıt yoksa hiç yayın yapmaz', async () => {
    await run();

    expect(emitAsync).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});
