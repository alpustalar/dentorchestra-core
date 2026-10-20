import { Injectable } from '@nestjs/common';
import { FinancialEvent, FinancialEventTypeSchema } from '@shared';
import { ACCOUNTING_RULES } from '@modules/finance/shared/domain/constants/accounting-rules.constant';
import { DraftJournalEntry, PostingRule } from '../posting-rule.interface';
import { PlatformReturnableChargeEventPayload } from '../event-payloads';

/**
 * Müşteriye İADE EDİLMESİ gereken tahsilat platform hesabına girdi —
 * PLATFORM_RETURNABLE_CHARGE_RECEIVED
 *
 *   B 108 Diğer Hazır Değerler    tutar   (sağlayıcı parayı tahsil etti, payout'a girecek)
 *       A 336 Diğer Çeşitli Borçlar   tutar   (müşteriye borç — GELİR DEĞİL)
 *
 * Çift çekim ve başarısız rezervasyon: para platformun hesabına düştü ama bir hizmet
 * karşılığı değil. Deftere hiç girmezse sağlayıcı payout'una dahil olan bu para 108'de
 * görünmez ve `FUNDS_IN_TRANSIT_GATE` payout'u reddeder ya da bozar. 336 iade
 * doğrulanana kadar parayı "bizim değil" olarak açık tutar (kural 16: açan akış kapatanla
 * — `PLATFORM_RETURNABLE_CHARGE_REFUNDED` — birlikte tasarlandı).
 */
@Injectable()
export class PlatformReturnableChargeReceivedRule implements PostingRule {
  readonly eventType = FinancialEventTypeSchema.enum.PLATFORM_RETURNABLE_CHARGE_RECEIVED;

  build(event: FinancialEvent): DraftJournalEntry {
    const payload =
      event.payload as unknown as PlatformReturnableChargeEventPayload;

    return {
      date: event.occurredAt,
      description: `İade edilecek tahsilat (${payload.provider} / ${payload.chargeReference})`,
      currency: payload.currency,
      lines: [
        {
          accountCode: ACCOUNTING_RULES.TARGET_ACCOUNTS.POS_108,
          debit: payload.amount,
          desc: `İade edilecek tahsilat girişi (${payload.reason})`,
        },
        {
          accountCode: ACCOUNTING_RULES.TARGET_ACCOUNTS.RETURNABLE_CHARGES_336,
          credit: payload.amount,
          desc: `Müşteriye iade borcu (${payload.reason})`,
        },
      ],
    };
  }
}
