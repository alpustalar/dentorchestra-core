/*
 * Prisma delegesi taklit edildiği için mock nesneleri `any` taşır; bu kurallar
 * yalnız bu dosyada kapatılır (üretim kodunda açık kalır).
 */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
import { Prisma } from '@prisma/client';
import { FinanceLedgerQueryRepository } from './finance-ledger.query.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';

/**
 * Para birimi kırılımını **kilitleyen** test: gruplama anahtarından `currency`
 * düşerse sorgu yine çalışır, hata vermez ve 1.000 EUR ile 1.000 TRY'yi
 * toplayıp 2.000 yazar. Bu sessiz bozulmayı yalnız böyle bir test tutar.
 */
describe('FinanceLedgerQueryRepository (para birimi kırılımı)', () => {
  const dec = (v: string) => new Prisma.Decimal(v);

  const buildRepo = (db: unknown) =>
    new FinanceLedgerQueryRepository(db as PrismaService);

  /**
   * `jest.fn(async () => …)` argüman tipini boş tuple olarak çıkarır; sorgu
   * argümanını okumak için tek yer burada açılır.
   */
  const argOf = (mock: jest.Mock, index = 0): any =>
    mock.mock.calls[index]?.[0];

  it('klinik özetini para birimi başına döner', async () => {
    const groupBy = jest.fn(async () => [
      {
        type: 'INCOME',
        currency: 'TRY',
        _sum: { amount: dec('1500.50') },
        _count: { id: 3 },
      },
      {
        type: 'INCOME',
        currency: 'EUR',
        _sum: { amount: dec('1000.00') },
        _count: { id: 1 },
      },
      {
        type: 'EXPENSE',
        currency: 'TRY',
        _sum: { amount: dec('500.00') },
        _count: { id: 2 },
      },
    ]);

    const repo = buildRepo({ financeLedger: { groupBy } });

    const summary = await repo.getClinicSummary('clinic-1', {});

    expect(argOf(groupBy).by).toEqual(['type', 'currency']);

    const tryTotal = summary.totals.find((t) => t.currency === 'TRY');
    const eurTotal = summary.totals.find((t) => t.currency === 'EUR');

    expect(tryTotal).toEqual({
      currency: 'TRY',
      totalIncome: '1500.50',
      totalExpenses: '500.00',
      balance: '1000.50',
      entryCount: 5,
    });
    expect(eurTotal?.balance).toBe('1000.00');
    // Satır sayısı para biriminden bağımsız toplanabilir.
    expect(summary.entryCount).toBe(6);
  });

  it('hasta bakiyesini para birimi başına döner; iade edilen plan borç yazmaz', async () => {
    const ledgerGroupBy = jest.fn(async () => [
      {
        type: 'INCOME',
        currency: 'TRY',
        _sum: { amount: dec('800.00') },
      },
      {
        type: 'INCOME',
        currency: 'EUR',
        _sum: { amount: dec('200.00') },
      },
    ]);
    const paymentGroupBy = jest.fn(async () => [
      { currency: 'TRY', _sum: { totalAmount: dec('1000.00') } },
      { currency: 'EUR', _sum: { totalAmount: dec('200.00') } },
    ]);

    const repo = buildRepo({
      financeLedger: { groupBy: ledgerGroupBy },
      payment: { groupBy: paymentGroupBy },
    });

    const summary = await repo.getPatientSummary('patient-1');

    expect(argOf(ledgerGroupBy).by).toEqual(['type', 'currency']);
    expect(argOf(paymentGroupBy).by).toEqual(['currency']);
    // İade edilmiş ödeme planı hastanın borcu değildir.
    expect(argOf(paymentGroupBy).where.status.notIn).toEqual(
      expect.arrayContaining(['CANCELLED', 'FAILED', 'REFUNDED'])
    );

    expect(summary.balances).toEqual([
      {
        currency: 'TRY',
        totalServiceAmount: '1000.00',
        totalPayments: '800.00',
        balance: '-200.00',
      },
      {
        currency: 'EUR',
        totalServiceAmount: '200.00',
        totalPayments: '200.00',
        balance: '0.00',
      },
    ]);
  });

  it('hasta-başı geliri para birimiyle birlikte döner', async () => {
    const groupBy = jest.fn(async () => [
      { patientId: 'p1', currency: 'TRY', _sum: { amount: dec('300.00') } },
      { patientId: 'p1', currency: 'EUR', _sum: { amount: dec('100.00') } },
      { patientId: null, currency: 'TRY', _sum: { amount: dec('50.00') } },
    ]);

    const repo = buildRepo({ financeLedger: { groupBy } });

    const rows = await repo.sumIncomeByPatientIds({
      patientIds: ['p1'],
      from: new Date('2026-09-01'),
      to: new Date('2026-09-30'),
    });

    expect(argOf(groupBy).by).toEqual(['patientId', 'currency']);
    expect(rows).toEqual([
      { patientId: 'p1', currency: 'TRY', revenue: '300.00' },
      { patientId: 'p1', currency: 'EUR', revenue: '100.00' },
    ]);
  });

  it('boş id listesinde deftere hiç gitmez', async () => {
    const findMany = jest.fn();
    const repo = buildRepo({ financeLedger: { findMany } });

    await expect(repo.findEntryStatusesByInstallmentIds([])).resolves.toEqual(
      []
    );
    expect(findMany).not.toHaveBeenCalled();
  });
});
