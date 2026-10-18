/*
 * Jest mock'ları tiplenmemiş (`any`) nesneler taşır: bus/repo taklitleri gerçek
 * sözleşmeyi değil yalnız testin ihtiyaç duyduğu yüzeyi kurar. Aşağıdaki kurallar
 * YALNIZ bu dosyada kapatılır; üretim kodunda açık kalır.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Decimal } from 'decimal.js';
import { PaymentPaidInvoiceListener } from './payment-paid.listener';

describe('PaymentPaidInvoiceListener', () => {
  const make = (payment: unknown) => {
    const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
    const queryBus = {
      execute: jest.fn().mockResolvedValue({ data: payment }),
    };
    // Fatura kesilemezse operatöre uyarı gider; testte yalnız çağrıldığı doğrulanır.
    const criticalFailure = { publish: jest.fn() };
    const listener = new PaymentPaidInvoiceListener(
      commandBus as never,
      queryBus as never,
      criticalFailure as never
    );
    return { listener, commandBus, queryBus, criticalFailure };
  };

  const event = {
    installmentId: 'inst-1',
    paymentId: 'pay-1',
    appointmentId: 'apt-1',
    clinicId: 'clinic-1',
  } as never;

  it('ödemenin TAMAMI + cari ile fatura komutu üretir (taksit tutarı değil)', async () => {
    const payment = {
      patientId: 'patient-1',
      currency: 'TRY',
      totalAmount: new Decimal(300),
      installments: [
        { id: 'inst-1', amount: new Decimal(100), currency: 'TRY' },
        { id: 'inst-2', amount: new Decimal(100), currency: 'TRY' },
        { id: 'inst-3', amount: new Decimal(100), currency: 'TRY' },
      ],
    };
    const { listener, commandBus } = make(payment);

    await listener.handle(event);

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const input = commandBus.execute.mock.calls[0][0].input;
    expect(input).toMatchObject({
      clinicId: 'clinic-1',
      patientId: 'patient-1',
      paymentId: 'pay-1',
    });
    // §12 P0-1 regresyonu: fatura `payment_id` üzerinde tekil olduğu için ilk
    // taksitte açılır ve sonraki taksitler idempotent atlanır. Tutar taksitten
    // alınırsa hasılatın yalnız 1/3'ü faturalanır, kalan iki taksit HİÇ
    // faturalanmaz (120 Alıcılar ters bakiyeye düşer).
    expect(input.totalAmount.value.toNumber()).toBe(300);
    expect(input.totalAmount.currency).toBe('TRY');
  });

  it('ödeme bulunamazsa fatura komutu üretmez', async () => {
    const { listener, commandBus } = make(null);
    await listener.handle(event);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('hangi taksit tahsil edilirse edilsin aynı tutar faturalanır (olay sırasından bağımsız)', async () => {
    const payment = {
      patientId: 'patient-2',
      currency: 'TRY',
      totalAmount: new Decimal(300),
      installments: [
        { id: 'inst-1', amount: new Decimal(100), currency: 'TRY' },
        { id: 'other', amount: new Decimal(200), currency: 'TRY' },
      ],
    };
    const { listener, commandBus } = make(payment);

    // Son taksitin olayı önce düşse bile fatura tutarı değişmez: randevu
    // tamamlanma dinleyicisi de ödeme toplamını kullanıyor, iki tetikleyici
    // artık aynı faturayı üretir.
    await listener.handle({
      ...(event as object),
      installmentId: 'other',
    } as never);

    expect(
      commandBus.execute.mock.calls[0][0].input.totalAmount.value.toNumber()
    ).toBe(300);
  });

  it('ödemenin para birimi faturaya taşınır (yabancı para tahsilat)', async () => {
    const payment = {
      patientId: 'patient-3',
      currency: 'EUR',
      totalAmount: new Decimal(500),
      installments: [
        { id: 'inst-1', amount: new Decimal(500), currency: 'EUR' },
      ],
    };
    const { listener, commandBus } = make(payment);

    await listener.handle(event);

    const input = commandBus.execute.mock.calls[0][0].input;
    expect(input.totalAmount.currency).toBe('EUR');
    expect(input.totalAmount.value.toNumber()).toBe(500);
  });
});
