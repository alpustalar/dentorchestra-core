import { Logger } from '@nestjs/common';
import { installProcessFailureAlarms } from './process-failure-alarms';
import { CriticalFailurePublisher } from './critical-failure.publisher';
import type { CriticalFailurePayload } from './critical-failure.event';

/**
 * Sürecin ölümünün sessiz kalmaması test edilir.
 *
 * Node, yakalanmayan promise reddinde süreci düşürür; platform onu yeniden
 * başlatır ve geriye kimsenin izlemediği bir stdout satırı kalır. Finans
 * tarafında yarıda kalan bir istek "para alındı, defter yazılmadı" demektir.
 */
describe('installProcessFailureAlarms', () => {
  const build = () => {
    const published: CriticalFailurePayload[] = [];
    const publisher = {
      publish: (payload: CriticalFailurePayload) => published.push(payload),
    } as unknown as CriticalFailurePublisher;

    const handlers = new Map<string, (arg: unknown) => void>();
    const source = {
      on: (event: string, handler: (arg: unknown) => void) => {
        handlers.set(event, handler);
        return source as unknown as NodeJS.Process;
      },
    } as unknown as Pick<NodeJS.Process, 'on'>;

    const exits: number[] = [];

    installProcessFailureAlarms({
      publisher,
      source,
      exit: (code) => exits.push(code),
      flushMs: 10,
    });

    return { published, handlers, exits };
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('yakalanmayan promise reddinde CRITICAL uyarı basar', () => {
    const { published, handlers } = build();

    handlers.get('unhandledRejection')?.(new Error('boom'));

    expect(published).toHaveLength(1);
    expect(published[0].severity).toBe('CRITICAL');
    expect(published[0].operation).toBe('process.unhandled-rejection');
    expect(published[0].errorMessage).toBe('boom');
    expect(published[0].dedupeKey).toBe('process.unhandled-rejection:Error');
  });

  it('yakalanmayan exception da aynı yoldan duyurulur', () => {
    const { published, handlers } = build();

    handlers.get('uncaughtException')?.(new TypeError('bad access'));

    expect(published[0].operation).toBe('process.uncaught-exception');
    expect(published[0].context.errorName).toBe('TypeError');
  });

  it('uyarıdan sonra süreç yine kapanır (ayakta tutulmaz)', () => {
    // Durumu bozulmuş bir süreci ayakta tutmak daha kötüsüdür: para hareketine
    // devam eder. Uyarının ağa çıkması için yalnız kısa bir pencere bırakılır.
    const { handlers, exits } = build();

    handlers.get('unhandledRejection')?.(new Error('boom'));
    expect(exits).toEqual([]);

    jest.advanceTimersByTime(10);
    expect(exits).toEqual([1]);
  });

  it('ikinci ölüm olayı kanalı meşgul etmez', () => {
    const { published, handlers } = build();

    handlers.get('unhandledRejection')?.(new Error('first'));
    handlers.get('uncaughtException')?.(new Error('second'));

    expect(published).toHaveLength(1);
    expect(published[0].errorMessage).toBe('first');
  });

  it('Error olmayan ret sebebi de taşınır', () => {
    const { published, handlers } = build();

    handlers.get('unhandledRejection')?.('string reason');

    expect(published[0].errorMessage).toBe('string reason');
    expect(published[0].context.errorName).toBe('string');
  });
});
