import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { CurrencyType } from '@input-type-schemas/CurrencySchema';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { IFxRateProvider } from '../fx-rate.port';
import { StaticEnvFxRateProvider } from './static-env-fx-rate.provider';

interface CachedRate {
  rate: number;
  /** epoch ms; geçmiş (immutable) tarihler için Infinity, bugün için kısa TTL. */
  expiresAt: number;
}

/**
 * TCMB günlük döviz kuru sağlayıcı — statutory kaynak (VUK: değerlemede TCMB döviz **alış**
 * kuru). Posting `asOf` (işlem tarihi) geçtiğinde o güne ait kuru kullanır; böylece yabancı
 * işlemler fonksiyonel paraya işlem-tarihli kurla çevrilir (anlık kur değil).
 *
 * Kaynak: `https://www.tcmb.gov.tr/kurlar/today.xml` (bugün) veya
 * `.../kurlar/YYYYMM/DDMMYYYY.xml` (geçmiş gün). Hafta sonu/resmî tatilde yayın **yoktur**;
 * o günler için en çok yedi gün geriye yürünüp **son yayınlanan** kur kullanılır. Kurlar
 * gün-içinde değişmez → in-memory cache (yayınlanmış geçmiş gün süresiz, bugün/geriye
 * yürünen gün kısa TTL). Çok-instance dağıtımda her instance kendi cache'ini
 * tutar; TCMB çağrısı ucuz olduğundan kabul edilir (Redis'e coupling'den kaçınıldı).
 *
 * Herhangi bir hata (ağ, parse, hafta sonu/tatil dosyası yok, para birimi eksik) → statik env
 * sağlayıcıya (fallback) düşer; o da çözemezse hata yükselir (çağıran graceful degrade eder).
 */
@Injectable()
export class TcmbFxRateProvider implements IFxRateProvider {
  private readonly logger = new Logger(TcmbFxRateProvider.name);
  private readonly cache = new Map<string, CachedRate>();

  private static readonly BASE_URL = 'https://www.tcmb.gov.tr/kurlar';
  private static readonly TIMEOUT_MS = 4000;
  private static readonly TODAY_TTL_MS = 30 * 60 * 1000; // 30 dk
  /**
   * Yayın olmayan günlerde kaç gün geriye yürünür. Yedi gün, hafta sonu + uzun
   * resmî tatilleri (ör. dokuz günlük bayram tatilinin ardındaki ilk iş günü)
   * kapsar. Sınır olmazsa erişim/yapılandırma sorunu sessizce aylar öncesinin
   * kuruyla fiş yazdırır — kur eskidikçe tutar sapar ve kimse fark etmez.
   */
  private static readonly MAX_LOOKBACK_DAYS = 7;

  constructor(private readonly fallback: StaticEnvFxRateProvider) {}

  async getRate(
    from: CurrencyType,
    to: CurrencyType,
    asOf?: Date
  ): Promise<number> {
    if (from === to) return 1;

    // TCMB tüm kurları TRY üzerinden verir. Hedef TRY değilse TRY üzerinden triangüle et.
    if (to !== 'TRY') {
      const [fromTry, toTry] = await Promise.all([
        this.getRate(from, 'TRY', asOf),
        this.getRate(to, 'TRY', asOf),
      ]);
      return fromTry / toTry;
    }

    if (from === 'TRY') return 1;

    try {
      return await this.resolveTryRate(from, asOf);
    } catch (err) {
      this.logger.warn(
        `TCMB kuru çözülemedi (${from}→TRY, asOf=${
          asOf ? DateTimeManager.toDateKey(asOf) : 'today'
        }): ${
          err instanceof Error ? err.message : err
        } — statik env fallback deneniyor.`
      );
      return this.fallback.getRate(from, to, asOf);
    }
  }

  /**
   * Belirli gün için `from`→TRY döviz alış kurunu (cache'li) çözer.
   *
   * **Yayın olmayan günler geriye yürütülür.** TCMB hafta sonu ve resmî
   * tatillerde kur **yayınlamaz**: o güne ait dosya yoktur (404). Tek günün
   * dosyasına bakan eski sürüm, cumartesi gerçekleşen bir yabancı para
   * işleminde kuru hiç çözemiyordu → statik env fallback'ine düşüyordu; o da
   * yapılandırılmadığı için (geliştirmede `none`, üretimde hiç yok) posting
   * **hata** veriyordu. Sonuç: hafta sonuna düşen her yabancı para olayı
   * fişlenmemiş kalıyor, telafi turu da aynı hatayla her seferinde patlıyordu.
   *
   * Geriye yürüme hem pratik hem **mevzuata uygun** yoldur: değerlemede o gün
   * için yayınlanmış kur yoksa **son yayınlanan** kur esas alınır. Bir haftadan
   * uzun boşluk (yapılandırma/erişim sorunu) sessizce kabul edilmez, hata
   * yükselir.
   */
  private async resolveTryRate(
    from: CurrencyType,
    asOf?: Date
  ): Promise<number> {
    const now = DateTimeManager.create();
    const base = asOf ?? now;
    const isToday = !asOf || DateTimeManager.isSameDay(asOf, now);
    const requestedKey = DateTimeManager.toCompactDateKey(base);
    const cacheKey = `${requestedKey}:${from}`;

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.rate;
    }

    const failures: string[] = [];

    for (let back = 0; back <= TcmbFxRateProvider.MAX_LOOKBACK_DAYS; back++) {
      const day = back === 0 ? base : DateTimeManager.subtractDays(base, back);
      // `today.xml` yalnız ilk denemede ve gerçekten bugünse kullanılır: TCMB
      // günlük dosyayı öğleden sonra yayınlar, o saate kadar bu dosya da yoktur
      // ve bir gün geriye yürümek gerekir.
      const url =
        back === 0 && isToday
          ? `${TcmbFxRateProvider.BASE_URL}/today.xml`
          : this.dailyUrl(day);

      let xml: string;
      try {
        xml = await this.fetchXml(url);
      } catch (err) {
        // **Yalnız yayın yokluğunda** geriye yürünür. Dosya indirilebildiği
        // hâlde para birimi bültende yoksa (desteklenmeyen birim) geriye
        // yürümek sorunu çözmez: sekiz ağ çağrısı yapıp aynı yere varır.
        failures.push(
          `${DateTimeManager.toCompactDateKey(day)}: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
        continue;
      }

      const rate = this.extractForexBuying(xml, from);

      if (back > 0) {
        this.logger.log(
          `TCMB ${from}→TRY: ${requestedKey} için yayın yok, ${DateTimeManager.toCompactDateKey(
            day
          )} kuru kullanıldı (son yayınlanan kur).`
        );
      }

      this.cache.set(cacheKey, {
        rate,
        // Bugünün kuru gün içinde yayınlanabilir → kısa TTL. Geriye yürünen
        // gün için de kısa TTL: istenen gün hâlâ "bugün"se yayın gelebilir.
        expiresAt:
          isToday || back > 0
            ? Date.now() + TcmbFxRateProvider.TODAY_TTL_MS
            : Number.POSITIVE_INFINITY,
      });
      return rate;
    }

    throw new Error(
      `TCMB ${from}→TRY kuru ${TcmbFxRateProvider.MAX_LOOKBACK_DAYS + 1} gün geriye kadar çözülemedi (${failures.join(
        ' | '
      )}).`
    );
  }

  /** `YYYYMM/DDMMYYYY.xml` — tarih anahtarları İstanbul yerel takvimine göre. */
  private dailyUrl(day: Date): string {
    const folder = DateTimeManager.toCompactMonthKey(day);
    const file = DateTimeManager.toCompactDateKey(day);
    return `${TcmbFxRateProvider.BASE_URL}/${folder}/${file}.xml`;
  }

  private async fetchXml(url: string): Promise<string> {
    const res = await axios.get<string>(url, {
      timeout: TcmbFxRateProvider.TIMEOUT_MS,
      responseType: 'text',
      // Hafta sonu/tatilde dosya yok → 404; catch edilip fallback'e düşülür.
      headers: { Accept: 'application/xml,text/xml' },
    });
    return res.data;
  }

  /**
   * TCMB XML'inde ilgili `<Currency CurrencyCode="XXX">` bloğundan `<ForexBuying>`'i çeker ve
   * `<Unit>`'e böler (bazı para birimleri 100 birim kotasyonludur; EUR/USD/GBP için 1). Değer
   * boş/geçersizse hata → fallback.
   */
  private extractForexBuying(xml: string, currency: CurrencyType): number {
    const block = new RegExp(
      `<Currency[^>]*CurrencyCode="${currency}"[^>]*>([\\s\\S]*?)</Currency>`,
      'i'
    ).exec(xml);
    if (!block) {
      throw new Error(`TCMB XML'inde ${currency} bulunamadı.`);
    }

    const buyingMatch = /<ForexBuying>([\d.]+)<\/ForexBuying>/i.exec(block[1]);
    const unitMatch = /<Unit>(\d+)<\/Unit>/i.exec(block[1]);

    const buying = buyingMatch ? Number(buyingMatch[1]) : NaN;
    const unit = unitMatch ? Number(unitMatch[1]) : 1;

    if (
      !Number.isFinite(buying) ||
      buying <= 0 ||
      !Number.isFinite(unit) ||
      unit <= 0
    ) {
      throw new Error(`TCMB ${currency} döviz alış kuru geçersiz/boş.`);
    }

    return buying / unit;
  }
}
