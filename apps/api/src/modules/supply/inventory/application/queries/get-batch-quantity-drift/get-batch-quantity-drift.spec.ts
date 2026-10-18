import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GetBatchQuantityDriftHandler } from './get-batch-quantity-drift.handler';
import { GetBatchQuantityDriftQuery } from './get-batch-quantity-drift.query';
import { PolicyFactory } from '@modules/platform/policy/staff/application/policy-factory';
import { ExecutionSources } from '@src/domain/constants/execution-source.constant';
import { ActorContext } from '@common/interfaces';
import { LogSource } from '@src/domain/constants/log-action.constant';
import type { IGetContext } from '@common/decorators/get-context.decorator';
import type { BatchQuantityDriftLine } from '@modules/supply/inventory/domain/contracts/stock-movement/stock-movement-queries.contracts';

/**
 * `product_batches.quantity` türetilmiş bir alandır; doğruluk kaynağı
 * hareketlerdir. Sapma raporu değerlemenin **tabanını** denetler: taban kayarsa
 * 150 mutabakatı farkı "sebebi bilinmeyen" olarak gösterir.
 *
 * Bu raporda iki yön **netleşir** (mal kabul ↔ fatura mutabakatının aksine):
 * ikisi de aynı şeyin ölçüsüdür — değerleme ne kadar yanlış.
 */
describe('GetBatchQuantityDriftHandler', () => {
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

  const build = (lines: BatchQuantityDriftLine[]) => {
    const getBatchQuantityDrift = jest.fn().mockResolvedValue(lines);

    const handler = new GetBatchQuantityDriftHandler(
      { getBatchQuantityDrift } as never,
      new PolicyFactory(new EventEmitter2())
    );

    const ctx: IGetContext = { actor, source: ExecutionSources.USER_ACTION };

    return {
      getBatchQuantityDrift,
      run: (clinicId: string = CLINIC_A) =>
        handler.execute(new GetBatchQuantityDriftQuery(clinicId, ctx)),
    };
  };

  const line = (
    overrides: Partial<BatchQuantityDriftLine> = {}
  ): BatchQuantityDriftLine => ({
    batchId: 'b1',
    productId: 'p1',
    productName: 'Eldiven',
    stockCode: 'ELD-1',
    lotNumber: 'LOT-1',
    currency: 'TRY',
    batchQuantity: '10',
    movementQuantity: '8',
    quantityDrift: '2',
    valueDrift: '200.00',
    batchUpdatedAt: new Date('2026-10-12T10:00:00.000Z'),
    ...overrides,
  });

  it('para birimi başına değer etkisini toplar ve sapan parti sayısını verir', async () => {
    const { run } = build([
      line({ batchId: 'b1', valueDrift: '200.00' }),
      line({ batchId: 'b2', valueDrift: '50.25' }),
      line({ batchId: 'b3', currency: 'USD', valueDrift: '30.00' }),
    ]);

    const result = await run();

    expect(result.data.totals).toEqual([
      { currency: 'TRY', valueDrift: '250.25', batchCount: 2 },
      { currency: 'USD', valueDrift: '30.00', batchCount: 1 },
    ]);
    expect(result.data.driftedBatchCount).toBe(3);
  });

  it('ters yönlü sapmalar netleşir (ikisi de aynı hatanın ölçüsü)', async () => {
    const { run } = build([
      line({ batchId: 'b1', valueDrift: '200.00' }),
      line({ batchId: 'b2', valueDrift: '-120.00', quantityDrift: '-1' }),
    ]);

    const result = await run();

    expect(result.data.totals).toEqual([
      { currency: 'TRY', valueDrift: '80.00', batchCount: 2 },
    ]);
  });

  it('sapma yoksa rapor boş ve sayaç sıfır (değerlemenin tabanı sağlam)', async () => {
    const { run } = build([]);

    const result = await run();

    expect(result.data.lines).toEqual([]);
    expect(result.data.totals).toEqual([]);
    expect(result.data.driftedBatchCount).toBe(0);
  });

  it('satırlar ve klinik olduğu gibi taşınır (rapor onarım yapmaz)', async () => {
    const lines = [line()];
    const { run } = build(lines);

    const result = await run();

    expect(result.data.clinicId).toBe(CLINIC_A);
    expect(result.data.lines).toBe(lines);
    expect(result.data.asOf).toBeInstanceOf(Date);
  });

  it('başka kliniğin sapması okunamaz', async () => {
    const { run, getBatchQuantityDrift } = build([line()]);

    await expect(run(CLINIC_B)).rejects.toThrow(ForbiddenException);
    expect(getBatchQuantityDrift).not.toHaveBeenCalled();
  });
});
