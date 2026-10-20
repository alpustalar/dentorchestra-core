import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { JournalLine } from './journal-line.entity';

/**
 * Repository fişi yazdıktan sonra satırları DB'nin döndürdüğü ham kayıttan yeniden kurar. O kayıttaki
 * tutarlar `Prisma.Decimal`'dir — `decimal.js`'in `Decimal`'i DEĞİL (`instanceof` FALSE). Katı
 * `instanceof` isteyen tutar VO'su bunu reddediyordu; sonuç: fişi yazan her çağrı, satırları yeniden
 * kurarken patlıyor ve transaction geri sarılıyordu. Mock'lu testler decimal.js verdiği için bu hata
 * yalnız gerçek DB'ye karşı çalıştırıldığında görünür (yıl sonu kapanışının uçtan uca doğrulamasında
 * yakalandı).
 */
describe('JournalLine — DB’den hidrasyon (Prisma.Decimal)', () => {
  const raw = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'line-1',
      entryId: 'entry-1',
      accountId: 'acc-1',
      partyId: null,
      debit: new Prisma.Decimal('10.50'),
      credit: new Prisma.Decimal('0'),
      currency: 'TRY',
      originalDebit: null,
      originalCredit: null,
      originalCurrency: null,
      fxRate: null,
      lineDesc: null,
      ...overrides,
    }) as never;

  it('Prisma.Decimal, decimal.js’ten farklı bir sınıftır (testin dayanağı)', () => {
    expect(new Prisma.Decimal(1) instanceof Decimal).toBe(false);
  });

  it('Prisma.Decimal tutarlı satır kurulabilir ve decimal.js olarak okunur', () => {
    const line = new JournalLine(raw());

    expect(line.debit).toBeInstanceOf(Decimal);
    expect(line.credit).toBeInstanceOf(Decimal);
    expect(line.debit.toFixed(2)).toBe('10.50');
    expect(line.isDebit()).toBe(true);
  });

  it('yabancı para izi (original*, fxRate) da decimal.js’e indirgenir', () => {
    const line = new JournalLine(
      raw({
        originalDebit: new Prisma.Decimal('3.00'),
        originalCredit: new Prisma.Decimal('0'),
        originalCurrency: 'EUR',
        fxRate: new Prisma.Decimal('3.500000'),
      })
    );

    expect(line.originalDebit).toBeInstanceOf(Decimal);
    expect(line.originalDebit?.toFixed(2)).toBe('3.00');
    expect(line.fxRate).toBeInstanceOf(Decimal);
    expect(line.fxRate?.toFixed(6)).toBe('3.500000');
  });

  it('create() → toPersistence() → yeniden kurma gidiş-dönüşü tutarı korur', () => {
    const created = JournalLine.create('entry-1', {
      accountId: 'acc-1',
      debit: '123.45',
    });
    const persisted = created.toPersistence();

    // Repository bu kaydı DB'ye yazar ve Prisma.Decimal olarak geri okur.
    const rehydrated = new JournalLine({
      ...persisted,
      debit: new Prisma.Decimal(persisted.debit.toString()),
      credit: new Prisma.Decimal(persisted.credit.toString()),
    } as never);

    expect(rehydrated.debit.toFixed(2)).toBe('123.45');
    expect(rehydrated.credit.isZero()).toBe(true);
  });
});
