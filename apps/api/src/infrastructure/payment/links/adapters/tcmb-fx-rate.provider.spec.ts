import axios from 'axios';
import { TcmbFxRateProvider } from './tcmb-fx-rate.provider';
import { StaticEnvFxRateProvider } from './static-env-fx-rate.provider';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Çağrı iddiaları `mock.calls` üzerinden yazılır: `expect(mockedAxios.get)`
 * metodu nesnesinden koparıp `unbound-method` borcu üretiyor (projedeki diğer
 * axios mock'ları da bu biçimde — bkz. `slack-ops-alert.adapter.spec`).
 */
const requestedUrls = (): string[] =>
  mockedAxios.get.mock.calls.map(([url]) => url);

const TCMB_XML = `<?xml version="1.0" encoding="ISO-8859-9"?>
<Tarih_Date Tarih="01.07.2026" Date="07/01/2026" Bulten_No="2026/123">
  <Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">
    <Unit>1</Unit>
    <Isim>ABD DOLARI</Isim>
    <ForexBuying>32.1234</ForexBuying>
    <ForexSelling>32.2000</ForexSelling>
  </Currency>
  <Currency CrossOrder="1" Kod="EUR" CurrencyCode="EUR">
    <Unit>1</Unit>
    <Isim>EURO</Isim>
    <ForexBuying>35.5000</ForexBuying>
    <ForexSelling>35.6000</ForexSelling>
  </Currency>
  <Currency CrossOrder="9" Kod="XDR" CurrencyCode="XDR">
    <Unit>1</Unit>
    <ForexBuying></ForexBuying>
  </Currency>
</Tarih_Date>`;

// Unit>1 kotasyonlu (100 birim) sentetik XML — birim bölme mantığını doğrulamak için.
const TCMB_XML_UNIT100 = `<Tarih_Date>
  <Currency CrossOrder="5" Kod="GBP" CurrencyCode="GBP">
    <Unit>100</Unit>
    <ForexBuying>4200.00</ForexBuying>
  </Currency>
</Tarih_Date>`;

describe('TcmbFxRateProvider', () => {
  const buildFallback = (rate = 99) => {
    const getRate = jest.fn(() => Promise.resolve(rate));
    return {
      provider: { getRate } as unknown as StaticEnvFxRateProvider,
      getRate,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aynı para birimi → 1 (TCMB çağrısı yok)', async () => {
    const fx = new TcmbFxRateProvider(buildFallback().provider);
    expect(await fx.getRate('EUR', 'EUR')).toBe(1);
    expect(requestedUrls()).toHaveLength(0);
  });

  it('EUR→TRY: today.xml ForexBuying döner', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: TCMB_XML });
    const fx = new TcmbFxRateProvider(buildFallback().provider);

    const rate = await fx.getRate('EUR', 'TRY');

    expect(rate).toBe(35.5);
    expect(requestedUrls()).toEqual([
      'https://www.tcmb.gov.tr/kurlar/today.xml',
    ]);
  });

  it('USD→TRY: doğru para biriminin bloğunu seçer', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: TCMB_XML });
    const fx = new TcmbFxRateProvider(buildFallback().provider);
    expect(await fx.getRate('USD', 'TRY')).toBe(32.1234);
  });

  it('geçmiş tarih → tarihli URL (YYYYMM/DDMMYYYY.xml) kullanır', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: TCMB_XML });
    const fx = new TcmbFxRateProvider(buildFallback().provider);

    await fx.getRate('EUR', 'TRY', new Date('2026-03-15T10:00:00Z'));

    expect(requestedUrls()).toEqual([
      'https://www.tcmb.gov.tr/kurlar/202603/15032026.xml',
    ]);
  });

  it('Unit>1 kotasyonunda ForexBuying birime bölünür (4200/100 = 42)', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: TCMB_XML_UNIT100 });
    const fx = new TcmbFxRateProvider(buildFallback().provider);
    expect(
      await fx.getRate('GBP', 'TRY', new Date('2026-03-15T10:00:00Z'))
    ).toBe(42);
  });

  it('para birimi eksik/boş ForexBuying → StaticEnv fallback', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: TCMB_XML });
    const fallback = buildFallback(40);
    const fx = new TcmbFxRateProvider(fallback.provider);

    // GBP TCMB_XML'de yok → fallback (40) döner.
    expect(await fx.getRate('GBP', 'TRY')).toBe(40);
    expect(fallback.getRate).toHaveBeenCalledWith('GBP', 'TRY', undefined);
  });

  it('yayın olmayan gün (hafta sonu) → bir gün geriye yürür, SON YAYINLANAN kuru kullanır', async () => {
    // TCMB hafta sonu/tatilde kur yayınlamaz: o güne ait dosya yoktur (404).
    // Tek güne bakan eski sürüm statik env fallback'ine düşüyordu; o da
    // yapılandırılmadığı için posting hata veriyor ve hafta sonuna düşen her
    // yabancı para olayı **fişlenmemiş** kalıyordu.
    mockedAxios.get
      .mockRejectedValueOnce(new Error('Request failed 404')) // 14.03 cumartesi
      .mockResolvedValueOnce({ data: TCMB_XML }); // 13.03 cuma
    const fallback = buildFallback(38.5);
    const fx = new TcmbFxRateProvider(fallback.provider);

    const asOf = new Date('2026-03-14T10:00:00Z'); // cumartesi

    expect(await fx.getRate('EUR', 'TRY', asOf)).toBe(35.5);
    expect(requestedUrls()[1]).toBe(
      'https://www.tcmb.gov.tr/kurlar/202603/13032026.xml'
    );
    expect(fallback.getRate).not.toHaveBeenCalled();
  });

  it('bugünün dosyası henüz yayınlanmadıysa dünün kuruna düşer', async () => {
    // TCMB günlük dosyayı öğleden sonra yayınlar; o saate kadar `today.xml` de
    // yoktur. İlk deneme `today.xml`, ikincisi dünün tarihli dosyası olmalı.
    mockedAxios.get
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValueOnce({ data: TCMB_XML });
    const fx = new TcmbFxRateProvider(buildFallback().provider);

    expect(await fx.getRate('EUR', 'TRY')).toBe(35.5);
    expect(requestedUrls()[0]).toBe('https://www.tcmb.gov.tr/kurlar/today.xml');
    expect(requestedUrls()).toHaveLength(2);
  });

  it('bir haftadan uzun boşlukta kabul etmez → StaticEnv fallback', async () => {
    // Sınırsız geriye yürümek, erişim/yapılandırma sorununu aylar öncesinin
    // kuruyla sessizce fişletirdi.
    mockedAxios.get.mockRejectedValue(new Error('404'));
    const fallback = buildFallback(38.5);
    const fx = new TcmbFxRateProvider(fallback.provider);

    const asOf = new Date('2026-03-14T10:00:00Z');
    expect(await fx.getRate('EUR', 'TRY', asOf)).toBe(38.5);
    expect(requestedUrls()).toHaveLength(8); // istenen gün + 7 gün
    expect(fallback.getRate).toHaveBeenCalledWith('EUR', 'TRY', asOf);
  });

  it('aynı gün+para birimi ikinci çağrıda cache kullanılır (tek fetch)', async () => {
    mockedAxios.get.mockResolvedValue({ data: TCMB_XML });
    const fx = new TcmbFxRateProvider(buildFallback().provider);
    const asOf = new Date('2026-03-15T10:00:00Z');

    await fx.getRate('EUR', 'TRY', asOf);
    await fx.getRate('EUR', 'TRY', asOf);

    expect(requestedUrls()).toHaveLength(1);
  });

  it('hedef TRY değilse TRY üzerinden triangüle eder (EUR→USD)', async () => {
    mockedAxios.get.mockResolvedValue({ data: TCMB_XML });
    const fx = new TcmbFxRateProvider(buildFallback().provider);

    // EUR/TRY = 35.5, USD/TRY = 32.1234 → EUR→USD = 35.5 / 32.1234
    const rate = await fx.getRate('EUR', 'USD');
    expect(rate).toBeCloseTo(35.5 / 32.1234, 6);
  });
});
