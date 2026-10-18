/*
 * Bus/repo taklitleri tiplenmemiş (`any`) nesneler taşır; kurallar yalnız bu
 * dosyada kapatılır (üretim kodunda açık kalır).
 */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { Decimal } from 'decimal.js';
import { PosPaymentSyncService } from './pos-payment-sync.service';
import { MarkInstallmentAsPaidCommand } from '@modules/finance/payment/application/commands/mark-installment-as-paid/mark-installment-as-paid.command';
import { MarkInstallmentAsRefundedCommand } from '@modules/finance/payment/application/commands/mark-installment-as-refunded/mark-installment-as-refunded.command';
import { MarkInstallmentAsFailedCommand } from '@modules/finance/payment/application/commands/mark-installment-as-failed/mark-installment-as-failed.command';
import { LogSource } from '@src/domain/constants/log-action.constant';

/**
 * Taksit seçimi POS'ta hareket eden tutara göre yapılır. Önceden yalnız duruma
 * bakılıp **ilk** uygun taksit seçiliyordu; bu iki sessiz para hatası üretiyordu
 * (bkz. servis dokümantasyonu): eksik tahsilatta hayalet gelir, kısmi iadede
 * fazla gelir düşüşü.
 */
describe('PosPaymentSyncService', () => {
  const ctx = {
    actor: { userId: 'u1', source: LogSource.WEB },
    source: 'API',
  } as never;

  const installment = (
    id: string,
    amount: string,
    status: 'PENDING' | 'COMPLETED'
  ) => ({ id, amount: new Decimal(amount), status });

  const make = (installments: ReturnType<typeof installment>[] | null) => {
    const queryBus = {
      execute: jest
        .fn()
        .mockResolvedValue(
          installments === null ? { data: null } : { data: { installments } }
        ),
    };
    const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
    const criticalFailure = { publish: jest.fn() };
    const service = new PosPaymentSyncService(
      commandBus as never,
      queryBus as never,
      criticalFailure as never
    );
    return { service, commandBus, criticalFailure };
  };

  const dispatched = <T>(
    commandBus: { execute: jest.Mock },
    type: new (...args: never[]) => T
  ) =>
    commandBus.execute.mock.calls
      .map(([c]) => c)
      .find((c): c is T => c instanceof type);

  describe('markPaid', () => {
    it('çekilen tutara EŞİT bekleyen taksiti kapatır', () => {
      const { service, commandBus } = make([
        installment('i1', '1000.00', 'PENDING'),
        installment('i2', '500.00', 'PENDING'),
      ]);

      return service
        .markPaid({
          paymentId: 'pay-1',
          clinicId: 'clinic-1',
          amount: new Decimal('500.00'),
          ctx,
        })
        .then(() => {
          const cmd = dispatched(commandBus, MarkInstallmentAsPaidCommand);
          expect(cmd?.payload.installmentId).toBe('i2');
          expect(cmd?.payload.ctx).toBe(ctx);
        });
    });

    it('tutarı eşleşen taksit yoksa ödemeye DOKUNMAZ ve alarm üretir', async () => {
      // 3×1.000 planına 500 ₺ çekim: eskiden 1.000 ₺'lik taksit "tahsil edildi"
      // işaretleniyor, 500 ₺ hayalet gelir yazılıyordu.
      const { service, commandBus, criticalFailure } = make([
        installment('i1', '1000.00', 'PENDING'),
      ]);

      await service.markPaid({
        paymentId: 'pay-1',
        clinicId: 'clinic-1',
        amount: new Decimal('500.00'),
        ctx,
      });

      expect(commandBus.execute).not.toHaveBeenCalled();
      expect(criticalFailure.publish).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'finance.pos.payment-sync' })
      );
    });
  });

  describe('markRefunded', () => {
    it('iade tutarına EŞİT tamamlanmış taksiti iade eder', async () => {
      const { service, commandBus } = make([
        installment('i1', '1000.00', 'COMPLETED'),
        installment('i2', '300.00', 'COMPLETED'),
      ]);

      await service.markRefunded({
        paymentId: 'pay-1',
        clinicId: 'clinic-1',
        amount: new Decimal('300.00'),
        ctx,
      });

      expect(
        dispatched(commandBus, MarkInstallmentAsRefundedCommand)?.payload
          .installmentId
      ).toBe('i2');
    });

    it('KISMİ iade taksiti tümüyle iade etmez; alarm üretir', async () => {
      // 1.000 ₺'lik taksitin 300 ₺'si iade edildiğinde eskiden taksit tümüyle
      // REFUNDED oluyor, muhasebe ters kaydı 1.000 ₺ gelir düşürüyordu.
      const { service, commandBus, criticalFailure } = make([
        installment('i1', '1000.00', 'COMPLETED'),
      ]);

      await service.markRefunded({
        paymentId: 'pay-1',
        clinicId: 'clinic-1',
        amount: new Decimal('300.00'),
        ctx,
      });

      expect(commandBus.execute).not.toHaveBeenCalled();
      expect(criticalFailure.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('markFailed', () => {
    it('tutar eşleşmesi zorunlu değildir (para hareketi yok)', async () => {
      const { service, commandBus, criticalFailure } = make([
        installment('i1', '1000.00', 'PENDING'),
      ]);

      await service.markFailed({
        paymentId: 'pay-1',
        clinicId: 'clinic-1',
        amount: new Decimal('500.00'),
        ctx,
        reason: 'Yetersiz bakiye',
      });

      expect(
        dispatched(commandBus, MarkInstallmentAsFailedCommand)?.payload
          .installmentId
      ).toBe('i1');
      expect(criticalFailure.publish).not.toHaveBeenCalled();
    });
  });

  it('ödeme kaydı yoksa alarm üretmeden çıkar (plana bağlı olmayan çekim)', async () => {
    // "Ödeme yok" ile "uygun taksit yok" ayrı: ilki bir veri bağının hiç
    // kurulmadığı meşru durum, ikincisi para hareket etti ama plana yazılamadı.
    const { service, commandBus, criticalFailure } = make(null);

    await service.markPaid({
      paymentId: 'missing',
      clinicId: 'clinic-1',
      amount: new Decimal('100.00'),
      ctx,
    });

    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(criticalFailure.publish).not.toHaveBeenCalled();
  });
});
