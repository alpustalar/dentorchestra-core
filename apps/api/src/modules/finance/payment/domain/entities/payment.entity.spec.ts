import { randomUUID } from 'crypto';
import { Payment } from './payment.entity';
import { PaymentRefundedEvent } from '@modules/finance/payment/domain/events/payment-refunded.event';
import { PaymentPaidEvent } from '@modules/finance/payment/domain/events/payment-paid.event';
import { PaymentFailedEvent } from '@modules/finance/payment/domain/events/payment-failed.event';
import { PaymentChargedBackEvent } from '@modules/finance/payment/domain/events/payment-charged-back.event';
import { Money } from '@src/domain/value-objects/money.vo';
import { LogSource } from '@src/domain/constants/log-action.constant';
import {
  InstallmentNotCancellableException,
  InstallmentNotChargeableBackException,
  InstallmentNotCollectibleException,
  InstallmentNotFailableException,
  InstallmentNotFoundException,
  InstallmentNotRefundableException,
  PaymentInvalidPrecisionException,
  RecoveryInstallmentNotCancellableException,
} from '@modules/finance/payment/domain/exceptions/payment.exceptions';

const audit = { actorId: 'user-1', logSource: LogSource.WEB };

/** Hasta kimliği `Patient.id` = UUID'dir (firebaseUid ayrı, nullable bir kolon). */
const patientId = randomUUID();

const buildPayment = (count: number, perInstallment = 1000) => {
  const ids = Array.from({ length: count }, () => randomUUID());
  const payment = Payment.create({
    clinicId: randomUUID(),
    patientId,
    totalAmount: Money.create(perInstallment * count, 'TRY').orThrow(),
    installments: ids.map((id, index) => ({
      id,
      installmentNo: index + 1,
      money: Money.create(perInstallment, 'TRY').orThrow(),
    })),
  });
  return { payment, ids };
};

const statusOf = (payment: Payment, installmentId: string) =>
  payment.installments.find((i) => i.id === installmentId)?.status;

describe('Payment entity — kimlik eşlemesi', () => {
  it('appointmentId randevudan gelir (clinicId YAZILMAZ)', () => {
    // Regresyon: `create` içinde `appointmentId: props.clinicId` yazılıyordu.
    // `payments.appointment_id` tekil + Appointment'a FK olduğu için kayıt ya
    // yanlış randevuya bağlanıyor ya da FK ihlaliyle hiç yazılamıyordu.
    const clinicId = randomUUID();
    const appointmentId = randomUUID();

    const payment = Payment.create({
      clinicId,
      patientId,
      appointmentId,
      totalAmount: Money.create(500, 'TRY').orThrow(),
      installments: [
        {
          id: randomUUID(),
          installmentNo: 1,
          money: Money.create(500, 'TRY').orThrow(),
        },
      ],
    });

    expect(payment.appointmentId?.value).toBe(appointmentId);
    expect(payment.clinicId.value).toBe(clinicId);
  });

  it('randevu verilmezse appointmentId null kalır', () => {
    const { payment } = buildPayment(1);
    expect(payment.appointmentId).toBeNull();
  });

  it('hasta kimliği UUID olarak taşınır', () => {
    const { payment } = buildPayment(1);
    expect(payment.patientId.value).toBe(patientId);
  });

  it('kuruştan ince tutar reddedilir (DB Decimal(10,2) sessizce yuvarlıyordu)', () => {
    expect(() =>
      Payment.create({
        clinicId: randomUUID(),
        patientId,
        totalAmount: Money.create(333.333, 'TRY').orThrow(),
        installments: [
          {
            id: randomUUID(),
            installmentNo: 1,
            money: Money.create(333.333, 'TRY').orThrow(),
          },
        ],
      })
    ).toThrow(PaymentInvalidPrecisionException);
  });
});

describe('Payment entity — tahsilat', () => {
  it('tahsilat event’i yalnız gerçek geçişte fırlar (tekrarlanan callback mükerrer event üretmez)', () => {
    // Regresyon: event'i handler koşulsuz yayınlıyordu; ikinci POS callback'i
    // taksit zaten COMPLETED olsa bile ikinci bir cari kayıt işi ve ikinci bir
    // faturalama denemesi üretiyordu.
    const { payment, ids } = buildPayment(1);

    payment.completeInstallment({ installmentId: ids[0], ...audit });
    payment.completeInstallment({ installmentId: ids[0], ...audit });

    expect(
      payment.getDomainEvents().filter((e) => e instanceof PaymentPaidEvent)
    ).toHaveLength(1);
    expect(payment.status).toBe('COMPLETED');
  });

  it('tahsilat event’i aktörü ve kanalı taşır', () => {
    const { payment, ids } = buildPayment(1);

    payment.completeInstallment({
      installmentId: ids[0],
      ...audit,
      details: 'POS ödemesi tahsil edildi',
    });

    const event = payment.getDomainEvents()[0] as PaymentPaidEvent;
    expect(event.installmentId).toBe(ids[0]);
    expect(event.log?.actorId).toBe('user-1');
    expect(event.log?.source).toBe(LogSource.WEB);
    expect(event.log?.details).toBe('POS ödemesi tahsil edildi');
  });

  it('iade edilmiş taksit yeniden tahsil edilemez', () => {
    // Aynı parayı ikinci kez gelir yazmak olurdu.
    const { payment, ids } = buildPayment(1);
    payment.completeInstallment({ installmentId: ids[0], ...audit });
    payment.refundInstallment({ installmentId: ids[0], ...audit });

    expect(() =>
      payment.completeInstallment({ installmentId: ids[0], ...audit })
    ).toThrow(InstallmentNotCollectibleException);
  });

  it('iptal edilmiş taksit tahsil edilemez', () => {
    const { payment, ids } = buildPayment(1);
    payment.cancelInstallment(ids[0]);

    expect(() =>
      payment.completeInstallment({ installmentId: ids[0], ...audit })
    ).toThrow(InstallmentNotCollectibleException);
  });

  it('olmayan taksit tipli domain hatası verir (ham Error 500’e dönüyordu)', () => {
    const { payment } = buildPayment(1);

    expect(() =>
      payment.completeInstallment({ installmentId: randomUUID(), ...audit })
    ).toThrow(InstallmentNotFoundException);
  });

  it('3 taksitten biri tahsil edilince ödeme PARTIAL olur', () => {
    const { payment, ids } = buildPayment(3);

    payment.completeInstallment({ installmentId: ids[0], ...audit });

    expect(payment.status).toBe('PARTIAL');
  });
});

describe('Payment entity — iade', () => {
  const buildCollected = (count: number) => {
    const { payment, ids } = buildPayment(count);
    ids.forEach((installmentId) =>
      payment.completeInstallment({ installmentId, ...audit })
    );
    payment.flushEvents();
    return { payment, ids };
  };

  it('tahsil edilmemiş taksit iade EDİLEMEZ', () => {
    // Alınmamış parayı geri vermek, defterde karşılığı olmayan bir ters kayıt
    // (gelir eksiği) üretir.
    const { payment, ids } = buildPayment(1);

    expect(() =>
      payment.refundInstallment({ installmentId: ids[0], ...audit })
    ).toThrow(InstallmentNotRefundableException);
    expect(payment.getDomainEvents()).toHaveLength(0);
  });

  it('iade tek bir event üretir (muhasebe ters kaydı iki kez koşmasın)', () => {
    const { payment, ids } = buildCollected(1);

    payment.refundInstallment({ installmentId: ids[0], ...audit });

    expect(
      payment.getDomainEvents().filter((e) => e instanceof PaymentRefundedEvent)
    ).toHaveLength(1);
  });

  it('tekrarlanan iade bildirimi ikinci ters kaydı tetiklemez', () => {
    const { payment, ids } = buildCollected(1);

    payment.refundInstallment({ installmentId: ids[0], ...audit });
    payment.refundInstallment({ installmentId: ids[0], ...audit });

    expect(
      payment.getDomainEvents().filter((e) => e instanceof PaymentRefundedEvent)
    ).toHaveLength(1);
  });

  it('iade event’i aktörü audit alanlarına taşır', () => {
    const { payment, ids } = buildCollected(1);

    payment.refundInstallment({
      installmentId: ids[0],
      ...audit,
      details: 'POS işlemi iade edildi',
    });

    const event = payment.getDomainEvents()[0] as PaymentRefundedEvent;
    expect(event.paymentId).toBe(payment.id.value);
    expect(event.log?.actorId).toBe('user-1');
    expect(event.log?.details).toBe('POS işlemi iade edildi');
  });

  it('details verilmezse varsayılan denetim metni yazılır', () => {
    const { payment, ids } = buildCollected(1);

    payment.refundInstallment({ installmentId: ids[0], ...audit });

    const event = payment.getDomainEvents()[0] as PaymentRefundedEvent;
    expect(event.log?.details).toBe('Ödeme iade edildi');
  });

  it('3 taksitten biri iade edilirse ödeme REFUNDED OLMAZ', () => {
    // Regresyon: `refundInstallment` ödemeyi koşulsuz REFUNDED yapıyordu. Cari
    // özet sorguları yalnız COMPLETED satırları topladığı için hasta, iade
    // edilmeyen iki taksiti de ödememiş gibi görünüyordu.
    const { payment, ids } = buildCollected(3);

    payment.refundInstallment({ installmentId: ids[1], ...audit });

    expect(payment.status).toBe('PARTIAL');
    expect(statusOf(payment, ids[1])).toBe('REFUNDED');
  });

  it('tüm taksitler iade edilince ödeme REFUNDED olur', () => {
    const { payment, ids } = buildCollected(3);

    ids.forEach((installmentId) =>
      payment.refundInstallment({ installmentId, ...audit })
    );

    expect(payment.status).toBe('REFUNDED');
  });

  it('iptal edilmiş taksitler "hepsi iade edildi" kararını engellemez', () => {
    const { payment, ids } = buildPayment(3);
    payment.cancelInstallment(ids[2]);
    [ids[0], ids[1]].forEach((installmentId) => {
      payment.completeInstallment({ installmentId, ...audit });
      payment.refundInstallment({ installmentId, ...audit });
    });

    expect(payment.status).toBe('REFUNDED');
  });
});

describe('Payment entity — iptal ve başarısız deneme', () => {
  it('tahsil edilmiş taksit iptal edilemez (iade yolu kullanılır)', () => {
    const { payment, ids } = buildPayment(1);
    payment.completeInstallment({ installmentId: ids[0], ...audit });

    expect(() => payment.cancelInstallment(ids[0])).toThrow(
      InstallmentNotCancellableException
    );
  });

  it('tüm taksitler iptal edilince ödeme CANCELLED olur', () => {
    const { payment, ids } = buildPayment(2);

    ids.forEach((id) => payment.cancelInstallment(id));

    expect(payment.status).toBe('CANCELLED');
  });

  it('tahsil edilmiş taksit "başarısız" işaretlenemez', () => {
    // Durum PENDING'e çekilirse taksit açık alacak sayılır ama tahsilatın
    // cari/defter kaydı yerinde kalır: rapor ile defter kalıcı olarak çelişir.
    const { payment, ids } = buildPayment(1);
    payment.completeInstallment({ installmentId: ids[0], ...audit });

    expect(() =>
      payment.failInstallment({ installmentId: ids[0], ...audit })
    ).toThrow(InstallmentNotFailableException);
  });

  it('başarısız deneme taksiti PENDING’e döndürür, paidAt temizlenir ve event fırlar', () => {
    const { payment, ids } = buildPayment(1);

    payment.failInstallment({
      installmentId: ids[0],
      ...audit,
      details: 'Yetersiz bakiye',
    });

    expect(statusOf(payment, ids[0])).toBe('PENDING');
    expect(
      payment.installments.find((i) => i.id === ids[0])?.paidAt
    ).toBeNull();
    const event = payment
      .getDomainEvents()
      .find((e) => e instanceof PaymentFailedEvent) as PaymentFailedEvent;
    expect(event.installmentId).toBe(ids[0]);
    expect(event.log?.details).toBe('Yetersiz bakiye');
  });
});

describe('Payment entity — ters ibraz (kaybedilen kart itirazı)', () => {
  const DUE = new Date('2026-10-30T00:00:00Z');

  const chargeBack = (
    payment: Payment,
    installmentId: string,
    over: { recoveryInstallmentId?: string } = {}
  ): string =>
    payment.chargeBackInstallment({
      installmentId,
      ...audit,
      recoveryInstallmentId: over.recoveryInstallmentId ?? randomUUID(),
      recoveryDueDate: DUE,
      caseReference: 'CB-1001',
    });

  const collect = (payment: Payment, installmentId: string) =>
    payment.completeInstallment({ installmentId, ...audit });

  it('taksit CHARGED_BACK olur (REFUNDED değil) ve aynı tutarda PENDING telafi taksidi açılır', () => {
    const { payment, ids } = buildPayment(2, 500);
    collect(payment, ids[0]);

    const recoveryId = chargeBack(payment, ids[0]);

    expect(statusOf(payment, ids[0])).toBe('CHARGED_BACK');
    const recovery = payment.installments.find((i) => i.id === recoveryId)!;
    expect(recovery.status).toBe('PENDING');
    expect(recovery.amount.toString()).toBe('500');
    expect(recovery.currency).toBe('TRY');
    expect(recovery.recoversInstallmentId).toBe(ids[0]);
    expect(recovery.installmentNo).toBe(3);
    expect(recovery.dueDate).toEqual(DUE);
    expect(recovery.paidAt).toBeNull();
    expect(recovery.note).toContain('CB-1001');
  });

  it('telafi taksidi yeni (eklenen) olarak işaretlenir — repository INSERT edebilsin', () => {
    const { payment, ids } = buildPayment(1);
    collect(payment, ids[0]);

    const recoveryId = chargeBack(payment, ids[0]);

    expect([...payment.newInstallmentIds]).toEqual([recoveryId]);
    // Kalıcılaşınca (repository `flushEvents` çağırır) işaret temizlenir; aksi
    // halde ikinci `update()` aynı taksiti yeniden INSERT etmeye çalışırdı.
    payment.flushEvents();
    expect(payment.newInstallmentIds.size).toBe(0);
  });

  it('plan toplamı değişmez: CHARGED_BACK taksit aktif kümenin dışındadır, telafi içindedir', () => {
    // Σ aktif taksit = toplam tutar. İkisi birlikte sayılsaydı plan iki kat görünürdü.
    const { payment, ids } = buildPayment(2, 500);
    collect(payment, ids[0]);
    collect(payment, ids[1]);
    expect(payment.status).toBe('COMPLETED');

    chargeBack(payment, ids[0]);

    // 1 taksit geri alındı, yerine borç doğdu → kısmen tahsilli.
    expect(payment.status).toBe('PARTIAL');
    const live = payment.installments.filter(
      (i) => i.status !== 'CHARGED_BACK' && i.status !== 'CANCELLED'
    );
    const total = live.reduce((acc, i) => acc + Number(i.amount), 0);
    expect(total).toBe(Number(payment.totalAmount.value));
  });

  it('tek taksitli plan geri alınınca ödeme tekrar PENDING olur (borç yeniden doğdu)', () => {
    const { payment, ids } = buildPayment(1);
    collect(payment, ids[0]);
    expect(payment.status).toBe('COMPLETED');

    chargeBack(payment, ids[0]);

    expect(payment.status).toBe('PENDING');
  });

  it('telafi tahsil edilince ödeme yeniden COMPLETED olur', () => {
    const { payment, ids } = buildPayment(1);
    collect(payment, ids[0]);
    const recoveryId = chargeBack(payment, ids[0]);

    collect(payment, recoveryId);

    expect(payment.status).toBe('COMPLETED');
    expect(statusOf(payment, ids[0])).toBe('CHARGED_BACK');
  });

  it('PaymentChargedBackEvent fırlatır: geri alınan + telafi taksidi, aktör ve WARNING seviyesi', () => {
    const { payment, ids } = buildPayment(1);
    collect(payment, ids[0]);
    payment.flushEvents();

    const recoveryId = chargeBack(payment, ids[0]);

    const events = payment
      .getDomainEvents()
      .filter((e) => e instanceof PaymentChargedBackEvent);
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.installmentId).toBe(ids[0]);
    expect(event.recoveryInstallmentId).toBe(recoveryId);
    expect(event.paymentId).toBe(payment.id.value);
    expect(event.log?.actorId).toBe('user-1');
    expect(event.log?.type).toBe('WARNING');
    // İade event'i ile KARIŞMAZ: muhasebe iade ters kaydı koşmamalı.
    expect(
      payment.getDomainEvents().some((e) => e instanceof PaymentRefundedEvent)
    ).toBe(false);
  });

  it('yalnız tahsil edilmiş taksit ters ibraz edilebilir', () => {
    const { payment, ids } = buildPayment(1);

    expect(() => chargeBack(payment, ids[0])).toThrow(
      InstallmentNotChargeableBackException
    );
    expect(payment.newInstallmentIds.size).toBe(0);
  });

  it('iade edilmiş taksit ters ibraz edilemez (para zaten geri gitti)', () => {
    const { payment, ids } = buildPayment(1);
    collect(payment, ids[0]);
    payment.refundInstallment({ installmentId: ids[0], ...audit });

    expect(() => chargeBack(payment, ids[0])).toThrow(
      InstallmentNotChargeableBackException
    );
  });

  it('idempotent: aynı taksit ikinci kez geri alınırsa ikinci telafi AÇILMAZ, olay yeniden fırlamaz', () => {
    const { payment, ids } = buildPayment(1);
    collect(payment, ids[0]);
    const first = chargeBack(payment, ids[0]);
    payment.flushEvents();
    const countAfterFirst = payment.installments.length;

    const second = chargeBack(payment, ids[0]);

    expect(second).toBe(first);
    expect(payment.installments).toHaveLength(countAfterFirst);
    expect(payment.getDomainEvents()).toHaveLength(0);
  });

  it('CHARGED_BACK taksit yeniden tahsil edilemez — yeniden tahsil telafi taksidi üzerinden', () => {
    const { payment, ids } = buildPayment(1);
    collect(payment, ids[0]);
    chargeBack(payment, ids[0]);

    expect(() => collect(payment, ids[0])).toThrow(
      InstallmentNotCollectibleException
    );
  });

  it('CHARGED_BACK taksit iade edilemez, iptal edilemez, başarısız işaretlenemez', () => {
    const { payment, ids } = buildPayment(1);
    collect(payment, ids[0]);
    chargeBack(payment, ids[0]);

    expect(() =>
      payment.refundInstallment({ installmentId: ids[0], ...audit })
    ).toThrow(InstallmentNotRefundableException);
    expect(() => payment.cancelInstallment(ids[0])).toThrow(
      InstallmentNotCancellableException
    );
    expect(() =>
      payment.failInstallment({ installmentId: ids[0], ...audit })
    ).toThrow(InstallmentNotFailableException);
  });

  it('telafi taksidi iptal edilemez — borç geçerliliğini koruyor', () => {
    // İptal edilirse 120 açık kalır, plan "borç yok" der. Değersiz alacak (128/129)
    // ayrı bir muhasebe kararıdır ve henüz akışı yoktur.
    const { payment, ids } = buildPayment(1);
    collect(payment, ids[0]);
    const recoveryId = chargeBack(payment, ids[0]);

    expect(() => payment.cancelInstallment(recoveryId)).toThrow(
      RecoveryInstallmentNotCancellableException
    );
    expect(statusOf(payment, recoveryId)).toBe('PENDING');
  });

  it('tahsil edilmiş telafi tekrar ters ibraz edilebilir (ikinci tur) ve zincir kurulur', () => {
    const { payment, ids } = buildPayment(1);
    collect(payment, ids[0]);
    const first = chargeBack(payment, ids[0]);
    collect(payment, first);

    const second = chargeBack(payment, first);

    const secondRow = payment.installments.find((i) => i.id === second)!;
    expect(secondRow.recoversInstallmentId).toBe(first);
    // Plan: 1 (asıl) → 2 (ilk telafi) → 3 (ikinci telafi).
    expect(secondRow.installmentNo).toBe(3);
    expect(statusOf(payment, first)).toBe('CHARGED_BACK');
  });

  it('telafi taksidi kimliği önceden üretilmiş UUID olmak zorunda', () => {
    const { payment, ids } = buildPayment(1);
    collect(payment, ids[0]);

    expect(() =>
      chargeBack(payment, ids[0], { recoveryInstallmentId: 'uuid-degil' })
    ).toThrow();
  });
});
