import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { FinancialEvent, FinancialEventTypeSchema } from '@shared';
import {
  DraftJournalEntry,
  DraftJournalLine,
  PostingRule,
} from '../posting-rule.interface';
import { CardChargebackOpenedEventPayload } from '../event-payloads';
import { ACCOUNTING_RULES } from '@modules/finance/shared/domain/constants/accounting-rules.constant';
import { resolveChargebackFundsAccount } from '@modules/finance/shared/domain/constants/chargeback-funds.constant';
import { UnmappedChargebackChannelException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';

/**
 * Kart itirazı AÇILDI — CARD_CHARGEBACK_OPENED
 *
 *   B 127 Diğer Ticari Alacaklar   tutar   (itiraz sürerken para burada bekler)
 *   B 653 Komisyon Giderleri       ücret   (sağlayıcının itiraz ücreti; 0 ise yazılmaz)
 *       A 108|102                      tutar
 *       A 108|102                      ücret
 *
 * **Neden doğrudan 120 değil, 127.** Sağlayıcı parayı kesti ama itirazın sonucu
 * haftalar sonra belli olur ve üye işyeri delil sunabilir. Hasta carisine hemen
 * borç yazmak, kazanılabilecek bir itirazda hastayı haksız yere borçlu gösterir;
 * tahsilatı hiç düzeltmemek ise parayı hâlâ elimizde sayar. 127 "para bizim
 * değil ama henüz kaybedilmedi" durumunu açık bir hesapta tutar ve açık
 * itirazlar bu hesabın bakiyesinde görünür (`pnpm finans:degismezler` eksi 127'yi
 * tarar).
 *
 * İki alacak satırı bilinçli ayrı: sağlayıcı kesintiyi iki hareket olarak
 * gösterebilir (itiraz tutarı + ücret); her satır kendi başına banka ekstresiyle
 * eşleşebilsin diye birleştirilmez.
 */
@Injectable()
export class CardChargebackOpenedRule implements PostingRule {
  readonly eventType = FinancialEventTypeSchema.enum.CARD_CHARGEBACK_OPENED;

  build(event: FinancialEvent): DraftJournalEntry {
    const payload =
      event.payload as unknown as CardChargebackOpenedEventPayload;

    // Eşlemesi olmayan kanal sessizce bir hesaba yazılamaz (bkz. kasa/ödeme
    // yöntemi kuralları): yanlış hesaba yazılan kesinti dengeli bir fiş üretir
    // ve hiçbir kontrole yakalanmaz.
    const fundsAccount = resolveChargebackFundsAccount(payload.fundsChannel);
    if (!fundsAccount) {
      throw new UnmappedChargebackChannelException({
        channel: payload.fundsChannel,
      });
    }

    const fee = new Decimal(payload.feeAmount);

    const lines: DraftJournalLine[] = [
      {
        accountCode: ACCOUNTING_RULES.TARGET_ACCOUNTS.CHARGEBACK_HOLD_127,
        debit: payload.amount,
        desc: `Kart itirazı — sonuç bekleniyor (${payload.caseReference})`,
      },
    ];

    if (fee.greaterThan(0)) {
      lines.push({
        accountCode: ACCOUNTING_RULES.TARGET_ACCOUNTS.PROVIDER_COMMISSION_653,
        debit: payload.feeAmount,
        desc: `İtiraz ücreti (${payload.provider} / ${payload.caseReference})`,
      });
    }

    lines.push({
      accountCode: fundsAccount,
      credit: payload.amount,
      desc: `Kart itirazı kesintisi (${payload.provider} / ${payload.caseReference})`,
    });

    if (fee.greaterThan(0)) {
      lines.push({
        accountCode: fundsAccount,
        credit: payload.feeAmount,
        desc: `İtiraz ücreti kesintisi (${payload.provider} / ${payload.caseReference})`,
      });
    }

    return {
      date: event.occurredAt,
      description: `Kart itirazı açıldı (${payload.caseReference})`,
      currency: payload.currency,
      lines,
    };
  }
}
