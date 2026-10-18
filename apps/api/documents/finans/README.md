# Klinik ERP — Finans / Muhasebe Modülü Dokümantasyonu

Bu doküman seti, bir **klinik ERP'sinin finans (ledger) tarafını** sıfırdan inşa etmek için
hazırlanmıştır. Hedef: önmuhasebeyi tam operasyonel yapmak, bundan **otomatik muhasebe fişi** üretmek
ve resmî beyanname/e-belge tarafını bir **entegratör (Logo, Uyumsoft, GİB vb.) modülü** ile yürütmek.
Entegratör modülü kapalıyken sistem en azından **önmuhasebe + fiş üretimi** seviyesinde tam çalışır.

> **Kullanım amacı:** Bu dosyalar Claude Code (veya başka bir geliştirici) tarafından implementasyon
> referansı olarak okunmak üzere yazılmıştır. Her dosya tek bir konuya odaklıdır; sırayla okunabilir.

## Varsayımlar

- **Bağlam:** Türkiye, klinik (özellikle diş/ağız-diş sağlığı) işletmeleri. Hem **muayenehane**
  (serbest meslek / şahıs) hem **poliklinik** (şirket / kurum) desteklenir.
- **Stack:** TypeScript / Node.js backend + PostgreSQL. Kavramsal bölümler stack-bağımsızdır; kod
  örnekleri TS + SQL'dir. ORM olarak Prisma varsayılır (TypeORM/Drizzle'a kolay uyarlanır).
- **Muhasebe standardı:** Tek Düzen Hesap Planı (TDHP), çift taraflı (double-entry) kayıt.
- **Para birimi:** TRY ana para birimi; çok para birimi (döviz) altyapısı baştan kurulur ama opsiyonel.

## Okuma sırası ve modül haritası

| Dosya                                                                    | İçerik                                                                                                                                            | Kim için kritik                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| [`00-mimari.md`](./00-mimari.md)                                         | Katmanlı mimari, modülerlik, çapraz kesen konular (multi-tenant, audit, dönem)                                                                    | Herkes — önce bunu oku              |
| [`01-veri-modeli.md`](./01-veri-modeli.md)                               | Çekirdek varlıklar, PostgreSQL şeması, TypeScript tipleri                                                                                         | Backend                             |
| [`02-hesap-plani.md`](./02-hesap-plani.md)                               | TDHP + klinik özelinde hesap planı, hesap türleri                                                                                                 | Muhasebe çekirdeği                  |
| [`03-onmuhasebe.md`](./03-onmuhasebe.md)                                 | Cari, kasa/banka/POS, fatura, stok, tahsilat, çek/senet                                                                                           | Operasyon katmanı                   |
| [`04-muhasebe-defterler.md`](./04-muhasebe-defterler.md)                 | Yevmiye fişi, defter-i kebir, mizan, dönem kapama, mali tablolar                                                                                  | Muhasebe çekirdeği                  |
| [`05-muhasebelestirme-kurallari.md`](./05-muhasebelestirme-kurallari.md) | Olay → fiş şablonu eşleşmeleri (posting rules engine)                                                                                             | **En kritik** — entegrasyonun kalbi |
| [`06-vergi.md`](./06-vergi.md)                                           | KDV, tevkifat, stopaj, geçici/kurumlar vergisi, beyanname verisi                                                                                  | Vergi                               |
| [`07-entegrator-modulu.md`](./07-entegrator-modulu.md)                   | e-Fatura/e-Arşiv/e-SMM, Logo/GİB; pluggable + fallback                                                                                            | Entegrasyon                         |
| [`08-girdi-cikti-ozeti.md`](./08-girdi-cikti-ozeti.md)                   | Hangi girdiyi tutmalısın / hangi çıktıyı üretmelisin (kontrol listesi)                                                                            | Ürün/kapsam                         |
| [`09-guvence-denetimi.md`](./09-guvence-denetimi.md)                     | Para güvenliği denetimi: modül-modül kontrol listesi + açık bulgular (P0/P1/P2)                                                                   | **Canlıya çıkmadan** — herkes       |
| [`10-kalan-isler.md`](./10-kalan-isler.md)                               | Denetimden kalan işler **tek listede**: 22 iş paketi (tetikleyici + bağımlılık sırası), kabul edilmiş tasarım kararları, kurulum/operasyon durumu | Planlama — sıradaki turu seçerken   |
| [`11-eksik-kalanlar.md`](./11-eksik-kalanlar.md)                         | Ertelenen kalemlerin düz listesi — **üretilir** (`pnpm finans:eksik`), elle tutulmaz                                                              | Hiçbir kalemin düşmediğini görmek   |
| [`12-durum-devri.md`](./12-durum-devri.md)                               | **Durum devri:** mimari kararlar + 16 kural indeksi + kapatılan bulgular + migration durumu + bekleyen 22 paket, tek sayfada                      | Yeni bir oturuma bağlam vermek      |

## Katman özeti (tek bakışta)

```
┌─────────────────────────────────────────────────────────────┐
│  ÖNMUHASEBE (operasyonel)                                     │
│  Cari · Kasa/Banka/POS · Fatura · Stok · Tahsilat · Çek/Senet │
│  → Her işlem bir "ekonomik olay" (financial event) üretir     │
└───────────────────────────┬─────────────────────────────────┘
                            │  posting rules
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  MUHASEBELEŞTİRME (fiş üretimi)                               │
│  Olay → çift taraflı yevmiye fişi (TDHP hesaplarıyla)         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  MUHASEBE (ledger)                                            │
│  Yevmiye · Defter-i Kebir · Mizan · Mali Tablolar · Dönem     │
└───────────────────────────┬─────────────────────────────────┘
                            │  (opsiyonel, pluggable)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  ENTEGRATÖR MODÜLÜ                                            │
│  e-Fatura/e-Arşiv/e-SMM · Beyanname export · Logo/GİB         │
│  KAPALIYSA: sistem önmuhasebe + fiş seviyesinde tam çalışır   │
└─────────────────────────────────────────────────────────────┘
```

## Tasarım ilkesi (özet)

Bütün finansal hareketleri **önce "ekonomik olay" (financial event)** olarak yakala. Muhasebe fişi bu
olayların **türevidir**, kaynak değildir. Böylece entegratör modülünü açıp kapatabilir, posting
kurallarını değiştirebilir ve fişleri yeniden üretebilirsin. Detay: `00-mimari.md`.

> **Yasal not:** Bu doküman teknik mimari rehberidir, mali müşavirlik tavsiyesi değildir. Hesap eşleşmeleri,
> KDV/tevkifat oranları ve beyanname kuralları mevzuata ve işletmenin durumuna göre değişir; canlıya
> almadan önce bir SMMM/YMM ile doğrulanmalıdır.
