import { Injectable } from '@nestjs/common';
import { FinancialEvent, FinancialEventTypeSchema } from '@shared';
import { DraftJournalEntry, PostingRule } from '../posting-rule.interface';
import { PaymentMadeEventPayload } from '../event-payloads';
import { resolvePaymentFundsAccount } from '@modules/finance/shared/domain/constants/payment-method-ledger.constant';
import { UnmappedPaymentMethodException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';

/** Satıcılar — 320 `requiresParty`, cari bazında takip edilir. */
const SUPPLIERS_320 = '320';

/**
 * Satıcıya ödeme — PAYMENT_MADE.
 *   Nakit: B 320 Satıcılar (party) / A 100 Kasa
 *   Banka: B 320 Satıcılar (party) / A 102 Bankalar
 *
 * `PaymentReceivedRule`'un karşı yönüdür. Bu kural olmadan 320'yi **alacaklandıran**
 * kurallar (alış faturası, sağlık turizmi tedarikçi payı) vardı ama borcu
 * **kapatan** hiçbir şey yoktu — satıcı borcu defterde sonsuza dek büyüyordu.
 */
@Injectable()
export class PaymentMadeRule implements PostingRule {
  readonly eventType = FinancialEventTypeSchema.enum.PAYMENT_MADE;

  build(event: FinancialEvent): DraftJournalEntry {
    const payload = event.payload as unknown as PaymentMadeEventPayload;

    // Çıkışta kabul edilen küme tahsilattan DARDIR (kart yok): bkz.
    // `OUTBOUND_PAYMENT_METHODS`. Eşleme bulunamazsa hata — varsayılan hesaba
    // düşmek borcu yanlış kaynaktan kapatırdı.
    const fundsAccountCode = resolvePaymentFundsAccount(
      payload.method,
      'OUTBOUND'
    );
    if (!fundsAccountCode) {
      throw new UnmappedPaymentMethodException({
        method: payload.method,
        direction: 'OUTBOUND',
      });
    }

    const description = payload.reference
      ? `Satıcı ödemesi (${payload.reference})`
      : 'Satıcı ödemesi';

    return {
      date: event.occurredAt,
      description,
      // Yabancı para ise posting handler fonksiyonel paraya çevirir (Model A).
      currency: payload.currency,
      lines: [
        {
          accountCode: SUPPLIERS_320,
          partyId: payload.partyId,
          debit: payload.amount,
          desc: 'Satıcılar (cari)',
        },
        {
          accountCode: fundsAccountCode,
          credit: payload.amount,
          desc: description,
        },
      ],
    };
  }
}
