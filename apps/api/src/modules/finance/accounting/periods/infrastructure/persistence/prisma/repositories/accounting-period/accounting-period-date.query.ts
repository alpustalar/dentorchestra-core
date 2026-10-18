import { Prisma } from '@prisma/client';

/**
 * "Bu tarih hangi döneme düşer" koşulu — **tek tanım**.
 *
 * İki repo aynı koşulu görmek zorunda: yazma kapısı (Command Repo, karar) ve
 * posting'in hızlı-ret okuması (Query Repo, rapor). İki kopya zamanla ayrışır ve
 * kapı ile kullanım yeri farklı dönemi bulur hale gelirdi.
 *
 * Aralık **kapalıdır** (`[startsAt, endsAt]`): dönem satırı yılın ilk anı ile
 * son anı (23:59:59.999) arasında kurulur, yani iki dönem çakışmaz.
 */
export function periodCoveringDateWhere(
  clinicId: string,
  date: Date
): Prisma.AccountingPeriodWhereInput {
  return {
    clinicId,
    startsAt: { lte: date },
    endsAt: { gte: date },
  };
}
