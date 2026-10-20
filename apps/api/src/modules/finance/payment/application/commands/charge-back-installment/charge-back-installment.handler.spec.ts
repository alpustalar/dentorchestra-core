import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { ChargeBackInstallmentHandler } from './charge-back-installment.handler';
import { ChargeBackInstallmentCommand } from './charge-back-installment.command';
import { Payment } from '@modules/finance/payment/domain/entities/payment.entity';
import { IPaymentCommandRepository } from '@modules/finance/payment/domain/repositories/payment/payment.command.repository';
import {
  InstallmentNotChargeableBackException,
  InstallmentNotFoundException,
  PaymentNotFoundException,
} from '@modules/finance/payment/domain/exceptions/payment.exceptions';
import { PaymentChargedBackEvent } from '@modules/finance/payment/domain/events/payment-charged-back.event';
import { Money } from '@src/domain/value-objects/money.vo';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '@shared/common/constants/execution-source.constant';

/**
 * Kaybedilen kart itirazının ödeme planına yansıması. Plan tarafı hata
 * fırlatmak yerine sonucu raporlar (NOT_LINKED / NO_MATCHING_INSTALLMENT):
 * sağlayıcı parayı çoktan geri almıştır, defter geri sarılamaz.
 */
describe('ChargeBackInstallmentHandler', () => {
  const CLINIC_ID = randomUUID();
  const OTHER_CLINIC_ID = randomUUID();
  const ACTOR_ID = 'aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h';
  const DUE = new Date('2026-10-30T00:00:00Z');
  const audit = { actorId: ACTOR_ID, logSource: LogSource.WEB };

  const ctx: IGetContext = {
    actor: {
      userId: ACTOR_ID,
      clinicId: CLINIC_ID,
      source: LogSource.WEB,
    } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  };

  /** 3 taksitlik plan: ilk ikisi tahsil edilmiş (aynı tutar), üçüncüsü bekliyor. */
  const buildPayment = (amount = 500) => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const payment = Payment.create({
      clinicId: CLINIC_ID,
      patientId: randomUUID(),
      totalAmount: Money.create(amount * 3, 'TRY').orThrow(),
      installments: ids.map((id, index) => ({
        id,
        installmentNo: index + 1,
        money: Money.create(amount, 'TRY').orThrow(),
      })),
    });
    payment.completeInstallment({ installmentId: ids[0], ...audit });
    payment.completeInstallment({ installmentId: ids[1], ...audit });
    payment.flushEvents();
    return { payment, ids };
  };

  const build = (payment: Payment | null) => {
    let txDepth = 0;
    const depthAtCall: Record<string, number> = {};

    // Kilitsiz `findById` bilerek tanımsız: handler kullanırsa test patlar.
    const findByIdForUpdate = jest.fn(() => {
      depthAtCall.lock = txDepth;
      return Promise.resolve(payment);
    });
    const update = jest.fn((entity: Payment) => Promise.resolve(entity));
    const paymentRepo = {
      findByIdForUpdate,
      update,
    } as unknown as IPaymentCommandRepository;

    const outboxRun = jest.fn(async (cb: () => Promise<unknown>) => {
      txDepth++;
      try {
        return await cb();
      } finally {
        txDepth--;
      }
    });
    const txManager = {
      outboxRun,
      run: jest.fn(() => {
        throw new Error('run() kullanılmamalı — kritik işlem outboxRun ister');
      }),
    } as unknown as TransactionManager;

    return {
      handler: new ChargeBackInstallmentHandler(paymentRepo, txManager),
      findByIdForUpdate,
      update,
      outboxRun,
      depthAtCall,
    };
  };

  const command = (
    paymentId: string,
    over: Partial<ChargeBackInstallmentCommand['payload']> = {}
  ) =>
    new ChargeBackInstallmentCommand({
      paymentId,
      clinicId: CLINIC_ID,
      amount: new Decimal('500.00'),
      caseReference: 'CB-1001',
      dueDate: DUE,
      ctx,
      ...over,
    });

  describe('sanal POS (taksit biliniyor)', () => {
    it('taksit CHARGED_BACK olur, telafi açılır, yanıt iki kimliği de taşır', async () => {
      const { payment, ids } = buildPayment();
      const { handler, update } = build(payment);

      const result = await handler.execute(
        command(payment.id.value, { installmentId: ids[0] })
      );

      expect(result.outcome).toBe('CHARGED_BACK');
      if (result.outcome !== 'CHARGED_BACK') return;
      expect(result.installmentId).toBe(ids[0]);
      const recovery = payment.installments.find(
        (i) => i.id === result.recoveryInstallmentId
      )!;
      expect(recovery.recoversInstallmentId).toBe(ids[0]);
      expect(recovery.status).toBe('PENDING');
      expect(recovery.dueDate).toEqual(DUE);
      expect(update).toHaveBeenCalledWith(payment);
    });

    it('PaymentChargedBackEvent entity’de raise edilir (handler yayınlamaz)', async () => {
      const { payment, ids } = buildPayment();
      const { handler } = build(payment);

      await handler.execute(
        command(payment.id.value, { installmentId: ids[0] })
      );

      // `update()` mock olduğu için olay flush edilmedi → entity'de bekliyor.
      const events = payment
        .getDomainEvents()
        .filter((e) => e instanceof PaymentChargedBackEvent);
      expect(events).toHaveLength(1);
    });

    it('kısmi itiraz taksit granülerliğine sığmaz: plana dokunulmaz, elle eşleştirme istenir', async () => {
      // 500 TL'lik taksite 200 TL itiraz: taksit bölünmez; yanlış tutarda telafi
      // açmak ya da taksidi tümüyle geri almak defteri bozardı.
      const { payment, ids } = buildPayment();
      const { handler, update } = build(payment);

      const result = await handler.execute(
        command(payment.id.value, {
          installmentId: ids[0],
          amount: new Decimal('200.00'),
        })
      );

      expect(result).toEqual({ outcome: 'NO_MATCHING_INSTALLMENT' });
      expect(update).not.toHaveBeenCalled();
      expect(payment.installments.find((i) => i.id === ids[0])?.status).toBe(
        'COMPLETED'
      );
    });

    it('taksit bu ödemeye ait değilse tipli hata (bozuk bağ sessizce geçmez)', async () => {
      const { payment } = buildPayment();
      const { handler, update } = build(payment);

      await expect(
        handler.execute(
          command(payment.id.value, { installmentId: randomUUID() })
        )
      ).rejects.toBeInstanceOf(InstallmentNotFoundException);

      expect(update).not.toHaveBeenCalled();
    });

    it('tahsil edilmemiş taksit geri alınamaz (alınmamış parayı geri almak olmaz)', async () => {
      const { payment, ids } = buildPayment();
      const { handler, update } = build(payment);

      await expect(
        handler.execute(command(payment.id.value, { installmentId: ids[2] }))
      ).rejects.toBeInstanceOf(InstallmentNotChargeableBackException);

      expect(update).not.toHaveBeenCalled();
    });

    it('plan yoksa ve taksit biliniyorsa bozuk veridir: tipli hata, NOT_LINKED değil', async () => {
      const { handler } = build(null);

      await expect(
        handler.execute(command(randomUUID(), { installmentId: randomUUID() }))
      ).rejects.toBeInstanceOf(PaymentNotFoundException);
    });
  });

  describe('fiziksel POS (taksit bilinmiyor → tutar eşleşmesi)', () => {
    it('tutara birebir eşit TAMAMLANMIŞ ilk taksidi bulur', async () => {
      const { payment, ids } = buildPayment();
      const { handler } = build(payment);

      const result = await handler.execute(command(payment.id.value));

      expect(result.outcome).toBe('CHARGED_BACK');
      if (result.outcome !== 'CHARGED_BACK') return;
      // İki taksit de 500 TL ve tamamlanmış: ilki seçilir (eşit tutarlı taksitler
      // birbirinin yerine geçer; `PosPaymentSyncService` ile aynı kural).
      expect(result.installmentId).toBe(ids[0]);
    });

    it('aynı tutarlı BEKLEYEN taksit eşleşmez — parası hareket etmemiş taksit geri alınmaz', async () => {
      const { payment, ids } = buildPayment();
      // İki tamamlanmış taksit geri alınır; üçüncü (PENDING, 500) eşleşmemeli.
      const { handler } = build(payment);

      await handler.execute(command(payment.id.value));
      await handler.execute(command(payment.id.value));
      const third = await handler.execute(command(payment.id.value));

      expect(third).toEqual({ outcome: 'NO_MATCHING_INSTALLMENT' });
      expect(payment.installments.find((i) => i.id === ids[2])?.status).toBe(
        'PENDING'
      );
    });

    it('tutara eşit tamamlanmış taksit yoksa plana dokunulmaz', async () => {
      const { payment } = buildPayment();
      const { handler, update } = build(payment);

      const result = await handler.execute(
        command(payment.id.value, { amount: new Decimal('123.45') })
      );

      expect(result).toEqual({ outcome: 'NO_MATCHING_INSTALLMENT' });
      expect(update).not.toHaveBeenCalled();
    });

    it('ödeme kaydı yoksa NOT_LINKED (satırın paymentId’si boşa düşmüş olabilir)', async () => {
      const { handler, update } = build(null);

      const result = await handler.execute(command(randomUUID()));

      expect(result).toEqual({ outcome: 'NOT_LINKED' });
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('güvenceler', () => {
    it('başka kliniğin planı: varlığı sızdırılmadan PaymentNotFound', async () => {
      const { payment, ids } = buildPayment();
      const { handler, update } = build(payment);

      await expect(
        handler.execute(
          command(payment.id.value, {
            installmentId: ids[0],
            clinicId: OTHER_CLINIC_ID,
          })
        )
      ).rejects.toBeInstanceOf(PaymentNotFoundException);

      expect(update).not.toHaveBeenCalled();
    });

    it('ödeme satırı KİLİTLİ okunur ve her şey outboxRun içinde yürür', async () => {
      const { payment, ids } = buildPayment();
      const { handler, findByIdForUpdate, outboxRun, depthAtCall } =
        build(payment);

      await handler.execute(
        command(payment.id.value, { installmentId: ids[0] })
      );

      expect(outboxRun).toHaveBeenCalledTimes(1);
      expect(findByIdForUpdate).toHaveBeenCalledWith(payment.id.value);
      expect(depthAtCall.lock).toBe(1);
    });

    it('yeniden işleme (zaten CHARGED_BACK) ikinci telafi açmaz; mevcut telafinin kimliği döner', async () => {
      const { payment, ids } = buildPayment();
      const { handler } = build(payment);

      const first = await handler.execute(
        command(payment.id.value, { installmentId: ids[0] })
      );
      const countAfterFirst = payment.installments.length;
      const second = await handler.execute(
        command(payment.id.value, { installmentId: ids[0] })
      );

      expect(second).toEqual(first);
      expect(payment.installments).toHaveLength(countAfterFirst);
    });
  });
});
