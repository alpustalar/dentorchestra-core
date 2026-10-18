import { Decimal } from 'decimal.js';
import { JournalEntryLineAmount } from './journal-entry-line-amount.vo';
import { InvalidJournalLineAmountException } from '@modules/finance/shared/domain/exceptions';
import { JournalLine } from '@modules/finance/accounting/posting/domain/entities/journal-line.entity';
import { JournalLines } from '@modules/finance/accounting/posting/domain/value-objects/journal-lines.vo';
import { Currency } from '@src/domain/value-objects/currency.vo';
import { randomUUID } from 'crypto';

const TRY = Currency.fromTrusted(Currency.enum.TRY);

/**
 * Defterin kendi kapısı: satır tutarı kuruş ölçeğinde olmak zorunda.
 *
 * `Decimal(14,2)` kolonu üçüncü basamağı hata vermeden **yuvarlar**. Denge
 * kontrolü ise yuvarlamadan ÖNCE, ham Decimal'ler üzerinde yapılıyor: uygulama
 * Σborç = Σalacak görüyor, veritabanı bir kuruş şaşmış fiş saklıyor. Mizan yine
 * dengeli görünür, çünkü fark fişin içinde kalır.
 */
describe('JournalEntryLineAmount — kuruş ölçeği', () => {
  it('iki ondalık haneli tutarı kabul eder', () => {
    const amount = JournalEntryLineAmount.create(
      new Decimal('10.01'),
      new Decimal(0),
      TRY
    );

    expect(amount.debit.toFixed(2)).toBe('10.01');
  });

  it('üç ondalık haneli borç reddedilir', () => {
    expect(() =>
      JournalEntryLineAmount.create(new Decimal('10.005'), new Decimal(0), TRY)
    ).toThrow(InvalidJournalLineAmountException);
  });

  it('üç ondalık haneli alacak reddedilir', () => {
    expect(() =>
      JournalEntryLineAmount.create(new Decimal(0), new Decimal('89.995'), TRY)
    ).toThrow(InvalidJournalLineAmountException);
  });

  it('kuruş altı tutarlar denge kontrolünü GEÇİYORDU — kapı artık önce durduruyor', () => {
    // Senaryo: komisyon 10.005 + tedarikçi 89.995 = satış 100.00.
    // Σborç = Σalacak **ham** Decimal'lerde tutar; DB'ye yazılınca
    // 10.01 + 90.00 = 100.01 ≠ 100.00 olur ve fiş dengesiz saklanır.
    const unrounded = [new Decimal('10.005'), new Decimal('89.995')];
    const sum = unrounded.reduce((a, v) => a.plus(v), new Decimal(0));
    expect(sum.toFixed(2)).toBe('100.00'); // denge kontrolü böyle geçiyordu

    const stored = unrounded.reduce(
      (a, v) => a.plus(v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)),
      new Decimal(0)
    );
    expect(stored.toFixed(2)).toBe('100.01'); // saklanan hâli dengesiz

    // Kapı, bu satırların defter nesnesine dönüşmesine izin vermiyor.
    expect(() =>
      JournalEntryLineAmount.create(new Decimal(0), unrounded[0], TRY)
    ).toThrow(InvalidJournalLineAmountException);
  });
});

describe('JournalLine — orijinal (yabancı para) tutarın ölçeği', () => {
  const entryId = randomUUID();
  const accountId = randomUUID();

  it('kuruş ölçeğindeki orijinal tutarı taşır', () => {
    const line = JournalLine.create(entryId, {
      accountId,
      debit: '3812.34',
      currency: Currency.enum.TRY,
      originalDebit: '100.00',
      originalCurrency: Currency.enum.EUR,
      fxRate: '38.123400',
    });

    expect(line.originalDebit?.toFixed(2)).toBe('100.00');
    expect(line.fxRate?.toFixed(6)).toBe('38.123400');
  });

  it('kuruştan ince orijinal tutar reddedilir', () => {
    // İzlenebilirlik kolonu saklanan değerden saparsa
    // `original × fxRate ≈ debit` mutabakatı hiç tutmaz.
    expect(() =>
      JournalLine.create(entryId, {
        accountId,
        debit: '3812.34',
        currency: Currency.enum.TRY,
        originalDebit: '100.004',
        originalCurrency: Currency.enum.EUR,
        fxRate: '38.123400',
      })
    ).toThrow(InvalidJournalLineAmountException);
  });

  it('denge kontrolü, satırların saklanacak tutarları üzerinde çalışır', () => {
    // Kapı geçildikten sonra satırlar zaten kuruş ölçeğindedir: uygulamanın
    // doğruladığı toplam ile DB'nin sakladığı toplam aynı sayıdır.
    const lines = new JournalLines([
      JournalLine.create(entryId, {
        accountId,
        debit: '10.01',
        currency: Currency.enum.TRY,
      }),
      JournalLine.create(entryId, {
        accountId,
        credit: '10.01',
        currency: Currency.enum.TRY,
      }),
    ]);

    expect(() => lines.validateBalance()).not.toThrow();
    expect(lines.totalDebit.toFixed(2)).toBe(lines.totalCredit.toFixed(2));
  });
});
