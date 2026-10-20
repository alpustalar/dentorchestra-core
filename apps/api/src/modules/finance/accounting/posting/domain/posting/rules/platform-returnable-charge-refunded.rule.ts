import { Injectable } from '@nestjs/common';
import { FinancialEvent, FinancialEventTypeSchema } from '@shared';
import { ACCOUNTING_RULES } from '@modules/finance/shared/domain/constants/accounting-rules.constant';
import { DraftJournalEntry, PostingRule } from '../posting-rule.interface';
import { PlatformReturnableChargeEventPayload } from '../event-payloads';

/**
 * Müşteriye iade edilecek tahsilatın iadesi sağlayıcıda DOĞRULANDI —
 * PLATFORM_RETURNABLE_CHARGE_REFUNDED
 *
 *   B 336 Diğer Çeşitli Borçlar   tutar   (müşteriye borç kapandı)
 *       A 108 Diğer Hazır Değerler    tutar   (para sağlayıcıdan müşteriye döndü)
 *
 * Yalnız iade CONFIRMED olunca yazılır (sağlayıcı onayı ya da operatörün elle doğrulaması).
 * Doğrulanmamış iade 336'yı açık bırakır: defter "para hâlâ müşteriye borç" der, ki gerçek de odur.
 */
@Injectable()
export class PlatformReturnableChargeRefundedRule implements PostingRule {
  readonly eventType = FinancialEventTypeSchema.enum.PLATFORM_RETURNABLE_CHARGE_REFUNDED;

  build(event: FinancialEvent): DraftJournalEntry {
    const payload =
      event.payload as unknown as PlatformReturnableChargeEventPayload;

    return {
      date: event.occurredAt,
      description: `İade edilecek tahsilat iade edildi (${payload.provider} / ${payload.chargeReference})`,
      currency: payload.currency,
      lines: [
        {
          accountCode: ACCOUNTING_RULES.TARGET_ACCOUNTS.RETURNABLE_CHARGES_336,
          debit: payload.amount,
          desc: `Müşteriye iade borcu kapandı (${payload.reason})`,
        },
        {
          accountCode: ACCOUNTING_RULES.TARGET_ACCOUNTS.POS_108,
          credit: payload.amount,
          desc: `Müşteriye iade (${payload.provider})`,
        },
      ],
    };
  }
}
