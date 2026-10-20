import { resolvePreviousPeriod } from './previous-period.calculator';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

const at = (isoDate: string) => DateTimeManager.create(isoDate);

describe('resolvePreviousPeriod — karşılaştırma dönemi seçimi', () => {
  it('takvim ayı için önceki takvim ayını seçer (gün sayısı farklı olsa da)', () => {
    // Nisan 30, Mart 31 gün: gün sayısına göre geri gitmek 2 Mart'a düşerdi.
    const previous = resolvePreviousPeriod({
      dateFrom: at('2026-04-01'),
      dateTo: at('2026-05-01'),
    });

    expect(previous.dateFrom).toEqual(at('2026-03-01'));
    expect(previous.dateTo).toEqual(at('2026-04-01'));
  });

  it('çok aylı hizalı dönemde aynı sayıda ay geri gider (çeyrek)', () => {
    const previous = resolvePreviousPeriod({
      dateFrom: at('2026-04-01'),
      dateTo: at('2026-07-01'),
    });

    expect(previous.dateFrom).toEqual(at('2026-01-01'));
    expect(previous.dateTo).toEqual(at('2026-04-01'));
  });

  it('yıl sınırını doğru aşar', () => {
    const previous = resolvePreviousPeriod({
      dateFrom: at('2026-01-01'),
      dateTo: at('2026-02-01'),
    });

    expect(previous.dateFrom).toEqual(at('2025-12-01'));
  });

  it('ay sınırına hizalı olmayan aralıkta eşit uzunluğa düşer', () => {
    const previous = resolvePreviousPeriod({
      dateFrom: at('2026-04-10'),
      dateTo: at('2026-04-20'),
    });

    expect(previous.dateFrom).toEqual(at('2026-03-31'));
    expect(previous.dateTo).toEqual(at('2026-04-10'));
  });

  it('bir ucu ay başı olsa bile hizalı sayılmaz', () => {
    const previous = resolvePreviousPeriod({
      dateFrom: at('2026-04-01'),
      dateTo: at('2026-04-15'),
    });

    // 14 günlük dönem → önceki 14 gün.
    expect(previous.dateFrom).toEqual(at('2026-03-18'));
    expect(previous.dateTo).toEqual(at('2026-04-01'));
  });

  it('önceki dönem daima cari dönemin başladığı anda biter (boşluk/örtüşme yok)', () => {
    const period = { dateFrom: at('2026-06-01'), dateTo: at('2026-07-01') };

    expect(resolvePreviousPeriod(period).dateTo).toEqual(period.dateFrom);
  });
});
