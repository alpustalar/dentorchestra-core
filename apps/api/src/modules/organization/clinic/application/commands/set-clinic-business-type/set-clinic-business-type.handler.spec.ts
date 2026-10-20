import { SetClinicBusinessTypeHandler } from './set-clinic-business-type.handler';
import { SetClinicBusinessTypeCommand } from './set-clinic-business-type.command';
import { ClinicFinanceSettings } from '@modules/organization/clinic/domain/entities/clinic-finance-settings.entity';
import { ClinicBusinessTypeLockedException } from '@modules/organization/clinic/domain/exceptions/clinic-finance-settings.exceptions';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';
import { PolicyFactory } from '@modules/platform/policy/staff/application/policy-factory';
import { EventEmitter2 } from '@nestjs/event-emitter';

const CLINIC = '11111111-1111-4111-8111-111111111111';

describe('SetClinicBusinessTypeHandler', () => {
  const ctx = ExecutionContextFactory.createInternal();

  const build = (props: {
    existing: ClinicFinanceSettings | null;
    periods?: { status: string }[];
  }) => {
    const repo = {
      findByClinicId: jest.fn().mockResolvedValue(props.existing),
      upsertByClinicId: jest.fn().mockImplementation(async (e) => e),
    };
    const queryBus = {
      execute: jest.fn().mockResolvedValue({ data: props.periods ?? [] }),
    };
    const handler = new SetClinicBusinessTypeHandler(
      repo as never,
      new PolicyFactory(new EventEmitter2()),
      queryBus as never,
      { run: jest.fn((cb: () => unknown) => cb()) } as never
    );
    const run = (businessType: 'COMPANY' | 'SOLE_PROPRIETOR') =>
      handler.execute(
        new SetClinicBusinessTypeCommand({
          clinicId: CLINIC,
          data: { businessType },
          ctx,
        })
      );
    return { repo, queryBus, run };
  };

  it('satır yoksa varsayılan ayarlarla ilk seçimi açar ve dönem sormaz', async () => {
    const { repo, queryBus, run } = build({ existing: null });

    await run('COMPANY');

    const saved = repo.upsertByClinicId.mock.calls[0][0] as ClinicFinanceSettings;
    expect(saved.businessType).toBe('COMPANY');
    expect(saved.clinicId.value).toBe(CLINIC);
    expect(queryBus.execute).not.toHaveBeenCalled();
  });

  it('boş değerden ilk seçim, kapanmış yıl olsa da serbest (dönem sormaz)', async () => {
    const existing = ClinicFinanceSettings.create({ clinicId: CLINIC });
    const { repo, queryBus, run } = build({
      existing,
      periods: [{ status: 'CLOSED' }],
    });

    await run('SOLE_PROPRIETOR');

    expect(existing.businessType).toBe('SOLE_PROPRIETOR');
    expect(repo.upsertByClinicId).toHaveBeenCalledTimes(1);
    expect(queryBus.execute).not.toHaveBeenCalled();
  });

  it('kapanmış yıl yoksa değişikliğe izin verir', async () => {
    const existing = ClinicFinanceSettings.create({
      clinicId: CLINIC,
      businessType: 'COMPANY',
    });
    const { run } = build({ existing, periods: [{ status: 'OPEN' }] });

    await run('SOLE_PROPRIETOR');

    expect(existing.businessType).toBe('SOLE_PROPRIETOR');
  });

  it('kapanmış yıl varken dolu değeri değiştirmeyi reddeder ve yazmaz', async () => {
    const existing = ClinicFinanceSettings.create({
      clinicId: CLINIC,
      businessType: 'COMPANY',
    });
    const { repo, run } = build({ existing, periods: [{ status: 'CLOSED' }] });

    await expect(run('SOLE_PROPRIETOR')).rejects.toBeInstanceOf(
      ClinicBusinessTypeLockedException
    );
    expect(existing.businessType).toBe('COMPANY');
    expect(repo.upsertByClinicId).not.toHaveBeenCalled();
  });

  it('aynı değeri tekrar seçmek dönem sormaz ve kapanmış yılda da hata vermez', async () => {
    const existing = ClinicFinanceSettings.create({
      clinicId: CLINIC,
      businessType: 'COMPANY',
    });
    const { queryBus, run } = build({
      existing,
      periods: [{ status: 'CLOSED' }],
    });

    await expect(run('COMPANY')).resolves.toBeUndefined();
    expect(queryBus.execute).not.toHaveBeenCalled();
  });
});
