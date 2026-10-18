import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { FinancialEvent, FinancialEventTypeSchema } from '@shared';
import {
  DraftJournalEntry,
  DraftJournalLine,
  PostingRule,
} from '../posting-rule.interface';
import { CashSessionClosedEventPayload } from '../event-payloads';

/**
 * Kasa oturum kapanışı — CASH_SESSION_CLOSED (kasa→muhasebe köprüsü).
 *
 * Payment modülü nakit tahsilatı zaten 100 Kasa'ya işlediği için burada
 * SALE_COLLECTION/REFUND POSTLANMAZ (mükerrer kayıt önlenir). Yalnızca başka
 * modülün kapsamadığı, çakışmayan olaylar tek özet fiş olarak yazılır:
 *   Bankaya yatırma:  B 102 Bankalar          / A 100 Kasa
 *   Nakit gider:      B 770 Genel Yön. Gider   / A 100 Kasa
 *   Sayım fazlası:    B 100 Kasa               / A 679 Diğer Olağandışı Gelir
 *   Sayım açığı:      B 689 Diğer Ol. Gider     / A 100 Kasa
 */
@Injectable()
export class CashSessionClosedRule implements PostingRule {
  readonly eventType = FinancialEventTypeSchema.enum.CASH_SESSION_CLOSED;

  build(event: FinancialEvent): DraftJournalEntry {
    const payload = event.payload as unknown as CashSessionClosedEventPayload;

    const bankDeposit = new Decimal(payload.bankDepositTotal);
    const expense = new Decimal(payload.expenseTotal);
    const difference = new Decimal(payload.difference);

    const lines: DraftJournalLine[] = [];

    if (bankDeposit.gt(0)) {
      const amount = bankDeposit.toFixed(2);
      lines.push({
        accountCode: '102',
        debit: amount,
        desc: 'Bankaya yatırma',
      });
      lines.push({
        accountCode: '100',
        credit: amount,
        desc: 'Bankaya yatırma',
      });
    }

    if (expense.gt(0)) {
      const amount = expense.toFixed(2);
      lines.push({ accountCode: '770', debit: amount, desc: 'Nakit gider' });
      lines.push({ accountCode: '100', credit: amount, desc: 'Nakit gider' });
    }

    if (difference.gt(0)) {
      const amount = difference.toFixed(2);
      lines.push({
        accountCode: '100',
        debit: amount,
        desc: 'Kasa sayım fazlası',
      });
      lines.push({
        accountCode: '679',
        credit: amount,
        desc: 'Kasa sayım fazlası',
      });
    } else if (difference.lt(0)) {
      const amount = difference.abs().toFixed(2);
      lines.push({
        accountCode: '689',
        debit: amount,
        desc: 'Kasa sayım açığı',
      });
      lines.push({
        accountCode: '100',
        credit: amount,
        desc: 'Kasa sayım açığı',
      });
    }

    return {
      date: event.occurredAt,
      description: 'Kasa oturum kapanışı',
      currency: payload.currency,
      lines,
    };
  }
}
