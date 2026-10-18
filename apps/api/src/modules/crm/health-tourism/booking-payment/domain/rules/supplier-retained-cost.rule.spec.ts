import { toSupplierRetainedCost } from './supplier-retained-cost.rule';

describe('toSupplierRetainedCost — "bilinmiyor" ile "sıfır" ayrımı', () => {
  it('bildirilen ceza tutarı ve para birimiyle taşınır', () => {
    expect(toSupplierRetainedCost(30, 'EUR')).toEqual({
      amount: '30.00',
      currency: 'EUR',
    });
  });

  it('sıfır ceza GEÇERLİ bir cevaptır (ücretsiz iptal)', () => {
    // `0` ile `null` farkı defteri değiştirir: 0 → tedarikçi borcunun tamamı
    // serbest kalır ve alarm çıkmaz; null → varsayım yapıldığı duyurulur.
    expect(toSupplierRetainedCost(0, 'EUR')).toEqual({
      amount: '0.00',
      currency: 'EUR',
    });
  });

  it('tutar yoksa sonuç null — 0 uydurulmaz', () => {
    expect(toSupplierRetainedCost(null, 'EUR')).toBeNull();
    expect(toSupplierRetainedCost(undefined, 'EUR')).toBeNull();
  });

  it('para birimi yoksa null — Currency.create boş girdiyi TRY sanar', () => {
    // Tuzak: `Currency.create(null)` TRY döndürür (boş → varsayılan). Kapı
    // burada olmasaydı para birimsiz bir ceza sessizce TRY'ye yazılırdı.
    expect(toSupplierRetainedCost(30, null)).toBeNull();
    expect(toSupplierRetainedCost(30, '')).toBeNull();
  });

  it('tanınmayan para birimi → null', () => {
    expect(toSupplierRetainedCost(30, 'XYZ')).toBeNull();
  });

  it('negatif ya da sayı olmayan tutar → null', () => {
    expect(toSupplierRetainedCost(-5, 'EUR')).toBeNull();
    expect(toSupplierRetainedCost(Number.NaN, 'EUR')).toBeNull();
  });

  it('string tutar kabul edilir (sağlayıcılar string döndürebiliyor)', () => {
    expect(toSupplierRetainedCost('45.5', 'EUR')).toEqual({
      amount: '45.50',
      currency: 'EUR',
    });
  });
});
