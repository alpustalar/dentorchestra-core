/* eslint-disable @typescript-eslint/unbound-method */
import { GetPurchaseInvoiceAmountsByOrderHandler } from './get-purchase-invoice-amounts-by-order.handler';
import { GetPurchaseInvoiceAmountsByOrderQuery } from './get-purchase-invoice-amounts-by-order.query';
import { IPurchaseInvoiceQueryRepository } from '@modules/finance/purchase-invoice/domain/repositories/purchase-invoice.repository';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';

describe('GetPurchaseInvoiceAmountsByOrderHandler', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const AS_OF = new Date('2026-12-31T20:59:59.999Z');
  const ctx: IGetContext = {
    actor: { userId: 'u-1', clinicId: CLINIC_ID } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  };

  const build = (accessOk = true) => {
    const repo = {
      findAmountsByOrderIdsAsOf: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<IPurchaseInvoiceQueryRepository>;
    const orThrow = jest.fn(() => {
      if (!accessOk) throw new Error('forbidden');
    });
    const policyFactory = {
      finance: jest.fn().mockReturnValue({
        evaluator: { check: jest.fn().mockReturnValue({ orThrow }) },
      }),
    } as never;
    return {
      handler: new GetPurchaseInvoiceAmountsByOrderHandler(repo, policyFactory),
      repo,
    };
  };

  const query = () =>
    new GetPurchaseInvoiceAmountsByOrderQuery({
      clinicId: CLINIC_ID,
      orderIds: ['o1'],
      asOf: AS_OF,
      ctx,
    });

  it('filtreyi aynen repoya geçirir', async () => {
    const { handler, repo } = build();
    await handler.execute(query());

    expect(repo.findAmountsByOrderIdsAsOf).toHaveBeenCalledWith({
      clinicId: CLINIC_ID,
      orderIds: ['o1'],
      asOf: AS_OF,
    });
  });

  it('finans erişimi yoksa okuma yapılmaz', async () => {
    const { handler, repo } = build(false);
    await expect(handler.execute(query())).rejects.toThrow('forbidden');
    expect(repo.findAmountsByOrderIdsAsOf).not.toHaveBeenCalled();
  });
});
