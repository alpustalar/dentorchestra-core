import { Injectable } from '@nestjs/common';
import { FinancialEvent, FinancialEventTypeSchema } from '@shared';
import { DraftJournalEntry, PostingRule } from '../posting-rule.interface';
import { CardChargebackWonEventPayload } from '../event-payloads';
import { ACCOUNTING_RULES } from '@modules/finance/shared/domain/constants/accounting-rules.constant';
import { resolveChargebackFundsAccount } from '@modules/finance/shared/domain/constants/chargeback-funds.constant';
import { UnmappedChargebackChannelException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';

/**
 * Kart itirazı KAZANILDI — CARD_CHARGEBACK_WON
 *
 *   B 108|102 Hazır Değerler   tutar   (sağlayıcı kesilen parayı geri verdi)
 *       A 127 Diğer Ticari Alacaklar   tutar
 *
 * Para **açılıştaki kanala döndüğü varsayılmaz**: sağlayıcı geri ödemeyi bir
 * sonraki payout'a (108) da koyabilir, doğrudan bankaya (102) da yatırabilir.
 * Kanal çözüm anında operatörden alınır ve olay gövdesinde taşınır.
 *
 * İtiraz ücreti **iade edilmez**: sağlayıcılar çoğunlukla kazanılan itirazda da
 * ücreti tutar. İade ediliyorsa ayrı bir ekonomik olaydır (§88 ertelemesi).
 */
@Injectable()
export class CardChargebackWonRule implements PostingRule {
  readonly eventType = FinancialEventTypeSchema.enum.CARD_CHARGEBACK_WON;

  build(event: FinancialEvent): DraftJournalEntry {
    const payload = event.payload as unknown as CardChargebackWonEventPayload;

    const fundsAccount = resolveChargebackFundsAccount(payload.fundsChannel);
    if (!fundsAccount) {
      throw new UnmappedChargebackChannelException({
        channel: payload.fundsChannel,
      });
    }

    return {
      date: event.occurredAt,
      description: `Kart itirazı kazanıldı (${payload.caseReference})`,
      currency: payload.currency,
      lines: [
        {
          accountCode: fundsAccount,
          debit: payload.amount,
          desc: `İtiraz iadesi (${payload.provider} / ${payload.caseReference})`,
        },
        {
          accountCode: ACCOUNTING_RULES.TARGET_ACCOUNTS.CHARGEBACK_HOLD_127,
          credit: payload.amount,
          desc: `Kart itirazı kapandı — kazanıldı (${payload.caseReference})`,
        },
      ],
    };
  }
}
