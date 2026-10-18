import { randomUUID } from 'crypto';
import { BankStatement } from './bank-statement.entity';
import {
  BankStatementBalanceMismatchException,
  BankStatementEmptyLinesException,
  BankStatementInvalidPrecisionException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';

/**
 * Ekstre bu modülün tek gerçeklik kaynağı: defterle farkı onunla kovalıyoruz.
 * Dosyanın kendi içinde tutarsız olması (düşen/çiftlenen satır) hiçbir yerde
 * hata üretmiyordu — eksik hareket "bankada yok" gibi görünüyordu.
 */
describe('BankStatement — ekstre bütünlüğü', () => {
  const BANK_ACCOUNT_ID = randomUUID();
  const CLINIC_ID = randomUUID();
  const ORGANIZATION_ID = randomUUID();
  /** İçe alan personelin kimliği Firebase UID'dir — UUID DEĞİL. */
  const ACTOR_ID = 'aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h';

  const line = (amount: number, day = 5) => ({
    transactionDate: new Date(`2026-05-0${day}`),
    description: `hareket ${amount}`,
    amount,
  });

  const build = (overrides: {
    openingBalance?: number | null;
    closingBalance?: number | null;
    lines?: ReturnType<typeof line>[];
  }) =>
    BankStatement.create({
      bankAccountId: BANK_ACCOUNT_ID,
      clinicId: CLINIC_ID,
      organizationId: ORGANIZATION_ID,
      periodStart: new Date('2026-05-01'),
      periodEnd: new Date('2026-05-31'),
      openingBalance: overrides.openingBalance,
      closingBalance: overrides.closingBalance,
      importedById: ACTOR_ID,
      lines: overrides.lines ?? [line(100)],
    });

  it('personel kimliği (Firebase UID) ile ekstre içe alınabilir', () => {
    // Regresyon: `importedById` UUID VO'sundan geçiriliyordu → ekstre import
    // her gerçek personel için InvalidUuidException ile patlıyordu.
    const statement = build({ openingBalance: 0, closingBalance: 100 });

    expect(statement.importedById).toBe(ACTOR_ID);
    expect(statement.lines).toHaveLength(1);
  });

  it('açılış + hareketler = kapanış tutuyorsa kabul eder', () => {
    const statement = build({
      openingBalance: 1000,
      closingBalance: 1150.5,
      lines: [line(250.5), line(-100, 6)],
    });

    expect(statement.closingBalance?.toFixed(2)).toBe('1150.50');
  });

  it('bir satır düşerse/çiftlenirse reddeder (tolerans yok)', () => {
    expect(() =>
      build({
        openingBalance: 1000,
        closingBalance: 1150.5,
        // 250.50 satırı eksik → dosya kendi içinde tutarsız
        lines: [line(-100)],
      })
    ).toThrow(BankStatementBalanceMismatchException);
  });

  it('bakiye beyanı yoksa kontrol edilmez (bazı CSV formatlarında kolon yok)', () => {
    const statement = build({
      openingBalance: null,
      closingBalance: null,
      lines: [line(13.37)],
    });

    expect(statement.openingBalance).toBeNull();
  });

  it('kuruştan ince tutar reddedilir', () => {
    expect(() =>
      build({ openingBalance: 0, closingBalance: 0.005, lines: [line(0.005)] })
    ).toThrow(BankStatementInvalidPrecisionException);
  });

  it('satırsız ekstre reddedilir', () => {
    expect(() => build({ lines: [] })).toThrow(
      BankStatementEmptyLinesException
    );
  });
});
