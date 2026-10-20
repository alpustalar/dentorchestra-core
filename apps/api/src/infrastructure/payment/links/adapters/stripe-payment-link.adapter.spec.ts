import { ConfigService } from '@nestjs/config';
import { StripeClientFactory } from './stripe-client.factory';
import { StripePaymentLinkAdapter } from './stripe-payment-link.adapter';

describe('StripePaymentLinkAdapter.refund', () => {
  let create: jest.Mock;
  let adapter: StripePaymentLinkAdapter;

  const input = {
    providerRef: 'pi_1',
    amount: 12.5,
    currency: 'EUR' as const,
    idempotencyKey: 'refund-1:1',
  };

  beforeEach(() => {
    create = jest.fn();
    adapter = new StripePaymentLinkAdapter(
      {
        get: () => ({ refunds: { create } }),
      } as unknown as StripeClientFactory,
      { get: jest.fn() } as unknown as ConfigService
    );
  });

  it('idempotencyKey Stripe isteğine iletilir; tutar minor birimde', async () => {
    create.mockResolvedValue({ id: 're_1', status: 'succeeded' });

    await adapter.refund(input);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_1', amount: 1250 }),
      { idempotencyKey: 'refund-1:1' }
    );
  });

  it('succeeded → SUCCEEDED + iade id', async () => {
    create.mockResolvedValue({ id: 're_1', status: 'succeeded' });

    await expect(adapter.refund(input)).resolves.toEqual({
      outcome: 'SUCCEEDED',
      providerRefundRef: 're_1',
    });
  });

  it.each(['failed', 'canceled'])('%s → REJECTED', async (status) => {
    create.mockResolvedValue({ id: 're_1', status, failure_reason: 'x' });

    await expect(adapter.refund(input)).resolves.toMatchObject({
      outcome: 'REJECTED',
      errorCode: 'x',
    });
  });

  it('pending → UNKNOWN (sonuç sonradan belli olur)', async () => {
    create.mockResolvedValue({ id: 're_1', status: 'pending' });

    await expect(adapter.refund(input)).resolves.toMatchObject({
      outcome: 'UNKNOWN',
    });
  });
});
