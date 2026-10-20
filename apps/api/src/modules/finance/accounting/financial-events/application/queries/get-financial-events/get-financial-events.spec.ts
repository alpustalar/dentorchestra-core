import { GetFinancialEventsHandler } from './get-financial-events.handler';
import { GetFinancialEventsQuery } from './get-financial-events.query';
import { IFinancialEventQueryRepository } from '@modules/finance/accounting/financial-events/domain/repositories/financial-event/financial-event.query.repository';
import { FindFinancialEventsFilter } from '@modules/finance/accounting/financial-events/domain/contracts/financial-event';
import { IPolicyFactory } from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ITenantScopeResolver, Pagination } from '@shared';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '../../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { LogSource } from '@src/domain/constants/log-action.constant';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const ORG_ID = '22222222-2222-4222-8222-222222222222';

const ctx: IGetContext = {
  actor: {
    userId: '55555555-5555-4555-8555-555555555555',
    clinicId: CLINIC_ID,
    organizationId: ORG_ID,
    managedClinics: [{ id: CLINIC_ID }],
    source: LogSource.SYSTEM,
  } as unknown as IGetContext['actor'],
  source: ExecutionSources.USER_ACTION,
};

const build = (options: { policyDenies?: boolean } = {}) => {
  const filters: FindFinancialEventsFilter[] = [];

  const financialEventRepo = {
    findMany: jest.fn(async (filter: FindFinancialEventsFilter) => {
      filters.push(filter);
      return { items: [], total: 0 };
    }),
    findById: jest.fn(),
  } as unknown as IFinancialEventQueryRepository;

  const policyFactory = {
    finance: jest.fn().mockReturnValue({
      evaluator: {
        check: jest.fn().mockReturnValue({
          orThrow: () => {
            if (options.policyDenies) throw new Error('forbidden');
          },
        }),
      },
      policy: {
        getSerializationOptions: jest.fn(() => ({
          isGroupActive: true,
          groups: [],
        })),
      },
    }),
  } as unknown as IPolicyFactory;

  const tenantScopeResolver = {
    resolve: jest.fn(async () => ORG_ID),
  } as unknown as ITenantScopeResolver;

  return {
    handler: new GetFinancialEventsHandler(
      financialEventRepo,
      policyFactory,
      tenantScopeResolver
    ),
    filters,
  };
};

const query = new GetFinancialEventsQuery({
  clinicId: CLINIC_ID,
  pagination: {
    take: 20,
    skip: 0,
    limit: 20,
    page: 1,
    orderBy: 'desc',
    orderByColumn: 'createdAt',
    searchOperator: 'AND',
  } satisfies Pagination,
  ctx,
});

describe('GetFinancialEventsHandler — satır kapsamı', () => {
  it('liste yalnız yetki verilen kliniğin olaylarıyla sınırlanır', async () => {
    // Yetki `canAccessClinicFinances(clinicId)` ile klinik seviyesinde veriliyor.
    // Filtre yalnız organizationId olsaydı tek şubeye erişimi olan personel
    // organizasyondaki tüm şubelerin finansal olay defterini okurdu.
    const { handler, filters } = build();

    await handler.execute(query);

    expect(filters[0].clinicId).toBe(CLINIC_ID);
    expect(filters[0].organizationId).toBe(ORG_ID);
  });

  it('yetki yoksa hiç sorgu çalıştırılmaz', async () => {
    const { handler, filters } = build({ policyDenies: true });

    await expect(handler.execute(query)).rejects.toThrow('forbidden');
    expect(filters).toHaveLength(0);
  });
});
