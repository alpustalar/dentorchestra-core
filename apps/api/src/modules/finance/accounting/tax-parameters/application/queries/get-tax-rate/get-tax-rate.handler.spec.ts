import { Decimal } from 'decimal.js';
import { GetTaxRateHandler } from './get-tax-rate.handler';
import { GetTaxRateQuery } from './get-tax-rate.query';
import { TaxParameterNotConfiguredException } from '@modules/finance/accounting/tax-parameters/domain/exceptions/tax-parameter-not-configured.exception';
import { TaxParameterKeySchema } from '@shared';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

describe('GetTaxRateHandler', () => {
  const make = (effective: { rate: Decimal } | null) => {
    const repo = { findEffective: jest.fn().mockResolvedValue(effective) };
    const handler = new GetTaxRateHandler(repo as never);
    return { handler, repo };
  };

  it('yapılandırılmış oran varsa onu döner', async () => {
    const { handler, repo } = make({ rate: new Decimal(8) });
    const date = new Date('2026-06-01');

    const res = await handler.execute(
      new GetTaxRateQuery(
        'clinic-1',
        TaxParameterKeySchema.enum.VAT_HEALTH,
        date
      )
    );

    expect(repo.findEffective).toHaveBeenCalledWith(
      'clinic-1',
      TaxParameterKeySchema.enum.VAT_HEALTH,
      date
    );
    expect(res.data).toEqual({
      key: TaxParameterKeySchema.enum.VAT_HEALTH,
      rate: 8,
    });
  });

  it('geçerli parametre yoksa TaxParameterNotConfiguredException fırlatır', async () => {
    const { handler } = make(null);

    await expect(
      handler.execute(
        new GetTaxRateQuery(
          'clinic-1',
          TaxParameterKeySchema.enum.VAT_HEALTH,
          DateTimeManager.create()
        )
      )
    ).rejects.toThrow(TaxParameterNotConfiguredException);
  });
});
