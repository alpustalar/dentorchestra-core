import { TaxParameter } from './tax-parameter.entity';
import { TaxParameterKeySchema } from '@shared';
import {
  InvalidTaxRateException,
  InvalidTaxValidityRangeException,
  TaxParameterAlreadyClosedException,
} from '@modules/finance/accounting/tax-parameters/domain/exceptions';
import { STATUTORY_VAT_RATES } from '@src/domain/constants/tax';

describe('TaxParameter entity', () => {
  const base = {
    clinicId: 'clinic-1',
    organizationId: 'org-1',
    key: TaxParameterKeySchema.enum.VAT_HEALTH,
    rate: 10,
    validFrom: new Date('2026-01-01'),
  };

  describe('create', () => {
    it('geçerli props ile açık sürüm (validTo=null) oluşturur', () => {
      const p = TaxParameter.create(base);
      expect(p.id).toBeDefined();
      expect(p.key).toBe(TaxParameterKeySchema.enum.VAT_HEALTH);
      expect(p.rateNumber).toBe(10);
      expect(p.validTo).toBeNull();
    });

    it('0-100 dışı oranı reddeder', () => {
      expect(() => TaxParameter.create({ ...base, rate: 101 })).toThrow(
        InvalidTaxRateException
      );
      expect(() => TaxParameter.create({ ...base, rate: -1 })).toThrow(
        InvalidTaxRateException
      );
    });

    it('KDV anahtarında yasal olmayan oranı yazma kapısında reddeder', () => {
      // Kritik: kontrol burada olmasa %8 sorunsuz kaydedilir, hata **fatura
      // kesilirken** `VatRate` VO'sundan gelir ("Yasal olmayan KDV oranı") ve
      // sebebinden (parametre ayarı) kopuk şekilde faturalamayı durdurur.
      expect(() => TaxParameter.create({ ...base, rate: 8 })).toThrow(
        InvalidTaxRateException
      );
      expect(() => TaxParameter.create({ ...base, rate: 10.5 })).toThrow(
        InvalidTaxRateException
      );
    });

    it('yasal KDV oranlarının hepsini kabul eder', () => {
      for (const rate of STATUTORY_VAT_RATES) {
        expect(TaxParameter.create({ ...base, rate }).rateNumber).toBe(rate);
      }
    });

    it('KDV dışı anahtarlarda yasal küme zorlanmaz (stopaj %20, kurumlar %25)', () => {
      // `VatRate` listesi yalnız KDV içindir; stopaj/kurumlar oranını o kümeye
      // sıkıştırmak varsayılan seed'i (CORP_TAX %25) bile reddederdi.
      expect(
        TaxParameter.create({
          ...base,
          key: TaxParameterKeySchema.enum.CORP_TAX,
          rate: 25,
        }).rateNumber
      ).toBe(25);
      expect(
        TaxParameter.create({
          ...base,
          key: TaxParameterKeySchema.enum.WHT_RENT,
          rate: 17.5,
        }).rateNumber
      ).toBe(17.5);
    });

    it('KDV dışı anahtarda 2 ondalıktan fazlasını reddeder (Decimal(5,2) kolonu)', () => {
      expect(() =>
        TaxParameter.create({
          ...base,
          key: TaxParameterKeySchema.enum.WHT_RENT,
          rate: 17.555,
        })
      ).toThrow(InvalidTaxRateException);
    });

    it('validTo <= validFrom ise reddeder', () => {
      expect(() =>
        TaxParameter.create({ ...base, validTo: new Date('2025-12-31') })
      ).toThrow(InvalidTaxValidityRangeException);
    });
  });

  describe('isEffectiveAt', () => {
    it('açık sürüm validFrom’dan itibaren her tarihte geçerli', () => {
      const p = TaxParameter.create(base);
      expect(p.isEffectiveAt(new Date('2026-06-01'))).toBe(true);
      expect(p.isEffectiveAt(new Date('2025-12-31'))).toBe(false);
    });

    it('kapatılmış sürüm yarı açık aralıkta geçerli: [validFrom, validTo)', () => {
      const p = TaxParameter.create(base);
      p.close(new Date('2026-06-01'));
      expect(p.isEffectiveAt(new Date('2026-03-01'))).toBe(true);
      // Tam sınır: yeni sürümün validFrom'u burasıdır. Dahil sayılsaydı o anda
      // iki sürüm birden yürürlükte görünürdü.
      expect(p.isEffectiveAt(new Date('2026-06-01'))).toBe(false);
      expect(p.isEffectiveAt(new Date('2026-07-01'))).toBe(false);
    });
  });

  describe('close', () => {
    it('açık sürümü kapatır', () => {
      const p = TaxParameter.create(base);
      p.close(new Date('2026-06-01'));
      expect(p.validTo).toEqual(new Date('2026-06-01'));
    });

    it('zaten kapalı sürümde sesli hata verir (eşzamanlılık sinyali)', () => {
      // Eskiden sessizce geri dönüyordu. Sessiz geri dönüş, çift açık sürüm
      // hatasını gizleyen şeydi: kilidi ikinci alan istek satırı kapalı görüyor,
      // `close()` hiçbir şey yapmıyor, yeni sürüm yine açılıyordu.
      const p = TaxParameter.create(base);
      p.close(new Date('2026-06-01'));
      expect(() => p.close(new Date('2026-08-01'))).toThrow(
        TaxParameterAlreadyClosedException
      );
      expect(p.validTo).toEqual(new Date('2026-06-01'));
    });

    it('validFrom öncesi kapanışı reddeder', () => {
      const p = TaxParameter.create(base);
      expect(() => p.close(new Date('2025-01-01'))).toThrow(
        InvalidTaxValidityRangeException
      );
    });
  });

  describe('toPersistence', () => {
    it('scalar Prisma şeklini döner', () => {
      const p = TaxParameter.create(base);
      const raw = p.toPersistence();
      expect(raw).toEqual(
        expect.objectContaining({
          id: p.id,
          clinicId: 'clinic-1',
          organizationId: 'org-1',
          key: TaxParameterKeySchema.enum.VAT_HEALTH,
          validTo: null,
        })
      );
      expect(raw.rate.toString()).toBe('10');
    });
  });
});
