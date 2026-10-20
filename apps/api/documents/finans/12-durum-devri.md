# Finans — Durum Devri (State Handoff)

**Tarih:** 2026-10-20 (§92 / tur 33 sonrası; **§0 devam noktası** güncel) · **Dal:** `main`
**Commit:** tur 1–29 `547eced8`; **tur 30 + 31** `ca4b5075` (2026-10-20, kullanıcı isteğiyle); kullanıcının
nest-kernel → `@shared` taşıma/web refactor'ü `68898279`. **Tur 32 (§91) çalışma ağacında, commit'siz.**

**Bu belge nedir.** Yeni bir sohbete doğrudan bağlam olarak yapıştırılmak üzere
yazılmış özet. **Yeni sohbette önce §0'ı uygula** (ilk ölçümler + sıradaki tur önerisi).
Kaynak belgeler hâlâ şunlardır ve bu dosya onların yerini **almaz**:

| Dosya | İçerik |
| --- | --- |
| `09-guvence-denetimi.md` (~6.600 satır) | Denetimin tamamı: §2 durum tablosu, §3–§91 tur bölümleri, §45 özet |
| `10-kalan-isler.md` | 22 iş paketi + kabul edilmiş tasarımlar + operasyon/kurulum |
| `11-eksik-kalanlar.md` | **Üretilir** (`pnpm finans:eksik`), 218 kalem düz liste (206 açık) |
| `/CLAUDE.md` → "Finans / Muhasebe — Para Güvenliği Kuralları" | 22 kural, tam metin |

Bir kalem kapandığında **iki yerde** işaretlenir (§-bölümü + `10-kalan-isler.md`),
yoksa liste sessizce bayatlar.

---

## 0. Devam noktası — buradan başla

**Durum (2026-10-20).** Tur 30 (kart itirazı) ve tur 31 (platform iade doğrulaması) `main`'e commit edildi
(`ca4b5075`); kullanıcının refactor'ü ayrı commit'te (`68898279`). Migration'lar **yerel dev DB'ye uygulandı**
(90/90), seed çalıştırıldı, uygulama açıldı (platform dönemi açıldı), sekiz `NOT VALID` kısıt doğrulandı,
`pnpm finans:degismezler` 23/23. **Tur 32 (§91, platform iyzico itirazı)** kodlandı, testlerden geçti,
**commit'siz**; migration'ı (`20261021120000_booking_payment_chargeback`) dev DB'ye uygulandı. Devam etmeden
önce §0.1 ölçümlerini yeniden al; sapma varsa önce farkı açıkla.

### 0.1 İlk ölçümler (hepsi salt-okunur)

| # | Komut (`apps/api` içinden) | Tur 32 bittiğinde ölçülen |
| --- | --- | --- |
| 1 | `git branch --show-current` · `git status --short` · `git log --oneline -3` | `main`; tur 32 değişiklikleri commit'siz; HEAD `68898279` |
| 2 | `npx tsc --noEmit` | **1** ilgisiz hata (`schedule-appointment.handler.spec.ts`) |
| 3 | `pnpm test` | 278/279 suite, **2059** test yeşil (kırmızı tek suite ilgisiz `schedule-appointment.handler.spec.ts`) |
| 4 | `pnpm prisma migrate status` | 90 klasör; hepsi uygulanmış (dev DB) |
| 5 | `pnpm finans:degismezler` | **23** kontrol, hepsi temiz (dev DB) |

### 0.2 Kullanıcıda bekleyen adımlar (kodla çözülemez)

Dev DB'deki adımlar yapıldı. **Kalanlar üretim ortamına özgü:**

1. Üretimde `prisma migrate deploy` (üç migration: tur 30/31/32), ardından uygulama açılışı (bir kerelik dönem
   işi platform dönemini açar; platform hesap planına `659`/`659.01` additif eklenir), seed
   (`bookingpaymentrefund`, `cardchargeback` aileleri), `pnpm finans:degismezler` 23/23, sonra sekiz kısıt için
   `VALIDATE CONSTRAINT`.
2. **Legacy REFUNDED satırlarını doğrula** (üretimde; dev DB'de hiç `booking_payments` yok):
   `GET /health-tourism/booking-payments/refunds/unresolved` → her satırı iyzico panelinde
   `idempotencyKey`/`chargeProviderRef` ile ara → `POST …/refunds/:id/resolve` (§89.4). **iyzico panelinden
   doğrulama kodla yapılamaz.**
3. Tur 32'yi commit et (`git add` ile tur 32 dosyaları; çalışma ağacında başka iş yok).
4. `SLACK_OPS_WEBHOOK_URL`, `POS_CALLBACK_SECRET` hâlâ tanımsız.

### 0.3 Tur 33 (§92–§93) kodlandı — yıl sonu kapanışı + GRNI tahakkuku; commit'siz

Kapanış zinciri tek saf planlayıcıdır (`planYearEndClosing`): GRNI tahakkuku (`B 150|gider / A 329`, `ADJUSTING`) →
7xx yansıtma (`622/631/632`) → 6. sınıf → 690 → 590/591 → ertesi yıl 1 Ocak ters kayıt. Önizleme
(`POST …/closing-preview`) ile `close` aynı fonksiyonu çağırır; `close` gövdesi `expectedLastEntryNo` +
`grniAccruals` ister (kural 19). Mal kabul günlüğü (`purchase_order_receipts`) kural 20 için kuruldu. Gizli P0:
`Prisma.Decimal` ≠ `decimal.js` yüzünden fişi yazan her çağrı gerçek DB'de patlıyordu (kural 21). Ayrıntı:
`09` §92–§93, kısa devir `13-tur33-devri.md`.

**Ölçümler (tur 33 sonrası):** `tsc` 1 ilgisiz hata; `pnpm test` 292/293 suite, **2237** test yeşil (kırmızı
tek suite ilgisiz `schedule-appointment.handler.spec.ts`); `finans:degismezler` 30 kontrol, **28 temiz + 2 çalıştırılamadı**
(`mal-kabul-gunlugu-*`: migration dev DB'de yok → exit 2, tasarım gereği).

**(2026-10-21: dev DB'de YAPILDI — 93/93 migration uygulandı, `finans:degismezler` 30/30, dev test kliniği için hesap planı (70 hesap) + 2026/2027 dönemleri kuruldu. Test kliniğinin işletme biçimi seçilmedi: kullanıcı kararı, seçilene kadar devir atlanır. Üretim adımları hâlâ kullanıcıda.)** Eski not: iki migration'ı uygula (`pnpm migrate:dev`) — mal kabul günlüğü **30 Kasım'a kadar**
canlıda olmalı; sonra `finans:degismezler` 30/30; mevcut kliniklerde `chart-of-accounts/initialize`; tur 32+33 commit.

**İşletme biçimi + devir (§94, 2026-10-21) kodlandı:** `businessType` alanı (kayıtta zorunlu), `SetClinicBusinessType`
komutu/ucu, planda `EQUITY_CARRYFORWARD` adımı (1 Ocak; şirket 570/580, şahıs 500). **Üçüncü migration:**
`20261024100000_clinic_business_type` (uygulanmadı). Eski klinikler için seçim ucu çağrılmalı; seçilene kadar devir atlanır.

**Tur 34 (§95, 2026-10-21) — gerçek-DB turu KODLANDI; tur 32–34 `231c27f5` ile commit'li:** `pnpm test:db` (izole DB, şimdi 9 suite / 78 test; §95–§96.1): 17 posting kuralı,
kasa, kart itirazı (ONLINE_PAYMENT), hesap kapaması, yıl sonu kapanışı (özkaynak devri dahil). **1×P0** (`lockConcept` Prisma `void`
sütunu → 108 kapısını kullanan her yol patlıyordu) ve **1×P1** (108 kapısı fişlenmemiş kesintileri düşmüyordu) bulundu ve
kapatıldı. Migration yok. Ölçümler: `tsc` 1 ilgisiz hata; `pnpm test` 293/294 suite, **2266** test; `test:db` **52** test.

**Sıradaki tur önerisi — iş paketi 23'ün kalanı (§95.5):** iade/iptal yolları (sağlayıcı adaptörü taklidi ister) ve
`POS_TRANSACTION`/`BOOKING_PAYMENT` itirazı; `test:db`'yi CI'a bağlamak. Tur 33'teki P0 ve tur 34'teki ikisi aynı sınıftandı. Alternatifler: `13-organization-clinic-defter-plani.md`
(tasarım, onay bekliyor), frontend Faz 3 (#13), kapanış `close` için ayrı capability (#4).

---

## 1. Çalışma kuralları (devredilen kısıtlar — bunlar değişmez)

| Kısıt | Gerekçe |
| --- | --- |
| **Migration'ları kullanıcı uygular** (`pnpm migrate:dev`) | Migration yazılır, çalıştırılmaz |
| **Otomatik yıkıcı veri temizliği yok** | Geçmişi yorumlayan düzeltme muhasebe kararıdır |
| **`git checkout <dosya>` bu ağaçta asla kullanılmaz** | Commit edilmemiş işi siler → `git restore --staged` |
| **Commit yalnız kullanıcı isterse** | Varsayılan: iş çalışma ağacında kalır. Tur 30 + 31 ve refactor, kullanıcının açık isteğiyle (2026-10-20) iki commit olarak atıldı; bu izin sonraki turlara taşınmaz |
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
- **Kart itirazı (§87): 127 ara hesabı + `CHARGED_BACK`.** İtiraz süresince para 127'de bekler
  (`B 127 / A 108|102` → kazanıldı `B 108|102 / A 127` / kaybedildi `B 120 / A 127`); kaybedilen itiraz
  `REFUNDED` değil `CHARGED_BACK` (geri **alınan** para) ve aynı tutarda `PENDING` **telafi taksidi** açar.
  Kayıt sağlayıcı bildiriminden elle girilir. Para geri götüren üç yol (iade, iptal, ters ibraz) aynı
  kümülatif tavanı paylaşır (kural 17).

---

## 3. 22 para güvenliği kuralı — indeks (tam metin `/CLAUDE.md`)

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
17. Parayı kart sahibine geri götüren **her yol** (iade, iptal, ters ibraz) **aynı kümülatif tavanı**
    paylaşır ve aynı kaynak satırını `FOR UPDATE` kilitler; her kontrol tek başına doğru olsa da toplam
    satışı aşar ve hata hiçbir yerde görünmez. Platform rezervasyonunda aynı kapı `BOOKING_PAYMENT`
    kaynağıyla üç iade claim'inde çağrılır (§91).
18. Sağlayıcı çağrısının sonucu **üç durumludur** (oldu / olmadı / bilinmiyor); adaptör ham SDK sonucunu değil
    tipli sonucu döner; "bilinmiyor" yalnız elle doğrulamayla kapanır, otomatik yeniden denenmez; idempotent
    olay dedupe'u sahiplenme değildir (§89).
19. Geri alınamaz toplu yazma önizlemesiz ve önizlemeden bağımsız hesapla çalışmaz (tek planlayıcı, tazelik belirteci,
    tutar sunucudan) (§92).
20. Tarihsiz sayaç tarihli soruyu cevaplayamaz; tarihli günlük, soruyu soran ilk dönem sonundan önce kurulur (§92).
21. Mock'lu test DB'nin döndürdüğü tipi taklit edemez: yazma yolu gerçek DB'ye karşı uçtan uca çalıştırılır
    (`pnpm test:db`), reddedilen senaryolar hata türüyle sabitlenir (§92, §95).
22. Kapı, beslendiği veriyi yazan akışın gecikmesini hesaba katar (fişlenmemiş kesintiler düşülür); `void` dönen SQL
    fonksiyonu `$executeRaw` ile çağrılır (§95).

---

## 4. Kapatılan bulgular — modül bazlı (kaynak: §2 tablosu)

Toplam: **~61×P0, ~107×P1, ~74×P2 + 2 eksik akış** (§85 settlement, §87 kart itirazı).

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
| `bank` (kart itirazı) + 6 iade/iptal handler'ı | **eksik akış** + çift iade deliği | §87, §88 |

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
| §87/§88 | Kart itirazı (chargeback) | sağlayıcı parayı geri kesiyor, defter tahsilatı gösteriyordu; ayrıca iade + itiraz **aynı parayı iki kez** götürebiliyordu |

---

## 6. Primitifler ve kapılar (kod adresleri)

| Ad | Yer / iş |
| --- | --- |
| `Money.scale()` / `isKurusScaled()` | `src/domain/value-objects/money.vo.ts` — tek yuvarlama kapısı + ölçü predicate'i |
| `lockRowForUpdate` / `lockRowForUpdateOrFail` | `prisma/base.repository.ts` — `FOR UPDATE`, tx yoksa patlar |
| `lockConcept(key)` | `prisma/base.repository.ts` — `pg_advisory_xact_lock(hashtext($1))`; kilitlenecek satırı olmayan bakiyeler için |
| `lockAndGetAccountBalance` | `posting/.../journal.command.repository.ts` — kilit + okuma **tek atomik metot** |
| `PERIOD_GATE_SERVICE.assertPeriodNotSealedAt` | dönem kapısı (13 çağrı yeri — kart itirazı açılış/çözüm dahil) |
| `FUNDS_IN_TRANSIT_GATE.assertCanSettle` | `posting/domain/services/funds-in-transit/` — 108 bakiye kapısı (hesap kapaması **ve** kart itirazı açılışı, tutar + ücret) |
| `CARD_CHARGEBACK_EXPOSURE_GUARD` | `bank/domain/services/card-chargeback-exposure/` — iade/iptal + aktif itiraz + istenen ≤ tahsilat; 4 POS + 2 sanal POS handler'ında |
| `POS_CARD_COLLECTION_SERVICE` / `PAYMENT_COLLECTION_SERVICE` | `pos/physical/domain/services/…`, `payment/domain/services/…` — `lockAndGet*`: satış / ödeme satırını kilitler **ve** geri götürülebilir tutarı döner (tek metot) |
| `FINANCIAL_EVENT_PRESENCE_GUARD` | `financial-events/domain/services/event-presence/` — "bu olay deftere yazıldı mı" (kiracı doğrulamalı) |
| `assertBankAccountUsableByClinic` | `bank/domain/rules/assert-bank-account-usable.ts` — hesap kapaması ve kart itirazı aynı kiracı kuralını paylaşır |
| `CHARGEBACK_FUNDS_ACCOUNT` | `finance/shared/domain/constants/chargeback-funds.constant.ts` — kanal (108/102) → hesap, Prisma enum'undan tam kaplama |
| `toInstallmentCreateData` | `payment.command.repository.ts` — taksit INSERT mapping'i **tek yerde** (kural 9 kilidi spec'te) |
| `PostingDomainServicesModule` | yaprak modül; tüketici `PostingModule`'ü import **etmez** |
| `FinancialEventDedupeKeys` | olay defteri idempotency anahtarları (23 dosya) |
| `POSTABLE_FINANCIAL_EVENT_TYPES` | fişlenebilir olay tipleri (12 dosya) |
| `LEDGER_EFFECTIVE_ENTRY_STATUSES` | `POSTED` + `REVERSED` — tüm defter sorgularının süzgeci |
| `CriticalFailurePublisher` → `OPS_ALERT_PORT` | **44** çağrı yeri (§83'te 41, §85'te 42 ölçülmüştü; kart itirazı +2: plan yansıması eşleşmedi, cari ters ibraz işi kuyruğa alınamadı); Slack adaptörü + Redis dedupe + log fallback |
| `installProcessFailureAlarms` | `src/common/observability/` — yakalanmayan red → CRITICAL + süreç kapanır |
| `pnpm finans:degismezler` | `scripts/finance-invariants.cjs` — **23** salt-okunur kontrol; aykırılıkta exit 1, **çalıştırılamayan kontrolde exit 2** (çalışmayan kontrol "sağlam" sayılmaz) |
| `pnpm finans:eksik` | `scripts/finans-eksik-liste.cjs` — `11-eksik-kalanlar.md` üretir |

---

## 7. Veritabanı / migration durumu

**Yerel dev DB'de 90/90 migration uygulandı** (2026-10-20: `prisma migrate status` → "Database schema is up to date").
Son üçü ek-yönlü, veri çatışması yok:

```
20261019120000_card_chargeback           (§87 — 4 enum + 5 enum değeri + card_chargebacks tablosu + 5 CHECK
                                                + payment_installments.recovers_installment_id)
20261020120000_booking_payment_refunds   (§89 — 4 enum, 2 olay tipi, tablo + 7 CHECK, legacy REFUNDED→UNCONFIRMED)
20261021120000_booking_payment_chargeback (§91 — CardChargebackSource += BOOKING_PAYMENT, patient_id/party_id
                                                nullable + CHECK card_chargebacks_patient_party_by_source)
```

Uygulama `prisma migrate deploy` ile yapıldı (etkileşimsiz). **Üretimde ayrı adım**; sırası: migration →
uygulama açılışı (dönem işi + platform `659`/`659.01` additif) → seed → `pnpm finans:degismezler` (**23** kontrol)
→ temizse sekiz `NOT VALID` kısıt (§81) için `VALIDATE CONSTRAINT` (dev DB'de yapıldı).

> ⚠️ **`migrate dev` ayrıca `appointment_embeddings` (pgvector) tablosu için bir migration üretmek isteyebilir.**
> Model şemada committed ama migration'ı yok — önceden var olan, bağımsız sapma (pgvector eklentisi gerektirir).

> ⚠️ **Yeni enum değeri (`ADD VALUE`) aynı transaction'da kullanılamaz.** Tur 32 migration'ındaki CHECK bu
> yüzden `source_type::text = 'BOOKING_PAYMENT'` karşılaştırır, enum literal'i kullanmaz.

**Son şema eklemeleri (§87):** `card_chargebacks` (`@@unique([clinicId, provider, caseReference])`,
`Decimal(14,2)`, 5 CHECK: tutar pozitif, ücret ≥ 0, `OPEN ⇔ resolved_at IS NULL`, `resolved_at ≥ opened_at`,
`WON ⇔ resolved_funds_channel IS NOT NULL`, ONLINE'da `installment_id = source_id`), `enum CardChargebackStatus /
CardChargebackSource / ChargebackFundsChannel / CardChargebackPlanSync`, `FinancialEventType` += 3 itiraz olayı,
`InstallmentStatus` / `LedgerStatus` += `CHARGED_BACK`, `payment_installments.recovers_installment_id`
(`@unique`, self-FK).

> **KURAL: "migration uygulandı" defterin çalıştığı anlamına gelmez.**

---

## 8. Bekleyen iş paketleri (22) — `10-kalan-isler.md` §1

Sıra önem değil **bağımlılık** sırasıdır; her satırın tetikleyicisi ve adresi o dosyada.

| # | İş paketi | Tetikleyici |
| --- | --- | --- |
| 1 | Dönem sonu / yıl sonu fiş takımı | ilk gerçek dönem kapanışı / resmî bilanço |
| 2 | Kalem bazlı fatura + gerçek e-belge adapter'ı | entegratör sözleşmesi / ilk e-Defter dönemi |
| 3 | İade / refund / **ters ibraz** akışı (kalan kısım; §88'in kart itirazı kalemleri dahil) | ilk hasta ya da abonelik iadesi / ilk kısmi ya da ikinci tur itiraz |
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
| 16 | Settlement — ~~klinik defteri **✅ §85**~~ / **platform defterinin 108'i açık** + platform kart itirazı (Stripe `charge.dispute.*`, §88) — **önerilen sıradaki tur (§0.3)** | ilk sağlayıcı payout mutabakatı |
| 17 | Para getiren `@Public` uçların doğrulaması | beşinci para ucu; ilk fiziksel POS adapter'ı |
| 18 | Hassas veri olgunlaşması | ilk sağlayıcı itirazı; KVKK dokümantasyonu |
| 19 | Event teslimi olgunlaşması | ilk gerçek ölü mektup |
| 20 | Teklif yaşam döngüsü (sağlık turizmi) | ödeme-önce akışın idempotency turu |
| 21 | Bakiye politikasının zorlanması (hasta carisi) | hasta cari ekstresi / bakiye okuma modeli |
| 22 | Alarm olgunlaşması | `SLACK_OPS_WEBHOOK_URL` bağlandıktan sonra |

**§88 (kart itirazı) bilinçli ertelemeleri** (13 kalem, mevcut paketlere işlendi — yeni paket açılmadı):
platform tarafı/Stripe (16), kısmi itirazın plana yansıması + değersiz alacak + WON'da ücret iadesi + ikinci tur +
sanal iade PENDING işareti + elle eşleştirme komutu (3), sağlayıcı itiraz API'si (5), döviz itirazı (15),
frontend ekranı (13), 127 alt hesabı + hastasız POS satışının deftere girmemesi (12).

**§86 (settlement) bilinçli ertelemeleri:** komisyonun KDV ayrıştırması (sağlayıcı faturası
gelmeden indirilecek KDV yazılmaz), 108'in sağlayıcı bazlı alt hesapları, FIFO yaşlandırma,
ekstre ↔ payout eşleştirme bağı, sağlayıcı payout API'si, **platform defterinin 108'i**.

---

## 9. Operasyon / kurulum blokajları (koddan bağımsız — ölçüldü)

| Kalem | Durum |
| --- | --- |
| **Muhasebe dönemi** | **0 dönem** (2 klinik) → dönem kapısı her posting yolunu durdurur |
| **Hesap planı** | **0 hesap** → fiş yazılamaz |
| **Yetki matrisi (seed)** | **Kısmen güncel** (2026-10-19 ölçüldü): DB'de 121 aile (önceki "58 aile yok" sonradan seed ile kapanmış, sanal `finance` dahil). **Eksik 4 aile:** `providersettlement`, `subscriptioncharge`, `appointmentembedding`, `cardchargeback` → seed yeniden çalıştırılmalı, yoksa ilgili uçları hiçbir rol kullanamaz |
| `SLACK_OPS_WEBHOOK_URL` | **Hiçbir ortamda tanımsız** (2026-10-19 yeniden ölçüldü) → 44 uyarı çağrısının tamamı yalnız log'a. Belgelendi, açılışta duyuruluyor (üretimde `error`). Joi'ye bilinçli eklenmedi |
| `POS_CALLBACK_SECRET` | dev/prod'da **değer yok** → POS callback 503 |
| `FX_*_TRY` | dev'de `none` (NaN → hata), üretimde anahtar yok |
| API kırıcı | `GET /reports/balance-sheet` artık `asOf` alıyor; ürün `vatRate` zorunlu (frontend tüketicisi yok) |
| `apps/web` tsc | Kullanıcının `app/[locale]` yeniden yapılandırması sürüyor → 277×TS2307 (**ilgisiz**) |
| `apps/api` tsc / test | **1 ilgisiz hata + 1 kırmızı suite:** `schedule-appointment.handler.spec.ts` eski `find-patient-by-id.query` yolunu import ediyor (kullanıcının `get-patient-by-id` yeniden adlandırması) |
| Dev DB defteri | 2 klinik, **0 dönem, 0 hesap, 0 fiş, 0 olay** → kart itirazı uçtan uca denemesi için önce dönem + hesap planı kurulmalı |

---

## 10. Hiç denetlenmemiş konular (kontrol listesinde açık)

| Konu | Ölçülen durum |
| --- | --- |
| ~~**Chargeback / kart itirazı**~~ | **✅ §87 (2026-10-19)** — klinik defteri kuruldu; platform tarafı (Stripe) §88'de ertelendi |
| **GRNI tahakkuku (159/326)** | §49'da kısmen; tek taraflı geçiş hesabı riski (kural 16 sınıfı) |
| **Backup / PITR / DR runbook** | Belge **yok** |
| **Yük / property / chaos testi** | `fast-check`, `k6`, `artillery` **yok** |
| **Platform defterinin settlement'ı** | İş paketi 16'nın kalan yarısı (Stripe/iyzico kesintisi + Stripe itirazı) — önerilen sıradaki tur (§0.3) |

---

## 11. Doğrulama — komutlar ve son yeşil durum

```bash
cd apps/api && npx tsc --noEmit            # 1 hata (ilgisiz: schedule-appointment.handler.spec.ts import yolu)
cd apps/messaging && npx tsc --noEmit      # 0
cd apps/api && pnpm test                   # 278/279 suite, 2059 test yeşil (1 ilgisiz kırmızı suite) — tur 32 sonu
cd apps/messaging && pnpm test             # 42/43 suite, 256 test yeşil (1 ilgisiz kırmızı: nest-kernel `setup-app.ts` → `@nestjs/swagger` bulunamıyor, kullanıcının WIP'i)
cd apps/api && pnpm finans:degismezler     # canlı DB'de: 9 kontrol temiz, 4'ü çalıştırılamadı (card_chargebacks yok) → exit 2
cd apps/api && pnpm finans:eksik           # 218 kalem (206 açık) üretir
```

Son tur (§87) sonunda ölçülen durum budur. `pnpm lint` tüm projede zorunlu değil;
yeni dosyalarda hedefli ESLint temiz (değişen mevcut dosyalarda yalnız önceden var olan biçim borcu kaldı).
