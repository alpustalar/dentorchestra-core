import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { FinancialEvent } from '@shared';
import { DraftJournalEntry, PostingRule } from '../posting-rule.interface';
import { PayrollAccruedEventPayload } from '../event-payloads';
import { FinancialEventTypeSchema } from '@shared';

/**
 * Bordro Tahakkuku — PAYROLL_ACCRUED
 *   B 770 Genel Yönetim Gid. (brüt)     grossSalary
 *   B 770 İşveren SGK payı               employerSgk
 *     A 335 Personele Borçlar (party)    netPayable
 *     A 360 Ödenecek Vergi ve Fonlar     taxWithholding         (GV stopajı + damga)
 *     A 361 Ödenecek SGK                 employeeSgk + employerSgk
 * Denge: brüt + işveren SGK = net + stopaj + (işçi SGK + işveren SGK).
 * Bordro hesabı (brüt→net) finans dışıdır; bu kural yalnız hazır tahakkuku fişler.
 *
 * Not (Model A): Bordro yasal olarak daima fonksiyonel parada (TRY) tahakkuk eder —
 * SGK/GV stopajı/net ücret TL'dir. Yabancı-para bordro olgusu yoktur; bu yüzden
 * `draft.currency` bilinçli olarak set edilmez (posting'de çevrilmez).
 */
@Injectable()
export class PayrollAccruedRule implements PostingRule {
  readonly eventType = FinancialEventTypeSchema.enum.PAYROLL_ACCRUED;

  build(event: FinancialEvent): DraftJournalEntry {
    const payload = event.payload as unknown as PayrollAccruedEventPayload;

    const sgkPayable = new Decimal(payload.employeeSgk)
      .plus(payload.employerSgk)
      .toFixed(2);

    return {
      date: event.occurredAt,
      description: 'Bordro tahakkuku',
      lines: [
        {
          accountCode: '770',
          debit: payload.grossSalary,
          desc: 'Brüt ücret',
        },
        {
          accountCode: '770',
          debit: payload.employerSgk,
          desc: 'İşveren SGK payı',
        },
        {
          accountCode: '335',
          partyId: payload.partyId,
          credit: payload.netPayable,
          desc: 'Personele Borçlar',
        },
        {
          accountCode: '360',
          credit: payload.taxWithholding,
          desc: 'Ödenecek Vergi ve Fonlar (GV stopajı + damga)',
        },
        {
          accountCode: '361',
          credit: sgkPayable,
          desc: 'Ödenecek SGK (işçi + işveren)',
        },
      ],
    };
  }
}
