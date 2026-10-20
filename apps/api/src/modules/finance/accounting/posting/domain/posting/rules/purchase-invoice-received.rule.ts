import { Injectable } from '@nestjs/common';
import { FinancialEvent } from '@shared';
import {
  DraftJournalEntry,
  DraftJournalLine,
  PostingRule,
} from '../posting-rule.interface';
import { PurchaseInvoiceReceivedEventPayload } from '../event-payloads';
import { FinancialEventTypeSchema } from '@shared';
import { isPurchaseInvoiceLineAccountCode } from '@shared/common/constants';
import { UnmappedPurchaseInvoiceAccountException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';

/**
 * Alış Faturası — PURCHASE_INVOICE_RECEIVED
 *   B {lineAccountCode} (stok / duran varlık / gider)    netTotal
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

    // Üçüncü kapı (DTO ve olay gövdesinden sonra): gövde kapı yokken yazılmış olabilir.
    // Kodu olduğu gibi borca yazmak `102`/`329` gibi bir hesabı sessizce hareket ettirir.
    if (!isPurchaseInvoiceLineAccountCode(payload.lineAccountCode)) {
      throw new UnmappedPurchaseInvoiceAccountException({
        lineAccountCode: String(payload.lineAccountCode),
      });
    }

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
