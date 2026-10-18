import { InitializeTaxParametersHandler } from './initialize-tax-parameters.handler';
import { InitializeTaxParametersCommand } from './initialize-tax-parameters.command';
import { TAX_PARAMETER_DEFAULTS } from '@modules/finance/accounting/tax-parameters/domain/constants/tax-parameter-defaults';

describe('InitializeTaxParametersHandler', () => {
  const ctx = {} as never;

  const make = (exists: boolean) => {
    const commandRepo = {
      createMany: jest.fn().mockResolvedValue(undefined),
      existsForClinic: jest.fn().mockResolvedValue(exists),
    };
    const txManager = {
      run: jest.fn().mockImplementation((cb: () => Promise<unknown>) => cb()),
    };
    const tenantScopeResolver = {
      resolve: jest.fn().mockResolvedValue('org-1'),
    };
    const handler = new InitializeTaxParametersHandler(
      commandRepo as never,
      tenantScopeResolver as never,
      txManager as never
    );
    return { handler, commandRepo };
  };

  it('parametre yoksa tüm varsayılanları tek seferde seed eder', async () => {
    const { handler, commandRepo } = make(false);

    await handler.execute(
      new InitializeTaxParametersCommand({ clinicId: 'clinic-1', ctx })
    );

    expect(commandRepo.createMany).toHaveBeenCalledTimes(1);
    const seeded = commandRepo.createMany.mock.calls[0][0];
    expect(seeded).toHaveLength(TAX_PARAMETER_DEFAULTS.length);
    expect(
      seeded.every((p: { validTo: Date | null }) => p.validTo === null)
    ).toBe(true);
  });

  it('idempotent: parametre zaten varsa hiçbir şey yapmaz', async () => {
    const { handler, commandRepo } = make(true);

    await handler.execute(
      new InitializeTaxParametersCommand({ clinicId: 'clinic-1', ctx })
    );

    expect(commandRepo.createMany).not.toHaveBeenCalled();
  });
});
