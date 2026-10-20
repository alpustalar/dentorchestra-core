import { DateTimeManager } from './date-time.manager';
import { TimeZoneSchema } from '@shared/index';

describe('DateTimeManager — timezone normalizasyonu', () => {
  describe('toIana', () => {
    it('Prisma enum biçimini IANA biçimine çevirir', () => {
      expect(DateTimeManager.toIana('Europe_Istanbul')).toBe('Europe/Istanbul');
      expect(DateTimeManager.toIana('Etc_UTC')).toBe('Etc/UTC');
    });

    it('şehir içindeki alt çizgiyi korur (yalnız ilk ayıraç dönüşür)', () => {
      expect(DateTimeManager.toIana('America_New_York')).toBe(
        'America/New_York'
      );
      expect(DateTimeManager.toIana('America_Sao_Paulo')).toBe(
        'America/Sao_Paulo'
      );
    });

    it('zaten IANA olan (/ içeren) değere dokunmaz', () => {
      expect(DateTimeManager.toIana('Europe/Istanbul')).toBe('Europe/Istanbul');
    });

    it('tüm enum değerleri geçerli IANA üretir (Intl kabul eder)', () => {
      for (const value of TimeZoneSchema.options) {
        const iana = DateTimeManager.toIana(value);
        expect(
          () => new Intl.DateTimeFormat(undefined, { timeZone: iana })
        ).not.toThrow();
      }
    });
  });

  describe('fromLocalDateTime', () => {
    it('İstanbul yerel saatini doğru UTC anına çevirir (+03:00)', () => {
      const utc = DateTimeManager.fromLocalDateTime(
        '2026-06-27',
        '14:00',
        TimeZoneSchema.enum.Europe_Istanbul
      );
      // 14:00 İstanbul (UTC+3) = 11:00 UTC
      expect(utc.toISOString()).toBe('2026-06-27T11:00:00.000Z');
    });

    it('default tz (Europe_Istanbul) ile patlamaz', () => {
      expect(() =>
        DateTimeManager.fromLocalDateTime('2026-06-27', '09:30')
      ).not.toThrow();
    });

    it('geçersiz tarih/saatte anlamlı hata fırlatır', () => {
      expect(() =>
        DateTimeManager.fromLocalDateTime('not-a-date', '99:99')
      ).toThrow();
    });
  });

  describe('toDateKey (regresyon: default tz artık patlamaz)', () => {
    it('UTC anını klinik yerel gün anahtarına çevirir', () => {
      // 22:30 UTC → İstanbul 01:30 ertesi gün
      expect(DateTimeManager.toDateKey(new Date('2026-06-27T22:30:00Z'))).toBe(
        '2026-06-28'
      );
    });
  });
});
