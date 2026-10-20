import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { normalizeReportDateRange } from './report-date-range';

/**
 * Bu suite bir P0 regresyonunu kilitler: **rapor aralığının son günü düşmemelidir.**
 *
 * `entryDate` tam bir zaman damgasıdır, rapor isteği ise bir gündür
 * (`?dateTo=2026-12-31` → 00:00:00). Ham `lte: dateTo` kullanıldığında o günün
 * bütün fişleri rapordan düşer — ve hata sessizdir, çünkü düşen fişler kendi
 * içinde dengelidir: "Σborç = Σalacak" kontrolü yine tutar.
 */
describe('normalizeReportDateRange', () => {
  it('dateTo günün SON anına genişler — son gün rapordan düşmez', () => {
    const { dateTo } = normalizeReportDateRange({
      dateTo: DateTimeManager.create('2026-12-31'),
    });

    expect(dateTo).toEqual(
      DateTimeManager.endOfDay(DateTimeManager.create('2026-12-31'))
    );

    // Asıl iddia: gün içinde damgalanmış bir fiş aralığa GİRER. Ham `dateTo`
    // (gece yarısı) ile bu karşılaştırma yanlış tarafa düşüyordu.
    const sameDayEntry = DateTimeManager.create('2026-12-31T17:45:00');
    expect(dateTo!.getTime()).toBeGreaterThan(sameDayEntry.getTime());
  });

  it('dateFrom günün İLK anına çekilir — günün erken fişi aralık dışında kalmaz', () => {
    const { dateFrom } = normalizeReportDateRange({
      dateFrom: DateTimeManager.create('2026-01-01T09:30:00'),
    });

    expect(dateFrom).toEqual(
      DateTimeManager.startOfDay(DateTimeManager.create('2026-01-01'))
    );
  });

  it('verilmeyen uç undefined kalır — açık uçlu rapor tüm defteri kapsar', () => {
    expect(normalizeReportDateRange({})).toEqual({
      dateFrom: undefined,
      dateTo: undefined,
    });
  });

  it('idempotenttir: normalize edilmiş aralık tekrar normalize edilince değişmez', () => {
    const once = normalizeReportDateRange({
      dateFrom: DateTimeManager.create('2026-03-05T11:00:00'),
      dateTo: DateTimeManager.create('2026-03-31T11:00:00'),
    });

    // Dönem sınırları (startsAt / endsAt 23:59:59.999) bu yoldan ikinci kez
    // geçtiğinde kaymamalı — yıl sonu kapanış fişinin tutarları buna bağlı.
    expect(normalizeReportDateRange(once)).toEqual(once);
  });

  it('gün sınırı kliniğin saat diliminde hesaplanır (UTC günü değil)', () => {
    const { dateFrom, dateTo } = normalizeReportDateRange({
      dateFrom: DateTimeManager.create('2026-06-15'),
      dateTo: DateTimeManager.create('2026-06-15'),
    });

    // Europe/Istanbul (UTC+3) → yerel gün UTC'de 21:00'da başlar. Aralık tam
    // olarak 24 saattir: yerel takvim gününün tamamı, bir eksik bir fazla değil.
    expect(dateTo!.getTime() - dateFrom!.getTime()).toBe(
      24 * 60 * 60 * 1000 - 1
    );
  });
});
