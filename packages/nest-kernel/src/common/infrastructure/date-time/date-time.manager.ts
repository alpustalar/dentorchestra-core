import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import duration from 'dayjs/plugin/duration';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

import {
  TimeZoneSchema,
  TimeZoneType,
} from '@input-type-schemas/TimeZoneSchema';

dayjs.extend(isBetween);
dayjs.extend(duration);
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);

const DEFAULT_TZ: TimeZoneType = TimeZoneSchema.enum.Europe_Istanbul;

type IsTimeWithinRangeInput = {
  checkTime: Date;
  startMinute: number;
  endMinute: number;
  tz?: TimeZoneType;
};

type IsBetweenInput = {
  target: Date | string;
  start: Date | string;
  end: Date | string;
  granularity?: dayjs.OpUnitType;
  inclusivity?: '()' | '[]' | '[)' | '(]';
};

export class DateTimeManager {
  /**
   * Bir tarihin toplam gün dakikasını döner (0 - 1439)
   */
  static getDayMinutes(
    date: Date | string,
    tz: TimeZoneType = DEFAULT_TZ
  ): number {
    const d = this.tz(date, tz);
    return d.hour() * 60 + d.minute();
  }

  static create(
    input?: Date | string | number,
    tz: TimeZoneType = DEFAULT_TZ
  ): Date {
    if (input === undefined) {
      return dayjs().tz(DateTimeManager.toIana(tz)).toDate();
    }

    const parsed = dayjs(input).tz(DateTimeManager.toIana(tz));
    if (!parsed.isValid()) {
      throw new Error(` Geçersiz tarih girdisi sağlandı"`);
    }

    return parsed.toDate();
  }

  /**
   * validasyon
   */
  static isValidTimeZone(value: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: value });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Belirtilen zaman diliminin şu anki UTC offset'ini döner (Örn: "+03:00")
   */
  static getOffset(tz: TimeZoneType): string {
    return this.tz(undefined, tz).format('Z');
  }

  /**
   * number olan Dakikayı HH:mm formatına çevirir (Örn: 540 -> "09:00")
   */
  static minutesToHHMM(minutes: number): string {
    return dayjs.duration(minutes, 'minutes').format('HH:mm');
  }

  /**
   * Klinik yerel saatindeki bir tarih + saat çiftini (YYYY-MM-DD + HH:mm) doğru
   * UTC anına (Date) çevirir. AI sohbet asistanı "İstanbul 15:00" gibi yerel
   * girdileri buradan UTC'ye dönüştürür — LLM'e zaman dilimi matematiği yaptırılmaz.
   */
  static fromLocalDateTime(
    date: string,
    time: string,
    tz: TimeZoneType = DEFAULT_TZ
  ): Date {
    const parsed = dayjs.tz(
      `${date} ${time}`,
      'YYYY-MM-DD HH:mm',
      DateTimeManager.toIana(tz)
    );
    if (!parsed.isValid()) {
      throw new Error(`Geçersiz tarih/saat: ${date} ${time}`);
    }
    return parsed.toDate();
  }

  /**
   * 🎯 Zaman dilimi (Timezone) sapmalarından etkilenmeden,
   * verilen tarihin haftanın hangi günü olduğunu döner (0: Pazar, 1: Pazartesi, ..., 6: Cumartesi)
   */
  static getDayOfWeek(
    date: Date | string,
    tz: TimeZoneType = DEFAULT_TZ
  ): number {
    return this.tz(date, tz).day();
  }

  /**
   * İki tarih arasındaki saat farkını tam (kesirli) olarak döner (later - earlier)
   */
  static diffInHours(later: Date, earlier: Date): number {
    return dayjs(later).diff(dayjs(earlier), 'hour', true); // true parametresi küsuratı korur (örn: 5.5 saat)
  }

  /**
   * İki tarih arasındaki farkı tam dakika olarak döner (later - earlier)
   */
  static diffInMinutes(later: Date, earlier: Date): number {
    return dayjs(later).diff(dayjs(earlier), 'minute');
  }

  /**
   * İki tarih arasındaki farkı tam saniye olarak döner (later - earlier).
   * Dakika altı hassasiyet gereken yerlerde kullanılır (ör. dış sağlayıcı
   * tekliflerinin kalan geçerlilik süresinden cache TTL'i türetmek).
   */
  static diffInSeconds(later: Date, earlier: Date): number {
    return dayjs(later).diff(dayjs(earlier), 'second');
  }

  /**
   * Verilen zamanın belirtilen aralıkta olup olmadığını kontrol eder (Sadece saat bazlı)
   */
  static isTimeWithinRange({
    checkTime,
    startMinute,
    endMinute,
    tz = DEFAULT_TZ,
  }: IsTimeWithinRangeInput): boolean {
    const currentMinutes = this.getDayMinutes(checkTime, tz);
    return currentMinutes >= startMinute && currentMinutes <= endMinute;
  }

  static isBetween({
    target,
    start,
    end,
    granularity = 'minute',
    inclusivity = '()',
  }: IsBetweenInput): boolean {
    return dayjs(target).isBetween(start, end, granularity, inclusivity);
  }

  static isOverlapping(
    range1: { start: Date; end: Date },
    range2: { start: Date; end: Date }
  ): boolean {
    return (
      dayjs(range1.start).isBefore(range2.end) &&
      dayjs(range1.end).isAfter(range2.start)
    );
  }
  /**
   * Verilen bir tarihe esnek zaman birimleri (seconds, minutes, hours, days) ekler.
   * Tarih verilmezse 'şu an'ı baz alır (Immutable).
   *
   * @example
   * DateTimeManager.plus({ seconds: 120 })
   * DateTimeManager.plus({ minutes: 30 }, myDate)
   */
  static plus(
    options: DurationOptions,
    baseDate: Date = new Date(),
    tz: TimeZoneType = DEFAULT_TZ
  ): Date {
    let d = this.tz(baseDate, tz);

    if (options.seconds) d = d.add(options.seconds, 'second');
    if (options.minutes) d = d.add(options.minutes, 'minute');
    if (options.hours) d = d.add(options.hours, 'hour');
    if (options.days) d = d.add(options.days, 'day');

    return d.toDate();
  }

  /**
   * Verilen bir tarihten esnek zaman birimleri çıkarır.
   */
  static minus(
    options: DurationOptions,
    baseDate: Date = new Date(),
    tz: TimeZoneType = DEFAULT_TZ
  ): Date {
    let d = this.tz(baseDate, tz);

    if (options.seconds) d = d.subtract(options.seconds, 'second');
    if (options.minutes) d = d.subtract(options.minutes, 'minute');
    if (options.hours) d = d.subtract(options.hours, 'hour');
    if (options.days) d = d.subtract(options.days, 'day');

    return d.toDate();
  }

  /**
   * İki Date nesnesinin aynı gün olup olmadığını kontrol eder
   */
  static isSameDay(
    date1: Date,
    date2: Date,
    tz: TimeZoneType = DEFAULT_TZ
  ): boolean {
    return this.tz(date1, tz).isSame(this.tz(date2, tz), 'day');
  }

  /**
   * Yeni bir Date oluşturur veya manipüle eder (Immutable)
   */
  static addMinutes(
    date: Date,
    minutes: number,
    tz: TimeZoneType = DEFAULT_TZ
  ): Date {
    return this.tz(date, tz).add(minutes, 'minute').toDate();
  }

  static subtractMinutes(
    date: Date,
    minutes: number,
    tz: TimeZoneType = DEFAULT_TZ
  ): Date {
    return this.tz(date, tz).subtract(minutes, 'minute').toDate();
  }

  static toMillis(
    date: Date | string = new Date(),
    tz: TimeZoneType = DEFAULT_TZ
  ): number {
    return this.tz(date, tz).valueOf();
  }

  /**
   * Verilen bir tarih objesinin (veya şu anın) ISO string değerini döner.
   */
  static toIsoString(
    date: Date | string = new Date(),
    tz: TimeZoneType = DEFAULT_TZ
  ): string {
    return this.tz(date, tz).toISOString();
  }

  static addDays(
    date: Date,
    days: number,
    tz: TimeZoneType = DEFAULT_TZ
  ): Date {
    return this.tz(date, tz).add(days, 'day').toDate();
  }

  static subtractDays(
    date: Date,
    days: number,
    tz: TimeZoneType = DEFAULT_TZ
  ): Date {
    return this.tz(date, tz).subtract(days, 'day').toDate();
  }

  static addMonths(
    date: Date,
    months: number,
    tz: TimeZoneType = DEFAULT_TZ
  ): Date {
    return this.tz(date, tz).add(months, 'month').toDate();
  }

  // YYYY-MM-DD formatında string döner
  static toDateString(date: Date, tz: TimeZoneType = DEFAULT_TZ): string {
    return this.tz(date, tz).format('YYYY-MM-DD');
  }

  static addHours(
    date: Date,
    hours: number,
    tz: TimeZoneType = DEFAULT_TZ
  ): Date {
    return this.tz(date, tz).add(hours, 'hour').toDate();
  }

  static addSeconds(
    date: Date,
    seconds: number,
    tz: TimeZoneType = DEFAULT_TZ
  ): Date {
    return this.tz(date, tz).add(seconds, 'second').toDate();
  }

  static startOfDay(date: Date, tz: TimeZoneType = DEFAULT_TZ): Date {
    return this.tz(date, tz).startOf('day').toDate();
  }

  static endOfDay(date: Date, tz: TimeZoneType = DEFAULT_TZ): Date {
    return this.tz(date, tz).endOf('day').toDate();
  }

  /** Verilen tarihin ait olduğu ayın ilk anı (ayın 1'i 00:00). */
  static startOfMonth(date: Date, tz: TimeZoneType = DEFAULT_TZ): Date {
    return this.tz(date, tz).startOf('month').toDate();
  }

  /**
   * İki tarih arasındaki tam ay farkı (ondalık kısım atılır). Takvim aylarına
   * hizalı raporlama dönemlerini tespit etmek için kullanılır.
   */
  static diffInMonths(later: Date, earlier: Date): number {
    return dayjs(later).diff(dayjs(earlier), 'month');
  }

  /**
   * Verilen yılın ilk anını döner (1 Ocak 00:00:00)
   */
  static startOfYear(year: number, tz: TimeZoneType = DEFAULT_TZ): Date {
    return dayjs()
      .tz(DateTimeManager.toIana(tz))
      .year(year)
      .startOf('year')
      .toDate();
  }

  /**
   * Verilen yılın son anını döner (31 Aralık 23:59:59.999)
   */
  static endOfYear(year: number, tz: TimeZoneType = DEFAULT_TZ): Date {
    return dayjs()
      .tz(DateTimeManager.toIana(tz))
      .year(year)
      .endOf('year')
      .toDate();
  }

  /**
   * İçinde bulunulan yılı döner (ör. 2026)
   */
  static currentYear(tz: TimeZoneType = DEFAULT_TZ): number {
    return dayjs().tz(DateTimeManager.toIana(tz)).year();
  }

  /**
   * Verilen tarihin ait olduğu yılı döner (ör. 2026). `currentYear`'dan farkı:
   * "şimdi" değil, verilen anın yılı.
   */
  static getYear(date: Date, tz: TimeZoneType = DEFAULT_TZ): number {
    return this.tz(date, tz).year();
  }

  /**
   * DD.MM.YYYY formatı döner
   */
  static toDateKey(date: Date, tz: TimeZoneType = DEFAULT_TZ): string {
    return this.tz(date, tz).format('YYYY-MM-DD');
  }

  /**
   * YYYY-MM formatında ay anahtarı döner (ör. 2026-06) — aylık grup raporları için.
   */
  static toMonthKey(date: Date, tz: TimeZoneType = DEFAULT_TZ): string {
    return this.tz(date, tz).format('YYYY-MM');
  }

  /**
   * İnsan-okunur tarih-saat döner: DD.MM.YYYY HH:mm (ör. 09.07.2026 14:30).
   * Bildirim metinleri gibi kullanıcıya gösterilen yerlerde kullanılır.
   */
  static formatDateTime(date: Date, tz: TimeZoneType = DEFAULT_TZ): string {
    return this.tz(date, tz).format('DD.MM.YYYY HH:mm');
  }

  /**
   * Ayraçsız gün anahtarı döner: DDMMYYYY (ör. 01072026). TCMB günlük kur dosya adı
   * (`/kurlar/YYYYMM/DDMMYYYY.xml`) gibi ayraçsız tarih bekleyen dış servisler için.
   */
  static toCompactDateKey(date: Date, tz: TimeZoneType = DEFAULT_TZ): string {
    return this.tz(date, tz).format('DDMMYYYY');
  }

  /**
   * Ayraçsız ay anahtarı döner: YYYYMM (ör. 202607). TCMB kur klasörü gibi ayraçsız
   * ay segmenti bekleyen dış servisler için.
   */
  static toCompactMonthKey(date: Date, tz: TimeZoneType = DEFAULT_TZ): string {
    return this.tz(date, tz).format('YYYYMM');
  }

  /**
   * İki tarih arasındaki tam gün farkını döner (later - earlier). Vade
   * yaşlandırması (AR aging) gibi gün bazlı hesaplar için.
   */
  static diffInDays(later: Date, earlier: Date): number {
    return dayjs(later).diff(dayjs(earlier), 'day');
  }

  /**
   * Birinci tarihin ikinci tarihten büyük (sonra) olup olmadığını kontrol eder.
   * 'granularity' verilirse kıyaslamayı o hassasiyette yapar (Örn: 'day' verilirse sadece gün bazında bakar, saatleri önemsemez).
   */
  static isAfter(
    date1: Date | string,
    date2: Date | string,
    granularity?: dayjs.OpUnitType
  ): boolean {
    return dayjs(date1).isAfter(dayjs(date2), granularity);
  }

  /**
   * Birinci tarihin ikinci tarihten küçük (önce) olup olmadığını kontrol eder.
   */
  static isBefore(
    date1: Date | string,
    date2: Date | string,
    granularity?: dayjs.OpUnitType
  ): boolean {
    return dayjs(date1).isBefore(dayjs(date2), granularity);
  }

  /**
   * Birinci tarihin ikinci tarihten küçük (önce) olup olmadığını ya da iki tarihin eşit olup olmadığını kontrol eder.
   */

  static isBeforeOrEqual(
    date1: dayjs.ConfigType,
    date2: dayjs.ConfigType,
    granularity?: dayjs.OpUnitType
  ) {
    return dayjs(date1).isSameOrBefore(date2, granularity);
  }

  /**
   * İki tarihin birbirine eşit olup olmadığını kontrol eder.
   * ⚠️ KRİTİK: granularity boş bırakılırsa milisaniyesine kadar eşitliğe bakar.
   * Eğer iki tarihin saatine bakmaksızın "aynı gün" olup olmadığını kontrol etmek istersen 'day' geçmelisin.
   */
  static isSame(
    date1: Date | string,
    date2: Date | string,
    granularity?: dayjs.OpUnitType
  ): boolean {
    return dayjs(date1).isSame(dayjs(date2), granularity);
  }

  /**
   * Prisma enum biçimini (`Europe_Istanbul`) dayjs/Intl'in beklediği IANA biçimine
   * (`Europe/Istanbul`) çevirir. Enum'da bölge ayıracı `_`, IANA'da `/`. Yalnız ilk
   * `_` ayıraca dönüştürülür; şehir içindeki `_` korunur (ör. `America_New_York` →
   * `America/New_York`). Zaten `/` içeren (IANA) değerler olduğu gibi bırakılır.
   */
  static toIana(tz: string): string {
    return tz.includes('/') ? tz : tz.replace('_', '/');
  }

  /**
   * Verilen zaman birimlerini saniyeye (seconds) çevirir.
   * Redis TTL, JWT expiration ve cache süreleri için idealdir.
   *
   * @example
   * DateTimeManager.toSeconds({ minutes: 30 }) // 1800
   * DateTimeManager.toSeconds({ hours: 1, minutes: 30 }) // 5400
   */
  static toSeconds({
    seconds = 0,
    minutes = 0,
    hours = 0,
    days = 0,
  }: DurationOptions): number {
    return seconds + minutes * 60 + hours * 3600 + days * 86400;
  }

  /**
   * Verilen zaman birimlerini milisaniyeye (ms) çevirir.
   * setTimeout, BullMQ delay veya JS Date operasyonları için.
   */
  static toMilliseconds(options: DurationOptions): number {
    return this.toSeconds(options) * 1000;
  }

  /**
   * Şimdinin epoch milisaniyesi. Mutlak zaman damgası bekleyen altyapı çağrıları
   * içindir (BullMQ `moveToDelayed`, Redis sorted-set skoru); iş mantığı tarihleri
   * için `create()` kullanılır.
   */
  static epochMs(): number {
    return dayjs().valueOf();
  }

  private static tz(date?: Date | string, tz: TimeZoneType = DEFAULT_TZ) {
    return dayjs(date).tz(DateTimeManager.toIana(tz));
  }
}

export interface DurationOptions {
  seconds?: number;
  minutes?: number;
  hours?: number;
  days?: number;
}
