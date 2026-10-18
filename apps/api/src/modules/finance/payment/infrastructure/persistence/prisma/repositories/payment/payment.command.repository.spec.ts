/*
 * Prisma delegesi taklit edildiği için mock nesneleri `any` taşır; bu kurallar
 * yalnız bu dosyada kapatılır (üretim kodunda açık kalır).
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { PaymentCommandRepository } from './payment.command.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { Payment } from '@modules/finance/payment/domain/entities/payment.entity';
import { Money } from '@src/domain/value-objects/money.vo';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { txStorage } from '@src/infrastructure/persistence/prisma/transaction';

/**
 * Mapping'i kilitleyen repository testi (CLAUDE.md finans kuralı 9): para
 * taşıyan kolonlar `create` payload'ından düşerse hata vermez, log üretmez ve
 * geri getirilemez. Burada hangi kolonun yazıldığı açıkça sabitlenir.
 */
describe('PaymentCommandRepository (mapping + kilit)', () => {
  const clinicId = randomUUID();
  const patientId = randomUUID();
  const appointmentId = randomUUID();

  const buildDb = () => ({
    payment: {
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
    paymentInstallment: {
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'pay-1' }]),
  });

  const buildRepo = (db: ReturnType<typeof buildDb>) =>
    new PaymentCommandRepository(db as unknown as PrismaService);

  const inTransaction = <T>(db: unknown, work: () => Promise<T>): Promise<T> =>
    txStorage.run({ tx: db, events: [], correlationId: 'c-1' } as never, work);

  const buildPayment = () =>
    Payment.create({
      clinicId,
      patientId,
      appointmentId,
      totalAmount: Money.create(1500.5, 'TRY').orThrow(),
      installments: [
        {
          id: randomUUID(),
          installmentNo: 1,
          money: Money.create(500.5, 'TRY').orThrow(),
        },
        {
          id: randomUUID(),
          installmentNo: 2,
          money: Money.create(1000, 'TRY').orThrow(),
        },
      ],
    });

  it('create: ödeme ve taksit satırlarında para/kimlik kolonları yazılır', async () => {
    const db = buildDb();
    const repo = buildRepo(db);
    const payment = buildPayment();

    await inTransaction(db, () => repo.create(payment));

    const written = db.payment.create.mock.calls[0][0].data;
    expect(written.totalAmount).toBeInstanceOf(Decimal);
    expect(written.totalAmount.toFixed(2)).toBe('1500.50');
    expect(written.currency).toBe('TRY');
    expect(written.clinicId).toBe(clinicId);
    expect(written.patientId).toBe(patientId);
    // Randevu kimliği klinik kimliğiyle doldurulmuyor (tekil + FK kolon).
    expect(written.appointmentId).toBe(appointmentId);

    expect(db.paymentInstallment.create).toHaveBeenCalledTimes(2);
    const lines = db.paymentInstallment.create.mock.calls.map(
      ([arg]) => arg.data
    );
    expect(lines.map((l) => l.amount.toFixed(2))).toEqual([
      '500.50',
      '1000.00',
    ]);
    expect(lines.map((l) => l.currency)).toEqual(['TRY', 'TRY']);
    expect(lines.map((l) => l.installmentNo)).toEqual([1, 2]);
  });

  it('update: taksit durumu ve paidAt yazılır, tutarlara DOKUNULMAZ', async () => {
    const db = buildDb();
    const repo = buildRepo(db);
    const payment = buildPayment();
    const firstInstallmentId = payment.installments[0].id;

    payment.completeInstallment({
      installmentId: firstInstallmentId,
      actorId: 'user-1',
      logSource: LogSource.WEB,
    });

    await inTransaction(db, () => repo.update(payment));

    const paymentData = db.payment.update.mock.calls[0][0].data;
    expect(paymentData.status).toBe('PARTIAL');

    const installmentData = db.paymentInstallment.update.mock.calls.find(
      ([arg]) => arg.where.id === firstInstallmentId
    )?.[0].data;
    expect(installmentData.status).toBe('COMPLETED');
    expect(installmentData.paidAt).toBeInstanceOf(Date);
    // Tahsil edilmiş taksitin tutarı bu yoldan değiştirilemez.
    expect(installmentData).not.toHaveProperty('amount');
    expect(installmentData).not.toHaveProperty('currency');
  });

  it('findByInstallmentIdForUpdate: önce satırı kilitler, sonra okur', async () => {
    const db = buildDb();
    db.paymentInstallment.findUnique.mockResolvedValue({ paymentId: 'pay-1' });
    db.payment.findUnique.mockResolvedValue({
      id: randomUUID(),
      clinicId,
      patientId,
      appointmentId: null,
      providerId: null,
      totalAmount: new Decimal('100.00'),
      currency: 'TRY',
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
      installments: [],
    });
    const repo = buildRepo(db);

    const payment = await inTransaction(db, () =>
      repo.findByInstallmentIdForUpdate('inst-1')
    );

    expect(db.$queryRaw).toHaveBeenCalled();
    expect(payment).toBeInstanceOf(Payment);
  });

  it('findByInstallmentIdForUpdate: taksit yoksa kilit denenmez', async () => {
    const db = buildDb();
    db.paymentInstallment.findUnique.mockResolvedValue(null);
    const repo = buildRepo(db);

    const payment = await inTransaction(db, () =>
      repo.findByInstallmentIdForUpdate('missing')
    );

    expect(payment).toBeNull();
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});
