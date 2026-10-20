/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-member-access */
import { GetGrniAccrualCandidatesHandler } from './get-grni-accrual-candidates.handler';
import { GetGrniAccrualCandidatesQuery } from './get-grni-accrual-candidates.query';
import { IPurchaseOrderQueryRepository } from '@modules/supply/purchasing/domain/repositories/purchase-order.repository';
import { GetPurchaseInvoiceAmountsByOrderQuery } from '@modules/finance/purchase-invoice/application/queries/get-purchase-invoice-amounts-by-order/get-purchase-invoice-amounts-by-order.query';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';

describe('GetGrniAccrualCandidatesHandler', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const AS_OF = new Date('2026-12-31T20:59:59.999Z');
  const ctx: IGetContext = {
    actor: { userId: 'u-1', clinicId: CLINIC_ID } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  };

  const build = (accessOk = true) => {
    const poQueryRepo = {
      findGrniAccrualOrders: jest.fn().mockResolvedValue([
        {
          id: 'o1',
          supplierId: 's1',
          orderDate: new Date('2026-10-01'),
          currency: 'TRY',
          items: [{ id: 'i1', productId: 'p1' }],
          receipts: [
            {
              source: 'GOODS_RECEIPT',
              lines: [{ itemId: 'i1', quantity: '10', unitPrice: '100.00' }],
            },
          ],
        },
        {
          id: 'o2',
          supplierId: 's1',
          orderDate: new Date('2026-10-02'),
          currency: 'TRY',
          items: [{ id: 'i2', productId: 'p2' }],
          receipts: [],
        },
      ]),
    } as unknown as jest.Mocked<IPurchaseOrderQueryRepository>;

    const execute = jest.fn().mockResolvedValue({
      data: [
        {
          invoiceId: 'inv-1',
          purchaseOrderId: 'o1',
          invoiceDate: new Date('2026-12-01'),
          netTotal: '600.00',
          currency: 'TRY',
          lineAccountCode: '150',
        },
      ],
    });
    const queryBus = { execute } as unknown as TSQueryBus;

    const orThrow = jest.fn(() => {
      if (!accessOk) throw new Error('forbidden');
    });
    const policyFactory = {
      finance: jest.fn().mockReturnValue({
        evaluator: { check: jest.fn().mockReturnValue({ orThrow }) },
      }),
    } as never;

    return {
      handler: new GetGrniAccrualCandidatesHandler(
        poQueryRepo,
        policyFactory,
        queryBus
      ),
      poQueryRepo,
      execute,
    };
  };

  const query = () =>
    new GetGrniAccrualCandidatesQuery({
      clinicId: CLINIC_ID,
      asOf: AS_OF,
      functionalCurrency: 'TRY',
      ctx,
    });

  it('faturaları sipariş kimlikleriyle QueryBus’tan okur ve siparişe göre eşler', async () => {
    const { handler, execute, poQueryRepo } = build();

    const { data } = await handler.execute(query());

    expect(poQueryRepo.findGrniAccrualOrders).toHaveBeenCalledWith({
      clinicId: CLINIC_ID,
      asOf: AS_OF,
    });
    const sent = execute.mock
      .calls[0][0] as GetPurchaseInvoiceAmountsByOrderQuery;
    expect(sent).toBeInstanceOf(GetPurchaseInvoiceAmountsByOrderQuery);
    expect(sent.payload).toMatchObject({
      clinicId: CLINIC_ID,
      orderIds: ['o1', 'o2'],
      asOf: AS_OF,
    });

    // 1000 teslim − 600 fatura = 400
    expect(data.candidates).toHaveLength(1);
    expect(data.candidates[0]).toMatchObject({
      orderId: 'o1',
      accrualAmount: '400.00',
    });
    expect(data.asOf).toEqual(AS_OF);
  });

  it('finans erişimi yoksa hiçbir okuma yapılmaz', async () => {
    const { handler, poQueryRepo, execute } = build(false);

    await expect(handler.execute(query())).rejects.toThrow('forbidden');
    expect(poQueryRepo.findGrniAccrualOrders).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});
