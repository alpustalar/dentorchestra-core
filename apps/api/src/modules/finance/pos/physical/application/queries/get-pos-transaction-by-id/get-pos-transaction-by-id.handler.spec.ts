import { Decimal } from 'decimal.js';
import { GetPosTransactionByIdHandler } from './get-pos-transaction-by-id.handler';
import { GetPosTransactionByIdQuery } from './get-pos-transaction-by-id.query';
import { IPosTransactionQueryRepository } from '@modules/finance/pos/physical/domain/repositories/pos-transaction/pos-transaction.query.repository';
import { PosTransactionSummary } from '@modules/finance/pos/physical/domain/contracts/pos-transaction';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '@shared/common/constants/execution-source.constant';

/**
 * İç köprü sorgusu: bus üzerinden her modülden çağrılabildiği için kapsam
 * kontrolü burada da yapılır — tek bir çağıranın unutması başka bir kliniğin
 * hasta/plan kimliklerini sızdırmasın.
 */
describe('GetPosTransactionByIdHandler', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';

  const ctx: IGetContext = {
    actor: { userId: 'user-1', clinicId: CLINIC_ID } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  };

  const summary: PosTransactionSummary = {
    id: '33333333-3333-4333-8333-333333333333',
    clinicId: CLINIC_ID,
    kind: 'SALE',
    status: 'SUCCESS',
    provider: 'PAX',
    patientId: '44444444-4444-4444-8444-444444444444',
    paymentId: null,
    amount: new Decimal(1000),
    currency: 'TRY',
    completedAt: new Date('2026-10-01T10:00:00Z'),
  };

  const build = (found: PosTransactionSummary | null, allowed = true) => {
    const findSummaryById = jest.fn(() => Promise.resolve(found));
    const repo = {
      findSummaryById,
    } as unknown as IPosTransactionQueryRepository;

    const checkedClinics: string[] = [];
    const orThrow = jest.fn(() => {
      if (!allowed) throw new Error('forbidden');
    });
    const policyFactory = {
      finance: jest.fn().mockReturnValue({
        evaluator: {
          check: (
            fn: (p: {
              canAccessClinicFinances: (id: string) => boolean;
            }) => void
          ) => {
            fn({
              canAccessClinicFinances: (id: string) => {
                checkedClinics.push(id);
                return allowed;
              },
            });
            return { orThrow };
          },
        },
      }),
    } as never;

    return {
      handler: new GetPosTransactionByIdHandler(repo, policyFactory),
      findSummaryById,
      checkedClinics,
    };
  };

  it('olguları döner; kapsam KAYDIN kendi kliniğinden doğrulanır', async () => {
    const { handler, checkedClinics } = build(summary);

    const result = await handler.execute(
      new GetPosTransactionByIdQuery(summary.id, ctx)
    );

    expect(result.data).toBe(summary);
    expect(checkedClinics).toEqual([CLINIC_ID]);
  });

  it('kayıt yoksa null döner, yetki değerlendirmesi yapılmaz', async () => {
    const { handler, checkedClinics } = build(null);

    const result = await handler.execute(
      new GetPosTransactionByIdQuery('yok', ctx)
    );

    expect(result.data).toBeNull();
    expect(checkedClinics).toEqual([]);
  });

  it('aktör o kliniğin finansına erişemiyorsa veri sızdırılmaz', async () => {
    const { handler } = build(summary, false);

    await expect(
      handler.execute(new GetPosTransactionByIdQuery(summary.id, ctx))
    ).rejects.toThrow('forbidden');
  });
});
