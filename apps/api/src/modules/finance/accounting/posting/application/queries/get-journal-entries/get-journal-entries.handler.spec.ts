/* eslint-disable @typescript-eslint/unbound-method */
import { GetJournalEntriesHandler } from './get-journal-entries.handler';
import { GetJournalEntriesQuery } from './get-journal-entries.query';
import { IJournalQueryRepository } from '@modules/finance/accounting/posting/domain/repositories/journal.repository';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '../../../../../../../../../../packages/shared/common/constants/execution-source.constant';

/**
 * Erişim `clinicId` için doğrulanır; liste de AYNI klinikle süzülmelidir. Süzgeç
 * yalnız organizasyonla kurulursa kontrol "bu klinik" için yapılır ama satırlar
 * "organizasyonun tüm klinikleri"nden gelir (§ yevmiye listesi sızıntısı).
 */
describe('GetJournalEntriesHandler — klinik kapsamı', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const ORG_ID = '99999999-9999-4999-8999-999999999999';

  const ctx: IGetContext = {
    actor: { userId: 'user-1', clinicId: CLINIC_ID } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  };

  const build = (accessOk = true) => {
    const journalQueryRepo = {
      findMany: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    } as unknown as jest.Mocked<IJournalQueryRepository>;

    const orThrow = jest.fn(() => {
      if (!accessOk) throw new Error('forbidden');
    });
    const policyFactory = {
      finance: jest.fn().mockReturnValue({
        evaluator: { check: jest.fn().mockReturnValue({ orThrow }) },
        policy: { getOrganizationSerializationOptions: () => ({}) },
      }),
    } as never;

    const tenantScopeResolver = {
      resolve: jest.fn().mockResolvedValue(ORG_ID),
    } as never;

    return {
      handler: new GetJournalEntriesHandler(
        journalQueryRepo,
        policyFactory,
        tenantScopeResolver
      ),
      journalQueryRepo,
    };
  };

  const query = () =>
    new GetJournalEntriesQuery({
      clinicId: CLINIC_ID,
      pagination: { page: 1, limit: 20 } as never,
      ctx,
    });

  it('repo süzgecine clinicId (ve çözülen organizationId) geçer', async () => {
    const { handler, journalQueryRepo } = build();
    await handler.execute(query());

    expect(journalQueryRepo.findMany).toHaveBeenCalledTimes(1);
    expect(journalQueryRepo.findMany.mock.calls[0][0]).toMatchObject({
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
    });
  });

  it('erişim reddedilirse hiç okuma yapılmaz', async () => {
    const { handler, journalQueryRepo } = build(false);
    await expect(handler.execute(query())).rejects.toThrow('forbidden');
    expect(journalQueryRepo.findMany).not.toHaveBeenCalled();
  });
});
