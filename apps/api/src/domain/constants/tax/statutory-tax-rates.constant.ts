/**
 * Yasal vergi oranı sabitleri **tek kaynaktan** (`packages/shared`) gelir.
 *
 * Buradaki yeniden dışa açım, api tarafındaki `@src/domain/constants/tax`
 * import yolunu bozmadan kaynağı shared'e taşımak içindir: aynı küme HTTP
 * yazma kapılarında (zod şemaları, `apps/web` de aynı paketi tüketir) ve
 * domain katmanında (`VatRate`, `TaxParameter`) zorlanmak zorunda. Sabit yalnız
 * api'de dururken şemalar onu import EDEMİYOR (shared → apps/api bağımlılığı
 * yasak) ve kapı zorunlu olarak daha geniş kalıyordu.
 */
export {
  STATUTORY_VAT_RATES,
  TAX_RATE_MAX_DECIMAL_PLACES,
  isVatTaxParameterKey,
} from '@shared/common/constants';
