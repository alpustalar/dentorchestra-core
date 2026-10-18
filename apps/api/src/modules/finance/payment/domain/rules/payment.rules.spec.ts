import { randomUUID } from 'crypto';
import { Payment } from '@modules/finance/payment/domain/entities/payment.entity';
import { Money } from '@src/domain/value-objects/money.vo';
import { LogSource } from '@src/domain/constants/log-action.constant';
import {
  PaymentNotCancellableException,
  PaymentNotRefundableException,
} from '@modules/finance/payment/domain/exceptions/payment.exceptions';

const audit = { actorId: 'user-1', logSource: LogSource.WEB };
const validateOptions = { businessRulesEnabled: true, systemOverride: false };

/**
 * Regresyon testi (§16 P0-3): `canCancel`/`canRefund` koşulları
 * `payment.validate.status.isCompleted` **Guard nesnesini** `!` ile kullanıyordu.
 * `!nesne` daima `false` olduğu için her iki kural "asla geçerli değil"e
 * düşüyordu: normal aktör hiç iade/iptal edemiyor, sistem aktöründe ise
 * (`systemOverride`) kural hiç değerlendirilmediği için **hiçbir** kontrol
 * kalmıyordu. Tipler uyduğu için derleyici bunu göremiyordu.
 */
describe('PaymentRules', () => {
  const build = (count = 2) => {
    const ids = Array.from({ length: count }, () => randomUUID());
    const payment = Payment.create({
      clinicId: randomUUID(),
      patientId: randomUUID(),
      totalAmount: Money.create(1000 * count, 'TRY').orThrow(),
      installments: ids.map((id, index) => ({
        id,
        installmentNo: index + 1,
        money: Money.create(1000, 'TRY').orThrow(),
      })),
    });
    return { payment, ids };
  };

  const collect = (payment: Payment, ids: string[]) =>
    ids.forEach((installmentId) =>
      payment.completeInstallment({ installmentId, ...audit })
    );

  describe('canRefund', () => {
    it('tamamı tahsil edilmiş ödemede iade yapılabilir', () => {
      const { payment, ids } = build();
      collect(payment, ids);

      expect(payment.rules(validateOptions).canRefund().isValid).toBe(true);
      expect(() =>
        payment.rules(validateOptions).canRefund().orThrow()
      ).not.toThrow();
    });

    it('kısmi tahsilatta iade yapılabilir (tahsil edilen taksit için)', () => {
      const { payment, ids } = build();
      collect(payment, [ids[0]]);

      expect(payment.rules(validateOptions).canRefund().isValid).toBe(true);
    });

    it('hiç tahsilat yoksa iade reddedilir', () => {
      const { payment } = build();

      expect(() =>
        payment.rules(validateOptions).canRefund().orThrow()
      ).toThrow(PaymentNotRefundableException);
    });

    it('tamamı iade edilmiş ödemede iade reddedilir', () => {
      const { payment, ids } = build();
      collect(payment, ids);
      ids.forEach((installmentId) =>
        payment.refundInstallment({ installmentId, ...audit })
      );

      expect(() =>
        payment.rules(validateOptions).canRefund().orThrow()
      ).toThrow(PaymentNotRefundableException);
    });
  });

  describe('canCancel', () => {
    it('bekleyen ödeme iptal edilebilir', () => {
      const { payment } = build();

      expect(payment.rules(validateOptions).canCancel().isValid).toBe(true);
    });

    it('tamamı tahsil edilmiş ödeme iptal edilemez (iade yolu kullanılır)', () => {
      const { payment, ids } = build();
      collect(payment, ids);

      expect(() =>
        payment.rules(validateOptions).canCancel().orThrow()
      ).toThrow(PaymentNotCancellableException);
    });

    it('iade edilmiş ödeme iptal edilemez', () => {
      const { payment, ids } = build(1);
      collect(payment, ids);
      payment.refundInstallment({ installmentId: ids[0], ...audit });

      expect(() =>
        payment.rules(validateOptions).canCancel().orThrow()
      ).toThrow(PaymentNotCancellableException);
    });
  });

  it('systemOverride kuralları atlar ama taksit invariant’ları entity’de durur', () => {
    // Politika atlanabilir; "tahsil edilmemiş taksit iade edilemez" atlanamaz.
    const { payment, ids } = build(1);
    const override = { businessRulesEnabled: true, systemOverride: true };

    expect(payment.rules(override).canRefund().isValid).toBe(true);
    expect(() =>
      payment.refundInstallment({ installmentId: ids[0], ...audit })
    ).toThrow();
  });
});
