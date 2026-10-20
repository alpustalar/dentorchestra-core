import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GetInventoryValuationHandler } from './get-inventory-valuation.handler';
import { GetInventoryValuationQuery } from './get-inventory-valuation.query';
import { PolicyFactory } from '@modules/platform/policy/staff/application/policy-factory';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { ActorContext } from '@common/interfaces';
import { LogSource } from '@src/domain/constants/log-action.constant';
import type { IGetContext } from '@common/decorators/get-context.decorator';
import type { InventoryValuationLine } from '@modules/supply/inventory/domain/contracts';

/**
 * Değerleme politikası parti bazlı fiili maliyet; para birimleri **çevrilmez**,
 * toplam para birimi başına verilir ve fonksiyonel (TRY) toplam mutabakatın
 * karşılaştırdığı değerdir.
 */
describe('GetInventoryValuationHandler', () => {
  const CLINIC_A = '11111111-1111-4111-8111-111111111111';
  const CLINIC_B = '22222222-2222-4222-8222-222222222222';
  const ORG_1 = '33333333-3333-4333-8333-333333333333';

  const actor: ActorContext = {
    userId: 'aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h',
    email: 'muhasebe@clinic.com',
    source: LogSource.WEB,
    capabilities: ['finance:read'],
    rolePriority: 70,
    managedClinics: [{ id: CLINIC_A }],
    ownedOrganizations: [],
    clinicId: CLINIC_A,
    organizationId: ORG_1,
  };

  const build = (lines: InventoryValuationLine[]) => {
    const getInventoryValuation = jest.fn().mockResolvedValue(lines);

    const handler = new GetInventoryValuationHandler(
      { getInventoryValuation } as never,
      new PolicyFactory(new EventEmitter2())
    );

    const ctx: IGetContext = { actor, source: ExecutionSources.USER_ACTION };

    return {
      getInventoryValuation,
      run: (clinicId: string = CLINIC_A) =>
        handler.execute(new GetInventoryValuationQuery(clinicId, ctx)),
    };
  };

  const line = (
    overrides: Partial<InventoryValuationLine> = {}
  ): InventoryValuationLine => ({
    productId: 'p1',
    productName: 'Eldiven',
    stockCode: 'ELD-1',
    currency: 'TRY',
    quantity: '10',
    value: '1000.00',
    isProductDeleted: false,
    ...overrides,
  });

  it('para birimi başına toplar ve fonksiyonel toplamı ayrı verir', async () => {
    const { run } = build([
      line({ value: '1000.00' }),
      line({ productId: 'p2', value: '250.50' }),
      line({ productId: 'p3', currency: 'USD', value: '300.00' }),
    ]);

    const result = await run();

    expect(result.data.totals).toEqual([
      { currency: 'TRY', value: '1250.50' },
      { currency: 'USD', value: '300.00' },
    ]);
    expect(result.data.functionalTotal).toBe('1250.50');
    expect(result.data.hasForeignCurrencyStock).toBe(true);
  });

  it('yalnız TRY stok varsa yabancı para işareti düşmez', async () => {
    const { run } = build([line()]);

    const result = await run();

    expect(result.data.hasForeignCurrencyStock).toBe(false);
    expect(result.data.functionalTotal).toBe('1000.00');
  });

  it('stok yoksa sıfır döner (boş rapor hata değildir)', async () => {
    const { run } = build([]);

    const result = await run();

    expect(result.data.lines).toEqual([]);
    expect(result.data.functionalTotal).toBe('0.00');
  });

  it('başka kliniğin stok değeri okunamaz', async () => {
    const { run, getInventoryValuation } = build([]);

    await expect(run(CLINIC_B)).rejects.toThrow(ForbiddenException);
    expect(getInventoryValuation).not.toHaveBeenCalled();
  });
});
