/*
 * Jest mock'ları tiplenmemiş (`any`) nesneler taşır; kurallar yalnız bu
 * dosyada kapatılır.
 */
/* eslint-disable @typescript-eslint/require-await */
import { randomUUID } from 'crypto';
import { CreatePaymentHandler } from './create-payment.handler';
import { CreatePaymentCommand } from './create-payment.command';
import { Payment } from '@modules/finance/payment/domain/entities/payment.entity';
import { AppointmentChargeTotals } from '@modules/finance/treatment-charge/domain/value-objects/appointment-charge-totals.vo';
import {
  PaymentAmountUnresolvableException,
  PaymentChargeCurrencyMismatchException,
} from '@modules/finance/payment/domain/exceptions/payment.exceptions';

/**
 * Tahsilat tutarı işlem satırlarından türüyorsa:
 *  - okuma **kilitli** ve ödeme yazmasıyla aynı transaction'da olmalı,
 *  - para birimi tutarla **aynı kaynaktan** gelmeli (eskiden istemciden geliyordu).
 */
describe('CreatePaymentHandler — satırlardan türeyen tutar', () => {
  const clinicId = randomUUID();
  const patientId = randomUUID();
  const appointmentId = randomUUID();

  const totals = (currency: 'TRY' | 'EUR') =>
    AppointmentChargeTotals.fromSummary({
      appointmentId,
      clinicId,
      patientId,
      currency,
      listTotal: '1200.00',
      discountTotal: '0.00',
      netTotal: '1000.00',
      vatTotal: '200.00',
      grandTotal: '1200.00',
      vatRate: 20,
      lineCount: 2,
    });

  const make = (chargeTotals: AppointmentChargeTotals | null) => {
    const paymentRepo = {
      create: jest.fn(async (payment: Payment) => payment),
    };
    const order: string[] = [];
    const service = {
      lockAndGetAppointmentTotals: jest.fn(async () => {
        order.push('lock');
        return chargeTotals;
      }),
    };
    const txManager = {
      run: jest.fn(async (work: () => Promise<unknown>) => {
        order.push('tx');
        return work();
      }),
    };

    return {
      handler: new CreatePaymentHandler(
        paymentRepo as never,
        service as never,
        txManager as never
      ),
      paymentRepo,
      service,
      order,
    };
  };

  const command = (currency: 'TRY' | 'EUR' = 'TRY') =>
    new CreatePaymentCommand({
      clinicId,
      patientId,
      appointmentId,
      currency,
    } as never);

  it('tutarı ve para birimini satırlardan alır; okuma transaction İÇİNDE', async () => {
    const { handler, paymentRepo, order } = make(totals('TRY'));

    await handler.execute(command('TRY'));

    // Kilitli okuma transaction açıldıktan SONRA yapılır.
    expect(order).toEqual(['tx', 'lock']);

    const saved = paymentRepo.create.mock.calls[0][0];
    expect(saved.totalAmount.toApiFormat()).toBe('1200.00');
    expect(saved.totalAmount.currency).toBe('TRY');
  });

  it('satırlar farklı para birimindeyse tahsilat oluşturulmaz', async () => {
    const { handler, paymentRepo } = make(totals('EUR'));

    await expect(handler.execute(command('TRY'))).rejects.toBeInstanceOf(
      PaymentChargeCurrencyMismatchException
    );
    expect(paymentRepo.create).not.toHaveBeenCalled();
  });

  it('satır yoksa tipli hata fırlatır', async () => {
    const { handler } = make(null);

    await expect(handler.execute(command('TRY'))).rejects.toBeInstanceOf(
      PaymentAmountUnresolvableException
    );
  });
});
