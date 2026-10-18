import { Prisma } from '@prisma/client';
import { Account } from '@shared';
import { YearEndClosingService } from './year-and-closing.service';
import { AccountResolver } from '@modules/finance/accounting/posting/domain/posting/account-resolver';
import { TrialBalanceRow } from '@modules/finance/accounting/posting/domain/repositories/journal.repository';

/**
 * Yıl sonu kapanışı defterdeki en yüksek etkili **yazma**: kapanan dönemin bütün
 * gelir/gider hesaplarını sıfırlar ve kârı öz kaynağa taşır. Hiç testi yoktu.
 *
 * Kilitlenen dört şey:
 * 1. Fişler `CLOSING` olarak işaretlenir — işaretsiz kalırsa gelir tablosu onları
 *    da sayar ve kapanmış yılın cirosu **sıfır** görünür (hata sessiz: fiş kendi
 *    içinde dengeli olduğu için mizan kontrolleri tutar).
 * 2. Yalnız sonuç hesapları (6/7) kapatılır; bilanço hesabı (1–5) kapatılmaz.
 * 3. 690 havuzu ve 590/591 devri dengeli ve doğru yönlüdür (kâr ↔ zarar).
 * 4. Kapatılacak hareket yoksa fiş üretilmez (ikinci kapanış mükerrer fiş atmaz).
 */
describe('YearEndClosingService', () => {
  const account = (id: string, code: string, name: string): Account =>
    ({
      id,
      code,
      name,
      isActive: true,
      isPostable: true,
    }) as unknown as Account;

  const SALES = account('acc-600', '600', 'Yurtiçi Satışlar');
  const EXPENSE = account('acc-770', '770', 'Genel Yönetim Giderleri');
  const CASH = account('acc-100', '100', 'Kasa');
  const POOL = account('acc-690', '690', 'Dönem Kârı/Zararı');
  const NET_PROFIT = account('acc-590', '590', 'Dönem Net Kârı');
  const NET_LOSS = account('acc-591', '591', 'Dönem Net Zararı');

  const accounts = [SALES, EXPENSE, CASH, POOL, NET_PROFIT, NET_LOSS];

  const row = (
    accountId: string,
    debit: number,
    credit: number
  ): TrialBalanceRow => ({
    accountId,
    totalDebit: new Prisma.Decimal(debit),
    totalCredit: new Prisma.Decimal(credit),
  });

  const generate = (rows: TrialBalanceRow[]) =>
    YearEndClosingService.generateClosingEntries({
      clinicId: 'clinic-1',
      organizationId: 'org-1',
      periodId: 'period-2026',
      entryDate: new Date('2026-12-31T20:59:59.999Z'),
      performedById: 'firebase-uid-1',
      trialBalanceRows: rows,
      resolver: new AccountResolver(accounts),
      accounts,
    });

  it('üretilen fişlerin hepsi CLOSING niteliğindedir (P0)', () => {
    const entries = generate([row(SALES.id, 0, 1000), row(EXPENSE.id, 400, 0)]);

    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      expect(entry.kind).toBe('CLOSING');
      // Persistence'a da taşınmalı: mapping düşürürse kolon varsayılanı
      // (OPERATIONAL) yazılır ve hata DB'de kalıcı olur.
      expect(entry.toPersistence().kind).toBe('CLOSING');
    }
  });

  it('bilanço hesabını kapatmaz — yalnız 6/7 sonuç hesapları', () => {
    const [entryA] = generate([
      row(SALES.id, 0, 1000),
      row(EXPENSE.id, 400, 0),
      row(CASH.id, 5000, 0), // 100 Kasa: devreder, kapatılmaz
    ]);

    const closedAccounts = entryA.lines.items.map((line) => line.accountId);
    expect(closedAccounts).toContain(SALES.id);
    expect(closedAccounts).toContain(EXPENSE.id);
    expect(closedAccounts).not.toContain(CASH.id);
  });

  it('kârda 690 alacaklanır, devir fişi 690 → 590 yapar', () => {
    const [entryA, entryB] = generate([
      row(SALES.id, 0, 1000),
      row(EXPENSE.id, 400, 0),
    ]);

    // Fiş A: 600 borçlandırılır (1000), 770 alacaklandırılır (400),
    // fark (600) 690'a alacak olarak yazılır → fiş dengeli.
    const poolLineA = entryA.lines.items.find((l) => l.accountId === POOL.id);
    expect(poolLineA?.credit.toString()).toBe('600');
    expect(entryA.isBalanced).toBe(true);

    // Fiş B: 690 borçlandırılır, 590 alacaklandırılır (kâr öz kaynağa taşınır).
    const poolLineB = entryB.lines.items.find((l) => l.accountId === POOL.id);
    expect(poolLineB?.debit.toString()).toBe('600');
    expect(
      entryB.lines.items
        .find((l) => l.accountId === NET_PROFIT.id)
        ?.credit.toString()
    ).toBe('600');
    expect(entryB.isBalanced).toBe(true);
  });

  it('zararda devir 591 → 690 yönünde kurulur', () => {
    const [, entryB] = generate([
      row(SALES.id, 0, 400),
      row(EXPENSE.id, 1000, 0),
    ]);

    // Zarar öz kaynağı AZALTIR: 591 borçlanır. Yön ters kurulsaydı zarar,
    // bilançoda kâr gibi görünürdü ve fiş yine dengeli olacağı için fark
    // edilmezdi.
    expect(
      entryB.lines.items
        .find((l) => l.accountId === NET_LOSS.id)
        ?.debit.toString()
    ).toBe('600');
    expect(
      entryB.lines.items.find((l) => l.accountId === POOL.id)?.credit.toString()
    ).toBe('600');
  });

  it('kapatılacak sonuç hesabı yoksa fiş üretilmez (ikinci kapanış mükerrer yazmaz)', () => {
    // Birinci kapanıştan sonra 6/7 bakiyeleri sıfırdır; dönem yeniden açılıp
    // tekrar kapatılsa mizan bu hâli gösterir ve yeni fiş çıkmaz.
    expect(
      generate([row(SALES.id, 1000, 1000), row(CASH.id, 5000, 0)])
    ).toEqual([]);
    expect(generate([])).toEqual([]);
  });

  it('690 havuz hesabının kendisi kapatılmaz (sonsuz döngü / mükerrer kapatma)', () => {
    const [entryA] = generate([
      row(SALES.id, 0, 1000),
      row(POOL.id, 0, 250), // önceki kapanıştan kalan havuz bakiyesi
    ]);

    // 690 kapatma listesine girmemeli: SUMMARY_ACCOUNT_PREFIX ('69') dışlanır.
    // Girseydi havuz hem kapatılan hem dengeleyen hesap olurdu.
    const poolLines = entryA.lines.items.filter((l) => l.accountId === POOL.id);
    expect(poolLines).toHaveLength(1); // yalnız dengeleyen satır
    expect(poolLines[0].credit.toString()).toBe('1000');
  });
});
