/*
 * Jest mock'ları tiplenmemiş (`any`) nesneler taşır: bus/repo taklitleri gerçek
 * sözleşmeyi değil yalnız testin ihtiyaç duyduğu yüzeyi kurar. Aşağıdaki kurallar
 * YALNIZ bu dosyada kapatılır; üretim kodunda açık kalır.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Decimal } from 'decimal.js';
import { AppointmentCompletedInvoiceListener } from './appointment-completed.listener';

describe('AppointmentCompletedInvoiceListener', () => {
  const make = (payment: unknown) => {
    const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
    const queryBus = {
      execute: jest.fn().mockResolvedValue({ data: payment }),
    };
    // Fatura kesilemezse operatöre uyarı gider; testte yalnız çağrıldığı doğrulanır.
    const criticalFailure = { publish: jest.fn() };
    const listener = new AppointmentCompletedInvoiceListener(
      commandBus as never,
      queryBus as never,
      criticalFailure as never
    );
    return { listener, commandBus, queryBus, criticalFailure };
  };

  const event = {
    patientId: 'patient-1',
    appointmentId: 'apt-1',
    clinicId: 'clinic-1',
  } as never;

  it('randevuya bağlı ödeme tutarıyla fatura komutu üretir', async () => {
    const payment = {
      id: 'pay-1',
      currency: 'TRY',
      totalAmount: new Decimal(250),
    };
    const { listener, commandBus } = make(payment);

    await listener.handle(event);

    const input = commandBus.execute.mock.calls[0][0].input;
    expect(input).toMatchObject({
      clinicId: 'clinic-1',
      patientId: 'patient-1',
      appointmentId: 'apt-1',
      paymentId: 'pay-1',
    });
    // Tutar artık Money VO olarak taşınır.
    expect(input.totalAmount.value.toNumber()).toBe(250);
    expect(input.totalAmount.currency).toBe('TRY');
  });

  it('ödeme yoksa fatura komutu üretmez (sıfır tutarlı fatura kesilmez)', async () => {
    const { listener, commandBus } = make(null);
    await listener.handle(event);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('patientId/appointmentId yoksa hiç sorgu yapmaz', async () => {
    const { listener, queryBus } = make(null);
    await listener.handle({
      patientId: null,
      appointmentId: 'apt-1',
      clinicId: 'c',
    } as never);
    expect(queryBus.execute).not.toHaveBeenCalled();
  });
});
