import { SetTaxParameterHandler } from './set-tax-parameter.handler';
import { SetTaxParameterCommand } from './set-tax-parameter.command';
import { TaxParameterKeySchema } from '@shared';
import {
  InvalidTaxRateException,
  InvalidTaxValidityRangeException,
  TaxParameterAlreadyClosedException,
} from '@modules/finance/accounting/tax-parameters/domain/exceptions';
import { TaxParameter } from '@modules/finance/accounting/tax-parameters/domain/entities/tax-parameter.entity';

describe('SetTaxParameterHandler', () => {
  const ctx = {} as never;
  // Yasal KDV oranı: eski test %8 kullanıyordu ve geçiyordu — yani parametre
  // tablosuna yasal olmayan bir oranın yazılabildiğini belgeliyordu. O oran artık
  // yazma kapısında reddediliyor (aşağıda ayrı test).
  const input = (validFrom?: Date, rate = 20) => ({
    clinicId: 'clinic-1',
    organizationId: 'org-1',
    key: TaxParameterKeySchema.enum.VAT_HEALTH,
    rate,
    validFrom,
  });

  const make = (open: TaxParameter | null) => {
    const commandRepo = {
      create: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
      update: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
      findOpenForUpdate: jest.fn().mockResolvedValue(open),
    };
    const txManager = {
      run: jest.fn().mockImplementation((cb: () => Promise<unknown>) => cb()),
    };
    // Kiracı kapsamı kontrolü geçer kabul edilir; reddedilme yolu policy'nin
    // kendi testlerinde doğrulanıyor.
    const policyFactory = {
      finance: jest.fn().mockReturnValue({
        evaluator: {
          check: jest.fn().mockReturnValue({ orThrow: () => undefined }),
        },
      }),
    };
    const handler = new SetTaxParameterHandler(
      commandRepo as never,
      txManager as never,
      policyFactory as never
    );
    return { handler, commandRepo };
  };

  const openVersion = (validFrom: Date, closedAt?: Date) => {
    const parameter = TaxParameter.create({
      clinicId: 'clinic-1',
      organizationId: 'org-1',
      key: TaxParameterKeySchema.enum.VAT_HEALTH,
      rate: 10,
      validFrom,
    });
    if (closedAt) parameter.close(closedAt);
    return parameter;
  };

  it('açık sürüm yoksa yeni parametre oluşturur ve id döner', async () => {
    const { handler, commandRepo } = make(null);

    const id = await handler.execute(
      new SetTaxParameterCommand(input(new Date('2026-06-01')), ctx)
    );

    expect(commandRepo.create).toHaveBeenCalledTimes(1);
    expect(commandRepo.update).not.toHaveBeenCalled();
    expect(typeof id).toBe('string');
  });

  it('açık sürüm varsa onu kapatır ve yeni sürüm açar (2 kayıt)', async () => {
    const open = openVersion(new Date('2026-01-01'));
    const { handler, commandRepo } = make(open);

    await handler.execute(
      new SetTaxParameterCommand(input(new Date('2026-06-01')), ctx)
    );

    expect(open.validTo).toEqual(new Date('2026-06-01'));
    expect(commandRepo.update).toHaveBeenCalledTimes(1); // close
    expect(commandRepo.create).toHaveBeenCalledTimes(1); // yeni sürüm
  });

  it('validFrom mevcut açık sürümden önce/eşitse reddeder', async () => {
    const { handler } = make(openVersion(new Date('2026-06-01')));

    await expect(
      handler.execute(
        new SetTaxParameterCommand(input(new Date('2026-06-01')), ctx)
      )
    ).rejects.toThrow(InvalidTaxValidityRangeException);
  });

  it('kilit alındıktan sonra sürüm kapanmışsa yeni sürüm AÇMAZ (çift açık sürüm)', async () => {
    // Eşzamanlılık yolu: iki istek de aynı açık sürümü görür; ilki kilidi alıp
    // kapatır. İkincisi kilidi aldıktan sonra satırı **kapalı** okur. Eskiden
    // `close()` sessizce geri dönüyor ve ikinci istek yeni sürümü yine açıyordu →
    // aynı anahtar için iki `validTo = null` satırı ve "hangi oran yürürlükte"
    // sorusunun eşzamanlılığa göre değişmesi.
    const alreadyClosed = openVersion(
      new Date('2026-01-01'),
      new Date('2026-06-01')
    );
    const { handler, commandRepo } = make(alreadyClosed);

    await expect(
      handler.execute(
        new SetTaxParameterCommand(input(new Date('2026-07-01')), ctx)
      )
    ).rejects.toThrow(TaxParameterAlreadyClosedException);

    expect(commandRepo.create).not.toHaveBeenCalled();
  });

  it('yasal olmayan KDV oranını yazma kapısında reddeder', async () => {
    const { handler, commandRepo } = make(null);

    await expect(
      handler.execute(
        new SetTaxParameterCommand(input(new Date('2026-06-01'), 8), ctx)
      )
    ).rejects.toThrow(InvalidTaxRateException);

    expect(commandRepo.create).not.toHaveBeenCalled();
  });
});
