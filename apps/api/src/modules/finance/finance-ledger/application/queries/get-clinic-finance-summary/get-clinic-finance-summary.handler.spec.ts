import { GetClinicFinanceSummaryHandler } from './get-clinic-finance-summary.handler';
import { GetClinicFinanceSummaryQuery } from './get-clinic-finance-summary.query';

describe('GetClinicFinanceSummaryHandler', () => {
  const summary = {
    totalIncome: '1000.00',
    totalExpenses: '400.00',
    balance: '600.00',
    entryCount: 5,
  };

  const make = () => {
    const repo = { getClinicSummary: jest.fn().mockResolvedValue(summary) };
    const orThrow = jest.fn();
    const check = jest.fn().mockReturnValue({ orThrow });
    const serializationOptions = { groups: [], isGroupActive: false };
    const policyFactory = {
      finance: jest.fn().mockReturnValue({
        evaluator: { check },
        policy: {
          getSerializationOptions: jest
            .fn()
            .mockReturnValue(serializationOptions),
        },
      }),
    };
    const handler = new GetClinicFinanceSummaryHandler(
      repo as never,
      policyFactory as never
    );
    return {
      handler,
      repo,
      policyFactory,
      check,
      orThrow,
      serializationOptions,
    };
  };

  const ctx = { actor: { id: 'u1' }, source: 'API' } as never;

  afterEach(() => jest.restoreAllMocks());

  it('şube özetini yetki kontrolünden sonra döner', async () => {
    const { handler, repo, check, serializationOptions } = make();
    const from = new Date('2026-01-01');
    const to = new Date('2026-12-31');

    const result = await handler.execute(
      new GetClinicFinanceSummaryQuery({
        clinicId: 'clinic-1',
        ctx,
        dateFrom: from,
        dateTo: to,
      })
    );

    expect(check).toHaveBeenCalledTimes(1);
    expect(repo.getClinicSummary).toHaveBeenCalledWith('clinic-1', {
      dateFrom: from,
      dateTo: to,
    });
    expect(result).toEqual({
      data: summary,
      meta: { serializationOptions },
    });
  });

  it('yetki kontrolü DB sorgusundan önce koşar — ciro okunmadan kapı tutulur', async () => {
    const { handler, repo, check, orThrow } = make();

    orThrow.mockImplementation(() => {
      throw new Error('yetkisiz');
    });

    await expect(
      handler.execute(
        new GetClinicFinanceSummaryQuery({ clinicId: 'clinic-1', ctx })
      )
    ).rejects.toThrow('yetkisiz');

    expect(check).toHaveBeenCalledTimes(1);
    expect(repo.getClinicSummary).not.toHaveBeenCalled();
  });

  // NOT: Sistem tetikli çağrıların baypası artık handler'da bir `if` ile değil,
  // `PolicyEvaluator` içinde (policy.isSystem()) yaşıyor — handler her koşulda
  // check'i çağırır, evaluator sistem bağlamında no-op olur.
});
