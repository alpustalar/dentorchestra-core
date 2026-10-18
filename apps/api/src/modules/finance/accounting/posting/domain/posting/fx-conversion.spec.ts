import { Decimal } from 'decimal.js';
import { FxConversion } from './fx-conversion';

describe('FxConversion.convertLine', () => {
  it('kur null ise satırı olduğu gibi fonksiyonel parada bırakır (çevirme yok)', () => {
    const result = FxConversion.convertLine({
      debit: '100',
      txCurrency: 'TRY',
      functionalCurrency: 'TRY',
      rate: null,
    });

    expect(result.debit).toBe('100');
    expect(result.currency).toBe('TRY');
    expect(result.originalDebit).toBeUndefined();
    expect(result.fxRate).toBeUndefined();
  });

  it('işlem para birimi fonksiyonel ile aynıysa çevirme yapmaz', () => {
    const result = FxConversion.convertLine({
      credit: '250',
      txCurrency: 'TRY',
      functionalCurrency: 'TRY',
      rate: new Decimal(35),
    });

    expect(result.credit).toBe('250');
    expect(result.originalCurrency).toBeUndefined();
  });

  it('yabancı borç satırını kurla fonksiyonel paraya çevirir ve orijinali saklar', () => {
    const result = FxConversion.convertLine({
      debit: '100',
      txCurrency: 'EUR',
      functionalCurrency: 'TRY',
      rate: new Decimal('35.5'),
    });

    expect((result.debit as Decimal).toFixed(2)).toBe('3550.00');
    expect(result.credit && (result.credit as Decimal).toFixed(2)).toBe('0.00');
    expect(result.currency).toBe('TRY');
    expect((result.originalDebit as Decimal).toString()).toBe('100');
    expect(result.originalCredit).toBeNull();
    expect(result.originalCurrency).toBe('EUR');
    expect((result.fxRate as Decimal).toString()).toBe('35.5');
  });

  it('yabancı alacak satırını çevirir ve 2 basamağa yuvarlar', () => {
    const result = FxConversion.convertLine({
      credit: '99.99',
      txCurrency: 'USD',
      functionalCurrency: 'TRY',
      rate: new Decimal('32.137'),
    });

    // 99.99 * 32.137 = 3213.380... → 3213.38
    expect((result.credit as Decimal).toFixed(2)).toBe('3213.38');
    expect((result.debit as Decimal).toFixed(2)).toBe('0.00');
    expect(result.originalCurrency).toBe('USD');
  });

  it('eşit borç/alacak çiftini aynı kurla çevirince denge korunur', () => {
    const debitLine = FxConversion.convertLine({
      debit: '100',
      txCurrency: 'EUR',
      functionalCurrency: 'TRY',
      rate: new Decimal('35.5'),
    });
    const creditLine = FxConversion.convertLine({
      credit: '100',
      txCurrency: 'EUR',
      functionalCurrency: 'TRY',
      rate: new Decimal('35.5'),
    });

    expect((debitLine.debit as Decimal).toFixed(2)).toBe(
      (creditLine.credit as Decimal).toFixed(2)
    );
  });
});

describe('FxConversion.roundingBalance', () => {
  it('borç ve alacak eşitse null döner (denkleştirme gerekmez)', () => {
    expect(
      FxConversion.roundingBalance(
        new Decimal('3550.00'),
        new Decimal('3550.00')
      )
    ).toBeNull();
  });

  it('borç fazlaysa 646 (Kâr) tarafına alacak denkleştirmesi verir', () => {
    const result = FxConversion.roundingBalance(
      new Decimal('3550.02'),
      new Decimal('3550.00')
    );
    expect(result).not.toBeNull();
    expect(result!.side).toBe('CREDIT');
    expect(result!.amount.toFixed(2)).toBe('0.02');
  });

  it('alacak fazlaysa 656 (Zarar) tarafına borç denkleştirmesi verir', () => {
    const result = FxConversion.roundingBalance(
      new Decimal('3550.00'),
      new Decimal('3550.03')
    );
    expect(result).not.toBeNull();
    expect(result!.side).toBe('DEBIT');
    expect(result!.amount.toFixed(2)).toBe('0.03');
  });
});

/**
 * Denkleştirme satırının **sınırı** ayrı bir konudur ve posting handler'ında
 * uygulanır (`post-financial-event`): `roundingBalance` farkı hesaplar, ne kadarının
 * kabul edilebilir olduğuna karar vermez. Aşağıdaki test bu ayrımı ve büyüklük
 * mertebesini sabitler — yuvarlama artığı satır sayısı × 1 kuruşu aşamaz.
 */
describe('FxConversion — yuvarlama artığının büyüklüğü', () => {
  it('satır başına yuvarlama hatası yarım kuruşu aşmaz', () => {
    // 3 satırın her biri en kötü ihtimalle 0.005 kayar → toplam artık < 0.02.
    const rate = new Decimal('1.23456');
    const amounts = ['33.33', '66.67', '10.01'];

    const converted = amounts.map((amount) =>
      FxConversion.convertLine({
        debit: amount,
        txCurrency: 'EUR',
        functionalCurrency: 'TRY',
        rate,
      })
    );

    const exactTotal = amounts.reduce(
      (sum, amount) => sum.plus(new Decimal(amount).mul(rate)),
      new Decimal(0)
    );
    const roundedTotal = converted.reduce(
      (sum, line) => sum.plus(new Decimal(line.debit!.toString())),
      new Decimal(0)
    );

    const residue = exactTotal.minus(roundedTotal).abs();
    expect(
      residue.lessThanOrEqualTo(new Decimal(amounts.length).mul('0.005'))
    ).toBe(true);
  });
});
