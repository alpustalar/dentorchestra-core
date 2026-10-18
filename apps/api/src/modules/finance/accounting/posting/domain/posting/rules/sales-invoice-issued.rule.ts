import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { FinancialEvent, FinancialEventTypeSchema } from '@shared';
import {
  DraftJournalEntry,
  DraftJournalLine,
  PostingRule,
} from '../posting-rule.interface';
import { SalesInvoiceIssuedEventPayload } from '../event-payloads';

/**
 * Satış/Hizmet Faturası — SALES_INVOICE_ISSUED
 *
 * KURUM (poliklinik) / nihai tüketici hasta:
 *   B 120 Alıcılar (party)      grandTotal
 *     A 600.xx Yurtiçi Satışlar          netTotal
 *     A 391 Hesaplanan KDV               vatTotal
 *
 * SERBEST MESLEK (muayenehane, e-SMM), ödeyen vergi sorumlusuysa (payload.withholdingTotal > 0):
 *   B 120 Alıcılar (party)         grandTotal − withholdingTotal   (tahsil edilecek)
 *   B 193 Peşin Ödenen Vergiler    withholdingTotal                (GV stopaj mahsubu)
 *     A 600 Serbest Meslek Hasılatı       netTotal
 *     A 391 Hesaplanan KDV                vatTotal
 */
@Injectable()
export class SalesInvoiceIssuedRule implements PostingRule {
  readonly eventType = FinancialEventTypeSchema.enum.SALES_INVOICE_ISSUED;

  build(event: FinancialEvent): DraftJournalEntry {
    const payload = event.payload as unknown as SalesInvoiceIssuedEventPayload;
    const revenueCode = payload.revenueAccountCode ?? '600.01';

    const grandTotal = new Decimal(payload.grandTotal);
    const netTotal = new Decimal(payload.netTotal);
    const vatTotal = new Decimal(payload.vatTotal ?? '0');
    const withholding = new Decimal(payload.withholdingTotal ?? '0');

    const hasWithholding = withholding.gt(0);
    const hasVat = vatTotal.gt(0);

    const receivable = hasWithholding
      ? grandTotal.minus(withholding)
      : grandTotal;

    const lines: DraftJournalLine[] = [
      {
        accountCode: '120',
        partyId: payload.partyId,
        debit: receivable.toFixed(2),
        desc: 'Alıcılar (cari)',
      },
    ];

    if (hasWithholding) {
      lines.push({
        accountCode: '193',
        debit: withholding.toFixed(2),
        desc: 'Peşin Ödenen Vergiler (GV stopajı)',
      });
    }

    lines.push({
      accountCode: revenueCode,
      credit: netTotal.toFixed(2),
      desc: 'Yurtiçi Satışlar',
    });

    if (hasVat) {
      lines.push({
        accountCode: '391',
        credit: vatTotal.toFixed(2),
        desc: 'Hesaplanan KDV',
      });
    }

    return {
      date: event.occurredAt,
      description: 'Satış faturası',
      currency: payload.currency,
      lines,
    };
  }
}
