import { Injectable } from '@nestjs/common';
import { FinancialEvent, FinancialEventTypeSchema } from '@shared';
import { DraftJournalEntry, PostingRule } from '../posting-rule.interface';
import { CardChargebackLostEventPayload } from '../event-payloads';
import { ACCOUNTING_RULES } from '@modules/finance/shared/domain/constants/accounting-rules.constant';

/**
 * Kart itirazı KAYBEDİLDİ — CARD_CHARGEBACK_LOST
 *
 *   B 120 Alıcılar (hasta carisi)   tutar   (tahsilat geri alındı, borç yeniden doğdu)
 *       A 127 Diğer Ticari Alacaklar    tutar
 *
 * Tahsilat fişinin (`B 108 / A 120`) ve açılış fişinin (`B 127 / A 108`) ardından
 * 120'nin yeniden borçlanması hasta borcunu **geri getirir**: para tahsil edilmiş
 * sayılamaz, ama hizmet verilmiştir. Bu borcun tahsili ya da değersiz alacağa
 * çevrilmesi (128/129/654) ayrı bir muhasebe kararıdır (§88 ertelemesi).
 *
 * İade değildir: iade bizim kararımızla geri verilen paradır ve hasta borcunu
 * kapatır; ters ibraz geri ALINAN paradır, hasta borcu yerinde durur.
 */
@Injectable()
export class CardChargebackLostRule implements PostingRule {
  readonly eventType = FinancialEventTypeSchema.enum.CARD_CHARGEBACK_LOST;

  build(event: FinancialEvent): DraftJournalEntry {
    const payload = event.payload as unknown as CardChargebackLostEventPayload;

    return {
      date: event.occurredAt,
      description: `Kart itirazı kaybedildi (${payload.caseReference})`,
      currency: payload.currency,
      lines: [
        {
          accountCode: '120',
          partyId: payload.partyId,
          debit: payload.amount,
          desc: `Alıcılar (cari) — ters ibraz (${payload.provider} / ${payload.caseReference})`,
        },
        {
          accountCode: ACCOUNTING_RULES.TARGET_ACCOUNTS.CHARGEBACK_HOLD_127,
          credit: payload.amount,
          desc: `Kart itirazı kapandı — kaybedildi (${payload.caseReference})`,
        },
      ],
    };
  }
}
