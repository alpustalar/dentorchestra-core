import { ConfigService } from '@nestjs/config';
import { IIyzicoProvider } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/interfaces/iyzico.provider.interface';
import { IyzicoPaymentLinkAdapter } from './iyzico-payment-link.adapter';

describe('IyzicoPaymentLinkAdapter', () => {
  let iyzico: { refund: jest.Mock; paymentInitialize: jest.Mock };
  let adapter: IyzicoPaymentLinkAdapter;

  const refundInput = {
    providerRef: 'ptx-1',
    amount: 100,
    currency: 'TRY' as const,
    idempotencyKey: 'refund-1:1',
  };

  beforeEach(() => {
    iyzico = { refund: jest.fn(), paymentInitialize: jest.fn() };
    adapter = new IyzicoPaymentLinkAdapter(
      iyzico as unknown as IIyzicoProvider,
      {
        get: jest.fn().mockReturnValue('https://x.test'),
      } as unknown as ConfigService
    );
  });

  describe('refund', () => {
    it('status success → SUCCEEDED ve hostReference taşır', async () => {
      iyzico.refund.mockResolvedValue({
        status: 'success',
        hostReference: 'h-9',
      });

      await expect(adapter.refund(refundInput)).resolves.toEqual({
        outcome: 'SUCCEEDED',
        providerRefundRef: 'h-9',
      });
    });

    // P0-1: iyzico iş hatasında FIRLATMAZ, `status: 'failure'` ile çözülür.
    it('status failure → REJECTED (fırlatmaz, "başarılı" saymaz)', async () => {
      iyzico.refund.mockResolvedValue({
        status: 'failure',
        errorCode: '5',
        errorMessage: 'iade edilemez',
      });

      await expect(adapter.refund(refundInput)).resolves.toEqual({
        outcome: 'REJECTED',
        errorCode: '5',
        errorMessage: 'iade edilemez',
      });
    });

    it('idempotencyKey iyzico conversationId olarak gider', async () => {
      iyzico.refund.mockResolvedValue({ status: 'success' });

      await adapter.refund(refundInput);

      expect(iyzico.refund).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'refund-1:1',
          paymentTransactionId: 'ptx-1',
          currency: 'TRY',
        })
      );
    });

    it('taşıma hatası fırlar (çağıran UNKNOWN sayar)', async () => {
      iyzico.refund.mockRejectedValue(new Error('ETIMEDOUT'));

      await expect(adapter.refund(refundInput)).rejects.toThrow('ETIMEDOUT');
    });
  });

  describe('createLink', () => {
    const linkInput = {
      bookingPaymentId: 'bp-1',
      amount: 100,
      currency: 'TRY' as const,
      description: 'Otel',
      buyer: { name: 'A', surname: 'B', email: 'a@b.c', phone: '555' },
      ip: '1.1.1.1',
    };

    it('status failure → fırlatır (URL yokluğundan önce)', async () => {
      iyzico.paymentInitialize.mockResolvedValue({
        status: 'failure',
        errorMessage: 'kart reddi',
        paymentPageUrl: 'https://pay.test/x',
      });

      await expect(adapter.createLink(linkInput)).rejects.toThrow();
    });

    it('başarılı sonuçta URL ve token döner', async () => {
      iyzico.paymentInitialize.mockResolvedValue({
        status: 'success',
        token: 't1',
        paymentPageUrl: 'https://pay.test/x',
      });

      await expect(adapter.createLink(linkInput)).resolves.toMatchObject({
        sessionId: 'bp-1',
        token: 't1',
        url: 'https://pay.test/x',
      });
    });
  });

  it('expireLink desteklenmez', async () => {
    await expect(adapter.expireLink()).resolves.toBe('NOT_SUPPORTED');
  });
});
