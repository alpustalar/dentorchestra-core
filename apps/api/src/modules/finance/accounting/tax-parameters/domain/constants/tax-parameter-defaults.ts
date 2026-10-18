import { TaxParameterKeyType } from '@input-type-schemas/TaxParameterKeySchema';
import { TaxParameterKeySchema } from '@shared';

export interface TaxParameterDefault {
  key: TaxParameterKeyType;
  rate: number;
}

/**
 * Şube kurulumunda seed edilen varsayılan vergi oranları (2025/2026 referans).
 * Mevzuat değişince `SetTaxParameterCommand` ile yeni sürüm açılır; bunlar yalnız başlangıçtır.
 * Kaynak: documents/finans/06-vergi.md
 */
export const TAX_PARAMETER_DEFAULTS: readonly TaxParameterDefault[] = [
  { key: TaxParameterKeySchema.enum.VAT_HEALTH, rate: 10 },
  { key: TaxParameterKeySchema.enum.VAT_STANDARD, rate: 20 },
  { key: TaxParameterKeySchema.enum.VAT_REDUCED, rate: 1 },
  { key: TaxParameterKeySchema.enum.WHT_SELF_EMPLOYMENT, rate: 20 },
  { key: TaxParameterKeySchema.enum.WHT_RENT, rate: 20 },
  { key: TaxParameterKeySchema.enum.CORP_TAX, rate: 25 },
];
