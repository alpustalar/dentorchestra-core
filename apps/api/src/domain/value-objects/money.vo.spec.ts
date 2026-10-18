import { Decimal } from 'decimal.js';
import { Money } from './money.vo';
import {
  CurrencyMismatchException,
  InvalidAllocationCountException,
  InvalidFxRateException,
} from '@src/domain/exceptions/money.exceptions';

const TRY = 'TRY';

/**
 * Para yuvarlamasının **tek kapısı** ve bölüştürme artığının yeri. Denetim
 * listesinin "Yuvarlama kuralı tanımlı ve tek yerde mi? Yuvarlama artığı nereye
 * yazılıyor?" satırını bu suite kilitler.
 */
describe('Money — yuvarlama ve bölüştürme', () => {
  describe('scale / ROUNDING', () => {
    it('mod YARIYI YUKARI ve global ayardan bağımsızdır', () => {
      // Ham `toDecimalPlaces(2)` çağrıları `Decimal.rounding` global ayarına
      // bağlıdır; `Decimal.set` ile değiştirildiğinde para aritmetiği sessizce
      // başka davranır. `Money.scale` modu kendisi taşır.
      const original = Decimal.rounding;
      try {
        Decimal.set({ rounding: Decimal.ROUND_DOWN });

        expect(Money.scale(new Decimal('1.005')).toString()).toBe('1.01');
        // Kanıt: aynı değer global moda bırakıldığında aşağı yuvarlanıyor.
        expect(new Decimal('1.005').toDecimalPlaces(2).toString()).toBe('1');
      } finally {
        Decimal.set({ rounding: original });
      }
    });

    it('kuruş ölçeğine indirir', () => {
      expect(Money.scale(new Decimal('66.666')).toString()).toBe('66.67');
      expect(Money.scale(new Decimal('399.996')).toString()).toBe('400');
      expect(Money.scale(new Decimal('10')).toString()).toBe('10');
    });

    it('round() aynı kapıdan geçer', () => {
      const money = Money.fromTrusted('66.666', TRY);
      expect(money.round().value.toString()).toBe('66.67');
    });
  });

  describe('allocate — bölüştürme artığı', () => {
    it('artık ilk parçaya eklenir; parçaların toplamı daima tutara eşittir', () => {
      // 100,00 / 3 = 33,33 × 3 = 99,99 → 1 kuruş artık. Artık bir yere yazılmazsa
      // taksitlerin toplamı ana tutardan küçük kalır ve cari kapanmaz.
      const parts = Money.fromTrusted('100.00', TRY).allocate(3);

      expect(parts.map((p) => p.value.toString())).toEqual([
        '33.34',
        '33.33',
        '33.33',
      ]);

      const sum = parts.reduce(
        (acc, p) => acc.add(p),
        Money.fromTrusted(0, TRY)
      );
      expect(sum.value.toString()).toBe('100');
    });

    it('tam bölünen tutarda artık oluşmaz', () => {
      const parts = Money.fromTrusted('90.00', TRY).allocate(3);
      expect(parts.map((p) => p.value.toString())).toEqual(['30', '30', '30']);
    });

    it('yuvarlama yukarı çıktığında artık NEGATİF olur ve yine kapanır', () => {
      // 10,00 / 3 → 3,33 (aşağı); ama 0,07 / 3 → 0,02 × 3 = 0,06 > 0,07 değil;
      // 1,00 / 8 = 0,125 → 0,13 × 8 = 1,04 → artık −0,04 ilk parçadan düşer.
      const parts = Money.fromTrusted('1.00', TRY).allocate(8);

      expect(parts[0].value.toString()).toBe('0.09');
      const sum = parts.reduce(
        (acc, p) => acc.add(p),
        Money.fromTrusted(0, TRY)
      );
      expect(sum.value.toString()).toBe('1');
    });

    it('geçersiz parça sayısı tipli hata fırlatır', () => {
      expect(() => Money.fromTrusted('100.00', TRY).allocate(0)).toThrow(
        InvalidAllocationCountException
      );
    });
  });
});

/**
 * Çevrim kapısı. `multiply` para birimini korur; kurla çarpıp etiketi
 * değiştirmemek, TRY tutarı taşıyan ama kendini EUR sanan bir Money üretir ve
 * ondan sonra `add`/`subtract` guard'ı koruma değil tuzak olur.
 */
describe('Money — convert (para birimi değiştiren çevrim)', () => {
  it('kurla çarpar, kuruşa yuvarlar ve ETİKETİ hedef cinse çevirir', () => {
    const eur = Money.fromTrusted('100.00', 'EUR');
    const trl = eur.convert(new Decimal('35.123456'), TRY);

    expect(trl.currency).toBe('TRY');
    expect(trl.toApiFormat()).toBe('3512.35'); // 3512.3456 → yarı yukarı
  });

  it('multiply ETİKETİ KORUR — çevrim için kullanılamaz', () => {
    // Kuralın kendisi: `multiply` ile çevirip etiketi bırakmak, iki farklı
    // cinsin guard'a yakalanmadan toplanmasına yol açar.
    const eur = Money.fromTrusted('100.00', 'EUR');
    expect(eur.multiply(35).currency).toBe('EUR');

    const trl = Money.fromTrusted('3500.00', TRY);
    expect(() => trl.add(eur.multiply(35))).toThrow(CurrencyMismatchException);
    // convert ile aynı işlem guard'dan geçer:
    expect(trl.add(eur.convert(35, TRY)).toApiFormat()).toBe('7000.00');
  });

  it('sıfır/negatif/NaN kur reddedilir (1 veya 0 varsayılmaz)', () => {
    const eur = Money.fromTrusted('100.00', 'EUR');
    expect(() => eur.convert(0, TRY)).toThrow(InvalidFxRateException);
    expect(() => eur.convert(-1, TRY)).toThrow(InvalidFxRateException);
    expect(() => eur.convert(NaN, TRY)).toThrow(InvalidFxRateException);
  });

  it('aynı cinse çevirmek kurla çarpmayı yine uygular (kimlik değil)', () => {
    // `convert` bir kısa devre yapmaz: 1 dışında bir kur geçilmişse çevirir.
    // Kısa devre, yanlış kurla çağrıyı sessizce yutmak olurdu.
    const trl = Money.fromTrusted('100.00', TRY);
    expect(trl.convert(2, TRY).toApiFormat()).toBe('200.00');
  });
});
