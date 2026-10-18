# Finans — Durum Devri (State Handoff)

**Tarih:** 2026-10-15 (§85 / tur 29 sonrası) · **Dal:** `main` · **Commit:** yok —
**tüm iş çalışma ağacında**, hiçbir şey commit edilmedi.

**Bu belge nedir.** Yeni bir sohbete doğrudan bağlam olarak yapıştırılmak üzere
yazılmış özet. Kaynak belgeler hâlâ şunlardır ve bu dosya onların yerini **almaz**:

| Dosya | İçerik |
| --- | --- |
| `09-guvence-denetimi.md` (6.306 satır) | Denetimin tamamı: §2 durum tablosu, §3–§86 tur bölümleri, §45 özet |
| `10-kalan-isler.md` | 22 iş paketi + kabul edilmiş tasarımlar + operasyon/kurulum |
| `11-eksik-kalanlar.md` | **Üretilir** (`pnpm finans:eksik`), 205 kalem düz liste |
| `/CLAUDE.md` → "Finans / Muhasebe — Para Güvenliği Kuralları" | 16 kural, tam metin |

Bir kalem kapandığında **iki yerde** işaretlenir (§-bölümü + `10-kalan-isler.md`),
yoksa liste sessizce bayatlar.

---

## 1. Çalışma kuralları (devredilen kısıtlar — bunlar değişmez)

| Kısıt | Gerekçe |
| --- | --- |
| **Migration'ları kullanıcı uygular** (`pnpm migrate:dev`) | Migration yazılır, çalıştırılmaz |
| **Otomatik yıkıcı veri temizliği yok** | Geçmişi yorumlayan düzeltme muhasebe kararıdır |
| **`git checkout <dosya>` bu ağaçta asla kullanılmaz** | Commit edilmemiş işi siler → `git restore --staged` |
| **Hiçbir şey commit edilmez** | İş çalışma ağacında kalır |
| **Canlı veritabanına yalnız okuma** | `finance-invariants.cjs` ve ölü-mektup betikleri tasarımı gereği salt okunur |
| Tur düzeni | denetle → düzelt → test → **belgelere yaz** (§-bölüm + §2 satırı + §45 + `10-kalan-isler` + `pnpm finans:eksik` + hafıza) |
| Yeni devredilebilir ders | `/CLAUDE.md` finans kuralları bölümüne **kural** olarak yazılır |

---

## 2. Mimari kararlar (finans)

- **Defter klinik seviyesinde.** `organizationId` taşıyan her finans kaydı `clinicId` de taşır.
- **Akış:** ekonomik olay (`FinancialEvent`, append-only, `dedupeKey` + unique) → posting kuralı
  (`POSTABLE_FINANCIAL_EVENT_TYPES` + kural sınıfı) → yevmiye fişi (`JournalEntry` + `JournalLine`).
- **Para:** `Decimal` (decimal.js). Prisma domain'e girmez. `Money.PRECISION = 2`,
  `Money.ROUNDING = ROUND_HALF_UP`, tek yuvarlama kapısı `Money.scale()`, ölçü predicate'i
  `Money.isKurusScaled()`.
- **Yabancı para — Model A:** defter tek fonksiyonel parada (bugün TRY), yabancı işlem
  **posting anında** olay tarihinin kuruyla çevrilir; kur fişte kilitlenir (`original*`, `fxRate`).
- **Storno defterden silmez:** orijinal fiş `REVERSED` olarak yerinde kalır; **her** defter/bakiye
  sorgusu `LEDGER_EFFECTIVE_ENTRY_STATUSES` (= `POSTED` + `REVERSED`) ile süzer.
- **Hesap planı:** TDHP. Kullanılan geçiş/kontrol hesapları: 100 Kasa, 102 Bankalar,
  **108 Diğer Hazır Değerler** (kart parası yolda), 120 Alıcılar, 150, 159/326 (GRNI),
  191/391 KDV, 320 Tedarikçi, 590/591/690, **653 Komisyon Giderleri (POS/Banka)**,
  679/689, 646/656 kambiyo.
- **Kritik event'ler `outboxRun()` ile mühürlenir** (§45'te 55 çağrı yeri ölçüldü) ve **yalnız `@OnDomainEvent`**
  ile teslim edilir (`async` + `promisify` + `suppressErrors: false`); beklenmeyen yol
  `emitDetached()` kullanır. Outbox: `FOR UPDATE SKIP LOCKED` + kiralama + ölü mektup.
- **Platform bir kiracı satırıdır** (`isPlatform`); sağlık turizmi komisyonu platform geliridir.

---

## 3. 16 para güvenliği kuralı — indeks (tam metin `/CLAUDE.md`)

1. Dönem kapısı kilit altında, aynı tx'te, Command Repo'dan okunur.
2. Yevmiye no tek-UPDATE ile tahsis edilir; `MAX(entry_no)+1` yasak.
3. Koşulsuz `update(entity)` durum yarışını kapatmaz — aggregate'in **bütün** geçişleri korunur.
4. Yutulan hata retry değildir: her yutulan kritik iş için retry **ya da** backfill + "eksik kalanlar" sorgusu.
5. Takvime bağlı ön koşullar (dönem, vergi parametresi) idempotent zamanlanmış işe bağlanır.
6. Dönem kapanışı "fişlenmemiş olay var mı" kontrolü olmadan çalıştırılmaz.
7. Yüksek etkili finansal işlem ayrı capability + kalıcı damga ister.
8. Storno silmez; rapor süzgeci `POSTED` + `REVERSED` (tek sabitten).
9. Repository mapping'inde alan düşmesi sessiz veri kaybıdır (para/kur kolonları testle kilitlenir).
10. Bir varlığın içkin kuralları **çözümlendiği yerde** zorlanır (lookup/resolver), çağrı yerinde değil.
11. Şablondan kurulan referans veride **sapma raporu** zorunlu; otomatik onarım varsayılan değil.
12. Bir değeri doğrulayan kural ile kullanan kural **aynı sabitten** gelir; kapı kullanımdan geniş olamaz.
13. "Teslim edildi" damgası dinleyicinin bittiğini kanıtlamak zorundadır; sıra zamanlamaya bırakılmaz.
14. Değişmez **saklanan veride** doğru olmak zorundadır: ölçü kapısı en içte, imkânsız bakiye kaydın
    önünde, saklanan veriye soru soran tarama + `NOT VALID` CHECK.
15. Uyarıya bağlanmış güvence, uyarının ulaştığı kanıtlanmadıkça güvence değildir (kanal / dinleyici
    kaydı / altyapı herkes adına yutmaz / sürecin ölümü de uyarıdır).
16. Geçiş hesabı açan akış, **kapatan akışla birlikte** tasarlanır (108, 159/326, 191/391);
    kapatma tutarı bekleyen bakiyeyi aşamaz.

---

## 4. Kapatılan bulgular — modül bazlı (kaynak: §2 tablosu)

Toplam: **~61×P0, ~107×P1, ~74×P2 + 1 eksik akış** (§85).

| Modül | Kapatılan | Bölüm |
| --- | --- | --- |
| `accounting/periods` | 5×P0, 3×P1 | §3, §4 |
| `accounting/posting` | 3×P0, 4×P1 + storno primitifi + raporlama 3×P0/2×P1 | §6, §47.1, §51 |
| `accounting/financial-events` | 4×P1, 3×P2 + dönem kapısı servisi | §34, §36 |
| `accounting/chart-of-accounts` | 2×P1, 5×P2 | §8, §9 |
| `accounting/tax-parameters` | 1×P0, 3×P1, 2×P2 | §10, §11 |
| `invoice` | 3×P0/7×P1/4×P2 + iptal 4×P0/7×P1/4×P2 + yuvarlama 2×P0/1×P1 | §12, §14.1, §47, §53 |
| `purchase-invoice` | 3×P0/5×P1/1×P2 + iptal + 1×P0 | §13, §14.2, §47, §53.5 |
| `e-document` | ⏳ **kısmen** — 1×P1, 1×P2 (kalem bazlı XML + `getStatus` adapter'a bağlı) | §35, §36 |
| `payment` | 4×P0, 5×P1, 5×P2 | §16, §18.1 |
| `payment-gateway` | 1×P0, 1×P1 | §17, §18.2 |
| `pos/physical` + `pos/virtual` | 4×P0, 5×P1, 5×P2 + aktör damgası 1×P1 | §20, §21, §57 |
| `cash-register` | 1×P0, 3×P1, 3×P2 | §23, §24 |
| `bank` | 1×P0 (ortak), 2×P1 | §23, §24 |
| `finance-ledger` | 2×P0, 5×P1, 6×P2 | §26, §28 |
| `party` | 4×P1, 3×P2 | §27, §28 |
| `treatment-charge` | 2×P0, 4×P1, 2×P2 | §30, §32 |
| `payroll` | 1×P0, 2×P1, 1×P2 | §31, §32 |
| `supply/purchasing` | 2×P0, 4×P1, 6×P2 + katalog kapısı | §38, §39 |
| `supply/inventory` | 1×P0, 9×P1, 5×P2 + değerleme/SMM + ürün KDV 2×P1 | §41–§44, §55 |
| `platform/subscription` (kart çeker) | 2×P0, 2×P1 | §59, §60 |
| `crm/health-tourism` (ödeme) | 2×P0, 1×P1 | §61, §62 |
| `crm/health-tourism` (fiyat) | 2×P0, 2×P1 | §63, §64 |

## 5. Kesişen turlar (tema bazlı) — başlık bulgular

| § | Tema | Başlık bulgu |
| --- | --- | --- |
| §44 | Envanter değerlemesi + 150 mutabakatı + SMM | tüketim hiç fişlenmiyordu |
| §47/§48 | Belge iptali / storno | iptal defteri hükümsüz kılmıyordu (iki modül) |
| §49/§50 | GRNI + parti sapması + ödeme yöntemi kapısı | mal geldi/fatura gelmedi karşılığı yoktu |
| §51/§52 | Raporlama semantiği | bilanço **anı** yoktu (`asOf`), gün sınırı kayıyordu |
| §53/§54 | Yuvarlama | çok satırlı fatura kesilemiyordu; `Money.scale()` tek kapı |
| §55/§56 | Ürün KDV kapısı + erteleme taraması | sıfır KDV'li ürün oluşturulamıyordu |
| §57/§58 | POS ters kaydı | iadeyi/iptali **kimin** yaptığı hiçbir yerde yoktu |
| §59/§60 | Abonelik tahsilatı | tahsilat defteri yoktu, `external_id` iki rol taşıyordu |
| §61/§62 | Ödeme linkleri | sahiplenilemeyen ödeme dalı yerel duruma göre karar veriyordu |
| §63/§64 | Fiyat türetmesi | defter teklif tutarını tedarikçi borcu yazıyordu |
| §65/§66 | İade akışı | iade çift taraflı deftere **hiç** ulaşmıyordu (2×P0) |
| §67/§68 | Rezervasyon iadesi | platform defteri ters kaydedilmiyordu, ileri fiş postlanamıyordu |
| §69/§70 | Platform telafi yolu | eksik kalan platform fişinin geri dönüşü yoktu |
| §71/§72 | Yabancı para | 108 gelmeyen parayı gösteriyordu; yayın olmayan gün fişlenemiyordu |
| §73/§74 | Webhook kimliği | iki `@Public` callback'te bildirim ↔ kayıt bağı yoktu (2×P0) |
| §75/§76 | Hassas veri | çekim yapmaya yeten kart token'ı yönetim grubuna serileştiriliyordu |
| §77/§78 | Outbox teslimi | "işlendi" damgası dinleyici **başlamadan** atılıyordu (2×P0) |
| §79/§80 | Önbellek / teklif sahipliği | para kararı global anahtarlı Redis kaydından, sahip kontrolü yok |
| §81/§82 | Değişmezler (uygulama ↔ DB) | kasa çıkışı çekmecede para var mı sormuyordu → uydurma gelir + olmayan banka mevcudu |
| §83/§84 | Alarm zinciri | 41 kalem uyarıya bağlıydı; **kanal hiçbir ortamda tanımlı değildi**, `AuditLogService` herkes adına yutuyordu |
| §85/§86 | Settlement (108 → 102 + 653) | **108'i kapatan hiçbir akış yoktu** — denetim değil, eksik ekonomik olay |

---

## 6. Primitifler ve kapılar (kod adresleri)

| Ad | Yer / iş |
| --- | --- |
| `Money.scale()` / `isKurusScaled()` | `src/domain/value-objects/money.vo.ts` — tek yuvarlama kapısı + ölçü predicate'i |
| `lockRowForUpdate` / `lockRowForUpdateOrFail` | `prisma/base.repository.ts` — `FOR UPDATE`, tx yoksa patlar |
| `lockConcept(key)` | `prisma/base.repository.ts` — `pg_advisory_xact_lock(hashtext($1))`; kilitlenecek satırı olmayan bakiyeler için |
| `lockAndGetAccountBalance` | `posting/.../journal.command.repository.ts` — kilit + okuma **tek atomik metot** |
| `PERIOD_GATE_SERVICE.assertPeriodNotSealedAt` | dönem kapısı (11 çağrı yeri) |
| `FUNDS_IN_TRANSIT_GATE.assertCanSettle` | `posting/domain/services/funds-in-transit/` — 108 bakiye kapısı |
| `PostingDomainServicesModule` | yaprak modül; tüketici `PostingModule`'ü import **etmez** |
| `FinancialEventDedupeKeys` | olay defteri idempotency anahtarları (23 dosya) |
| `POSTABLE_FINANCIAL_EVENT_TYPES` | fişlenebilir olay tipleri (12 dosya) |
| `LEDGER_EFFECTIVE_ENTRY_STATUSES` | `POSTED` + `REVERSED` — tüm defter sorgularının süzgeci |
| `CriticalFailurePublisher` → `OPS_ALERT_PORT` | **42** çağrı yeri (§83'te 41 ölçülmüştü); Slack adaptörü + Redis dedupe + log fallback |
| `installProcessFailureAlarms` | `src/common/observability/` — yakalanmayan red → CRITICAL + süreç kapanır |
| `pnpm finans:degismezler` | `scripts/finance-invariants.cjs` — 8 salt-okunur kontrol, aykırılıkta exit 1 |
| `pnpm finans:eksik` | `scripts/finans-eksik-liste.cjs` — `11-eksik-kalanlar.md` üretir |

---

## 7. Veritabanı / migration durumu

**16 migration yazıldı, 8'i uygulandı ve doğrulandı** (`migrate diff` → sapma yok).
**8'i bekliyor** — hepsi ek/nullable kolon, enum değeri veya `NOT VALID` kısıt; veri çatışması yok:

```
20261013140000_pos_transaction_initiated_by      (§57)
20261013160000_subscription_charge_ledger        (§59)
20261013180000_booking_payment_supplier_amount   (§63)
20261013200000_financial_event_payment_refunded  (§65)
20261013220000_booking_payment_refund_ledger     (§67)
20261014100000_outbox_delivery_guarantee         (§77)
20261015100000_financial_invariant_checks        (§81 — 8 CHECK, hepsi NOT VALID)
20261015120000_provider_settlement               (§85 — yeni tablo + enum değeri + 2 CHECK)
```

Uygulama sırası: `pnpm migrate:dev` → `pnpm finans:degismezler` → **temizse**
`NOT VALID` kısıtlar için `VALIDATE CONSTRAINT`.

**Son şema eklemeleri (§85):** `provider_settlements` tablosu
(`@@unique([clinicId, provider, reference])`, `Decimal(14,2)` tutarlar,
`CHECK (gross>0 AND net>0 AND commission>=0)`, `CHECK (gross = net + commission)`),
`enum SettlementProvider`, `FinancialEventType.PROVIDER_SETTLEMENT_RECEIVED`.

> **KURAL: "migration uygulandı" defterin çalıştığı anlamına gelmez.**

---

## 8. Bekleyen iş paketleri (22) — `10-kalan-isler.md` §1

Sıra önem değil **bağımlılık** sırasıdır; her satırın tetikleyicisi ve adresi o dosyada.

| # | İş paketi | Tetikleyici |
| --- | --- | --- |
| 1 | Dönem sonu / yıl sonu fiş takımı | ilk gerçek dönem kapanışı / resmî bilanço |
| 2 | Kalem bazlı fatura + gerçek e-belge adapter'ı | entegratör sözleşmesi / ilk e-Defter dönemi |
| 3 | İade / refund akışı (kalan kısım) | ilk hasta ya da abonelik iadesi |
| 4 | Yetki ayrımı (SoD) + yüksek etkili işlem damgası | rol matrisi turu |
| 5 | POS gün sonu (EOD) ↔ defter mutabakatı | **BLOKE** — sağlayıcı dokümanı/sandbox |
| 6 | Yabancı para parti maliyeti | ilk yabancı para alımı |
| 7 | Envanter derinleştirme | dönem sonu envanter / ilk transfer-iade |
| 8 | Cari (party) raporlama | panelde kâr/zarar; franchise konsolide |
| 9 | Dönem kapısının genişletilmesi | geriye dönük elle tahsilat/kasa düzeltmesi |
| 10 | Vergi parametresi olgunlaşması | ondalık orana geçiş (ör. %8,5) |
| 11 | Hesap planı yönetimi | şablonun ikinci düzeltmesi / hesap planı ekranı |
| 12 | Hijyen borçları | hijyen turu / lint'in CI'da zorunlu olması |
| 13 | Frontend (`apps/web`) | Faz 3 |
| 14 | Finans dışındaki kalan para yolları | komisyon oranı değişikliği / fiyat şikâyeti |
| 15 | Yabancı para olgunlaşması | ilk yabancı para faturası; değerleme turu |
| 16 | Settlement — ~~klinik defteri **✅ §85**~~ / **platform defterinin 108'i açık** | ilk sağlayıcı payout mutabakatı |
| 17 | Para getiren `@Public` uçların doğrulaması | beşinci para ucu; ilk fiziksel POS adapter'ı |
| 18 | Hassas veri olgunlaşması | ilk sağlayıcı itirazı; KVKK dokümantasyonu |
| 19 | Event teslimi olgunlaşması | ilk gerçek ölü mektup |
| 20 | Teklif yaşam döngüsü (sağlık turizmi) | ödeme-önce akışın idempotency turu |
| 21 | Bakiye politikasının zorlanması (hasta carisi) | hasta cari ekstresi / bakiye okuma modeli |
| 22 | Alarm olgunlaşması | `SLACK_OPS_WEBHOOK_URL` bağlandıktan sonra |

**§86 (settlement) bilinçli ertelemeleri:** komisyonun KDV ayrıştırması (sağlayıcı faturası
gelmeden indirilecek KDV yazılmaz), 108'in sağlayıcı bazlı alt hesapları, FIFO yaşlandırma,
ekstre ↔ payout eşleştirme bağı, sağlayıcı payout API'si, **platform defterinin 108'i**.

---

## 9. Operasyon / kurulum blokajları (koddan bağımsız — ölçüldü)

| Kalem | Durum |
| --- | --- |
| **Muhasebe dönemi** | **0 dönem** (2 klinik) → dönem kapısı her posting yolunu durdurur |
| **Hesap planı** | **0 hesap** → fiş yazılamaz |
| **Yetki matrisi (seed)** | **Bayat**: 364 satır, **58 model ailesi yok** (+ sanal `finance`, + yeni `providersettlement`) → seed yeniden çalıştırılmalı |
| `SLACK_OPS_WEBHOOK_URL` | **Hiçbir ortamda tanımsız** → 42 uyarı çağrısının tamamı yalnız log'a. Belgelendi, açılışta duyuruluyor (üretimde `error`). Joi'ye bilinçli eklenmedi |
| `POS_CALLBACK_SECRET` | dev/prod'da **değer yok** → POS callback 503 |
| `FX_*_TRY` | dev'de `none` (NaN → hata), üretimde anahtar yok |
| API kırıcı | `GET /reports/balance-sheet` artık `asOf` alıyor; ürün `vatRate` zorunlu (frontend tüketicisi yok) |
| `apps/web` tsc | Kullanıcının `app/[locale]` yeniden yapılandırması sürüyor → 277×TS2307 (**ilgisiz**) |

---

## 10. Hiç denetlenmemiş konular (kontrol listesinde açık)

| Konu | Ölçülen durum |
| --- | --- |
| **Chargeback / kart itirazı** | Şema alanı yok, uç yok, akış yok — para geri gidiyor, defter tahsilatı göstermeye devam ediyor (kural 16 sınıfı) |
| **GRNI tahakkuku (159/326)** | §49'da kısmen; tek taraflı geçiş hesabı riski (kural 16 sınıfı) |
| **Backup / PITR / DR runbook** | Belge **yok** |
| **Yük / property / chaos testi** | `fast-check`, `k6`, `artillery` **yok** |
| **Platform defterinin settlement'ı** | İş paketi 16'nın kalan yarısı (Stripe/iyzico kesintisi) |

---

## 11. Doğrulama — komutlar ve son yeşil durum

```bash
cd apps/api && npx tsc --noEmit            # 0
cd apps/messaging && npx tsc --noEmit      # 0
cd apps/api && pnpm test                   # 253 suite / 1739 test yeşil
cd apps/messaging && pnpm test             # 44 suite / 270 test yeşil
cd apps/api && pnpm finans:degismezler     # canlı DB'de temiz (salt okunur)
cd apps/api && pnpm finans:eksik           # 205 kalem (193 açık) üretir
```

Son tur (§85) sonunda ölçülen durum budur. `pnpm lint` tüm projede zorunlu değil;
yeni dosyalarda hedefli ESLint temiz.
