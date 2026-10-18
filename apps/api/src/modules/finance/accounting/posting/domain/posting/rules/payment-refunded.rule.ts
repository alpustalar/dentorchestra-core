import { Injectable } from '@nestjs/common';
import { FinancialEvent } from '@shared';
import { DraftJournalEntry, PostingRule } from '../posting-rule.interface';
import { PaymentRefundedEventPayload } from '../event-payloads';
import { FinancialEventTypeSchema } from '@shared';
import { resolvePaymentFundsAccount } from '@modules/finance/shared/domain/constants/payment-method-ledger.constant';
import { UnmappedPaymentMethodException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';

/**
 * İade — PAYMENT_REFUNDED. Tahsilat fişinin **aynası**:
 *   Nakit:  B 120 Alıcılar (party) / A 100 Kasa
 *   Banka:  B 120 Alıcılar (party) / A 102 Bankalar
 *   Kart:   B 120 Alıcılar (party) / A 108 Diğer Hazır Değerler
 *
 * **Neden storno değil, yeni bir fiş.** Tahsilat fişini ters kaydetmek
 * (`reverse-journal-entry`) iki şeyi birlikte bozardı: (1) para o gün gerçekten
 * alınmıştı — tahsilatı tarihinden silmek o günün kasa/banka bakiyesini yanlış
 * yapar; (2) iade aylar sonra gelebilir ve orijinal dönem **kapanmış** olabilir,
 * yani storno dönem kapısına takılır ya da kapanmış yılın mizanını değiştirir.
 * Storno "bu kayıt hiç olmamalıydı" (belge iptali, §47) demek içindir; iade ise
 * kendi tarihi olan yeni bir ekonomik olaydır.
 *
 * Kısmi iadede fiş **fiilen geri giden** tutarı taşır: ödeme planı taksit
 * granülerliğinde kaldığı için (bkz. §19 ertelemesi) taksit açık kalabilir,
 * ama defter paranın gerçekliğini gösterir.
 */
@Injectable()
export class PaymentRefundedRule implements PostingRule {
  readonly eventType = FinancialEventTypeSchema.enum.PAYMENT_REFUNDED;

  build(event: FinancialEvent): DraftJournalEntry {
    const payload = event.payload as unknown as PaymentRefundedEventPayload;

    // Yön `REFUND`: hesap enstrümandan gelir (kartla alınan kartla iade edilir),
    // `OUTBOUND` kümesi kart taşımadığı için her kart iadesini reddederdi.
    const fundsAccountCode = resolvePaymentFundsAccount(
      payload.method,
      'REFUND'
    );
    if (!fundsAccountCode) {
      throw new UnmappedPaymentMethodException({
        method: payload.method,
        direction: 'REFUND',
      });
    }

    return {
      date: event.occurredAt,
      description: payload.reference ? `İade (${payload.reference})` : 'İade',
      // Yabancı para ise posting handler fonksiyonel paraya çevirir (Model A).
      currency: payload.currency,
      lines: [
        {
          accountCode: '120',
          partyId: payload.partyId,
          debit: payload.amount,
          desc: 'Alıcılar (cari) — iade',
        },
        {
          accountCode: fundsAccountCode,
          credit: payload.amount,
          desc: 'İade çıkışı',
        },
      ],
    };
  }
}
