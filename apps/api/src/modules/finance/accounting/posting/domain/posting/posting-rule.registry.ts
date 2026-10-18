import { Inject, Injectable } from '@nestjs/common';
import { POSTING_RULES, PostingRule } from './posting-rule.interface';
import { FinancialEventTypeType as FinancialEventType } from '@input-type-schemas/FinancialEventTypeSchema';
import { POSTABLE_FINANCIAL_EVENT_TYPES } from './postable-event-types.constant';

@Injectable()
export class PostingRuleRegistry {
  private readonly byType = new Map<FinancialEventType, PostingRule>();

  constructor(@Inject(POSTING_RULES) rules: PostingRule[]) {
    for (const rule of rules) {
      this.byType.set(rule.eventType, rule);
    }
    this.assertCoverageMatchesConstant();
  }

  get(type: FinancialEventType): PostingRule | undefined {
    return this.byType.get(type);
  }

  has(type: FinancialEventType): boolean {
    return this.byType.has(type);
  }

  supportedTypes(): FinancialEventType[] {
    return [...this.byType.keys()];
  }

  /**
   * `POSTABLE_FINANCIAL_EVENT_TYPES` ile kayıtlı kurallar birebir örtüşmeli.
   * Sapma iki yönde de sessiz bir finansal hataya dönüşür:
   *  - kural var, listede yok  → dönem kapanışı gerçek fiş boşluğunu görmez;
   *  - listede var, kural yok  → o tipte tek bir olay kapanışı kalıcı olarak bloke eder.
   * Bu yüzden uyuşmazlık açılışta (deploy anında) patlar, canlıda değil.
   */
  private assertCoverageMatchesConstant(): void {
    const registered = new Set(this.byType.keys());
    const declared = new Set(POSTABLE_FINANCIAL_EVENT_TYPES);

    const missingInConstant = [...registered].filter((t) => !declared.has(t));
    const missingRule = [...declared].filter((t) => !registered.has(t));

    if (missingInConstant.length > 0 || missingRule.length > 0) {
      throw new Error(
        'Posting kural kapsamı POSTABLE_FINANCIAL_EVENT_TYPES ile uyuşmuyor. ' +
          `Listeye eklenmeli: [${missingInConstant.join(', ')}]; ` +
          `kuralı eksik: [${missingRule.join(', ')}].`
      );
    }
  }
}
