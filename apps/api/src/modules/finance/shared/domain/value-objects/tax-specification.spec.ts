import { Decimal } from 'decimal.js';
import { Money } from '@src/domain/value-objects/money.vo';
import { TaxSpecification } from './tax-specification.vo';
import { InvalidTaxSpecificationException } from '@modules/finance/shared/domain/exceptions';

const TRY = 'TRY';
const money = (amount: string | Decimal) => Money.fromTrusted(amount, TRY);

/**
 * Faturanın matrah/KDV kırılımı. İki P0 regresyonu kilitleniyor:
 *
 * 1. **Çok satırlı fatura kesilemiyordu.** Eski `create(net, rate, customTaxAmount?)`
 *    verilen tutarı `net × oran` ile **sabit 2 kuruş** toleransla karşılaştırıyordu.
 *    KDV yasal olarak satır bazında yuvarlanır, bu yüzden `Σ round(net_i × r)` ile
 *    `(Σ net_i) × r` satır sayısı arttıkça ayrışır: 10 satır × 33,33 TRY @ %20'de
 *    fark 4 kuruş → `Vergi tutarı uyuşmuyor` → fatura **hiç kesilemiyordu**.
 * 2. **Kesilmiş fatura okunamıyordu.** Aynı doğrulama rehidrasyonda da çalıştığı
 *    için toleransı aşan bir satır veritabanında bir kez oluştuğunda fatura
 *    kalıcı olarak 422 veriyordu: görüntülenemez, iptal edilemez, düzeltilemez.
 */
describe('TaxSpecification', () => {
  describe('create — otorite oran', () => {
    it('vergiyi KURUŞA yuvarlar (P0)', () => {
      // 333,33 @ %20 = 66,666. Yuvarlanmazsa Decimal(x,2) kolona giderken
      // veritabanı sessizce yuvarlar ve entity'nin brütü (399,996) saklanan
      // brütten (400,00) ayrışır — fark hiçbir yerde görünmez.
      const spec = TaxSpecification.create(money('333.33'), 20);

      expect(spec.taxAmount.value.toString()).toBe('66.67');
      expect(spec.grossAmount.value.toString()).toBe('400');
      expect(spec.taxAmount.value.decimalPlaces()).toBeLessThanOrEqual(2);
    });

    it('sıfır oranda vergi sıfırdır', () => {
      const spec = TaxSpecification.create(money('100.00'), 0);
      expect(spec.taxAmount.value.isZero()).toBe(true);
      expect(spec.grossAmount.value.toString()).toBe('100');
    });

    it('oran 0-100 dışındaysa tipli hata fırlatır', () => {
      expect(() => TaxSpecification.create(money('100'), 101)).toThrow(
        InvalidTaxSpecificationException
      );
    });
  });

  describe('fromLineTotals — otorite satırlar', () => {
    /** n satır × `lineNet` @ `rate`; KDV satır bazında yuvarlanır (yasal kural). */
    const lines = (lineNet: string, rate: number, n: number) => {
      const net = new Decimal(lineNet);
      const vat = net.mul(rate).div(100).toDecimalPlaces(2);
      return {
        netAmount: money(net.mul(n)),
        taxRate: rate,
        taxAmount: money(vat.mul(n)),
        lineCount: n,
      };
    };

    it('10 satır × 33,33 @ %20 kabul edilir — eski sabit tolerans bunu REDDEDİYORDU (P0)', () => {
      const props = lines('33.33', 20, 10);

      // Satır toplamı 66,70; orandan hesap 333,30 × %20 = 66,66 → fark 4 kuruş.
      expect(props.taxAmount.value.toString()).toBe('66.7');
      const spec = TaxSpecification.fromLineTotals(props);

      // Satır toplamı AYNEN korunur: fatura, kalemlerinin toplamıdır.
      expect(spec.taxAmount.value.toString()).toBe('66.7');
      expect(spec.grossAmount.value.toString()).toBe('400');
    });

    it('izin verilen pay satır sayısıyla büyür (lineCount × 0,005)', () => {
      // 100 satırda pay 50 kuruş; aynı sapma 1 satırda reddedilir.
      const net = money('1000.00');
      const drifted = money('200.40'); // orandan hesap 200,00 → 40 kuruş sapma

      expect(() =>
        TaxSpecification.fromLineTotals({
          netAmount: net,
          taxRate: 20,
          taxAmount: drifted,
          lineCount: 100,
        })
      ).not.toThrow();

      expect(() =>
        TaxSpecification.fromLineTotals({
          netAmount: net,
          taxRate: 20,
          taxAmount: drifted,
          lineCount: 1,
        })
      ).toThrow(InvalidTaxSpecificationException);
    });

    it('payı aşan fark hesap hatasıdır ve faturayı durdurur', () => {
      // Yanlış oranla hesaplanmış KDV (%10 yerine %20): yuvarlama değil hata.
      let thrown: unknown;
      try {
        TaxSpecification.fromLineTotals({
          netAmount: money('1000.00'),
          taxRate: 20,
          taxAmount: money('100.00'),
          lineCount: 3,
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(InvalidTaxSpecificationException);
      // Mesaj teşhis edilebilir olmalı: beklenen, gelen, sapma ve pay birlikte.
      expect((thrown as InvalidTaxSpecificationException).message).toContain(
        '200.00'
      );
      expect((thrown as InvalidTaxSpecificationException).message).toContain(
        '0.02'
      );
    });

    it('satır sayısı verilmezse/geçersizse reddedilir — pay uydurulamaz', () => {
      for (const lineCount of [0, -1, 1.5]) {
        expect(() =>
          TaxSpecification.fromLineTotals({
            netAmount: money('100.00'),
            taxRate: 20,
            taxAmount: money('20.00'),
            lineCount,
          })
        ).toThrow(InvalidTaxSpecificationException);
      }
    });
  });

  describe('fromTrusted — otorite veritabanı', () => {
    it('çapraz kontrol YAPMAZ: saklanmış sapma kaydı okunamaz hâle getirmez (P0)', () => {
      // Gerçekte olamayacak kadar büyük bir sapma bile okuma yolunu durdurmaz;
      // sapmayı bulmak mutabakat raporunun işi, fatura detay ucunun değil.
      const spec = TaxSpecification.fromTrusted(
        money('100.00'),
        20,
        money('5.00')
      );

      expect(spec.taxAmount.value.toString()).toBe('5');
      expect(spec.grossAmount.value.toString()).toBe('105');
    });
  });

  describe('fromGrossAmount — otorite brüt tutar', () => {
    it('matrah + vergi = brüt birebir tutar', () => {
      // 100,00 @ %20 → matrah 83,33 + vergi 16,67 = 100,00. Vergiyi ayrıca
      // yuvarlamak (16,666 → 16,67 ve matrah 83,33) toplamı bir kuruş kaydırırdı.
      const spec = TaxSpecification.fromGrossAmount(money('100.00'), 20);

      expect(spec.netAmount.value.toString()).toBe('83.33');
      expect(spec.taxAmount.value.toString()).toBe('16.67');
      expect(spec.grossAmount.value.toString()).toBe('100');
    });

    it('sıfır oranda brütün tamamı matrahtır', () => {
      const spec = TaxSpecification.fromGrossAmount(money('100.00'), 0);
      expect(spec.netAmount.value.toString()).toBe('100');
      expect(spec.taxAmount.value.isZero()).toBe(true);
    });
  });
});
