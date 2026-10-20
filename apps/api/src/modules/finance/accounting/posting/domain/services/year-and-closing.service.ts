import { Decimal } from 'decimal.js';
import { JournalEntryKindSchema } from '@input-type-schemas/JournalEntryKindSchema';
import { JournalEntry } from '@modules/finance/accounting/posting/domain/entities/journal-entry.entity';
import { isResultAccountCode } from '@modules/finance/shared/domain/constants/year-end-closing.constant';
import { ClosingBalance } from '@modules/finance/accounting/posting/domain/closing/year-end-closing.planner';
import {
  BuildClosingEntriesProps,
  ClosingEntryDraft,
  ToClosingBalancesProps,
} from '@modules/finance/accounting/posting/domain/services/year-and-closing.service.interface';
import { ClosingNextPeriodRequiredException } from '@modules/finance/accounting/posting/domain/exceptions/year-end-closing.exceptions';

/**
 * Yıl sonu kapanış planını (`planYearEndClosing`) fiş taslaklarına çevirir.
 *
 * Hesaplama BURADA değil planlayıcıdadır: önizleme ve kapanış aynı planı kullanır. Bu servis
 * yalnız (a) mizan satırlarını hesap koduna çevirir, (b) plan adımlarını `JournalEntry` taslağına
 * dönüştürür ve fişin NİTELİĞİNİ (`CLOSING` / `ADJUSTING`) ve hangi dönemin numara akışına
 * gireceğini taşır.
 */
export class YearEndClosingService {
  /**
   * Mizan satırlarını `kod → net` biçimine çevirir. Hesap planında bulunmayan satır sessizce
   * atlanmaz: kapanışa girmeyen bir hesabın bakiyesi sonuçta kalır. (Mizan zaten hesap planındaki
   * hesaplara yazıldığı için bu durum bir bütünlük arızasıdır.)
   */
  static toClosingBalances(props: ToClosingBalancesProps): ClosingBalance[] {
    const codeById = new Map(props.accounts.map((a) => [a.id, a.code]));

    return props.trialBalanceRows.flatMap((row) => {
      const code = codeById.get(row.accountId);
      if (!code) {
        throw new Error(
          `Mizan satırının hesabı hesap planında yok: ${row.accountId}`
        );
      }
      return [
        {
          code,
          net: new Decimal(row.totalDebit.toString()).minus(
            row.totalCredit.toString()
          ),
        },
      ];
    });
  }

  static buildEntries(props: BuildClosingEntriesProps): ClosingEntryDraft[] {
    const { plan, resolver } = props;

    return plan.steps.map((step) => {
      let periodId = props.closingPeriodId;
      if (step.period === 'NEXT_PERIOD') {
        if (!props.nextPeriodId) throw new ClosingNextPeriodRequiredException();
        periodId = props.nextPeriodId;
      }

      const entry = JournalEntry.createDraft({
        clinicId: props.clinicId,
        organizationId: props.organizationId,
        periodId,
        entryDate: step.entryDate,
        description: step.description,
        // Kapanış ve tahakkuk ekonomik bir olaydan doğmaz.
        eventId: null,
        performedById: props.performedById ?? null,
        // Kapanış fişi gelir tablosuna GİRMEZ (6/7'yi sıfırlar); tahakkuk fişi GİRER.
        kind:
          step.entryKind === 'ADJUSTING'
            ? JournalEntryKindSchema.enum.ADJUSTING
            : JournalEntryKindSchema.enum.CLOSING,
        lines: step.lines.map((line) => ({
          accountId: resolver.resolve(line.accountCode).id,
          debit: line.debit,
          credit: line.credit,
          lineDesc: line.lineDesc,
        })),
      });

      return { step: step.step, period: step.period, entry };
    });
  }

  static isResultAccount(code: string): boolean {
    return isResultAccountCode(code);
  }
}
