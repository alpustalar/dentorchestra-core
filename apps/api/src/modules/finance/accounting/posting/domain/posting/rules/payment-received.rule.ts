import { Injectable } from '@nestjs/common';
import { FinancialEvent } from '@shared';
import { DraftJournalEntry, PostingRule } from '../posting-rule.interface';
import { PaymentReceivedEventPayload } from '../event-payloads';
import { FinancialEventTypeSchema } from '@shared';
import { resolvePaymentFundsAccount } from '@modules/finance/shared/domain/constants/payment-method-ledger.constant';
import { UnmappedPaymentMethodException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';

/**
 * Tahsilat — PAYMENT_RECEIVED
 *   Nakit:  B 100 Kasa            / A 120 Alıcılar (party)
 *   Banka:  B 102 Bankalar        / A 120 Alıcılar (party)
 *   POS:    B 108 Diğer Hazır Değ. / A 120 Alıcılar (party)
 * (POS komisyon/valör ayrıştırması sonraki fazda.)
 */
@Injectable()
export class PaymentReceivedRule implements PostingRule {
  readonly eventType = FinancialEventTypeSchema.enum.PAYMENT_RECEIVED;

  build(event: FinancialEvent): DraftJournalEntry {
    const payload = event.payload as unknown as PaymentReceivedEventPayload;

    // Eşlemesi olmayan yöntem **sessizce bir hesaba yazılamaz**: eski kod
    // `CASH`/`POS_CARD` dışındaki her şeyi 102 Bankalar'a düşürüyordu ve fiş
    // dengeli olduğu için hata hiçbir kontrole yakalanmıyordu.
    const cashAccountCode = resolvePaymentFundsAccount(
      payload.method,
      'INBOUND'
    );
    if (!cashAccountCode) {
      throw new UnmappedPaymentMethodException({
        method: payload.method,
        direction: 'INBOUND',
      });
    }

    return {
      date: event.occurredAt,
      description: 'Tahsilat',
      // Yabancı para ise posting handler fonksiyonel paraya çevirir (Model A).
      currency: payload.currency,
      lines: [
        {
          accountCode: cashAccountCode,
          debit: payload.amount,
          desc: 'Tahsilat',
        },
        {
          accountCode: '120',
          partyId: payload.partyId,
          credit: payload.amount,
          desc: 'Alıcılar (cari)',
        },
      ],
    };
  }
}
