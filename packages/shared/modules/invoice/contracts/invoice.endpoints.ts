import { defineEndpoint } from '@shared/common/contracts/endpoint';
import { GetInvoicesSchema } from '../schemas/queries';
import { CancelInvoiceSchema } from '../schemas/commands';
import type { InvoiceDetailView, InvoiceListItemView } from '../interfaces';

/**
 * `apps/api` → `InvoiceQueryController`. Modül `app.routes.ts`'te `invoices`
 * önekine takılı, controller'ın kendi `@Controller()`'ı boş.
 *
 * Fatura **elle kesilmez** (olay güdümlü üretilir); yazma uçları yalnız düzeltme
 * amaçlıdır: iptal (storno) ve telafi (backfill). İptal `invoice.delete` yetkisi
 * ister — yıkıcı bir düzeltmedir (bkz. `InvoiceCommandController`).
 */
export const invoiceEndpoints = {
  list: defineEndpoint<InvoiceListItemView[]>()({
    method: 'GET',
    path: '/invoices',
    query: GetInvoicesSchema,
  }),

  byId: defineEndpoint<InvoiceDetailView>()({
    method: 'GET',
    path: (p: { invoiceId: string }) => `/invoices/${p.invoiceId}`,
  }),

  byPaymentId: defineEndpoint<InvoiceDetailView>()({
    method: 'GET',
    path: (p: { paymentId: string }) => `/invoices/by-payment/${p.paymentId}`,
  }),

  cancel: defineEndpoint<void>()({
    method: 'POST',
    path: (p: { invoiceId: string }) => `/invoices/${p.invoiceId}/cancel`,
    body: CancelInvoiceSchema,
  }),
};
