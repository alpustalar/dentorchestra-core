import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from 'decimal.js';
import { GetGoodsReceivedNotInvoicedHandler } from './get-goods-received-not-invoiced.handler';
import { GetGoodsReceivedNotInvoicedQuery } from './get-goods-received-not-invoiced.query';
import { PolicyFactory } from '@modules/platform/policy/staff/application/policy-factory';
import { ExecutionSources } from '@src/domain/constants/execution-source.constant';
import { ActorContext } from '@common/interfaces';
import { LogSource } from '@src/domain/constants/log-action.constant';
import type { IGetContext } from '@common/decorators/get-context.decorator';

/**
 * Mal kabul ↔ fatura mutabakatı. Yetki **finans** tarafında: rapor tedarikçi
 * başına tutar ve ay sonu tahakkuk adayı üretiyor — "sipariş geçebilmek" ile
 * "faturalanmamış borç görebilmek" aynı yetki değildir.
 */
describe('GetGoodsReceivedNotInvoicedHandler', () => {
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

  /** Prisma Decimal yerine decimal.js: ikisi de `toString()` taşır. */
  const orderRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'order-1',
    clinicId: CLINIC_A,
    organizationId: ORG_1,
    supplierId: 'supplier-1',
    orderDate: new Date('2026-10-01'),
    currency: 'TRY',
    status: 'PARTIALLY_RECEIVED',
    billingStatus: 'NOT_BILLED',
    grandTotal: new Decimal('1200.00'),
    invoicedTotal: new Decimal('0.00'),
    items: [
      {
        id: 'item-1',
        quantityReceived: new Decimal('10'),
        unitPrice: new Decimal('100'),
        vatRate: 20,
      },
    ],
    ...overrides,
  });

  const build = (rows: Record<string, unknown>[]) => {
    const findReceiptVarianceCandidates = jest.fn().mockResolvedValue(rows);

    const handler = new GetGoodsReceivedNotInvoicedHandler(
      { findReceiptVarianceCandidates } as never,
      new PolicyFactory(new EventEmitter2())
    );

    const ctx: IGetContext = { actor, source: ExecutionSources.USER_ACTION };

    return {
      findReceiptVarianceCandidates,
      run: (clinicId: string = CLINIC_A) =>
        handler.execute(new GetGoodsReceivedNotInvoicedQuery(clinicId, ctx)),
    };
  };

  it('faturası gelmemiş malı tahakkuk adayı olarak raporlar', async () => {
    const { run, findReceiptVarianceCandidates } = build([orderRow()]);

    const result = await run();

    expect(findReceiptVarianceCandidates).toHaveBeenCalledWith(CLINIC_A);
    expect(result.data.lines).toHaveLength(1);
    expect(result.data.lines[0].receiptVariance).toBe('1200.00');
    expect(result.data.totals).toEqual([
      {
        currency: 'TRY',
        notInvoicedTotal: '1200.00',
        notReceivedTotal: '0.00',
        orderCount: 1,
      },
    ]);
  });

  it('sapması olmayan siparişi listeden düşürür', async () => {
    const { run } = build([
      orderRow({
        invoicedTotal: new Decimal('1200.00'),
        billingStatus: 'FULLY_BILLED',
      }),
    ]);

    const result = await run();

    expect(result.data.lines).toEqual([]);
    expect(result.data.totals).toEqual([]);
  });

  it('tek sipariş özetiyle aynı hesabı kullanır (tutar ve KDV dahil değer)', async () => {
    const { run } = build([
      orderRow({
        items: [
          {
            id: 'item-1',
            quantityReceived: new Decimal('3'),
            unitPrice: new Decimal('33.33'),
            vatRate: 10,
          },
        ],
      }),
    ]);

    const result = await run();

    // 3 × 33,33 = 99,99 → KDV 10,00 → 109,99 (satır bazında yuvarlama)
    expect(result.data.lines[0].receivedValue).toBe('109.99');
  });

  it('klinik ve rapor zamanı taşınır', async () => {
    const { run } = build([orderRow()]);

    const result = await run();

    expect(result.data.clinicId).toBe(CLINIC_A);
    expect(result.data.asOf).toBeInstanceOf(Date);
  });

  it('başka kliniğin mutabakatı okunamaz (repo hiç çağrılmaz)', async () => {
    const { run, findReceiptVarianceCandidates } = build([orderRow()]);

    await expect(run(CLINIC_B)).rejects.toThrow(ForbiddenException);
    expect(findReceiptVarianceCandidates).not.toHaveBeenCalled();
  });
});
