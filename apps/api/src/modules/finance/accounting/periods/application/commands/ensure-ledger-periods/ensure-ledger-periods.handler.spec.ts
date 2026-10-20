import { EnsureLedgerPeriodsHandler } from './ensure-ledger-periods.handler';
import { PeriodAlreadyExistsException } from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';
import { DateTimeManager } from '@common/utils';

describe('EnsureLedgerPeriodsHandler', () => {
  const PLATFORM = {
    clinicId: '00000000-0000-4000-8000-000000000002',
    organizationId: '00000000-0000-4000-8000-000000000001',
  };
  const CLINIC = {
    clinicId: '11111111-1111-4111-8111-111111111111',
    organizationId: '22222222-2222-4222-8222-222222222222',
  };

  let repo: { findLedgerScopes: jest.Mock; findByYear: jest.Mock; create: jest.Mock };
  let platformTenant: { resolve: jest.Mock };
  let criticalFailure: { publish: jest.Mock };
  let handler: EnsureLedgerPeriodsHandler;

  const years = () => [DateTimeManager.currentYear(), DateTimeManager.currentYear() + 1];

  beforeEach(() => {
    repo = {
      findLedgerScopes: jest.fn().mockResolvedValue([{ ...CLINIC }]),
      findByYear: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async (p) => p),
    };
    platformTenant = { resolve: jest.fn().mockResolvedValue(PLATFORM) };
    criticalFailure = { publish: jest.fn() };
    handler = new EnsureLedgerPeriodsHandler(
      repo as never,
      platformTenant as never,
      { run: (fn: () => Promise<unknown>) => fn() } as never,
      criticalFailure as never
    );
  });

  it('dönemi hiç olmayan platform da kapsama girer (cari + gelecek yıl)', async () => {
    const result = await handler.execute();

    const platformYears = repo.findByYear.mock.calls
      .filter(([clinicId]) => clinicId === PLATFORM.clinicId)
      .map(([, year]) => year);
    expect(platformYears).toEqual(years());
    // 2 kapsam × 2 yıl
    expect(result.created).toBe(4);
  });

  it('platform zaten kapsamdaysa iki kez işlenmez', async () => {
    repo.findLedgerScopes.mockResolvedValue([{ ...CLINIC }, { ...PLATFORM }]);

    await handler.execute();

    const platformCalls = repo.findByYear.mock.calls.filter(
      ([clinicId]) => clinicId === PLATFORM.clinicId
    );
    expect(platformCalls).toHaveLength(2);
  });

  it('platform çözülemezse CRITICAL basar, diğer kiracılar devam eder', async () => {
    platformTenant.resolve.mockRejectedValue(new Error('yok'));

    const result = await handler.execute();

    expect(criticalFailure.publish).toHaveBeenCalledWith(
      expect.objectContaining({ dedupeKey: 'period-ensure-platform-unresolved' })
    );
    expect(result.created).toBe(2); // yalnız clinic-a
  });

  it('eşzamanlı çalıştırmada PeriodAlreadyExists atlanmış sayılır', async () => {
    repo.create.mockRejectedValue(
      new PeriodAlreadyExistsException(2026)
    );

    const result = await handler.execute();

    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(4);
  });
});
