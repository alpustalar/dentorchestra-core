import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

export interface ReportPeriod {
  dateFrom: Date;
  dateTo: Date;
}

/**
 * Bir raporlama döneminin "önceki dönem"ini çözer.
 *
 * İki kural, bu sırayla:
 *
 * 1. **Takvim ayına hizalı dönem** (1 Nisan → 1 Mayıs gibi): önceki dönem de
 *    takvim ayıdır (1 Mart → 1 Nisan). Muhasebeci Nisan'ı Mart'la karşılaştırır;
 *    gün sayısına göre geri gitmek "2 Mart – 1 Nisan" gibi anlamsız bir dönem
 *    üretir (Nisan 30, Mart 31 gün olduğu için).
 * 2. **Diğer her aralık**: eşit uzunlukta ve bitişik önceki dilim.
 *
 * Her iki durumda da önceki dönem cari dönemin başladığı anda biter — araya
 * boşluk veya örtüşme girmez.
 */
export function resolvePreviousPeriod(period: ReportPeriod): ReportPeriod {
  const wholeMonths = alignedWholeMonths(period);

  if (wholeMonths !== null) {
    return {
      dateFrom: DateTimeManager.addMonths(period.dateFrom, -wholeMonths),
      dateTo: period.dateFrom,
    };
  }

  const spanMinutes = DateTimeManager.diffInMinutes(
    period.dateTo,
    period.dateFrom
  );

  return {
    dateFrom: DateTimeManager.addMinutes(period.dateFrom, -spanMinutes),
    dateTo: period.dateFrom,
  };
}

/**
 * Aralık tam takvim ayı/aylarını kapsıyorsa ay sayısını, kapsamıyorsa null döner.
 * Her iki uç da bir ayın ilk anı olmalı ve aradaki fark en az 1 ay olmalıdır.
 */
function alignedWholeMonths(period: ReportPeriod): number | null {
  const startsAtMonthBoundary = DateTimeManager.isSame(
    DateTimeManager.startOfMonth(period.dateFrom),
    period.dateFrom
  );
  const endsAtMonthBoundary = DateTimeManager.isSame(
    DateTimeManager.startOfMonth(period.dateTo),
    period.dateTo
  );

  if (!startsAtMonthBoundary || !endsAtMonthBoundary) return null;

  const months = DateTimeManager.diffInMonths(period.dateTo, period.dateFrom);
  return months >= 1 ? months : null;
}
