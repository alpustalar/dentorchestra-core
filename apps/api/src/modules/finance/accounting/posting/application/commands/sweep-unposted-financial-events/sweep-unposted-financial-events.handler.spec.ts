import { SweepUnpostedFinancialEventsHandler } from './sweep-unposted-financial-events.handler';
import { SweepUnpostedFinancialEventsCommand } from './sweep-unposted-financial-events.command';
import { GetClinicsWithUnpostedFinancialEventsQuery } from '@modules/finance/accounting/financial-events/application/queries/get-clinics-with-unposted-financial-events/get-clinics-with-unposted-financial-events.query';
import { PostUnpostedFinancialEventsCommand } from '@modules/finance/accounting/posting/application/commands/post-unposted-financial-events/post-unposted-financial-events.command';
import { POSTABLE_FINANCIAL_EVENT_TYPES } from '@modules/finance/accounting/posting/domain/posting/postable-event-types.constant';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';

/**
 * Süpürme, yutulan posting hatasının tek otomatik onarım yolu (CLAUDE.md finans
 * kuralı 4). Testler işin iki sözünü kilitler: yalnız işi olan defterleri hedefler
 * ve kalıcı hata sessiz kalmaz.
 */
describe('SweepUnpostedFinancialEventsHandler', () => {
  const build = (params: {
    clinicIds: string[];
    perClinic?: (clinicId: string) => Promise<unknown>;
  }) => {
    // Mock fonksiyonlar yerel tutulur: assertion'lar `as jest.Mock` cast'i
    // gerektirmeden tipli kalır.
    const queryExecute = jest
      .fn<
        Promise<{ data: string[] }>,
        [GetClinicsWithUnpostedFinancialEventsQuery]
      >()
      .mockResolvedValue({ data: params.clinicIds });

    const commandExecute = jest.fn(
      (command: PostUnpostedFinancialEventsCommand) =>
        params.perClinic
          ? params.perClinic(command.payload.clinicId)
          : Promise.resolve({ posted: 2, skipped: 1, failed: 0 })
    );

    const publish = jest.fn<void, [{ dedupeKey: string }]>();

    return {
      handler: new SweepUnpostedFinancialEventsHandler(
        { execute: queryExecute } as unknown as TSQueryBus,
        { execute: commandExecute } as unknown as TSCommandBus,
        { publish } as unknown as CriticalFailurePublisher
      ),
      queryExecute,
      commandExecute,
      publish,
    };
  };

  it('yalnız fişlenmemiş olayı olan defterler için backfill çalıştırır', async () => {
    const { handler, queryExecute, commandExecute } = build({
      clinicIds: ['clinic-1', 'clinic-2'],
    });

    const result = await handler.execute(
      new SweepUnpostedFinancialEventsCommand()
    );

    // Hedef küme sorgudan gelir; bütün klinikleri dolaşmak yerine işi olanlar.
    const [query] = queryExecute.mock.calls[0];
    expect(query.payload.filter.types).toBe(POSTABLE_FINANCIAL_EVENT_TYPES);

    expect(commandExecute).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ clinics: 2, posted: 4, skipped: 2, failed: 0 });
  });

  it('boş kümede hiç backfill çalıştırmaz', async () => {
    const { handler, commandExecute } = build({ clinicIds: [] });

    const result = await handler.execute(
      new SweepUnpostedFinancialEventsCommand()
    );

    expect(commandExecute).not.toHaveBeenCalled();
    expect(result).toEqual({ clinics: 0, posted: 0, skipped: 0, failed: 0 });
  });

  it('bir defterin hatası diğerlerini durdurmaz ve CRITICAL uyarı üretir', async () => {
    const { handler, commandExecute, publish } = build({
      clinicIds: ['clinic-bad', 'clinic-ok'],
      perClinic: (clinicId) =>
        clinicId === 'clinic-bad'
          ? Promise.reject(new Error('hesap planı eksik'))
          : Promise.resolve({ posted: 3, skipped: 0, failed: 0 }),
    });

    const result = await handler.execute(
      new SweepUnpostedFinancialEventsCommand()
    );

    // İkinci defter yine işlendi: bir kiracının kalıcı hatası defteri olan
    // diğer kiracıların fişlerini rehin alamaz.
    expect(commandExecute).toHaveBeenCalledTimes(2);
    expect(result.posted).toBe(3);
    expect(result.failed).toBe(1);

    const dedupeKeys = publish.mock.calls.map(([failure]) => failure.dedupeKey);
    expect(dedupeKeys).toContain('posting-sweep-failed:clinic-bad');
    // Süpürmeden sonra da fişlenemeyen olay kalıcı bir hatadır → ayrıca uyarılır.
    expect(dedupeKeys).toContain('posting-sweep-residual-failures');
  });
});
