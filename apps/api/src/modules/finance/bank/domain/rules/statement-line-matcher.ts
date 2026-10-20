import { Decimal } from 'decimal.js';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

/**
 * Ekstre satırı ↔ 102 (Bankalar) defter satırı oto-eşleştirme motoru.
 *
 * Saf fonksiyon kümesi: entity hidrate etmez, repository bilmez, I/O yapmaz.
 * Böylece aynı mantık hem yazma tarafında (oto-eşleştirme taraması) hem okuma
 * tarafında (personele aday önerme) tek kaynaktan çalışır ve birim testi kolaydır.
 *
 * Tasarım ilkesi — **makine tahmin etmez**: tutar ve yön KESİN eşleşmek
 * zorundadır (tolerans yok); tarih yakınlığı ve metin benzerliği yalnızca
 * birden çok aday arasında sıralama yapar. Tek bir açık kazanan yoksa satır
 * UNMATCHED bırakılır ve personele aday listesi sunulur.
 */

/** Eşleştirilecek ekstre satırının motora giren minimal hâli. */
export interface MatchableStatementLine {
  id: string;
  transactionDate: Date;
  /** İmzalı: + banka girişi / − banka çıkışı. */
  amount: Decimal;
  description: string;
  reference: string | null;
  counterpartyName: string | null;
}

/** 102 defterinden gelen aday fiş satırı. */
export interface LedgerCandidate {
  /** JournalLine.id — eşleşince `matchedRef` olarak saklanır. */
  lineId: string;
  entryId: string;
  entryNo: bigint | null;
  entryDate: Date;
  entryDescription: string | null;
  lineDesc: string | null;
  /** Bankaya giriş. */
  debit: Decimal;
  /** Bankadan çıkış. */
  credit: Decimal;
}

export interface MatchOptions {
  /** Ekstre tarihi ile fiş tarihi arasında kabul edilen en fazla gün farkı. */
  dateToleranceDays: number;
}

export const DEFAULT_MATCH_OPTIONS: MatchOptions = {
  // Valör farkı ve hafta sonu kaymasını karşılar; daha genişi yanlış eşleşme üretir.
  dateToleranceDays: 3,
};

/** Bir adayın neden/ne kadar uyduğu — hem sıralama hem personele gerekçe metni. */
export interface ScoredCandidate {
  candidate: LedgerCandidate;
  /** 0–100; yüksek olan daha güçlü aday. */
  score: number;
  dayDifference: number;
  reasons: MatchReason[];
}

export type MatchReason =
  | 'AMOUNT_AND_DIRECTION'
  | 'SAME_DAY'
  | 'REFERENCE_IN_TEXT'
  | 'COUNTERPARTY_IN_TEXT';

export type MatchOutcome =
  /** Tek açık kazanan — güvenle otomatik eşleştirilebilir. */
  | { kind: 'MATCHED'; best: ScoredCandidate }
  /** Birden çok aday aynı güçte — makine seçmez, personele bırakılır. */
  | { kind: 'AMBIGUOUS'; candidates: ScoredCandidate[] }
  /** Tutar/yön/tarih filtresini geçen aday yok. */
  | { kind: 'NONE' };

/**
 * Adayı zorunlu filtrelerden geçirir ve puanlar. Filtreyi geçemezse `null`.
 *
 * Zorunlu (hard filter):
 * 1. Yön — ekstrede giriş (+) ise adayda borç, çıkış (−) ise alacak olmalı.
 * 2. Tutar — mutlak değerler kuruşu kuruşuna eşit olmalı.
 * 3. Tarih — fark `dateToleranceDays` içinde olmalı.
 */
export function scoreCandidate(
  line: MatchableStatementLine,
  candidate: LedgerCandidate,
  options: MatchOptions = DEFAULT_MATCH_OPTIONS
): ScoredCandidate | null {
  const isInflow = line.amount.isPositive();
  const ledgerAmount = isInflow ? candidate.debit : candidate.credit;
  const oppositeAmount = isInflow ? candidate.credit : candidate.debit;

  // Yön: karşı taraf doluysa bu satır ters yönlü bir harekettir.
  if (!oppositeAmount.isZero()) return null;
  if (ledgerAmount.isZero()) return null;

  // Tutar: tolerans YOK — kuruş farkı ayrı bir işlemdir.
  if (!ledgerAmount.equals(line.amount.abs())) return null;

  const dayDifference = Math.abs(
    DateTimeManager.diffInDays(candidate.entryDate, line.transactionDate)
  );
  if (dayDifference > options.dateToleranceDays) return null;

  const reasons: MatchReason[] = ['AMOUNT_AND_DIRECTION'];

  // Tarih yakınlığı: aynı gün en yüksek, tolerans sınırında sıfıra yaklaşır.
  const dateScore =
    options.dateToleranceDays === 0
      ? 40
      : Math.round(40 * (1 - dayDifference / (options.dateToleranceDays + 1)));
  if (dayDifference === 0) reasons.push('SAME_DAY');

  const haystack = normalize(
    [candidate.entryDescription, candidate.lineDesc].filter(Boolean).join(' ')
  );

  let textScore = 0;
  if (containsToken(haystack, line.reference)) {
    textScore += 25;
    reasons.push('REFERENCE_IN_TEXT');
  }
  if (containsToken(haystack, line.counterpartyName)) {
    textScore += 15;
    reasons.push('COUNTERPARTY_IN_TEXT');
  }

  // Taban 20: tutar+yön+tarih filtresini geçmek başlı başına güçlü bir sinyal.
  return {
    candidate,
    score: 20 + dateScore + textScore,
    dayDifference,
    reasons,
  };
}

/**
 * Adaylar arasından güvenle eşleştirilebilecek olanı seçer.
 *
 * "Güvenle" = filtreyi geçen tek aday var, ya da en yüksek puanlı aday
 * ikincisinden **kesin olarak** üstün. Beraberlik varsa AMBIGUOUS döner:
 * iki ayrı işlem aynı tutarda ve aynı gün olabilir; makinenin kura çekmesi
 * yanlış mutabakattan daha kötüdür.
 */
export function findBestMatch(
  line: MatchableStatementLine,
  candidates: LedgerCandidate[],
  options: MatchOptions = DEFAULT_MATCH_OPTIONS
): MatchOutcome {
  const scored = candidates
    .map((candidate) => scoreCandidate(line, candidate, options))
    .filter((s): s is ScoredCandidate => s !== null)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { kind: 'NONE' };
  if (scored.length === 1) return { kind: 'MATCHED', best: scored[0] };

  const [best, runnerUp] = scored;
  if (best.score === runnerUp.score) {
    return { kind: 'AMBIGUOUS', candidates: scored };
  }

  return { kind: 'MATCHED', best };
}

/** Personele gösterilecek/denetime yazılacak insan-okur gerekçe. */
export function describeMatch(scored: ScoredCandidate): string {
  const parts = [`tutar ve yön birebir`];
  parts.push(
    scored.dayDifference === 0 ? 'aynı gün' : `${scored.dayDifference} gün fark`
  );
  if (scored.reasons.includes('REFERENCE_IN_TEXT'))
    parts.push('referans metni');
  if (scored.reasons.includes('COUNTERPARTY_IN_TEXT'))
    parts.push('karşı taraf adı');
  return `Oto-eşleştirme: ${parts.join(', ')}.`;
}

/** Türkçe büyük/küçük harf ve noktalama farklarını eleyen sadeleştirme. */
function normalize(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Metin sinyali: aday açıklamasında ekstre referansı/karşı taraf adı geçiyor mu.
 * Çok kısa parçalar (≤2 karakter) rastgele eşleşme ürettiği için elenir.
 */
function containsToken(haystack: string, needle: string | null): boolean {
  if (!needle) return false;
  const normalized = normalize(needle);
  if (normalized.length <= 2) return false;
  return haystack.includes(normalized);
}
