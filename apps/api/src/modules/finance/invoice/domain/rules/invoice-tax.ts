import { Invoice as IInvoice } from '@shared';
import { Money } from '@src/domain/value-objects/money.vo';
import { TaxSpecification } from '@modules/finance/shared/domain/value-objects/tax-specification.vo';

/**
 * Saklanmış fatura kaydının vergi kırılımını (net / KDV / brüt) kurar — **okuma
 * tarafı**: fatura listesi ve detay uçları bunu kullanır.
 *
 * `fromTrusted` ile kurulur, doğrulayan `create` ile değil. Okuma ucunda çapraz
 * kontrol yapmak, veritabanındaki bir kuruşluk sapmayı faturayı **görüntülenemez**
 * kılan bir 422'ye çevirir: satır-başı KDV yuvarlaması çok satırlı faturada
 * orandan hesaplanan tutardan meşru biçimde ayrışır. Yazma kapısı
 * `TaxSpecification.fromLineTotals`'tadır ve payı satır sayısından türetir.
 */
export function taxSpecificationOf(
  invoice: Pick<IInvoice, 'netTotal' | 'vatTotal' | 'vatRate' | 'currency'>
): TaxSpecification {
  return TaxSpecification.fromTrusted(
    Money.fromTrusted(invoice.netTotal, invoice.currency),
    invoice.vatRate,
    Money.fromTrusted(invoice.vatTotal, invoice.currency)
  );
}
