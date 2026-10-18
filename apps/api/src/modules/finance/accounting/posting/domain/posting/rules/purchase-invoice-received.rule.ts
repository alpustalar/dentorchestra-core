import { Injectable } from '@nestjs/common';
import { FinancialEvent } from '@shared';
import {
  DraftJournalEntry,
  DraftJournalLine,
  PostingRule,
} from '../posting-rule.interface';
import { PurchaseInvoiceReceivedEventPayload } from '../event-payloads';
import { FinancialEventTypeSchema } from '@shared';

/**
 * Alış Faturası — PURCHASE_INVOICE_RECEIVED
 *   B {lineAccountCode} (150 stok / 770-760-740 gider)   netTotal
 *   B 191 İndirilecek KDV                                  vatTotal   (vat > 0 ise)
 *     A 320 Satıcılar (party=tedarikçi)                                grandTotal
 * (KDV tevkifatı / sorumlu sıfatıyla 360 dalı v2 — parametrik oranla eklenecek.)
 */
@Injectable()
export class PurchaseInvoiceReceivedRule implements PostingRule {
  readonly eventType = FinancialEventTypeSchema.enum.PURCHASE_INVOICE_RECEIVED;

  build(event: FinancialEvent): DraftJournalEntry {
    const payload =
      event.payload as unknown as PurchaseInvoiceReceivedEventPayload;

    const lines: DraftJournalLine[] = [
      {
        accountCode: payload.lineAccountCode,
        debit: payload.netTotal,
        desc: 'Alış (stok/gider)',
      },
    ];

    if (Number(payload.vatTotal) > 0) {
      lines.push({
        accountCode: '191',
        debit: payload.vatTotal,
        desc: 'İndirilecek KDV',
      });
    }

    lines.push({
      accountCode: '320',
      partyId: payload.partyId,
      credit: payload.grandTotal,
      desc: 'Satıcılar (cari)',
    });

    return {
      date: event.occurredAt,
      description: 'Alış faturası',
      // Yurtdışı/ithal fatura ise posting handler fonksiyonel paraya çevirir (Model A).
      currency: payload.currency,
      lines,
    };
  }
}
