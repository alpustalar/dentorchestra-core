import { Invoice, Pagination } from '@shared';
import { FindInvoicesFilter } from '@modules/finance/invoice/domain/contracts/invoice';

export const INVOICE_QUERY_REPOSITORY = Symbol('IInvoiceQueryRepository');

/** Okuma tarafı: entity değil, plain model döner (veri HTTP sınırını geçiyor). */
export interface IInvoiceQueryRepository {
  findById(id: string): Promise<Invoice | null>;
  findByPaymentId(paymentId: string): Promise<Invoice | null>;
  findByAppointmentId(appointmentId: string): Promise<Invoice | null>;
  findMany(
    filter: FindInvoicesFilter,
    pagination: Pagination
  ): Promise<{ items: Invoice[]; total: number }>;

  /**
   * Verilen ödemelerden faturası OLANLARIN id'leri. Fatura eksiği taramasında
   * N+1 sorguyu önler; mutasyon kararını beslemediği için (aday listesi üretir,
   * nihai kontrol `IssueInvoiceCommand` içinde Command Repo'dan yapılır) okuma
   * tarafında durur.
   */
  findExistingPaymentIds(paymentIds: string[]): Promise<string[]>;
}
