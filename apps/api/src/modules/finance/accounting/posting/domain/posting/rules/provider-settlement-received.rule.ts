import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { FinancialEvent, FinancialEventTypeSchema } from '@shared';
import {
  DraftJournalEntry,
  DraftJournalLine,
  PostingRule,
} from '../posting-rule.interface';
import { ProviderSettlementReceivedEventPayload } from '../event-payloads';
import { ACCOUNTING_RULES } from '@modules/finance/shared/domain/constants/accounting-rules.constant';

/**
 * Sağlayıcı hesap kapaması — PROVIDER_SETTLEMENT_RECEIVED
 *
 *   B 102 Bankalar              net       (hesaba fiilen geçen)
 *   B 653 Komisyon Giderleri    komisyon  (sağlayıcının kestiği)
 *       A 108 Diğer Hazır Değ.      brüt  (bekleyen tahsilatların kapanışı)
 *
 * Bu fiş olmadığı sürece üç hata birlikte yaşıyordu: 108 sonsuza kadar şişiyor,
 * para 102'ye hiç girmiyor (banka ekstresiyle mutabakat imkânsız) ve komisyon
 * hiç gider yazılmıyor (kâr fazla görünüyor). Üçü de dengeli bir mizan üretir,
 * yani hiçbir denge kontrolüne yakalanmaz.
 *
 * Komisyon **sıfır olabilir** (kesintisiz payout): o durumda 653 satırı
 * yazılmaz — sıfır tutarlı satır geçersizdir (§81.4) ve "en az iki satır"
 * kuralını sahte biçimde sağlardı.
 *
 * Komisyonun KDV'si bu fişte **ayrıştırılmaz**: indirilecek KDV sağlayıcının
 * faturasından doğar (ayrı belge, ayrı olay). Burada 653'e brüt yazmak,
 * faturası gelmeden KDV indirmekten doğru olandır.
 */
@Injectable()
export class ProviderSettlementReceivedRule implements PostingRule {
  readonly eventType =
    FinancialEventTypeSchema.enum.PROVIDER_SETTLEMENT_RECEIVED;

  build(event: FinancialEvent): DraftJournalEntry {
    const payload =
      event.payload as unknown as ProviderSettlementReceivedEventPayload;

    const commission = new Decimal(payload.commissionAmount);

    const lines: DraftJournalLine[] = [
      {
        accountCode: ACCOUNTING_RULES.TARGET_ACCOUNTS.BANKS_102,
        debit: payload.netAmount,
        desc: `Sağlayıcı hesap kapaması (${payload.provider})`,
      },
    ];

    if (commission.greaterThan(0)) {
      lines.push({
        accountCode: ACCOUNTING_RULES.TARGET_ACCOUNTS.PROVIDER_COMMISSION_653,
        debit: payload.commissionAmount,
        desc: `Sağlayıcı komisyonu (${payload.provider})`,
      });
    }

    lines.push({
      accountCode: ACCOUNTING_RULES.TARGET_ACCOUNTS.POS_108,
      credit: payload.grossAmount,
      desc: `Bekleyen kart tahsilatlarının kapanışı (${payload.reference})`,
    });

    return {
      date: event.occurredAt,
      description: 'Sağlayıcı hesap kapaması',
      currency: payload.currency,
      lines,
    };
  }
}
