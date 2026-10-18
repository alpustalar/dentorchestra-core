import { InitializeChartOfAccountsHandler } from './initialize-chart-of-accounts.handler';
import { InitializeChartOfAccountsCommand } from './initialize-chart-of-accounts.command';
import { Account } from '@modules/finance/accounting/chart-of-accounts/domain/entities/account.entity';
import { IAccountCommandRepository } from '@modules/finance/accounting/chart-of-accounts/domain/repositories/account/account.command.repository';
import { IChartOfAccountsEventPublisher } from '@modules/finance/accounting/chart-of-accounts/domain/interfaces/chart-of-accounts-event-publisher.interface';
import { IPolicyFactory } from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { ITenantScopeResolver } from '@shared';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '@src/domain/constants/execution-source.constant';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { CLINIC_CHART_OF_ACCOUNTS_TEMPLATE } from '@modules/finance/accounting/chart-of-accounts/domain/constants/clinic-chart-of-accounts.template';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const ORG_ID = '22222222-2222-4222-8222-222222222222';

const ctx: IGetContext = {
  actor: {
    userId: UUID.generate().value,
    clinicId: CLINIC_ID,
    organizationId: ORG_ID,
    managedClinics: [{ id: CLINIC_ID }],
    source: LogSource.SYSTEM,
  } as unknown as IGetContext['actor'],
  source: ExecutionSources.USER_ACTION,
};

interface BuildOptions {
  existing?: Record<string, string>;
  policyDenies?: boolean;
}

const build = (options: BuildOptions = {}) => {
  const created: Account[][] = [];

  const accountRepo = {
    findIdByCodeMap: jest.fn(async () => options.existing ?? {}),
    createChart: jest.fn(async (accounts: Account[]) => {
      created.push(accounts);
    }),
    update: jest.fn(),
    updateMany: jest.fn(),
  } as unknown as IAccountCommandRepository;

  const tenantScopeResolver = {
    resolve: jest.fn(async () => ORG_ID),
  } as unknown as ITenantScopeResolver;

  const txManager = {
    run: jest.fn(async (cb: () => Promise<unknown>) => cb()),
  } as unknown as TransactionManager;

  const policyFactory = {
    finance: jest.fn().mockReturnValue({
      evaluator: {
        check: jest.fn().mockReturnValue({
          orThrow: () => {
            if (options.policyDenies) throw new Error('forbidden');
          },
        }),
      },
    }),
  } as unknown as IPolicyFactory;

  const eventPublisher = {
    initialized: jest.fn(),
  } as unknown as IChartOfAccountsEventPublisher;

  return {
    handler: new InitializeChartOfAccountsHandler(
      accountRepo,
      tenantScopeResolver,
      policyFactory,
      eventPublisher,
      txManager
    ),
    accountRepo,
    eventPublisher,
    tenantScopeResolver,
    created,
  };
};

const command = new InitializeChartOfAccountsCommand({
  clinicId: CLINIC_ID,
  ctx,
});

describe('InitializeChartOfAccountsHandler', () => {
  it('boş şubede şablonun tamamını kurar', async () => {
    const { handler, accountRepo, created } = build();

    await handler.execute(command);

    expect(accountRepo.createChart).toHaveBeenCalledTimes(1);
    expect(created[0]).toHaveLength(CLINIC_CHART_OF_ACCOUNTS_TEMPLATE.length);
  });

  it('şablon büyüdüğünde YALNIZ eksik hesapları ekler', async () => {
    // Regresyon: eskiden "şubede hesap var mı?" diye bakılıp çıkılıyordu; bu,
    // şablona sonradan eklenen hesabın mevcut şubelere hiç gitmemesi demekti.
    const codes = CLINIC_CHART_OF_ACCOUNTS_TEMPLATE.map((n) => n.code);
    const existing = Object.fromEntries(
      codes.slice(0, -2).map((code) => [code, UUID.generate().value])
    );
    const { handler, created } = build({ existing });

    await handler.execute(command);

    expect(created[0].map((a) => a.code.value).sort()).toEqual(
      codes.slice(-2).sort()
    );
  });

  it('eksik hesabın üst hesabı MEVCUT kaydın id’sine bağlanır (FK kopmaz)', async () => {
    const child = CLINIC_CHART_OF_ACCOUNTS_TEMPLATE.find((n) => n.parentCode);
    if (!child?.parentCode) return; // şablon şu an düzse kural zaten sınanamaz

    const parentId = UUID.generate().value;
    const existing = Object.fromEntries(
      CLINIC_CHART_OF_ACCOUNTS_TEMPLATE.filter(
        (n) => n.code !== child.code
      ).map((n) => [
        n.code,
        n.code === child.parentCode ? parentId : UUID.generate().value,
      ])
    );

    const { handler, created } = build({ existing });
    await handler.execute(command);

    const inserted = created[0].find((a) => a.code.value === child.code);
    expect(inserted?.parentId).toBe(parentId);
  });

  it('hesap planı eksiksizse hiçbir şey yazmaz ve olay yayınlamaz', async () => {
    const existing = Object.fromEntries(
      CLINIC_CHART_OF_ACCOUNTS_TEMPLATE.map((n) => [
        n.code,
        UUID.generate().value,
      ])
    );
    const { handler, accountRepo, eventPublisher } = build({ existing });

    await handler.execute(command);

    expect(accountRepo.createChart).not.toHaveBeenCalled();
    expect(eventPublisher.initialized).not.toHaveBeenCalled();
  });

  it('kurulum tek bir toplu denetim olayı yayınlar', async () => {
    const { handler, eventPublisher } = build();

    await handler.execute(command);

    expect(eventPublisher.initialized).toHaveBeenCalledTimes(1);
    expect(eventPublisher.initialized).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: CLINIC_ID,
        organizationId: ORG_ID,
        createdCount: CLINIC_CHART_OF_ACCOUNTS_TEMPLATE.length,
      })
    );
  });

  it('yetki reddedilirse hiçbir yazma yapılmaz', async () => {
    const { handler, accountRepo } = build({ policyDenies: true });

    await expect(handler.execute(command)).rejects.toThrow('forbidden');
    expect(accountRepo.createChart).not.toHaveBeenCalled();
  });

  it('organizationId istemciden değil, clinicId’den çözülür', async () => {
    const { handler, tenantScopeResolver, created } = build();

    await handler.execute(command);

    expect(tenantScopeResolver.resolve).toHaveBeenCalled();
    expect(created[0][0].organizationId.value).toBe(ORG_ID);
  });
});
