import { AddTreatmentChargeSchema } from '@shared/modules/treatment-charge/schemas/commands';
import { STATUTORY_VAT_RATES } from '@shared/common/constants';

/**
 * Kapının kabul kümesi **kullanım yeriyle aynı** sabitten gelmek zorunda
 * (CLAUDE.md finans kuralı 12): kapı 0–100 iken istemci %8 gönderebiliyor,
 * istek kapıdan geçiyor ve satır oluşurken `VatRate` "Yasal olmayan KDV oranı"
 * diyerek sebebinden kopuk bir yerde patlıyordu.
 */
describe('AddTreatmentChargeSchema', () => {
  const base = {
    treatmentId: '55555555-5555-4555-8555-555555555555',
    quantity: 1,
    discountRate: 0,
  };

  it('yasal KDV oranlarını kabul eder', () => {
    for (const rate of STATUTORY_VAT_RATES) {
      expect(
        AddTreatmentChargeSchema.safeParse({ ...base, vatRate: rate }).success
      ).toBe(true);
    }
  });

  it('yasal olmayan KDV oranını kapıda reddeder', () => {
    expect(
      AddTreatmentChargeSchema.safeParse({ ...base, vatRate: 8 }).success
    ).toBe(false);
  });

  it('3 ondalıktan ince adedi reddeder (DB Decimal(10,3))', () => {
    expect(
      AddTreatmentChargeSchema.safeParse({ ...base, quantity: 1.2345 }).success
    ).toBe(false);
  });
});
