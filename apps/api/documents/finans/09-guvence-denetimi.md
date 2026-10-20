# 09 — Finans Güvence Denetimi (Money-Safety Audit)

Finans/muhasebe modüllerinin **para güvenliği** açısından modül-modül gözden geçirilmesi.
Her modül aşağıdaki sabit kontrol listesinden geçirilir; bulgular şiddet (P0/P1/P2) ve
kanıt (`dosya:satır`) ile bu dosyaya yazılır. Tasarım referansı: `00`–`08`.

> **Şiddet ölçeği**
> **P0** — Defter bütünlüğü bozulabilir, para/kayıt kaybolabilir veya mevzuata (VUK/e-Defter)
> aykırı kayıt üretilebilir. Canlıya çıkmadan kapatılır.
> **P1** — Bütünlük şu an bozulmuyor ama denetlenebilirlik, yetki ayrımı veya operasyon
> güvenliği eksik. Yakın turda kapatılır.
> **P2** — Doğruluk riski düşük; varsayım netleştirme, ölü kod, semantik düzeltme.

---

## 1. Kontrol listesi (her finans modülü için)

**Para ve matematik**

- [ ] Tutarlar `Decimal` (`decimal.js` / `@db.Decimal`) mı — `number` aritmetiği yok mu?
- [ ] Para birimi her satırda açık mı (fonksiyonel + orijinal)?
- [ ] Yuvarlama kuralı tanımlı ve tek yerde mi? Yuvarlama artığı nereye yazılıyor?
- [ ] Negatif/sıfır tutar, ters yön (borç/alacak) invariant'ları guard'lı mı?

**İdempotentlik ve tekrar**

- [ ] Yazma idempotent mi (doğal anahtar / `eventId` / `dedupeKey` / unique kısıt)?
- [ ] Aynı idempotency key + **farklı payload** ayırt ediliyor mu?
- [ ] Webhook/callback tekrarı ve **sıra karışması** güvenli mi? Replay penceresi var mı?

**Eşzamanlılık ve transaction**

- [ ] Mutasyon kararını besleyen okuma **Command Repo**'dan ve **aynı tx** içinde mi?
- [ ] Sıcak satırda kilit var mı (`findByIdForUpdate`) veya koşullu tek-UPDATE (claim) mı?
- [ ] `version` (optimistic) gereken aggregate'lerde var mı? Lost-update mümkün mü?
- [ ] Check-then-act kalıbı DB kısıtı ile de destekleniyor mu?
- [ ] İzolasyon seviyesi (varsayılan READ COMMITTED) bu karar için yeterli mi?

**Defter (ledger)**

- [ ] Çift taraflı denge her fişte zorlanıyor mu (Σborç = Σalacak)?
- [ ] POSTED kayıt değişmez mi; düzeltme yalnız storno ile mi?
- [ ] Numaralandırma (yevmiye no) boşluksuz, mükerrersiz ve dönem kapsamlı mı?
- [ ] Bakiye/mizan kaynaktan yeniden üretilebilir (reconcile) mi?

**Durum makinesi ve iade**

- [ ] Geçişler entity içinde ve tek yerde mi? Geçersiz geçiş tipli hata mı?
- [ ] İade/storno ayrı kayıt mı (orijinali mutasyona sokmuyor mu)?
- [ ] Kısmi iade kümülatif tavan kontrolüne bağlı mı?

**Dış sağlayıcı**

- [ ] Timeout'ta UNKNOWN durumu var mı; retry güvenli mi; mutabakat taraması var mı?
- [ ] Sağlayıcı kimlikleri (referenceId) saklanıp aranabiliyor mu?

**Event ve teslim**

- [ ] Kritik event `outboxRun()` ile atomik mühürleniyor mu?
- [ ] Tüketici idempotent mi? Kalıcı hatada **retry** var mı, yoksa hata yutuluyor mu?
- [ ] Teslim edilemeyen/işlenemeyen kayıt için görünürlük (alarm + sorgu) var mı?

**Yetki ve denetim**

- [ ] Kapsam istekteki alandan değil **kaydın kendi** klinik/organizasyonundan mı doğrulanıyor?
- [ ] Yetki ayrımı (SoD) var mı — yüksek etkili işlem ayrı capability mi?
- [ ] Audit izi: kim, ne zaman, neyi (event + kalıcı damga kolonu)?
- [ ] Hassas veri log/exception meta'sına sızıyor mu?

**Operasyon**

- [ ] Mutabakat raporu/komutu var mı (kaynak ↔ defter)?
- [ ] Alarm (CRITICAL) + correlationId zinciri var mı?
- [ ] Eşzamanlılık ve invariant testleri kalıcı `*.spec.ts` olarak duruyor mu?
- [ ] Yıl/dönem devri gibi **takvime bağlı** ön koşulları kuran otomasyon var mı?

---

## 2. Denetim durumu

| Modül                          | Durum                                       | Not                                                                                                                                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accounting/periods`           | ✅ denetlendi + **düzeltildi** (2026-09-20) | 5×P0 ve 3×P1 kapatıldı; P1-2 bilinçli ertelendi — bkz. §3, §4                                                                                                                                                                                                                          |
| `accounting/posting`           | ✅ denetlendi + **düzeltildi** (2026-10-13) | 3×P0, 4×P1 (§6) + **kaynak-belge storno primitifi** (§47.1) + **raporlama semantiği turu**: 3×P0, 2×P1 ve **migration var** (`kind`) — bkz. §51                                                                                                                                        |
| `accounting/financial-events`  | ✅ denetlendi + **düzeltildi** (2026-10-13) | 4×P1, 3×P2 + **dönem kapısı servisi** (§15 ertelemesi kapandı) — §34, §36; fişlenmemiş olay raporunun gün sınırı §51.2'de düzeltildi                                                                                                                                                   |
| `accounting/chart-of-accounts` | ✅ denetlendi + **düzeltildi** (2026-09-28) | 2×P1 ve 5×P2 kapatıldı; 2 madde ertelendi — bkz. §8, §9                                                                                                                                                                                                                                |
| `accounting/tax-parameters`    | ✅ denetlendi + **düzeltildi** (2026-09-28) | 1×P0, 3×P1, 2×P2 kapatıldı; **migration var** — bkz. §10, §11                                                                                                                                                                                                                          |
| `invoice`                      | ✅ denetlendi + **düzeltildi** (2026-10-13) | 3×P0, 7×P1, 4×P2 (§12, §14.1) + **belge iptali/storno** 4×P0, 7×P1, 4×P2 + migration (§47) + **yuvarlama turu** 2×P0, 1×P1 (§53): çok satırlı fatura kesilemiyordu                                                                                                                     |
| `purchase-invoice`             | ✅ denetlendi + **düzeltildi** (2026-10-13) | 3×P0, 5×P1, 1×P2 (§13, §14.2) + **belge iptali/storno** (§47) + **yuvarlama turu** 1×P0 (§53.5): tedarikçinin çok satırlı belgesi kaydedilemiyordu; **2 migration var**                                                                                                                |
| `e-document`                   | ⏳ kısmen                                   | adapter-bağımsız kısım denetlendi: 1×P1, 1×P2 (§35, §36) + **iptal bildirimi kuyruğu** (§47.4); kalem bazlı XML + `getStatus` adapter'a bağlı                                                                                                                                          |
| `payment`                      | ✅ denetlendi + **düzeltildi** (2026-10-13) | 4×P0, 5×P1, 5×P2 (§16, §18.1); hekim hasılatı + 2 mutabakat taramasının gün sınırı §51.2'de düzeltildi                                                                                                                                                                                 |
| `payment-gateway`              | ✅ denetlendi + **düzeltildi** (2026-10-10) | 1×P0, 1×P1 kapatıldı — bkz. §17, §18.2                                                                                                                                                                                                                                                 |
| `pos/physical`, `pos/virtual`  | ✅ denetlendi + **düzeltildi** (2026-10-13) | 4×P0, 5×P1, 5×P2; eşzamanlılık turu `concurrency-followups.md` §1 — §20, §21; köprülenmemiş işlem taramasının gün sınırı §51.2; + **aktör damgası turu** 1×P1 (§57): kart iptalini/iadesini kimin yaptığı ne kolonda ne audit log'da duruyordu — **migration var** (`initiated_by_id`) |
| `cash-register`                | ✅ denetlendi + **düzeltildi** (2026-10-11) | 1×P0, 3×P1, 3×P2 kapatıldı; **migration var** — bkz. §23, §24                                                                                                                                                                                                                          |
| `bank`                         | ✅ denetlendi + **düzeltildi** (2026-10-11) | 1×P0 (ortak), 2×P1 kapatıldı — bkz. §23, §24                                                                                                                                                                                                                                           |
| `finance-ledger`               | ✅ denetlendi + **düzeltildi** (2026-10-13) | 2×P0, 5×P1, 6×P2 (§26, §28); klinik özeti + mutabakat taramasının gün sınırı §51.2'de düzeltildi (özet kartını frontend **bugün** çağırıyor)                                                                                                                                           |
| `party`                        | ✅ denetlendi + **düzeltildi** (2026-10-11) | 4×P1, 3×P2 kapatıldı — bkz. §27, §28                                                                                                                                                                                                                                                   |
| `treatment-charge`             | ✅ denetlendi + **düzeltildi** (2026-10-13) | 2×P0, 4×P1, 2×P2; **migration var** — §30, §32; satır KDV/indirim yuvarlaması §53.6'da tek kapıya bağlandı                                                                                                                                                                             |
| `payroll`                      | ✅ denetlendi + **düzeltildi** (2026-10-11) | 1×P0, 2×P1, 1×P2 kapatıldı — bkz. §31, §32                                                                                                                                                                                                                                             |
| `supply/purchasing`            | ✅ denetlendi + **düzeltildi** (2026-10-12) | 2×P0, 4×P1, 6×P2 kapatıldı; **katalog kapısı servisi** (§15 `.toNumber()` ertelemesi kapandı) — bkz. §38, §39                                                                                                                                                                          |
| `supply/inventory`             | ✅ denetlendi + **düzeltildi** (2026-10-13) | 1×P0, 9×P1, 5×P2 + **migration** (stok kodu klinik kapsamına) + değerleme/150 mutabakatı/SMM — §41, §42, §44; + **ürün KDV kapısı** 2×P1 (§55): sıfır KDV'li ürün oluşturulamıyor/güncellenemiyordu                                                                                    |
| `platform/subscription`        | ✅ denetlendi + **düzeltildi** (2026-10-13) | **Finans dışı ama kart çekiyor** (kayıtlı kartla otomatik yenileme): 2×P0, 2×P1 — tahsilat defteri yoktu ve `external_id` iki rol taşıyordu; **migration var** (`subscription_charge_ledger`) — §59, §60                                                                               |
| `crm/health-tourism` (ödeme)   | ✅ denetlendi + **düzeltildi** (2026-10-13) | **Finans dışı ama kart çekiyor** (iyzico TRY + Stripe EUR/USD ödeme linkleri, Duffel uçuş): 2×P0, 1×P1 — sahiplenilemeyen ödeme dalı yerel duruma göre karar veriyordu; migration yok — §61, §62                                                                                     |
| `crm/health-tourism` (fiyat)   | ✅ denetlendi + **düzeltildi** (2026-10-13) | Otel/transfer/uçuş **fiyat türetmesi** (net ↔ satış ↔ komisyon): 2×P0, 2×P1 — defter teklif tutarını tedarikçi borcu yazıyordu ve fiyatı okunamayan transfer "bedava" satılabiliyordu; **migration var** (`booking_payment_supplier_amount`) — §63, §64                             |
| **iade yolu** (POS + sanal POS)  | ✅ denetlendi + **düzeltildi** (2026-10-13) | Kesişen tur: `pos/physical` + `pos/virtual` + `payment` + `accounting/posting` — iade çift taraflı deftere **hiç** ulaşmıyordu (2×P0) ve askıda kalmış iade sonradan tahsilat olarak işleniyordu; **migration var** (`financial_event_payment_refunded`) — §65, §66                    |
| **settlement** (108 → 102 + 653) | ✅ **kuruldu** (2026-10-15) | Denetim değil **eksik akış**: kartla tahsil edilen her kuruş `B 108`'e yazılıyordu ve **108'i kapatan hiçbir akış yoktu** (ne olay tipi, ne kural, ne komut; `653 Komisyon Giderleri` şablonda duruyor, hiç kullanılmıyordu). Üç hata birlikte yaşıyordu: 108 sonsuza kadar şişiyor (bilanço), para 102'ye hiç girmiyor (banka ekstresindeki payout **kalıcı UNMATCHED**), komisyon hiç gider yazılmıyor (kâr fazla). Üçü de dengeli mizan üretiyor. Kurulan: `ProviderSettlement` aggregate + `PROVIDER_SETTLEMENT_RECEIVED` olayı + posting kuralı + **108 bakiye kapısı** (danışma kilidi altında) + kendi capability'si; **migration var** (`provider_settlement`) — §85, §86 |
| **gözlemlenebilirlik / alarm** (uyarı kime gidiyor?) | ✅ denetlendi + **düzeltildi** (2026-10-15) | Kesişen tur: `common/observability` + `platform/notification` (uyarı kanalı) + `platform/audit-log` + modül grafiği + süreç kancaları — önceki turlarda **41 kalem** "CRITICAL uyarı çıkar" diye kapatılmıştı; ölçüldü: `SLACK_OPS_WEBHOOK_URL` **hiçbir ortamda tanımlı değil ve `.env.example`'da bile yazılı değildi** (hepsi log satırına düşüyor, seçim sessiz yapılıyordu). `AuditLogService.record()` **her** depolama hatasını herkes adına yutuyordu → 20'den fazla dinleyicinin `catch` bloğu hiç tetiklenemiyordu ve güvenlik kayıtlarının kaybı sessizdi. Grafikten düşen bir **dinleyici** hiç patlamadığı için bağlı olduğu güvenceyi sessizce iptal ediyordu (handler'lar test ağında, dinleyiciler değildi). Sürecin ölümü (yakalanmayan promise reddi) kimseye haber verilmiyordu: 4×P1, 1×P2; migration yok — §83, §84 |
| **finansal değişmezler** (uygulama ↔ veritabanı) | ✅ denetlendi + **düzeltildi** (2026-10-15) | Kesişen tur: `cash-register` + `accounting/posting` (yevmiye satırı) + şemanın tamamı (95 para kolonu, 48 cascade, idempotency kısıtları) + `clinic-finance-settings` — kasa çıkışı **çekmecede o para var mı diye sormuyordu**: 1.200 ₺'lik kasadan 50.000 ₺ "bankaya yatırma" kaydı, hiç yatırılmamış parayı 102'ye borç ve hiç kazanılmamış geliri 679'a alacak yazdırıyordu (iki fiş de kendi içinde dengeli olduğu için Σborç = Σalacak kontrolü sessiz). Ayrıca yevmiye satırı kuruş ölçeğini zorlamıyordu (denge **yuvarlamadan önce** doğrulanıyor, DB yuvarladıktan sonra saklıyor) ve saklanan defterin değişmezlerini soran tek bir sorgu yoktu: 1×P0, 2×P1, 1 ölçüm; **migration var** (`financial_invariant_checks`, hepsi `NOT VALID`) — §81, §82 |
| **önbellek / teklif sahipliği** (Redis'ten okunan karar) | ✅ denetlendi + **düzeltildi** (2026-10-14) | Kesişen tur: `crm/health-tourism` (otel+transfer+uçuş teklif önbellekleri) + `platform/ai-tools` + randevu slot kilidi + entitlement/klinik/auth önbellekleri — hastanın ödeyeceği tutarın temeli ve sağlayıcıya gidecek rezervasyon talimatı **global anahtarlı** bir Redis kaydından okunuyordu: sahip kontrolü yok, kimlik 32 bit. Personelin HTTP ucu başka kliniğin teklifiyle bilet kesebiliyordu; 8 haneli kimlik çarpışması başka hastanın teklifini eziyordu: 1×P0, 1×P1, 1×P2; migration yok (Redis anahtar biçimi) — §79, §80 |
| **event teslimi** (outbox → dinleyici) | ✅ denetlendi + **düzeltildi** (2026-10-14) | Kesişen tur: `prisma/outbox` + `transaction.manager` + 57 dinleyici + `@nestjs/event-emitter` ayarı + `apps/messaging` — outbox kaydı dinleyici **başlamadan** "işlendi" damgası alıyordu (`emitAsync` çıplak `@OnEvent` dinleyicisini beklemiyor) ve fırlatılan hata framework'te yutuluyordu; retry'ı telafi yolu seçen tek dinleyicinin (stok hareketi + SMM köprüsü) işi sessizce kayboluyordu. Ayrıca sahiplenme/ölü mektup/sıra yoktu: 2×P0, 3×P1, 2×P2 + bir sıra hatası (AI bağlam penceresi); **migration var** (`outbox_delivery_guarantee`) — §77, §78 |
| **hassas veri** (log / saklama / HTTP yanıtı) | ✅ denetlendi + **düzeltildi** (2026-10-14) | Kesişen tur: `pos/virtual` + `pos/physical` + `invoice` + `clinic-governance` + `meta-ads` + `crm/health-tourism` — çekim yapmaya yeten kart token'ı tanı blob'unda saklanıp **yönetim/admin grubuna serileştiriliyordu**; ayrıca altı credential alanı yanıt DTO'larında (biri **canlı** bir uçta: kliniğin USS şifresi): 2×P0, 1×P1, 2×P2; migration yok — §75, §76 |
| **webhook güvenliği** (bildirimin kimliği) | ✅ denetlendi + **düzeltildi** (2026-10-14) | Kesişen tur: `crm/health-tourism` (booking-payment) + `platform/subscription` + `pos/virtual` + iyzico adapter'ı — iki `@Public` callback'te bildirim ile kayıt arasında **bağ yoktu**: başka bir ödemenin geçerli token'ı, bedeli ödenmemiş bir rezervasyonu tedarikçide açtırıyor ve ödenmemiş bir aboneliği aktive ediyordu. Aynı kontrolün **düzeltilmiş kopyası** üçüncü callback'te zaten vardı (çağrı yerine konmuş, kurala dönüştürülmemiş): 2×P0, 1×P1, 2×P2; migration yok — §73, §74 |
| **yabancı para** (fiş para birimi + kur anı) | ✅ denetlendi + **düzeltildi** (2026-10-14) | Kesişen tur: `crm/health-tourism` (booking-payment) + `accounting/posting` + `Money` VO + TCMB kur adapter'ı — iyzico ile TRY tahsil edilen yabancı para rezervasyonda 108 **gelmeyen parayı** gösteriyordu (posting kuru dışarıdan yeniden türetiyordu) ve TCMB'nin yayın yapmadığı güne (hafta sonu/tatil) düşen her yabancı para olayı **hiç fişlenemiyordu**: 2×P0, 1×P1; migration yok — §71, §72 |
| **rezervasyon iadesi** (platform defteri) | ✅ denetlendi + **düzeltildi** (2026-10-13) | Kesişen tur: `crm/health-tourism` (booking-payment + hotel/transfer/flight iptali) + `accounting/posting` — iade platform defterini **hiç** ters kaydetmiyordu ve ileri fiş de 320 carisi olmadığı için **hiç postlanamıyordu** (§67). Üç sağlayıcının iptal cezası yanıtta geliyor ama atılıyordu; otelde alan semantiği doğrulanmadığı için bilinçli okunmuyor (§68). |
| **kart itirazı** (chargeback / ters ibraz) | ✅ **kuruldu** (2026-10-19) | Denetim değil **eksik akış** + keşfedilen **çift iade** deliği: sağlayıcı parayı geri kesiyor ama defter tahsilatı göstermeye devam ediyordu (108'de olmayan para, 120'de kapanmış borç), payout'taki kesinti 108'de takılıyordu ve dört POS ters kayıt + iki sanal POS handler'ı itirazı tavana saymadığı için kart sahibine para **iki kez** gidebiliyordu. Kurulan: `CardChargeback` durum makinesi, 127 ara hesabı (`B 127 / A 108\|102` → kazanıldı `B 108\|102 / A 127` / kaybedildi `B 120 / A 127`), `CHARGED_BACK` taksit durumu + telafi taksidi, 4 kilitli domain servisi, 6 handler'a tavan kapısı; **migration var** (`card_chargeback`) — §87, §88 |
| **platform defteri: iade doğrulaması** (tur 31) | ✅ **kapatıldı** (2026-10-20) | 3×P0 + 1×P1: iyzico iade sonucu okunmuyordu (para dönmeden ters fiş), platform muhasebe dönemi hiç açılmıyordu, backfill doğrulanmamış iadeye ters kayıt yazıyordu, çift çekim deftere/kilide/dedupe'a sahip değildi. Kurulan: `BookingPaymentRefund` (üç durumlu sonuç), executor, 336 yolu, elle karar komutları, platform dönemi, Stripe açık kapısı, 7 yeni tarama. **Migration var** (`booking_payment_refunds`) — §89, §90 |

---

## 3. `accounting/periods` — Muhasebe Dönemi

Denetim tarihi: **2026-09-20**. Kapsam: entity, repo'lar, 4 command + 2 query, controller'lar,
şema (`accounting.prisma`) ve **dönemin dışa dönük sözleşmesi** (posting'in dönem kapısı).

> **Durum (2026-09-20):** §3'teki bulgular **kayıt** olarak duruyor (neden-nasıl izi).
> Hangisinin nasıl kapatıldığı §4'te; kasıtlı olarak yapılmayanlar §5'te.

### 3.1 Kontrol listesi sonucu

| Başlık                                | Durum                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| Para/matematik                        | — (dönem tutar taşımaz)                                                          |
| İdempotentlik (dönem açma)            | ⚠️ `clinicId_year` unique var; P2002 → jenerik 409 (tipli hata değil)            |
| Eşzamanlılık — kapanış                | ✅ `claimForClosing` atomik claim                                                |
| Eşzamanlılık — kilitle/yeniden aç     | ❌ **P0-3** korumasız `update(entity)` → lost update                             |
| Eşzamanlılık — dönem kapısı (posting) | ❌ **P0-1** tx dışı/kilitsiz okuma → kapalı döneme fiş                           |
| Defter — numaralandırma               | ❌ **P0-2** `MAX+1`, kilit yok, unique kısıt yok                                 |
| Durum makinesi                        | ⚠️ geçişler entity'de ama guard'lar çıplak `Error` (**P1-4**)                    |
| Kapanış ön koşulları                  | ❌ **P0-4** fişlenmemiş olay kontrolü yok (doc 04 §5 adım 1)                     |
| Takvim otomasyonu                     | ❌ **P0-5** yeni yıl dönemi açan iş yok                                          |
| Yetki kapsamı                         | ✅ dördünde de kaydın/kliniğin kendi kapsamı doğrulanıyor                        |
| Yetki ayrımı (SoD)                    | ❌ **P1-2** lock/reopen/close aynı capability                                    |
| Audit izi                             | ❌ **P1-1** hiç domain event, hiç damga kolonu yok                               |
| HTTP sınırı                           | ❌ **P1-3** ölü endpoint + gereksiz zorunlu `organizationId` + DTO yok           |
| Testler                               | ⚠️ yalnız `close-period.handler.spec.ts`; lock/reopen/open ve yarış testleri yok |

### 3.2 P0 — Canlı öncesi kapanmalı

#### P0-1 · Dönem kapısı TOCTOU: kapalı/kilitli döneme fiş yazılabilir

**Kanıt.**
`posting/application/commands/post-financial-event/post-financial-event.handler.ts:74-82`
dönemi **QueryBus** ile, **hiçbir transaction olmadan** okuyup `status !== OPEN` kontrolü yapıyor;
fişi ise `:213` satırında **ayrı bir** `outboxRun()` içinde yazıyor.
`reverse-journal-entry.handler.ts:63-71` okumayı tx içinde yapıyor ama **satır kilidi almıyor**.

**Neden bozuk.** Kontrol ile insert arasındaki pencerede `ClosePeriodHandler` dönemi
`claimForClosing` ile CLOSED'a çekebilir. Kapanış fişleri (6xx/7xx → 690 → 590/591) o anki
mizandan üretildiği için, sonradan düşen fiş **kapanmış yılın mizanını değiştirir**: 690 devri
eksik kalır, bilanço/gelir tablosu ile defter uyuşmaz, e-Defter beratı verilmiş dönemde kayıt
belirir. `JournalEntry.periodId` FK'sı sadece dönemin _varlığını_ garanti eder, **durumunu** değil.

Ek olarak bu, projenin kendi kuralını ihlal ediyor (CLAUDE.md — "Command Handler'da mutasyon
kararını besleyen okuma daima Command Repo'dan"): dönem durumu bir yazma kararını besliyor,
dolayısıyla Query Repo'dan (replica/kilitsiz) okunmamalı.

**Düzeltme.** Dönem okuması Command Repo'ya taşınır ve **fişin yazıldığı tx içinde satır kilidi
altında** yapılır: `findByDateForUpdate(clinicId, date)` (`lockRowForUpdate` ile). Böylece
`claimForClosing` posting commit'ini bekler; sonra gelen posting CLOSED görüp reddedilir.
P0-2'nin sayaç çözümü bu kilidi **bedavaya** getirir (aşağı bak) — ikisi birlikte yapılmalı.

#### P0-2 · Yevmiye numarası yarışı: mükerrer `entry_no`

**Kanıt.** `posting/.../journal/journal.command.repository.ts:98-104` —
`aggregate({_max: {entryNo}})` + 1. Kilit yok, sequence yok.
`journal-entry.prisma` içinde `@@unique([clinicId, periodId, entryNo])` **yok**
(yalnız `eventId @unique` var). Şemadaki yorum "POSTED olunca atanır, **boşluksuz sıralı**" diyor;
doc `04-muhasebe-defterler.md:23` de bunu zorunlu kılıyor.

**Neden bozuk.** İki eşzamanlı posting (READ COMMITTED) aynı MAX'ı okur → **aynı numara** iki fişe
yazılır ve hiçbir kısıt bunu durdurmaz. Ayrıca `post-financial-event.handler.ts:202-209`
numarayı ayrı bir tx'te "rezerve ediyor" varsayıyor; oysa `aggregate` **hiçbir şey rezerve etmez** —
yorum yanıltıcı, kayıt başarısız olursa numara da boşluk bırakır. `reverse-journal-entry` ve
`generate-year-end-closing` tek tx içinde çalıştığı için kendi içlerinde tutarlı, ama **birbirleriyle**
ve posting ile yarışır.

**Düzeltme (P0-1 ile tek hamlede).** Numara tahsisi dönem satırından yapılır:

```sql
UPDATE accounting_periods
   SET last_entry_no = last_entry_no + 1
 WHERE id = $1 AND status = 'OPEN'
RETURNING last_entry_no;
```

- Satır kilidi numarayı **serileştirir** (mükerrer imkânsız).
- Aynı UPDATE dönem satırını kilitlediği için `claimForClosing` ile doğal olarak çakışır → **P0-1
  de kapanır**; `status = 'OPEN'` koşulu 0 satır dönerse dönem kapanmış/kilitlenmiş demektir.
- Emniyet kemeri olarak `@@unique([clinicId, periodId, entryNo])` eklenir.
- Boşluksuzluk ancak numara **fişle aynı tx'te** alınırsa korunur → `post-financial-event`'in
  üç ayrı tx'i tek tx'e indirilir.

Gereken şema değişikliği: `AccountingPeriod.lastEntryNo BigInt @default(0)`.

#### P0-3 · `lock`/`reopen` lost update: kapatılmış dönem dirilebilir

**Kanıt.** `lock-period.handler.ts:38-41` ve `reopen-period.handler.ts:38-41`
klasik "yükle → domain metodu → `update(entity)`". `accounting-period.command.repository.ts:39-48`
`update` **tüm satırı** koşulsuz yazıyor; entity'de `version` yok.

**Neden bozuk.** `reopen` dönemi LOCKED okurken `close` araya girip CLOSED'a çekerse, reopen'ın
commit'i status'ü **OPEN'a geri döndürür** — kapanış fişleri atılmıştır ama dönem açıktır; yıl
yeniden fişlenebilir hale gelir. Aynı yarış `lock` ile de olur (dönem CLOSED iken LOCKED'a düşer).
`claimForClosing`'in tüm atomikliği, koşulsuz bir `update` tarafından iptal ediliyor.

**Düzeltme.** İki seçenek; ikisi de projede mevcut desen:

1. `claimForLocking(periodId)` / `claimForReopening(periodId)` — `updateMany` + `where.status`
   beklenen değere eşit; 0 satır → `InvalidPeriodLockException` / `InvalidPeriodReopenException`.
   (Kapanışla simetrik, migration gerektirmez.)
2. `AccountingPeriod.version` optimistic kolon + `ConcurrencyConflictException` (CLAUDE.md
   "Concurrency Control"). Dönem satırında başka mutasyon da olacaksa (P0-2 sayacı) bu daha temiz.

#### P0-4 · Dönem kapanışı, fişlenmemiş ekonomik olayları kontrol etmiyor

**Kanıt.** `close-period.handler.ts:52-78` — claim + kapanış fişi. Doc `04-muhasebe-defterler.md:84`
kapanış adım 1: _"Tüm bekleyen olayların fişe dönüştüğünü doğrula (kuyrukta FinancialEvent
kalmasın)."_ Kodda bu kontrol yok. Sistemde "fişlenmemiş olay" sorgusu da yok
(`grep unposted/postedAt` → 0 sonuç).

**Neden bozuk.** `FinancialEventRecordedListener` posting hatasını **bilerek yutuyor**
(`financial-event-recorded.listener.ts:36-57`): CRITICAL alarm üretir, ama retry yoktur ve outbox
kaydı `processedAt` ile kapanır. Yani fişlenememiş bir olay **kalıcı olarak** fişsiz kalır. Dönem
bir kez CLOSED olduktan sonra o olay artık hiç fişlenemez (dönem kapısı reddeder) → mizan kalıcı
eksik, olay defteri ile yevmiye arasında mutabakat sağlanamaz.

**Düzeltme.**

1. `ClosePeriodHandler` içinde (claim'den önce, aynı tx): dönem aralığında POSTED fişi olmayan
   `FinancialEvent` sayısı > 0 ise `UnpostedFinancialEventsException(count)` (409 + meta).
2. `PostUnpostedFinancialEventsCommand` (backfill) + fişlenmemiş olay listesi query'si →
   mutabakat ekranı. Alarm tek başına operasyonel çözüm değil.
3. Listener'da hata yutulmaya devam edecekse, en az outbox kaydı **başarısız** işaretlenip
   yeniden denenmeli (idempotentlik `findByEventId` ile zaten var).

#### P0-5 · Yeni yılın dönemini kimse açmıyor → 1 Ocak'ta posting durur

**Kanıt.** `OpenPeriodCommand` yalnız **bir** yerden çağrılıyor:
`register-clinic-account.handler.ts:113-119`, `year: DateTimeManager.currentYear()`.
`accounting` altında hiç cron/kuyruk yok (`grep Cron|Processor` → 0).

**Neden bozuk.** 1 Ocak 00:00'dan itibaren her posting `NoAccountingPeriodForDateException` alır;
listener hatayı yutar (P0-4) → o günün **tüm** ekonomik olayları kalıcı fişsiz kalır. Klinik
tarafında hiçbir hata görünmez (tahsilat/fatura akışı çalışmaya devam eder), yalnız CRITICAL
alarm düşer. Doc 04 §5 adım 6'daki **açılış fişi** (bilanço hesaplarının devri) de hiç üretilmiyor.

**Düzeltme.** Yıllık zamanlanmış iş: her aktif klinik için gelecek yılın dönemini önceden aç
(idempotent — `clinicId_year` unique). Posting yolunda "yoksa aç" yapılmamalı (denetimsiz dönem
açılışı olur). Açılış fişi ayrı bir iş kalemidir; ondan önce en azından dönemin var olması
garanti edilmeli.

### 3.3 P1 — Denetlenebilirlik ve yetki

#### P1-1 · Dönem geçişlerinin audit izi yok

`AccountingPeriod` `AggregateRoot`'u extend ediyor ama **tek bir `addDomainEvent` çağrısı yok**;
`close-period.handler.ts` `outboxRun()` kullanıyor ama outbox'a hiçbir şey koymuyor. Şemada
`closedAt`/`closedById`/`lockedAt`/`reopenedById` gibi damga kolonu yok. Sonuç: _"FY2026'yı kim,
ne zaman kapattı; kilitli dönemi kim yeniden açtı"_ sorusunun cevabı sistemde **hiçbir yerde yok**.
Bu, finans modülünün en yüksek ayrıcalıklı işlemi.

**Düzeltme.** `PeriodOpened/Locked/Reopened/Closed` event'leri (entity'de raise) + publisher +
audit listener (CLAUDE.md 3 adımlı akış) ve kalıcı damga kolonları. Kapanış event'i `outboxRun`
ile zaten atomik mühürlenecek.

#### P1-2 · Yetki ayrımı yok

`accounting-period.command.controller.ts` — lock/reopen/close **üçü de** `ACCOUNTINGPERIOD.update`.
Kilitli dönemi yeniden açmak (düzeltme penceresi açmak) ile dönemi kilitlemek aynı yetkiye bağlı;
mali yılı kapatmak da öyle. En azından `close` ve `reopen` ayrı capability olmalı (tercihen
reopen'da step-up doğrulama).

#### P1-3 · HTTP sınırı: ölü endpoint, gereksiz zorunlu alan, DTO yok

- `accounting-period.query.controller.ts:29` — `@Get()` route'unda `:clinicId` **yok** ama
  `@Param('clinicId', ParseUUIDPipe)` kullanılıyor. `ParseUUIDPipe` `optional` olmadığı için
  `undefined` → **her istek 400**. `GET /api/v1/accounting/periods` şu anda tümüyle ölü.
  (Yol: `app.routes.ts:141-144` → `accounting/periods`.)
- `accounting-period.command.controller.ts:31` — `organizationId` query param'ı `ParseUUIDPipe`
  ile **zorunlu** hale gelmiş (optional değil), oysa handler onu hiç kullanmıyor: org
  `tenantScopeResolver.resolve({ clinicId })` ile çözülüyor. Hem gereksiz 400 üretiyor hem de
  "organizationId istemciden alınmaz" kuralına aykırı — `OpenPeriodCommand.payload`'dan da
  kaldırılmalı.
- `@Body('year') year: number` — DTO/Zod yok; `@shared` altında period şeması/DTO'su hiç yok.
  `year` string gelirse entity guard'ı yakalıyor (`InvalidPeriodYearException`) ama doğrulama
  HTTP sınırında olmalı (`OpenPeriodDto` + `...FilterDto`).
- lock/reopen/close `@Param('id')` üzerinde `ParseUUIDPipe` yok (diğer uçlarla tutarsız).

#### P1-4 · Guard'lar çıplak `Error` atıyor; `canPost` ölü kod

`accounting-period.entity.ts:88-118` — `isOpen`/`isLocked`/`isClosed`/`canPost` guard'ları
`new Error(...)` üretiyor. Bu hatalar `AllExceptionsFilter`'da **500**'e düşer (domain exception
kuralı ihlali). `canPost` hiç kullanılmıyor: dönem kapısı handler'da string karşılaştırmasıyla
(`period.status !== OPEN`) yapılıyor → aynı kural iki yerde, biri ölü. Ayrıca
`InvalidPeriodLockException`/`InvalidPeriodReopenException` `currentStatus` meta alanını taşıyor
ama `lock()`/`reopen()` onu **doldurmuyor** → frontend hangi durumda reddedildiğini bilmiyor.

### 3.4 P2 — Varsayım ve hijyen

- **P2-1 · Timezone ve aralık semantiği.** `startsAt/endsAt`, `DateTimeManager.startOfYear/endOfYear`
  ile **sabit `Europe/Istanbul`** (DEFAULT_TZ) üzerinden hesaplanıyor; kliniğin kendi timezone'u
  kullanılmıyor. Yurt dışı klinikte 31 Aralık/1 Ocak gecesi oluşan olay yerel takvimden farklı
  döneme düşebilir. Ayrıca aralık kapalı-kapalı (`endsAt = 23:59:59.999` + `gte`) — yarı-açık
  `[startsAt, nextStart)` daha güvenli. Özel hesap dönemi (takvim yılı olmayan) desteklenmiyor;
  bu bilinçli varsayım olarak dokümana yazılmalı.
- **P2-2 · `toPersistence()` saf değil.** `accounting-period.entity.ts:189` her çağrıda
  `updatedAt: DateTimeManager.create()` üretiyor. Prisma'da `@updatedAt` zaten var; entity'nin
  okuduğu ile yazdığı değer farklı oluyor. Optimistic locking'e geçilirse tuzak.
- **P2-3 · Dönem açmada tipli çakışma hatası yok.** `open-period.handler.ts:57-63` ön kontrol
  READ COMMITTED'da iki eşzamanlı isteği ayırt etmez; nihai güvence `clinicId_year` unique'tir ama
  P2002 global `PrismaErrorMap` ile **jenerik** 409'a ("Bu bilgi zaten sistemde kayıtlı") dönüşür.
  Repository `create`'te P2002 → `PeriodAlreadyExistsException(year)` map'lenmeli (invoice/party
  repolarındaki desen).

### 3.5 Düzeltme sırası (uygulandı)

1. **P0-2 + P0-1 birlikte** — `lastEntryNo` sayacı + tek-UPDATE tahsis + `entry_no` unique
   - posting'in tek transaction'a indirilmesi. Tek hamlede numara bütünlüğü _ve_ dönem kapısı.
2. **P0-3** — `claimForLocking` / `claimForReopening`.
3. **P0-4** — kapanış ön koşulu + mutabakat listesi + backfill komutu.
4. **P0-5** — aylık dönem garanti işi + CRITICAL uyarı.
5. **P1-1** (audit olayı + damga kolonları), **P1-3** (HTTP/DTO), **P1-4** (tipli guard'lar).
6. **P2-2 / P2-3** hijyen + kalıcı `*.spec.ts` (entity, repo, lock/reopen, close).

Ayrıntı: §4. Kasıtlı olarak yapılmayanlar (P1-2 SoD, P2-1 saat dilimi, açılış fişi): §5.

---

## 4. Uygulanan düzeltmeler (2026-09-20)

| Bulgu                               | Ne yapıldı                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0-1** dönem kapısı TOCTOU        | Fiş atmanın otoriter kapısı artık **numara tahsisi**: `AccountingPeriod.lastEntryNo` sayacı `UPDATE … WHERE id = ? AND status = 'OPEN' RETURNING …` ile, **fişin yazıldığı transaction içinde** artırılır. Satır kilidi eşzamanlı kapanışı bekletir; kapanış önce commit olduysa tahsis 0 satır döner ve fiş `PeriodNotOpenException` ile reddedilir. `post-financial-event`'in üç ayrı transaction'ı tek transaction'a indirildi. QueryBus okuması kaldı ama artık yalnız "hangi dönem" çözümlemesi + hızlı-ret (kod içinde bu şekilde belgelendi). |
| **P0-2** mükerrer yevmiye no        | `nextEntryNo` (MAX+1) **silindi**; tahsis tek yerde: `IJournalEntryNumberingService` (dönem modülünün yaprak domain servisi, `lockAndAllocateEntryNo` / `lockAndAllocateClosingEntryNo`). DB'de `@@unique([clinicId, periodId, entryNo])` emniyet kemeri. Repository kilit olmadan çağrılırsa (`assertInTransaction`) sesli hata verir.                                                                                                                                                                                                              |
| **P0-3** lock/reopen lost update    | Koşulsuz `update(entity)` kaldırıldı; `claimForLocking` (OPEN→LOCKED) ve `claimForReopening` (LOCKED→OPEN) koşullu tek UPDATE. 0 satır → `PeriodConcurrentTransitionException` (409). `update()` ayrıca sayacı `undefined` bırakarak asla geri yazmaz.                                                                                                                                                                                                                                                                                               |
| **P0-4** kapanış ön koşulu          | `FINANCIAL_EVENT_POSTING_COMPLETENESS_SERVICE.assertAllPostedInRange` (financial-events yaprak domain servisi, Command Repo'dan okur) kapanış transaction'ı içinde, claim'den **sonra** çalışır → `UnpostedFinancialEventsException` (409, sayı + aralık meta'sıyla). Görünürlük + düzeltme yolu: `GET /accounting/financial-events/unposted` ve `POST /accounting/financial-events/post-unposted` (backfill).                                                                                                                                       |
| **P0-5** yıl dönümü                 | `EnsureLedgerPeriodsCommand` + aylık BullMQ repeatable job (`accounting-queue`, her ayın 1'i 03:00 TRT, Bull Board'a kayıtlı). Defteri olan her klinik için **cari ve gelecek** yılı garanti eder (idempotent, klinik başına ayrı transaction, hata → CRITICAL uyarı). Klinik listesi `accounting_periods`'tan türetilir → Clinic modülüne bağımlılık yok.                                                                                                                                                                                           |
| **P1-1** audit izi                  | Dört domain olayı (`AccountingPeriodOpened/Locked/Reopened/Closed`, entity içinde raise) + tek audit listener; şemada `lockedAt/lockedById`, `reopenedAt/reopenedById`, `closedAt/closedById` damgaları; response DTO'da yönetim gruplarına açıldı. Olaylar **yalnız koşullu geçiş başarılıysa** flush edilir.                                                                                                                                                                                                                                       |
| **P1-3** HTTP sınırı                | `@shared/modules/accounting-period` (şema+type+DTO) kuruldu: `OpenPeriodDto`, `GetAccountingPeriodsFilterDto`. Ölü `GET /accounting/periods` düzeltildi (query string), `organizationId` hem uçtan hem command payload'ından kaldırıldı, `:id` parametrelerine `ParseUUIDPipe` eklendi.                                                                                                                                                                                                                                                              |
| **P1-4** guard'lar                  | Çıplak `Error`'lar tipli domain exception'lara çevrildi (`PeriodNotOpen/NotLocked/NotClosed`, hepsi 409); ölü `canPost` silindi; `InvalidPeriodLock/Reopen` artık `currentStatus` meta'sını taşıyor.                                                                                                                                                                                                                                                                                                                                                 |
| **P2-2** saf `toPersistence`        | `updatedAt` artık entity alanından gelir (her çağrıda `now()` üretmiyor); damgaları domain metotları yazıyor.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **P2-3** tipli çakışma              | Repo `create` P2002'yi `PeriodAlreadyExistsException(year)`'a çeviriyor (jenerik 409 mesajı yerine).                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Bonus** (denetim sırasında çıktı) | Kuralı olmayan olay tipleri kapanışı sonsuza kadar bloke edebilirdi: kapsam `POSTABLE_FINANCIAL_EVENT_TYPES` ile sınırlandı ve liste ↔ kural kümesi **açılışta** karşılaştırılıyor (`PostingRuleRegistry`), sapma varsa uygulama ayağa kalkmıyor.                                                                                                                                                                                                                                                                                                    |

**Testler.** `accounting-period.entity.spec.ts` (durum makinesi + damga + olay + `toPersistence` saflığı), `accounting-period.command.repository.spec.ts` (koşullu geçişlerin `where` koşulları, event flush yalnız başarıda, sayaç geri yazılmıyor, tx dışı tahsis patlıyor, 0 satır → tipli hata), `lock-period.handler.spec.ts` (claim çağrılıyor/`update` çağrılmıyor, 0 satır → eşzamanlılık hatası), `close-period.handler.spec.ts` (claim + fişlenmemiş olay kapısı). `tsc` 0; finans suite 268 test, proje geneli 910 test yeşil.

**Migration** (kullanıcı uygular): `20260920120000_accounting_period_entry_numbering_and_audit`.
Sayaç backfill'i (`last_entry_no = MAX(entry_no)`) migration'ın **içinde**: atlanırsa yeni tahsisler mevcut numaralarla çakışır. Unique index mevcut mükerrer numara varsa hata verir — migration yorumundaki teşhis sorgusu çalıştırılıp o satırlar düzeltilmelidir.

---

## 5. Bilinçli yapılmayanlar — `accounting/periods`

| Konu                                              | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1-2 · Ayrı capability (SoD)**                  | Yetki sistemi model × CRUD türetmeli (`capability-helper.ts` → `CRUD_ACTIONS`). Bespoke bir `close` eylemi ya 110 modele boş yetki satırı basar ya da yetki sistemine özel-eylem mekanizması ekler; bu, dönem modülünün değil **yetki altyapısının** işi. Ara çözüm olarak P1-1 damgası hesap verebilirliği sağlıyor (kim kapattı/açtı artık kayıtlı). Yetki altyapısına özel eylem desteği geldiğinde `close`/`reopen` ilk müşteri olmalı. |
| **P2-1 · Klinik saat dilimi / özel hesap dönemi** | Ürün Türkiye mevzuatına göre çalışıyor (`documents/finans/README.md` varsayımları) ve tüm klinikler `Europe/Istanbul`. Mali yıl sınırını klinik ayarından beslemek, bugün var olmayan bir senaryo için dönem açma yoluna cross-module okuma ekler. Varsayım entity'de yoruma bağlandı; çok saat dilimi veya özel hesap dönemi gündeme geldiğinde `startsAt/endsAt` hesabı klinik ayarından beslenmeli.                                      |
| **Açılış fişi (doc 04 §5 adım 6)**                | Bilanço hesaplarının yeni döneme devri ayrı bir muhasebe **özelliği**, eşzamanlılık/bütünlük düzeltmesi değil. Ondan önce raporlama tarafında bir semantik sorun var: `get-balance-sheet` `dateFrom`/`dateTo` aralığıyla topluyor; bilanço bir **an** fotoğrafıdır, aralık toplamı değil. Posting/raporlama turunda birlikte ele alınmalı.                                                                                                  |
| **Listener'ın posting hatasını yutması**          | _(Posting turunda kapatıldı — bkz. §6 P1-3.)_ Hata hâlâ yutuluyor (olay defteri bozulmasın diye) ama artık günlük süpürme işi onarıyor.                                                                                                                                                                                                                                                                                                     |
| **Yarı-açık dönem aralığı**                       | `endsAt = 23:59:59.999` + `gte/lte` ile kapalı aralık; JS `Date` milisaniye hassasiyetinde olduğu için pratik boşluk yok. Değişiklik `findByDate`'i ve mizan aralıklarını birlikte etkilediği için raporlama turuna bırakıldı.                                                                                                                                                                                                              |

---

## 6. `accounting/posting` — Yevmiye / Fiş Motoru

Denetim tarihi: **2026-09-20**. Kapsam: `JournalEntry`/`JournalLine` entity'leri + VO'lar,
command/query repository'ler, 5 command, 8 rapor sorgusu, posting kuralları + registry,
FX çevrimi, storno yolu, yıl sonu kapanışı, dinleyici ve controller'lar.

### 6.1 Kontrol listesi sonucu

| Başlık                              | Durum                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| Para tipi / `Decimal`               | ✅ her yerde `decimal.js` + `@db.Decimal(14,2)`; `number` aritmetiği yok                |
| Para birimi her satırda             | ⚠️ **P0-3** storno satırları para birimini kaybediyor (TRY'ye düşüyor)                  |
| Yabancı para izlenebilirliği        | ❌ **P0-2** `original*`/`fxRate` repo mapping'inde düşüyor                              |
| Yuvarlama                           | ⚠️ **P2-1** mod açıkça tanımlı değil (decimal.js global varsayılanı)                    |
| Denge invariant'ı (Σborç = Σalacak) | ⚠️ zorlanıyor ama hata tipsiz 400 + tutarsız (**P1-2**)                                 |
| FX yuvarlama artığı                 | ✅ kambiyo 646/656 + artık tavanı (satır×0.01) ile sınırlı                              |
| İdempotentlik                       | ✅ `event_id` unique + `findByEventId` + P2002 yarış kurtarması                         |
| POSTED değişmezliği                 | ✅ tek meşru mutasyon `applyReversal` (status + reversedById)                           |
| Numaralandırma                      | ✅ dönem sayacı + kilit (periods turunda kapatıldı) + DB unique                         |
| **Storno sonrası bakiye**           | ❌ **P0-1** `REVERSED` fişler tüm raporlardan ve kapanıştan düşüyor                     |
| Eşzamanlılık — storno               | ✅ `findByIdForUpdate` (FOR UPDATE) + `ensureReversible`                                |
| Storno ayrı kayıt mı                | ✅ yeni fiş, kendi dönemi/numarası; orijinale dokunulmuyor                              |
| Kısmi iade tavanı                   | — (fiş seviyesinde kavram yok; fatura/tahsilat modüllerinde)                            |
| Kritik event atomikliği             | ✅ `outboxRun` (post, storno, kapanış)                                                  |
| Tüketici / kalıcı hata              | ⚠️ **P1-3** hata yutuluyor; backfill vardı ama **otomatik tetik yok**                   |
| Yetki kapsamı                       | ✅ storno kapsamı **fişin kendi** kliniğinden doğrulanıyor                              |
| Yetki — yıl sonu kapanışı           | ❌ **P1-1** `policyFactory` inject edilmiş, hiç kullanılmıyor                           |
| Yetki ayrımı (SoD)                  | ⚠️ **P1-4** storno `journalEntry:create` ile yapılıyor                                  |
| Audit izi — storno                  | ❌ **P1-5** hiç domain event yok; iz yalnız storno fişinin içinde                       |
| `toPersistence` saflığı             | ⚠️ **P2-2** her çağrıda `now()` üretiyor                                                |
| Hata teşhisi                        | ⚠️ **P2-3** iki ayrı unique kısıt aynı hataya çevriliyor                                |
| Testler                             | ⚠️ kurallar ve FX test edilmiş; entity durum makinesi ve repo süzgeçleri test edilmemiş |

### 6.2 P0 — Canlı öncesi kapanmalı

#### P0-1 · Storno edilmiş fişler defterden düşüyor → her hesabın bakiyesi yanlış

**Kanıt.** Altı rapor sorgusu da fişleri `status = POSTED` ile süzüyordu:
`journal-trial-balance.query.ts:20`, `journal.query.repository.ts:63` (kebir + açılış devri),
`:121` (yevmiye defteri), `:165` (nakit akışı), `:207` (KDV), `:263` (banka mutabakatı).

**Neden bozuk.** Çift taraflı muhasebede storno kayıt silmez: orijinal fiş `REVERSED`
olarak **yerinde kalır** ve etkisini, borç/alacağı ters çevrilmiş ikinci bir fiş götürür;
ikisinin net etkisi sıfırdır. `REVERSED` "bu fiş hiç olmadı" demez, "etkisi şu storno
fişiyle iptal edildi" der.

Süzgeç yalnız `POSTED` olduğunda storno sonrası **orijinal düşer, ters fiş kalır**:

|             | orijinal (B 100 Kasa 1.000) | storno (A 100 Kasa 1.000) | rapordaki bakiye |
| ----------- | --------------------------- | ------------------------- | ---------------- |
| doğru       | dahil                       | dahil                     | **0**            |
| eski süzgeç | REVERSED → **hariç**        | POSTED → dahil            | **−1.000**       |

Yani hesap bakiyesi orijinal tutar kadar **ters işaretle** yanlış çıkıyordu. Hata
sessizdir: ters fiş kendi içinde dengeli olduğu için mizanın `isBalanced`
(Σborç = Σalacak) kontrolü **yine tutar** — sapma yalnız hesap bazında görünür.
Aynı yanlış mizan `generate-year-end-closing`'i de besliyor (`trialBalance` → 690/590),
dolayısıyla sapma kapanış fişine yazılıp **kalıcı** hâle geliyordu.

**Düzeltme.** `LEDGER_EFFECTIVE_ENTRY_STATUSES` (`POSTED` + `REVERSED`) tek yerde
tanımlandı ve altı sorgunun hepsinde kullanılıyor. `DRAFT` dışarıda kalır (numarası yok,
deftere girmemiş). Yevmiye defteri raporu da storno edilmiş fişi **gizlemez**: resmî defter
kronolojik ve eksiksizdir, `status` alanı hangi fişin iptal edildiğini söyler.

#### P0-2 · Yabancı para izi (`original*`/`fxRate`) repository mapping'inde sessizce düşüyor

**Kanıt.** `journal.command.repository.ts:59-67` — nested `lines.create` yalnız
`id, accountId, partyId, debit, credit, currency, lineDesc` yazıyordu.

**Neden bozuk.** Zincirin geri kalanı çalışıyor: `post-financial-event` kuru çözüyor
(`FxConversion.convertLine`), `JournalLine` `originalDebit/originalCredit/originalCurrency/fxRate`
alanlarını taşıyor, `toPersistence()` döndürüyor, şemada (`journal-entry.prisma:59-62`)
kolonlar var — sadece repo mapping'i yazmıyordu. Sonuç: yabancı para fişinde defterde
yalnız **çevrilmiş** tutar kalır; hangi tutarın hangi kurla çevrildiği geri getirilemez
(VUK izlenebilirliği, kur farkı mutabakatı ve sonraki değerleme imkânsız). Hata sessiz:
ne exception ne uyarı. Bugün uyuyor çünkü hiçbir posting kuralı `draft.currency` set
etmiyor — ilk yabancı para kuralı yazıldığı gün veri kaybı başlıyordu.

**Düzeltme.** Dört alan mapping'e eklendi; mapping'in neden alan-alan yazıldığı
(`entryId` nested create'te Prisma'nın kurduğu alan) ve yeni kolon eklendiğinde buranın
güncellenmesinin **zorunlu** olduğu kod içinde belgelendi. Regresyon testi:
`journal.command.repository.spec.ts`.

#### P0-3 · Storno satırları para birimini ve kur izini kaybediyor

**Kanıt.** `journal-entry.entity.ts:211-218` — `buildReversalDraft` satır eşlemesinde
`currency` ve `original*`/`fxRate` yok. `JournalLine.create` para birimi gelmezse
`Currency.fromTrusted('TRY')`'ye düşüyor (`journal-line.entity.ts:105-107`).

**Neden bozuk.** Fonksiyonel para birimi klinik ayarından geliyor
(`ClinicFinanceSettings`, Model A). TRY dışı bir defterde orijinal fiş satırları (ör. EUR)
storno edilirken ters kayıt satırları **TRY** damgalanır: mizan iki farklı para birimini
aynı kolonda toplar ve defterin para bütünlüğü kalkar. Ayrıca yabancı para fişinin
stornosu orijinalin kur snapshot'ını taşımadığı için izlenebilirlik zinciri kopar.

**Düzeltme.** `currency` orijinal satırdan taşınıyor; `original*` de **terslenerek**
(`originalDebit ↔ originalCredit`) aynı `fxRate`/`originalCurrency` ile aktarılıyor —
storno, orijinalin kuruyla kapatılmalıdır; bugünün kuruyla kapatmak defterde gerçek
olmayan bir kur farkı yaratır. Test: `journal-entry.entity.spec.ts`.

### 6.3 P1 — Yetki, denetlenebilirlik, operasyon

#### P1-1 · Yıl sonu kapanışı yetki kontrolü yapmıyor

`generate-year-end-closing.handler.ts` `POLICY_FACTORY`'yi inject ediyor ama **hiç
kullanmıyordu** (dosyanın başında duran `// TODO: burası tekrar kontrol edilecek` yorumu
da bunu işaret ediyordu). Komut bugün yalnız `close-period` içinden çağrılıyor ve o
`PERIOD_CLOSE` yetkisini kontrol ediyor — ama komut bus'a kayıtlı: "çağıran zaten kontrol
ediyor" varsayımı derleyiciye görünmez. **Düzeltme:** kapsam kapanan defterin kliniğinden
doğrulanıyor (`ACCOUNTING_EVENTS.YEAR_END_CLOSING`); sistem aktörleri `PolicyEvaluator`
içinde muaf olduğu için zamanlanmış/iç çağrılar etkilenmiyor. Ölü TODO kaldırıldı.

#### P1-2 · Denge invariant'ı domain'de NestJS HTTP exception fırlatıyordu

`journal-lines.vo.ts:12,41` ve `finance/shared` VO'ları (`journal-entry-line-amount.vo.ts:58`,
`journal-entry-sequence.vo.ts:32`) `BadRequestException` fırlatıyordu: hem CLAUDE.md katman
kuralı ihlali (domain NestJS'e bağımlı) hem de modülün **en kritik invariant'ı** (`Fiş
dengesiz.`) tipsiz, gövdesiz 400 dönüyordu — ne `errorCode` ne fark tutarı. **Düzeltme:**
denge ihlali artık `UnbalancedJournalEntryException` (422, `{totalDebit, totalCredit}`
meta'sıyla); satır sayısı `JournalEntryInsufficientLinesException`; satır tutarı ve sıra no
biçimi `finance/shared/domain/exceptions` altındaki iki yeni tipli hata.

#### P1-3 · Yutulan posting hatasının otomatik onarımı yoktu

`financial-event-recorded.listener.ts:36-57` posting hatasını bilerek yutuyor (olay defteri
bozulmasın diye) ve CRITICAL uyarı düşüyor. Periods turunda görünürlük + elle backfill
eklenmişti; ama onu tetikleyen tek **otomatik** kontrol yılda bir çalışan dönem kapanışı
kapısıydı → bir fiş boşluğu aylarca fark edilmeden durabilirdi (CLAUDE.md finans kuralı 4).

**Düzeltme.** `SweepUnpostedFinancialEventsCommand` + günlük BullMQ işi (`posting-queue`,
04:00 TRT, Bull Board'a kayıtlı). Süpürme önce **hangi defterlerde** açık olduğunu sorar
(`GetClinicsWithUnpostedFinancialEventsQuery` → `distinct clinicId`; yalnız sistem
yöneticisi, kapsamsız sorgu olduğu için), sonra her klinik için mevcut backfill komutunu
çalıştırır. Pencere 45 gün: bir kapanış çevrimini kapsar, daha eskisi zaten kapanış
kapısında yakalanır. Bir defterin kalıcı hatası diğerlerini durdurmaz; süpürmeden sonra da
fişlenemeyen olay kalırsa ayrı CRITICAL uyarı üretilir. Posting kendi kuyruğunu taşır:
BullMQ'da aynı kuyruğa iki `@Processor` bağlanırsa işler ikisi arasında dağıtılır ve bir iş
adını tanımayan işleyiciye düşebilir.

#### P1-4 · Storno denetim izi yoktu + `create` yetkisiyle yapılıyordu

`markReversed` hiç domain event fırlatmıyordu; "kim iptal etti" yalnız storno fişinin
`performedById` kolonunda, defterin içine gömülü kalıyordu — audit log'da aranabilir kayıt
yoktu. Uç ayrıca `JOURNALENTRY.create` istiyordu: storno, fiş üretmekle (ki normalde onu
sistem yapar) aynı yetkiye bağlıydı (CLAUDE.md finans kuralı 7).

**Düzeltme.** `JournalEntryReversedEvent` (entity içinde raise, `LogType.SECURITY`,
orijinal fiş no + gerekçe + aktör) + `JournalEntryReversedListener`. Olay **yalnız linkaj
DB'ye yazıldıktan sonra** flush edilir (`applyReversal` → `flushEvents`): transaction geri
alınırsa "storno edildi" diye bir audit kaydı kalmaz. Uç yetkisi `JOURNALENTRY.delete`
oldu — storno yıkıcı bir düzeltmedir. Bugün `fullAccess(...ACCOUNTING)` taşıyan roller
(ADMIN, ORGANIZATION_OWNER, ACCOUNTANT) ikisine de sahip olduğundan davranış değişmez;
ayrım rol matrisinde tek satırla etkinleşir (bkz. §7).

Ek: `ensureReversible` kontrol sırası düzeltildi. `isPosted()` önce geldiği için ikinci
storno denemesi "yalnızca POSTED fişler storno edilebilir" diyordu — doğru statü, yanlış
gerekçe. Eşzamanlı iki storno isteğinde ikinci istek tam buraya düşer; görmesi gereken
mesaj "fiş zaten storno edilmiş"tir.

### 6.4 P2 — Varsayım ve hijyen

| Bulgu                            | Durum                                                                                                                                                                                                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P2-1** Yuvarlama modu          | `FxConversion` `toDecimalPlaces(2)` ile decimal.js global varsayılanına (ROUND_HALF_UP) güveniyor; kodda hiçbir yerde `Decimal.set({rounding})` yok. Bugün doğru mod ama **açıkça** seçilmemiş: ileride bir yerde global ayar değişirse tüm para yuvarlaması sessizce değişir. Ertelendi (§7). |
| **P2-2** `toPersistence` saflığı | ✅ `updatedAt` artık entity alanından; `post()` ve `markReversed()` damgayı yazıyor. `applyReversal` de `data.updatedAt`'i kullanıyor (repo'da `now()` üretmiyor).                                                                                                                             |
| **P2-3** Tipli çakışma ayrımı    | ✅ `journal_entries` iki unique kısıt taşıyor. `eventId` çakışması normal bir idempotent tekrardır (çağıran mevcut fişi bulup döner); `entryNo` çakışması tahsis yolunun baypas edildiğini gösteren bütünlük arızasıdır → ayrı hata (`JournalEntryNumberCollisionException`).                  |
| **P2-4** Magic string policy op  | ✅ `'accounting.journal.reverse'` literal'i `ACCOUNTING_EVENTS.JOURNAL_REVERSE` sabitine taşındı; uçta `ParseUUIDPipe` eklendi.                                                                                                                                                                |

### 6.5 Testler

| Dosya                                                            | Ne kilitler                                                                                                                                                                         |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `journal.query.repository.spec.ts` (yeni, 6 test)                | **P0-1 regresyonu**: altı rapor sorgusunun hepsi `POSTED + REVERSED` süzüyor; kebir/nakit akışının **açılış devri** de dahil                                                        |
| `journal.command.repository.spec.ts` (yeni, 2 test)              | **P0-2 regresyonu**: `original*`/`fxRate` DB payload'ına giriyor; `applyReversal` yalnız `status/reversedById/updatedAt` yazıyor ve olayı yazma sonrası salıyor                     |
| `journal-entry.entity.spec.ts` (yeni, 8 test)                    | dengesiz/tek satırlı fiş tipli hata + tutar meta'sı; `toPersistence` saflığı; storno para birimi ve terslenmiş FX izi (**P0-3**); `markReversed` denetim olayı; ikinci storno reddi |
| `sweep-unposted-financial-events.handler.spec.ts` (yeni, 3 test) | süpürme yalnız işi olan defterleri hedefler; boş kümede hiç çalışmaz; bir defterin kalıcı hatası diğerlerini durdurmaz ve iki ayrı CRITICAL uyarı üretir                            |

`tsc` 0; proje geneli **156 suite / 929 test** yeşil (`app.module.spec.ts` dahil — gerçek DI
grafiği yeni kuyruk ve dinleyici modülleriyle ayağa kalkıyor).

**Migration gerekmez** — bu turda şema değişmedi.

---

## 7. Bilinçli yapılmayanlar — `accounting/posting`

| Konu                                                                         | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rol matrisinde storno ayrımı (SoD'nin ikinci yarısı)**                     | Uç artık `journalEntry:delete` istiyor, ama `fullAccess(...ACCOUNTING)` taşıyan üç rol (ADMIN, ORGANIZATION_OWNER, ACCOUNTANT) hem `create` hem `delete` taşıdığı için **bugün kimse için değişiklik yok**. Gerçek ayrım `roles.ts`'te muhasebeciyi `fullAccess(...ACCOUNTING)` → `manage(...ACCOUNTING)`'e çekmekle olur (storno yalnız sahip/yönetici). Bu bir **ürün kararı** ("muhasebeci kendi kestiği fişi storno edebilir mi?") ve etkinleşmesi için yeniden seed gerekir — tek taraflı değiştirilmedi. |
| **Manuel fiş (storno sonrası doğru kaydı atma yolu)**                        | Bugün deftere fiş yalnız üç yoldan giriyor: posting kuralı, storno, yıl sonu kapanışı. `eventId` unique olduğu için bir ekonomik olayın fişi storno edildikten sonra **aynı olay yeniden fişlenemez** → düzeltme kaydını atmanın hiçbir yolu yok (`MANUAL_JOURNAL` olay tipinin kuralı da yok). Bu bir eşzamanlılık/bütünlük hatası değil, eksik bir **özellik**: kendi komutu, DTO'su, hesap/party doğrulaması ve yetkisi olan bir "manuel fiş" ucu gerekir. Ayrı tur.                                        |
| **P2-1 · Açık yuvarlama modu** ✅ **KAPANDI (§53.6)**                        | Para yuvarlaması için tek bir `MoneyRounding` politikası (mod + ölçek) kurmak yalnız posting'i değil fatura, tahsilat, bordro ve KDV hesabını da kapsar; tek modülde yarısını tanımlamak iki farklı kuralın yan yana yaşamasına yol açar. Fatura/tahsilat turunda proje geneli ele alınmalı. **§57 taramasında ölçüldü:** `Money.ROUNDING` + `Money.scale()` ile tek kapı kuruldu; satır kapanmış olduğu hâlde açık duruyordu.                                                                                 |
| **Dinleyicinin hatayı fırlatması (gerçek at-least-once)**                    | Hata fırlatıp outbox'ın yeniden denemesine bırakmak kalıcı hatada sonsuz tur üretir ve olay kaydını da geri alma riski taşır. P1-3'teki günlük süpürme aynı sonucu (kendiliğinden onarım) sınırlı ve gözlemlenebilir bir şekilde veriyor; gerçek retry semantiği outbox'ın genel yeniden-deneme politikasıyla birlikte ele alınmalı.                                                                                                                                                                           |
| **Bilanço `dateFrom` semantiği / açılış fişi** ⚠️ **YARISI KAPANDI (§51.1)** | Periods turundan devredildi ve **hâlâ açık**: `get-balance-sheet` aralıkla topluyor, oysa bilanço bir **an** fotoğrafıdır. Bu bir raporlama semantiği işi; açılış fişiyle (doc 04 §5 adım 6) birlikte raporlama turunda ele alınacak. **§57 taramasında ölçüldü:** `dateFrom` yarısı §51.1'de kapandı (tek `asOf` parametresi). Açılış fişi yarısı §52'de izleniyor — bu satır artık yalnız onu temsil ediyor.                                                                                                 |

---

## 8. `accounting/chart-of-accounts` — Hesap Planı

Denetim tarihi: **2026-09-28**. Kapsam: entity + `AccountCode` VO, TDHP şablonu (65 hesap),
command/query repository'ler, kurulum komutu, hesap planı sorgusu, controller'lar ve **hesap
planının dışa dönük sözleşmesi** (posting'in `AccountResolver` üzerinden hesap çözümü).

> **Modülün temel tasarımı sağlam:** hesap planı şablondan üretilir, kurulum idempotenttir ve
> **yalnız ekler**; hesapları güncelleyen/silen hiçbir uç yok. Bu, defterin altındaki referans
> kümesini kazara bozulmaya karşı korur. Bulgular bu tasarımın etrafındaki boşluklarda.

### 8.1 Kontrol listesi sonucu

| Başlık                              | Durum                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| Para/matematik                      | — (hesap planı tutar taşımaz)                                                      |
| Para birimi                         | ✅ hesap başına opsiyonel `currency`; defter para birimi Model A'da fiş tarafında  |
| İdempotentlik (kurulum)             | ✅ `findIdByCodeMap` + yalnız eksikleri ekle + `createMany({skipDuplicates})`      |
| Eşzamanlı kurulum yarışı            | ✅ `@@unique([clinicId, code])` + `skipDuplicates`; mevcut id'ler korunur          |
| Self-FK sırası                      | ⚠️ **P2-3** sıralama yalnız iki seviyede doğru                                     |
| Hesap ağacı tutarlılığı             | ⚠️ **P2-4** şablon doğrulaması yalnız kurulum anında çalışıyor                     |
| Kod ↔ ağaç uyumu                    | ❌ **P1-2** kod hiyerarşisi ile `parentId` ayrışabiliyor                           |
| `isActive`                          | ❌ **P1-1** hiçbir yerde okunmuyor — pasif hesap fiş kabul ediyor                  |
| `isPostable` (kapanış/kambiyo yolu) | ❌ **P1-1** yalnız satır döngüsünde kontrol ediliyordu                             |
| Şablon evrimi (schema evolution)    | ❌ **P1-3** şablon düzenlenince eski defterler sessizce ayrışıyor                  |
| Yetki kapsamı                       | ✅ kurulum `actorCanManageTargetClinic`, okuma `canAccessClinicFinances`           |
| Kiracı kimliği                      | ⚠️ **P2-5** `organizationId` uçtan alınıyordu (resolver doğruluyor ama gereksiz)   |
| Audit izi                           | ✅ toplu `ChartOfAccountsInitializedEvent` (65 olay yerine tek olay + kod listesi) |
| Hata tipleri                        | ✅ hepsi tipli `DomainException` + meta (`InvalidAccountCode` VO'dan çıkarılmış)   |
| Mutabakat raporu                    | ❌ **P1-3** şablon ↔ defter farkını gösteren hiçbir şey yok                        |
| `toPersistence` saflığı             | ⚠️ **P2-1** her çağrıda `now()` üretiyor                                           |
| Ölü mutasyon metotları              | ⚠️ **P2-2** `togglePostable` ulaşılamaz ve tehlikeli                               |
| Testler                             | ⚠️ entity + kurulum test edilmiş; şablon bütünlüğü ve hesap çözümü test edilmemiş  |

### 8.2 P1 — Kapatılanlar

#### P1-1 · `isActive` bir kontrol değil süstü; `isPostable` iki yolda hiç kontrol edilmiyordu

**Kanıt.** `account-resolver.ts:20-26` (eski hâli) yalnız varlık kontrolü yapıyordu.
`isPostable` kontrolü `post-financial-event.handler.ts:126-128`'de, **satır döngüsünün
içinde** duruyordu. `isActive` ise codebase'de hiçbir yerde okunmuyordu.

**Neden bozuk.** `resolve()`'un **her** sonucu bir yevmiye satırının hesabı olur. Kontrol
satır döngüsünde durduğu için `resolve()`'un diğer iki çağrı yolu denetimsizdi:
yıl sonu kapanışı (`690` havuzu, `590`/`591` net K/Z — `year-and-closing.service.ts:58,88,91`)
ve FX yuvarlama artığının kambiyo satırı (`646`/`656` — `post-financial-event.handler.ts:180`).
Bu iki yolda kolektif (yaprak olmayan) bir hesaba fiş atılabilirdi: aynı tutar hem üst hem
alt hesapta görünür ve kod önekine göre toplayan raporlarda **iki kez sayılır**.

`isActive` tarafı daha sinsi: kolon var, entity'de `deactivate()` metodu var, ama okuyan
kimse yok → pasife alınmış bir hesap fişleri sessizce kabul etmeye devam ediyordu. Yani
bayrak bir güvence sağlıyormuş gibi görünüp hiçbir şey yapmıyordu.

**Düzeltme.** Üç kontrol (`var` / `aktif` / `yaprak`) `AccountResolver.resolve()` içinde tek
kapıya alındı; yeni `AccountInactiveException` (422). `requiresParty` **bilerek** çağıranda
kaldı: o hesabın değil satırın özelliğidir (party verilmiş mi?). Şablondaki 21 kullanılan
kodun hepsinin `isPostable=true` olduğu doğrulandı (regresyon: `account-resolver.spec.ts`).

#### P1-2 · Alt hesap kodu ile ağaç ayrışabiliyordu

`createChild` `props.code`'u doğrudan kabul ediyordu: `600` (kolektif) altına `700.01`
kodlu bir çocuk açılabilirdi. Kod önekine göre toplayan rapor ile `parentId` ağacına göre
toplayan rapor aynı defterde **farklı** sonuç verir. Artık `AccountCode.parentCode`
üst hesabın koduyla eşleşmek zorunda (`AccountCodeHierarchyMismatchException`); aynı kural
şablon doğrulamasına da eklendi.

#### P1-3 · Şablon düzenlenince mevcut defterler sessizce ayrışıyordu

**Neden bozuk.** `initialize-chart-of-accounts` idempotent ve **yalnız ekler** — mevcut
hesapların niteliklerine hiç dokunmaz (bu doğru bir karar: `type`/`normalSide`'ı geriye
dönük değiştirmek geçmiş hareketlerin raporlardaki işaretini çevirir). Ama şablon yaşayan
bir dosya: TDHP genişledikçe düzenleniyor. Sonuç: bir alan düzeltildiğinde **yeni açılan
klinikler yeni davranışı, eski defterler eskisini** taşır ve bu fark hiçbir yerde görünmez.

Somut senaryo: `120`/`320` için `requiresParty` false→true düzeltildi. Yeni klinikler cari
zorunlu tutar; eski defterler party'siz satır yazmaya devam eder → **cari mutabakatı
yapılamaz**. Aynı şekilde `isPostable` sapması aynı fişi bir klinikte kabul edip diğerinde
reddeder.

**Düzeltme.** `ChartTemplateIntegrity.detectDrift` (saf domain) + `GET /accounting/chart-of-accounts/drift`:
şablonda olup defterde olmayan kodlar (`missingCodes` → kurulumu çalıştır), defterde olup
şablonda olmayanlar (`extraCodes` → elle açılmış alt defter hesapları, meşru) ve kodu aynı
ama niteliği ayrışmış hesaplar (`drifted`, **alan alan**: beklenen ↔ fiilî). Rapor
**otomatik düzeltme yapmaz** — hangi sapmanın düzeltilip hangisinin defterin gerçeği olarak
kabul edileceği muhasebe kararıdır.

### 8.3 P2 — Kapatılanlar

| Bulgu                             | Ne yapıldı                                                                                                                                                                                                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P2-1** `toPersistence` saflığı  | `updatedAt` artık entity alanından (period/journal ile aynı düzeltme)                                                                                                                                                                                                                                                  |
| **P2-2** Ölü + tehlikeli mutasyon | `togglePostable` **silindi**: ulaşılamazdı (hiçbir uç/komut çağırmıyor) ve kolektif bir hesabı sessizce fişe açabiliyordu; entity içinden "çocuğu var mı" bilinemediği için güvenli hâle getirilemez. `activate`/`deactivate` kaldı — P1-1 ile artık gerçek bir etkileri var.                                          |
| **P2-3** Self-FK sıralaması       | `createChart` artık **kod derinliğine** göre sıralıyor. Eski hâli yalnız "kök mü değil mi" ayrımı yapıyordu: iki seviyeli şablonda çalışır, üçüncü seviye (`120.01.0001` — cari alt defteri) eklendiğinde torun ebeveyninden önce gelip FK'yı ihlal edebilirdi.                                                        |
| **P2-4** Şablon doğrulaması       | `ChartTemplateGuard` ile **açılışta** çalışıyor (`PostingRuleRegistry` ile aynı gerekçe): bozuk bir şablon düzenlemesi eskiden ilk klinik kurulumuna kadar — canlıda, kayıt açma transaction'ının içinde — gizli kalıyordu. Doğrulama tek kaynakta; `buildChartFromTemplate` de onu çağırıyor (kopya kontrol silindi). |
| **P2-5** Kiracı kimliği uçta      | `organizationId` query parametresi kaldırıldı; komut payload'ındaki alan yalnız iç çağrılar (kayıt akışı, platform kiracısı) için duruyor ve resolver'da doğrulanıyor.                                                                                                                                                 |
| **P2-6** Magic string / UUID      | Policy op `'accounting.chart-of-accounts.list'` → `ACCOUNTING_EVENTS.CHART_OF_ACCOUNTS`; `crypto.randomUUID()` → `UUID.generate()` (proje sözleşmesi).                                                                                                                                                                 |

### 8.4 Testler

| Dosya                                             | Ne kilitler                                                                                                                                                                                                                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chart-template-integrity.spec.ts` (yeni, 8 test) | gerçek şablonun tutarlılığı (şablonu düzenleyen herkesin ağı); eksik üst hesap, tip/yön uyuşmazlığı, kod öneki uyuşmazlığı, çocuğu olan hesabın fişe açık olması → hepsi reddediliyor; drift raporu (`requiresParty` sapması alan alan, `missingCodes`, meşru `extraCodes`) |
| `account-resolver.spec.ts` (yeni, 4 test)         | **P1-1 regresyonu**: bulunamayan kod, pasif hesap, kolektif hesap → tipli hata; aktif yaprak hesap çözülüyor                                                                                                                                                                |

### 8.5 Doğrulanan, sorun çıkmayan noktalar

- **Posting'in istediği her hesap kodu şablonda var.** 21 kod (`100, 102, 108, 120, 150, 191,
193, 320, 335, 360, 361, 391, 590, 591, 600.01, 646, 656, 679, 689, 690, 770`) tek tek
  şablonla karşılaştırıldı: hepsi var ve hepsi `isPostable=true`.
- **`type` ↔ `normalSide` zorunlu bir çift değil.** TDHP'de (-) karakterli hesaplar
  (`103, 256, 257, 580, 591, 610, 611, 7x1` yansıtma) sınıfının genel yönünün tersine çalışır;
  şablon bunu açıkça yazıyor. Bu yüzden "ASSET ⇒ DEBIT" gibi bir invariant **eklenmedi** —
  eklenseydi doğru şablonu reddederdi.
- **Kurulum yarışı güvenli.** İki eşzamanlı istek de aynı eksik kümeyi hesaplayıp farklı
  UUID'lerle yazmaya çalışsa bile `@@unique([clinicId, code])` + `skipDuplicates` ikinci
  yazımı düşürür; mevcut hesaplar kimliklerini korur (`existingIdByCode`), dolayısıyla
  sonradan eklenen alt hesap üst hesabın **gerçek** id'sine bağlanır.

---

## 9. Bilinçli yapılmayanlar — `accounting/chart-of-accounts`

| Konu                                                          | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sapmayı otomatik onaran reconcile komutu**                  | `name`/`isPostable`/`requiresParty` için güvenli görünse de `type`/`normalSide` düzeltmesi geçmiş hareketlerin raporlardaki işaretini **geriye dönük** çevirir; üstelik hangi sapmanın "şablon haklı", hangisinin "defter haklı" olduğu muhasebe kararıdır (klinik bilinçli olarak farklı ayarlanmış olabilir). Rapor önce görünür olsun; onarım, hangi alanların güvenle yazılabileceği kararlaştıktan sonra ayrı bir komut olarak gelir.                                                                                                                                                                                                                                                      |
| **Sapma için zamanlanmış alarm**                              | Drift raporu `extraCodes`'u da sayıyor ve alt defter hesapları (`120.01`) meşru olarak oradadır — yani rapor sürekli "boş değil" döner. Günlük alarm bu yüzden gürültü üretir ve alarm yorgunluğu yaratır. Şablon düzenlemesi bir **geliştirici eylemi**; kontrol de o anda (uç ile) yapılır.                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Hesap planını Command Repo'dan okumak**                     | `post-financial-event` hesap planını QueryBus + Query Repo üzerinden okuyor; CLAUDE.md "yazma kararını besleyen okuma Command Repo'dan" der. Burada bilinçli bırakıldı: (1) hesap planı yavaş değişen **referans** veridir, kurulumdan sonra pratikte sabittir; (2) yanlış sonuç üretemez — kodlar sabittir, olası tek hata "kod bulunamadı"dır (yanlış tutar değil, sesli hata); (3) cross-module olduğu için sanktifiye yol QueryBus'tır, domain-servis istisnası ise yalnız `assert*`/skaler dönüşe izin verir — hesap planı bir liste olduğu için o istisnaya girmez. Alternatif, tüm hesap planını skaler-skaler çözen bir domain servisi olurdu: her satır için ayrı çağrı, aynı garanti. |
| **Hesap planı yönetim ucu (ekle/pasife al/yeniden adlandır)** | Bugün hesap planı şablondan üretiliyor ve elle değiştirilemiyor — bu **kasıtlı** bir güvence. Yönetim ucu açmak, defterin altındaki referans kümesini kullanıcı hatasına açar; açılacaksa her mutasyonun (hareketi olan hesabı pasife alma, kodu değiştirme) kendi invariant'ı ve denetim izi olmalı. Ayrı tur, ürün kararı.                                                                                                                                                                                                                                                                                                                                                                    |

---

## 10. `accounting/tax-parameters` — Vergi Parametreleri

Denetim tarihi: **2026-09-28**. Kapsam: entity, `TaxSpecification`/`VatRate` VO'ları,
command/query repository'ler, 2 command + 2 query, controller'lar, şema (`tax.prisma`) ve
parametrenin **dışa dönük sözleşmesi** (fatura kesiminde oran çözümü).

Tablo tarih-versiyonludur: `(clinicId, key)` için `validFrom`/`validTo` aralıklı satırlar,
`validTo = null` → yürürlükteki sürüm. Geçmiş dönemler doğru hesaplansın diye satır silinmez.
Bu doğru bir model; bulgular modelin **zorlanmasında**.

### 10.1 Kontrol listesi sonucu

| Başlık                           | Durum                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| Para tipi / hassasiyet           | ⚠️ **P0-1** oran zinciri boyunca **dört farklı** tanım                                     |
| Oran aralığı doğrulaması         | ❌ **P0-1** yazma kapısı 0–100, kullanım yeri `{0,1,10,20}`                                |
| İdempotentlik (kurulum)          | ✅ `existsForClinic` + aynı tx + Command Repo                                              |
| **Tek açık sürüm invariant'ı**   | ❌ **P1-1** çift açık sürüm üretilebiliyordu; DB kısıtı yoktu                              |
| Eşzamanlılık — kilit             | ⚠️ **P1-1** kilit alınıyor ama **kilit öncesi karar** kullanılıyordu                       |
| Aralık semantiği                 | ❌ **P1-2** kapalı aralık → sınırda iki sürüm birden yürürlükte                            |
| Mutasyon kararını besleyen okuma | ✅ Command Repo + `FOR UPDATE`                                                             |
| Yetki kapsamı                    | ✅ `actorCanManageTargetClinic`; kiracı kimliği **actor context**'ten (istemciden değil)   |
| Hata tipleri                     | ❌ **P1-3** entity/handler `BadRequestException`, "yapılandırılmamış" çıplak `Error` (500) |
| Audit izi                        | ⚠️ **P2-2** oran değişikliği domain olayı üretmiyor                                        |
| Geçmişin korunması               | ✅ satır silinmez, yeni sürüm açılır                                                       |
| Testler                          | ⚠️ vardı ama biri **hatalı davranışı belgeliyordu** (yasal olmayan oran kabul ediliyor)    |

### 10.2 P0-1 · Bir KDV oranının "geçerli" olup olmadığına dört ayrı yer karar veriyordu

**Kanıt.**

| Katman                                        | Kabul ettiği               | Kanıt                                       |
| --------------------------------------------- | -------------------------- | ------------------------------------------- |
| Yazma kapısı (`TaxParameter.assertValidRate`) | 0–100 arası **her** sayı   | `tax-parameter.entity.ts:101-105` (eski)    |
| DB kolonu                                     | `Decimal(5,2)` — ondalıklı | `tax.prisma:20`                             |
| Kullanım yeri (`VatRate` VO)                  | yalnız `{0, 1, 10, 20}`    | `vat-rate.vo.ts:10` (kopya liste)           |
| Fatura satırı kolonu                          | `Int` — ondalık yok        | `invoice.prisma:38`, `treatment.prisma:141` |

**Neden bozuk.** Yönetici `PUT /tax-parameters` ile `VAT_HEALTH = 8` (ya da `10.5`) yazabiliyordu:
0–100 kontrolünden geçer, `Decimal(5,2)` kolonuna sığar, **kaydedilir**. Sonra fatura kesilirken
`issue-invoice` bu oranı parametre tablosundan çözüp `VatRate`'e veriyor ve VO onu reddediyor:
`InvalidVatRateException` — "Yasal olmayan KDV oranı".

Sonuç: **faturalama tamamen duruyor**, hata sebebinden (parametre ayarı) tamamen kopuk bir yerde
ve o ayardan hiç bahsetmeyen bir mesajla ortaya çıkıyor. Üstelik parametrik tablonun varlık
nedeni ("mevzuat değişince yeni oran aç") çalışmıyor: yasal oran %22'ye çıksa tabloya yazılabilir
ama VO reddeder — yani yine kod değişikliği gerekir.

**Düzeltme.** Yasal KDV oranları **tek kaynağa** taşındı: `src/domain/constants/tax/STATUTORY_VAT_RATES`.
Hem `VatRate` VO (kopya listesi silindi) hem de yazma kapısı aynı listeyi kullanıyor →
kullanılamaz bir oran **hiç kaydedilemiyor**, hata ayarın yapıldığı yerde ve anlaşılır bir
mesajla çıkıyor (`InvalidTaxRateException`, izin verilen değerler meta'da). Mevzuat değişirse
yalnız o sabit güncellenir, zincirin tamamı uyar.

**Önemli ayrım:** yasal küme **yalnız KDV anahtarlarına** (`VAT_*`) uygulanır. Stopaj (`WHT_*` %20)
ve kurumlar vergisi (`CORP_TAX` %25) KDV değildir; o kümeye sıkıştırılsa varsayılan seed'in kendisi
(`CORP_TAX = 25`) reddedilirdi. KDV dışı anahtarlarda sınır DB kolonundan gelir: 0–100 ve en çok
2 ondalık basamak.

### 10.3 P1 — Kapatılanlar

#### P1-1 · Aynı anahtar için iki açık sürüm üretilebiliyordu

**Kanıt.** `set-tax-parameter.handler.ts:42-54` + `tax-parameter.command.repository.ts:23-40` +
`tax-parameter.entity.ts:108-110` (eski `close`).

**İki ayrı yol.**

1. **Kilit var ama kilit öncesi karar kullanılıyor.** İki istek de `findFirst({validTo: null})`
   ile aynı açık sürümü görür (kilit **bu okumadan sonra** alınır). İlk istek kilidi alır,
   sürümü kapatır, commit eder. İkinci istek kilidi devralır ve satırı yeniden okur — artık
   `validTo` dolu. Ama `close()` sessizce geri dönüyordu (`if (this._validTo) return;`), handler
   bunu fark etmiyor ve **yeni sürümü yine açıyordu**. Sonuç: iki `validTo = null` satırı.
2. **İlk sürümde kilitlenecek satır yok.** Açık sürüm hiç yokken `findOpenForUpdate` null döner
   ve serileştirilecek hiçbir şey kalmaz; iki eşzamanlı istek de ilk sürümü açar.

Her iki durumda "hangi oran yürürlükte" sorusu belirsizleşir: `findEffective` `validFrom desc`
sıralamasıyla birini seçer, iki satırın `validFrom`'u eşitse seçim tamamen belirsizdir. Yani
**faturada kullanılan KDV oranı eşzamanlılığa göre değişir**. DB'de bunu engelleyecek hiçbir
kısıt yoktu (`@@index` var, unique yok).

**Düzeltme.** Üç katman:

- `close()` zaten kapalı sürümde **sesli hata** veriyor (`TaxParameterAlreadyClosedException`, 409)
  — sessiz geri dönüş hatayı gizleyen şeydi;
- kısmî unique index `(clinic_id, key) WHERE valid_to IS NULL` (migration) — ilk-sürüm yarışının
  tek gerçek koruması, çünkü orada kilitlenecek satır yok;
- repo `P2002` → `TaxParameterConcurrentUpdateException` (409).

#### P1-2 · Geçerlilik aralığı kapalıydı → sınırda iki sürüm birden yürürlükte

`close(validFrom)` eski sürümün `validTo`'sunu yeni sürümün `validFrom`'una eşitler. Aralık
kapalı (`<=` / `gte`) olduğu için **tam o anda** hem eski hem yeni sürüm "yürürlükte" görünüyordu.
Doğru sonuç yalnız `orderBy validFrom desc` sayesinde geliyordu — yani doğruluk sıralamaya
bağlıydı ve `validFrom`'lar eşit olduğunda (P1-1'in ürettiği durum) tamamen kayboluyordu.
Aralık **yarı açık** yapıldı: `[validFrom, validTo)` — hem `isEffectiveAt` hem `findEffective`.

#### P1-3 · Hata tipleri

Entity'de 3, handler'da 1 `BadRequestException` (domain/application katmanı NestJS'e bağımlı) ve
`TaxParameterNotConfiguredException` çıplak `Error` — yani **500**, `errorCode` yok. Oysa o
hatanın aksiyonu net ve operasyoneldir ("kayıt akışında parametreler kurulmamış") ve
**faturalamayı durdurur**; teşhis edilebilir olması şart. Hepsi tipli `DomainException`'a
çevrildi (422/409 + meta). `finance/shared/tax-specification.vo.ts`'teki 2
`BadRequestException` de `InvalidTaxSpecificationException`'a taşındı.

### 10.4 P2 — Kapatılanlar

| Bulgu                                     | Ne yapıldı                                                                                                                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P2-1** Magic string policy op           | `'accounting.tax-parameter.set'` → `ACCOUNTING_EVENTS.TAX_PARAMETER_SET`                                                                                                                                                       |
| **P2-2** Hatalı davranışı belgeleyen test | `set-tax-parameter.handler.spec.ts` `rate: 8` ile çağırıp **başarı** bekliyordu — yani yasal olmayan oranın tabloya yazılabildiğini test olarak sabitlemişti. Yasal orana çevrildi; %8 artık ayrı bir testte **reddediliyor**. |

### 10.5 Testler

| Dosya                                                         | Ne kilitler                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tax-parameter.entity.spec.ts` (yeniden yazıldı, 11 test)     | **P0-1**: KDV'de yasal olmayan oran (%8, %10.5) reddediliyor, yasal kümenin tamamı kabul ediliyor, KDV dışı anahtarlarda küme zorlanmıyor (%25 kurumlar, %17.5 stopaj) ama 2 ondalık sınırı var; **P1-2**: yarı açık aralık sınırı (`validTo` anında artık yürürlükte değil); **P1-1**: ikinci `close` sesli hata veriyor |
| `set-tax-parameter.handler.spec.ts` (yeniden yazıldı, 5 test) | **P1-1 regresyonu**: kilit alındıktan sonra sürüm kapalıysa yeni sürüm **açılmıyor** (`create` hiç çağrılmıyor); yasal olmayan oran yazma kapısında reddediliyor; açık sürüm kapatma + yeni sürüm açma akışı                                                                                                              |

`tsc` 0; finans + DI grafiği **55 suite / 305 test** yeşil.

**Migration (kullanıcı uygular):** `20260928090000_tax_parameter_single_open_version`.
Kısmî unique index kurar. Mevcut veride aynı `(clinic_id, key)` için birden fazla açık sürüm
varsa **hata verir**; migration yorumundaki teşhis sorgusu çalıştırılıp o satırlar
kapatılmalıdır. `valid_from` değerleri eşit olan çiftlerde hangisinin doğru oran olduğu
**elle** karara bağlanmalıdır (otomatik seçim yapılmamalı).

---

## 11. Bilinçli yapılmayanlar — `accounting/tax-parameters`

| Konu                                                               | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ondalıklı KDV oranı desteği (uçtan uca)**                        | Bugün `invoice.vatRate`, `treatment.vatRate`, `purchase-invoice.vatRate`, `purchasing.vatRate` kolonları **`Int`**; `tax_parameters.rate` ve `inventory`/`clinic` kolonları `Decimal(5,2)`. Yani sistem "KDV oranı ondalıklı olabilir mi" sorusuna iki farklı yanıt veriyor. Bu turda çelişki **yazma kapısını daraltarak** kapatıldı (yasal küme zaten tamsayı) — ondalık bir oran artık hiç kaydedilemiyor, dolayısıyla `Int` kolona düşme riski yok. Kolonları `Decimal(5,2)`'ye taşımak 4 tabloda migration + tüm KDV aritmetiğinin gözden geçirilmesi demek; mevzuat ondalıklı bir orana geçmediği sürece riski kazancından büyük. **Tetikleyici:** yasal bir orana ondalık gelirse önce bu migration yapılmalı, `STATUTORY_VAT_RATES` sonra güncellenmeli. |
| **Oran değişikliği için domain olayı / denetim izi**               | Oran değişikliği yüksek etkili bir işlem (tüm sonraki faturaları etkiler) ve CLAUDE.md finans kuralı 7 kalıcı damga istiyor. Şu an iz **dolaylı** olarak var: eski sürüm silinmiyor, `validTo` + `updatedAt` ile kapanıyor, yeni satır `createdAt` taşıyor — yani "hangi oran ne zaman yürürlükteydi" tam olarak yeniden kurulabilir. Eksik olan yalnız **kim** değiştirdi. Bunun için ya `changedById` kolonu (migration) ya da domain olayı + listener gerekiyor; dönem modülündeki damga deseninin aynısı. Aynı migration turunda yapılmalı, ayrı turda değil.                                                                                                                                                                                                |
| **Mevzuat değişikliğini tüm kliniklere yayan komut**               | Yasal oran değişince (ör. %20 → %22) her klinik için tek tek `SetTaxParameterCommand` çağırmak gerekiyor; toplu bir yayma (rollout) komutu yok. Bu bir **özellik**, bütünlük hatası değil: `STATUTORY_VAT_RATES` güncellenmeden yeni oran hiç yazılamaz, dolayısıyla sessiz bir sapma doğmaz. Yayma komutu yazıldığında idempotent olmalı ve `validFrom`'u mevzuatın yürürlük tarihine sabitlemeli (çalıştırma anına değil).                                                                                                                                                                                                                                                                                                                                     |
| **Controller'ın `clinicId`'yi yalnız `actor.clinicId`'den alması** | Birden çok kliniği yöneten bir aktör (bölge müdürü) kardeş kliniğin oranını uçtan ayarlayamıyor; yalnız kendi bağlamındaki şubeyi. Policy kontrolü (`actorCanManageTargetClinic`) hedef kliniği destekliyor, yani kısıt yalnız controller'da. Bunu açmak DTO'ya `clinicId` eklemek demek — kiracı kimliğini istemciden almanın **doğru** biçimi (klinik kapsamı policy'de doğrulanıyor) ama bir ürün kararı: oranı kim, hangi şube için ayarlayabilir? Kapsam genişletmesi olduğu için tek taraflı yapılmadı.                                                                                                                                                                                                                                                    |

## 12. `invoice` — Satış Faturası

Denetim tarihi: **2026-10-10**. Kapsam: entity, `InvoiceNumber` VO, `TaxSpecification` kullanımı,
command/query repository'ler, 2 command + 4 query, iki olay dinleyicisi (randevu tamamlandı /
tahsilat alındı), e-Belge kuyruğu + işleyicisi, şema (`invoice.prisma`) ve faturanın **dışa dönük
sözleşmesi** (muhasebe köprüsü: `SALES_INVOICE_ISSUED`).

Fatura bu sistemde **elle kesilmez**: iki olay dinleyicisi tetikler, kayıt `PENDING` açılır,
e-Belge sonucu gelince `ISSUED`'a finalize olur. Bulguların çoğu bu akışın uçlarında.

### 12.1 Kontrol listesi sonucu

| Başlık                               | Durum                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Para tipi / hassasiyet               | ⚠️ **P1-5** `amount` zincirde `number` (`.toNumber()`)                                           |
| Para birimi (fonksiyonel + orijinal) | ❌ **P0-2** muhasebe olayına `currency` geçmiyor                                                 |
| Yuvarlama                            | ✅ `fromGrossAmount` tek yerde (net 2 haneye, KDV = brüt − net)                                  |
| Faturalanan tutarın doğruluğu        | ❌ **P0-1** taksitli tahsilatta yalnız ilk taksit faturalanıyor                                  |
| İdempotentlik (mükerrer fatura)      | ✅ `appointment_id` / `payment_id` unique + yarış kaybedeni kazananı döner                       |
| Dış sağlayıcı tekrarı (e-Belge)      | ❌ **P0-3** job retry'ında entegratöre ikinci belge gider                                        |
| Belge değişmezliği                   | ❌ **P1-1** `applyEDocumentResult` numarayı üzerine yazabiliyor                                  |
| KDV oranı kabul kümesi               | ❌ **P1-2** yasal küme zorlanmıyor (kardeş modül zorluyor)                                       |
| Eşzamanlılık — e-Belge sonucu        | ⚠️ **P1-1** kilit/`version` yok; iki sonuç yarışabilir                                           |
| Durum makinesi                       | ⚠️ `issue()`/`fail()` ölü kod (**P1-3**); `CANCELLED` erişilemez (**P2-4**)                      |
| Audit izi                            | ❌ **P1-3** finalizasyon hiç domain olayı üretmiyor                                              |
| Hata tipleri                         | ❌ **P1-4** domain'de `BadRequestException` + çıplak `Error`, application'da `NotFoundException` |
| Yetki kapsamı (okuma)                | ✅ klinik bağı kaydın kendisinden (`invoice.clinicId`) doğrulanıyor                              |
| Yutulan hata → retry/backfill        | ❌ **P1-6** üç yerde yutuluyor; yeniden deneme ve "faturası eksik" sorgusu yok                   |
| Mutabakat                            | ⚠️ yalnız _yazılmış_ olaylar taranıyor; hiç kesilmemiş fatura görünmüyor (**P1-6**)              |
| Testler                              | ⚠️ 4 + 7 test var ama **P0-1**'i doğru sanıp sabitliyor (`payment-paid.listener.spec`)           |

### 12.2 P0 — Canlı öncesi kapanmalı

#### P0-1 · Taksitli tahsilatta hasılatın yalnız ilk taksiti faturalanıyor

**Kanıt.** `PaymentPaidEvent` **her taksitte** fırlar
(`payment/application/commands/mark-installment-as-paid/mark-installment-as-paid.handler.ts:41`).
Dinleyici faturalanacak tutarı **o taksitten** alıyor
(`invoice/infrastructure/messaging/events/listeners/payment-paid.listener.ts:43-50`), fatura ise
`payment_id` üzerinde **unique** (`schema/invoice.prisma` — `paymentId String? @unique`). İlk
taksitten sonra `resolveExisting` mevcut faturayı bulup komutu sessizce erken döndürüyor
(`issue-invoice.handler.ts:64-70`, `:234-242`).

**Neden bozuk.** 6 taksitli 60.000 TL'lik tedavide defter şunu görür: `SALES_INVOICE_ISSUED`
bir kez, **10.000 TL** net+KDV ile (600 hasılat + 391 KDV eksik); `PAYMENT_RECEIVED` ise altı
kez, toplam 60.000 TL ile 120 Alıcılar'ı kapatır. Sonuç: hasılat ve KDV matrahı **beşte bir**
kaydedilir, 120 **ters bakiyeye** düşer (alacaklı müşteri cari), KDV beyanı eksik verilir.
Üstelik sonuç **olay sırasına** bağlıdır: randevu önce tamamlanırsa diğer dinleyici ödemenin
**tamamını** faturalar (`appointment-completed.listener.ts:42-54`) ve tutar doğru çıkar. Aynı
veri, hangi olayın önce düştüğüne göre iki farklı fatura tutarı üretiyor.

`payment-paid.listener.spec.ts` bu davranışı ("taksit eşleşmezse ödeme toplamını faturalar",
"tahsil edilen taksit tutarı ile fatura komutu üretir") **doğru kabul edip sabitlemiş** —
tax-parameters P2-2 ile aynı sınıf: hatayı belgeleyen test.

#### P0-2 · Faturanın para birimi muhasebe olayına geçmiyor → yabancı para fatura TRY sanılıyor

**Kanıt.** `issue-invoice.handler.ts:285-291` olay payload'ında `currency` **yok**; oysa
`SalesInvoiceIssuedEventPayload.currency` tanımlı ve "yabancı fatura → fonksiyonel paraya
çevrilir" diye belgeli (`posting/domain/posting/event-payloads.ts:42`). Posting tarafı
`const txCurrency = draft.currency ?? functionalCurrency`
(`post-financial-event.handler.ts:109`) ile **çeviri yapmadan** TRY varsayıyor.

**Neden bozuk.** Fatura `currency` kolonu taşıyor ve tutar ödemenin para biriminden geliyor
(`payment-paid.listener.ts:50`) — sağlık turizminde Stripe tahsilatları **EUR/USD**. 1.000 EUR'luk
fatura deftere **1.000 TRY** olarak düşer: hasılat ~%97 eksik, 120 cari bakiyesi tahsilatla
tutmaz, `original*`/`fxRate` izlenebilirlik kolonları da boş kalır (Model A'nın çeviri yolu hiç
tetiklenmez). Aynı eksik alış faturasında da var (§14 P0-3).

#### P0-3 · e-Belge job'u yeniden denendiğinde entegratöre ikinci belge gönderiliyor

**Kanıt.** İşleyici portu **koşulsuz** çağırıyor ve faturanın mevcut e-belge durumuna hiç
bakmıyor (`e-document/infrastructure/queue/processors/e-document.processor.ts:56-134`); job
`attempts: 5` ile kuruluyor (`producers/e-document.producer.ts:23`); port isteğinde bir
idempotency anahtarı yok (`domain/contracts/e-document.contracts.ts:38-48`); faturaya sonucu
yazan entity metodu da guard'sız (`invoice/domain/entities/invoice.entity.ts:223-234`).

**Neden bozuk.** Sıra şu: port `issue()` **başarılı** (GİB'de belge oluştu) → ardından
`MarkInvoiceEDocumentResultCommand` DB hatasıyla patlar → BullMQ job'u yeniden dener →
`issue()` **tekrar** çağrılır. Aynı fatura için **iki yasal belge** (iki ETTN) oluşur; ikinci
sonuç faturanın numarasını da üzerine yazar, yani sistemdeki numara ile ilk beyan edilen belge
ayrışır. `removeOnComplete: true` olduğu için `jobId` de serbest kalır: elle yeniden tetikleme
aynı kapıyı ikinci kez açar.

### 12.3 P1 — Yakın turda kapatılmalı

#### P1-1 · Kesilmiş faturanın numarası üzerine yazılabiliyor

`applyEDocumentResult` (`invoice.entity.ts:223-234`) durum kontrolü yapmıyor: zaten `ISSUED` ve
numarası basılmış bir faturaya ikinci bir sonuç gelirse `invoiceNumber` **değişir**; `CANCELLED`
bir fatura da `ISSUED`'a geri döner. Ticari belge donmuş olmalıdır. Kilit/`version` de yok
(`mark-invoice-edocument-result.handler.ts:23-35` → `findById` + `update`), yani iki sonuç
yarışırsa son yazan kazanır.

#### P1-2 · Satış faturasında KDV oranı yasal kümeye zorlanmıyor

Oran zinciri `TaxSpecification` üzerinden geçiyor ve orada kabul kümesi **0–100**
(`finance/shared/domain/value-objects/tax-specification.vo.ts:7-10`); `VatRate.create`
(yasal küme: `STATUTORY_VAT_RATES`) satış faturası yolunda **hiç çağrılmıyor**
(`issue-invoice.handler.ts:85-96`). Kardeş modül alış faturasında bu kapı kapalı
(`purchase-invoice.entity.ts:140`). Yani aynı büyüklük iki modülde farklı kabul ediliyor —
tax-parameters P0-1 ile aynı sınıf (CLAUDE.md finans kuralı 12) ve o turda kapatılan kapının
satış tarafındaki eşi.

#### P1-3 · Fatura kesimi hiç domain olayı üretmiyor; `issue()` / `fail()` ölü kod

`Invoice.issue()` ve `Invoice.fail()` hiçbir yerden çağrılmıyor (grep: tek referans entity'nin
kendisi), dolayısıyla `InvoiceIssuedEvent` / `InvoiceFailedEvent` **hiç fırlatılmıyor**.
Gerçek finalizasyon `applyEDocumentResult` içinde, olay fırlatmadan oluyor
(`invoice.entity.ts:230-233`). Sonuç: "fatura ne zaman, hangi tetikleyiciyle kesildi" sorusunun
audit log'da karşılığı yok; `issue()`'nun içindeki `throw new Error(...)` (satır 192) da ölü.

#### P1-4 · Katman ihlali: domain'de HTTP exception'ı, application'da `NotFoundException`

`InvoiceNumber.create` doğrulama hatasını `BadRequestException` ile fırlatıyor
(`domain/value-objects/invoice-number.vo.ts:1,24`) — domain katmanı NestJS'e bağımlı;
`mark-invoice-edocument-result.handler.ts:26` `NotFoundException` kullanıyor; `invoice.entity.ts:192`
çıplak `Error` (→ 500, `errorCode` yok). Tax-parameters P1-3 ile aynı sınıf.

#### P1-5 · Para yolunda `number`

`CreateInvoiceProps.amount` **`number`** (`domain/contracts/invoice/invoice-inputs.contracts.ts:24`)
ve handler Decimal'i `.toNumber()` ile çeviriyor (`issue-invoice.handler.ts:116`); dinleyici de
taksit tutarını `.toNumber()` ile geçiriyor (`payment-paid.listener.ts:46-48`). `netTotal`/`vatTotal`
Decimal iken genel toplamın float olması aynı satırda iki ayrı hassasiyet rejimi demek.

#### P1-6 · Fatura kesilemediğinde ne yeniden deneme ne "faturası eksik" sorgusu var

Üç yerde kritik iş `try/catch` ile yutuluyor: randevu dinleyicisi
(`appointment-completed.listener.ts:55-74`), tahsilat dinleyicisi (`payment-paid.listener.ts:65-83`)
ve e-Belge enqueue (`issue-invoice.handler.ts:186-205`). Üçü de CRITICAL alarm üretiyor ama
**yeniden denemiyor**; kodun kendi yorumu "tekrar denenmiyor, elle müdahale gerekir" diyor.
Mevcut mutabakat yalnız **yazılmış** `financial_event` kayıtlarını tarıyor
(`sweep-unposted-financial-events`) — hiç kesilmemiş fatura orada görünmez. CLAUDE.md finans
kuralı 4: yutulan her kritik iş için ya retry ya **backfill komutu + "eksik kalanlar" sorgusu**.

#### P1-7 · İşlem satırlarının para birimi yok sayılıyor

`AppointmentChargeSummary` kendi `currency`'sini taşıyor ama handler satır tutarlarını
`input.totalAmount.currency` ile Money'e çeviriyor (`issue-invoice.handler.ts:90-96`). Satırlar
EUR, tahsilat TRY ise fatura sessizce yanlış para biriminde kesilir; çapraz kontrol de yok.

### 12.4 P2

| Bulgu                                                                                                 | Kanıt                                                   |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **P2-1** `trigger` alanı hiç kullanılmıyor (yalnız taşınıyor)                                         | `issue-invoice.command.ts:14`                           |
| **P2-2** Ölü `??` dalı + VO/`CurrencyType` karışımı (`currency` zaten non-nullable)                   | `issue-invoice.handler.ts:117-119`                      |
| **P2-3** `toPersistence()` içinde `updatedAt` üretiliyor (yan etki; entity alanı güncellenmiyor)      | `invoice.entity.ts:279`                                 |
| **P2-4** `InvoiceStatus.CANCELLED` erişilemez — iptal/storno yolu yok                                 | `invoice.prisma`, entity'de geçiş yok                   |
| **P2-5** `update()` alan-alan mapping; yeni kolon sessizce düşer, mapping testi yok (kural 9)         | `invoice.command.repository.ts:85-103`                  |
| **P2-6** Unique kısıt `is_deleted`'ı dışlamıyor; soft-delete eklenirse randevu bir daha faturalanamaz | `invoice.prisma`, `invoice.command.repository.ts:26-38` |

---

## 13. `purchase-invoice` — Alış Faturası

Denetim tarihi: **2026-10-10**. Kapsam: entity, `PriceBreakdown` kullanımı, command/query
repository'ler, 3 command (kaydet / siparişe eşleştir / eşleştirmeyi kaldır) + 1 query,
controller'lar, şema (`purchase-invoice.prisma`), `@shared` DTO şeması ve alış faturasının
**dışa dönük sözleşmesi** (`PURCHASE_INVOICE_RECEIVED` → 150/770 + 191 / 320).

Satış faturasının kardeşi ama ters yönlü: belge **dışarıdan** gelir, tutarları kullanıcı girer.
Bu yüzden bulgular ağırlıkla **giriş kapısında** (kabul kümesi, doğal anahtar, denge).

### 13.1 Kontrol listesi sonucu

| Başlık                           | Durum                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| Para tipi / hassasiyet           | ⚠️ **P1-3** DTO `z.number()`, ondalık sınırı yok; `round()` uygulanmıyor                |
| Para birimi                      | ❌ **P0-3** muhasebe olayına `currency` geçmiyor (şema USD/EUR/GBP kabul ediyor)        |
| **İdempotentlik**          | `dedupeKey` + unique kısıt (olay defteri), POS/iyzico callback'leri, outbox at-least-once + idempotent tüketiciler, doğal anahtarlar (alış faturası, kasa oturumu). **§77'den sonra at-least-once gerçek**: teslim artık dinleyici bitince damgalanıyor, hata yukarı fırlıyor ve kayıt sahipleniliyor (iki örnek aynı event'i iki kez yayınlayamaz). |
| net + KDV = genel toplam         | ⚠️ **P1-1** denge handler'da (`PriceBreakdown`), entity'de değil                        |
| KDV tutarı ↔ KDV oranı           | ❌ **P1-2** çapraz doğrulama yok (oran yasal, tutar serbest)                            |
| Negatif/sıfır tutar              | ✅ `nonnegative` + `Money` negatifi reddediyor                                          |
| Eşzamanlılık — eşleştirme        | ✅ `findByIdForUpdate` (satır kilidi) + aynı tx'te sipariş sayacı                       |
| Mutasyon kararını besleyen okuma | ✅ Command Repo                                                                         |
| Dönem kapısı                     | ❌ **P1-4** `invoiceDate` sınırsız; kapalı döneme fatura kabul ediliyor                 |
| Durum makinesi                   | ❌ **P1-6** 5 durum tanımlı, **hiç geçiş yok**; `CANCELLED` dalı ölü                    |
| İptal / storno                   | ❌ **P1-6** yanlış girilen fatura iptal edilemiyor                                      |
| Yetki kapsamı                    | ✅ `actorCanAccessClinicOrOwnsOrganization`, kiracı `clinicId`'den çözülüyor            |
| Audit izi                        | ❌ **P1-5** hiç domain olayı yok; köprü `internalCtx` ile çağrılıyor (aktör kayboluyor) |
| Yutulan hata → retry/backfill    | ❌ **P0-2** köprü hatası yutuluyor, backfill/sorgu yok                                  |
| Testler                          | ❌ modülde **tek test yok**                                                             |

### 13.2 P0 — Canlı öncesi kapanmalı

#### P0-1 · Aynı alış faturası iki kez kaydedilebiliyor (mükerrer gider + mükerrer borç)

**Kanıt.** `purchase_invoices` tablosunda hiçbir unique kısıt yok
(`schema/purchase-invoice.prisma:14-44` — yalnız index'ler); handler her çağrıda **yeni** UUID
üretiyor (`record-purchase-invoice.handler.ts:70`) ve dedupe anahtarı o yeni id'ye bağlı
(`FinancialEventDedupeKeys.purchase_invoice(invoiceId)`); DTO'da idempotency anahtarı yok.

**Neden bozuk.** Tedarikçinin aynı belgesi (aynı `invoiceNumber`) iki kez girilince — çift tıklama,
sekme tekrarı, iki kullanıcı — iki ayrı fatura satırı **ve iki ayrı ekonomik olay** doğar.
Defterde 770/150 gideri iki kez, 320 Satıcılar borcu iki kez yazılır; 191 indirilecek KDV de
mükerrer olur (haksız KDV indirimi). Satış faturasında bu kapı `appointment_id`/`payment_id`
unique kısıtlarıyla kapalı; alış tarafında hiçbir şey kapatmıyor.

#### P0-2 · Muhasebe köprüsü hatası yutuluyor; yeniden deneme de, "köprüsüz fatura" sorgusu da yok

**Kanıt.** `record-purchase-invoice.handler.ts:146-204` — cari garantisi + `PURCHASE_INVOICE_RECEIVED`
olayı `try/catch` içinde; hata CRITICAL alarmla yutulup fatura satırı **commit ediliyor**.
Kodun kendi yorumu bunu kabul ediyor: _"ödenecek tutar defterde eksik görünür, mutabakat da bunu
göstermez."_

**Neden bozuk.** Alış faturası kaydedilir, 320 borç **hiç yazılmaz**. Olay hiç yazılmadığı için
`sweep-unposted-financial-events` (posting P0-4 turunda eklenen süpürme) bunu göremez: o yalnız
yazılmış ama fişlenmemiş olayları tarar. Ödenecek borç defterde eksik, tedarikçi mutabakatı
sessizce yanlış. CLAUDE.md finans kuralı 4 bunun için ya retry ya backfill + eksikler sorgusu
istiyor; ikisi de yok. Üstelik **kardeş modül aynı köprüyü bilinçle yutmuyor** (satış faturasında
hata rollback'e gidiyor, `issue-invoice.handler.ts:244-254`) — aynı sınıf iş için iki zıt politika.

#### P0-3 · Faturanın para birimi muhasebe olayına geçmiyor (ithal fatura TRY sanılıyor)

**Kanıt.** Olay payload'ı `{ partyId, netTotal, vatTotal, grandTotal, lineAccountCode }`
(`record-purchase-invoice.handler.ts:170-176`) — `currency` yok; oysa
`PurchaseInvoiceReceivedEventPayload.currency` tanımlı ve kural onu okuyor
(`posting/domain/posting/rules/purchase-invoice-received.rule.ts:54`). DTO ise USD/EUR/GBP'yi
açıkça kabul ediyor (`record-purchase-invoice.schema.ts:4,33`).

**Neden bozuk.** 1.000 USD'lik ithal fatura deftere 1.000 TRY borç olarak düşer; kur farkı,
`original*`/`fxRate` izi ve KDV matrahı hepsi yanlış. §12 P0-2'nin alış tarafındaki eşi — tek
satırlık eksik, iki modülde.

### 13.3 P1 — Yakın turda kapatılmalı

#### P1-1 · "net + KDV = genel toplam" dengesi entity'de değil, çağıranda

`PurchaseInvoice.create` üç tutarı **bağımsız** alıyor ve hiçbirini diğerine karşı doğrulamıyor
(`purchase-invoice.entity.ts:128-150`); denge yalnız handler'daki `PriceBreakdown.create`
çağrısında (`record-purchase-invoice.handler.ts:72-76`). Varlığın kendi değişmez kuralı
çağrı noktasına bırakılmış (CLAUDE.md finans kuralı 10): entity'yi kullanan ikinci bir yol
(import, migration script, `sync()`) dengesiz fatura yazabilir. Sonucu ağır: posting
`UnbalancedJournalEntryException` ile patlar (`posting/domain/exceptions/posting.exceptions.ts:86`),
olay yazılmış olduğu için süpürme onu sonsuza kadar yeniden dener ve fiş **hiç** üretilemez.

#### P1-2 · KDV tutarı, KDV oranıyla çapraz doğrulanmıyor

`vatRate` yasal kümeden geçiyor (`entity:140`) ama `vatTotal` tamamen serbest: net 1.000 / oran %20 /
KDV 1 TL kabul edilir. Defter dengeli kalır (grand = net + vat) ama **191 indirilecek KDV yanlış**
ve KDV beyanı bozulur. `TaxSpecification` bu kontrolü (±2 kuruş) zaten taşıyor
(`tax-specification.vo.ts:23-31`) ama alış faturası onu kullanmıyor.

#### P1-3 · Kuruş altı girdi, DB'de dengeyi bozuyor

DTO `netTotal`/`vatTotal` için yalnız `z.number().nonnegative()` diyor
(`record-purchase-invoice.schema.ts:31-32`); ondalık basamak sınırı yok ve hiçbir yerde
`Money.round()` çağrılmıyor. Kolonlar `Decimal(12,2)`. net=100,005 / KDV=0,005 girilirse:
bellekte denge tutar (grand=100,01), satır DB'de 100,01 + 0,01 olarak yuvarlanır ve olay payload'ı
`toFixed(2)` ile **100,01 + 0,01 ≠ 100,01** üretir → fiş 1 kuruş dengesiz → kalıcı fişlenemez.
`Money`'nin kendi yorumu bunu söylüyor: satır tutarı olacak her Money `round()`'dan geçmeli.

#### P1-4 · Fatura tarihi sınırsız; kapanmış döneme fatura kabul ediliyor

`invoiceDate: z.coerce.date()` (`record-purchase-invoice.schema.ts:19`) — ne üst ne alt sınır var;
dönem kapısı yalnız posting'de (§6 P0-1 turunda kilitlendi). Kapanmış yıla tarihli bir fatura
kaydedilir, olay yazılır, fişlenemez; kullanıcı **hiçbir hata görmez** ve belge defterde yokken
sistemde var görünür. 2090 tarihli fatura da aynı şekilde kabul edilir.

#### P1-5 · Faturayı kimin girdiği kaybediliyor

Modül hiç domain olayı üretmiyor (kaydet/eşleştir/eşleştirmeyi kaldır — üçü de sessiz) ve köprü
çağrıları **`internalCtx`** ile yapılıyor (`record-purchase-invoice.handler.ts:42,130,160,183`),
yani gerçek aktör ne olayda ne kayıtta damgalanıyor. "Bu borcu kim yazdı" sorusu cevaplanamaz —
CLAUDE.md finans kuralı 7 yüksek etkili finansal işlem için kalıcı damga istiyor.

#### P1-6 · Durum makinesi yok; yanlış girilen fatura iptal edilemiyor

`PurchaseInvoiceStatus` beş değer tanımlıyor (DRAFT / RECORDED / PAID / PARTIALLY_PAID / CANCELLED)
ama **hiçbir geçiş metodu yok**; `create` her zaman `RECORDED` yazıyor (`entity:146`) ve
`matchToOrder` içindeki `CANCELLED` kontrolü (`entity:165`) erişilemez bir dal. Yanlış girilen bir
alış faturası ne iptal edilebiliyor ne storno'lanabiliyor (tek yol DB'den elle silmek — defterle
tutarsızlık üretir). Ödeme durumu da takip edilmiyor. Okunmayan bayrak kolonu güvence değil süstür
(kural 10).

### 13.4 P2

| Bulgu                                                                                                        | Kanıt                                          |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| **P2-1** `sync()` (upsert) hiç kullanılmıyor — create/update disiplinini bypass eden ölü kapı                | `purchase-invoice.command.repository.ts:47-57` |
| **P2-2** Sipariş sayacına para `.toNumber()` ile geçiyor                                                     | `match:64`, `unmatch:56`, `record:110`         |
| **P2-3** `lineAccountCode` serbest string; hesap planında var mı / postable mı yalnız posting'de anlaşılıyor | `record-purchase-invoice.schema.ts:29`         |
| **P2-4** Modülde tek test yok                                                                                | `find … -name '*.spec.ts'` → 0                 |

---

## 14. Uygulanan düzeltmeler (2026-10-10)

### 14.1 `invoice` — satış faturası

| Bulgu                                                | Ne yapıldı                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0-1** Taksitli tahsilatta eksik faturalama        | Tahsilat dinleyicisi artık **ödemenin tamamını** faturalıyor (`payment-paid.listener.ts`). Fatura `payment_id` üzerinde tekil olduğu için ilk taksitte açılır, sonraki taksitler idempotent atlanır; randevu dinleyicisi de aynı tutarı kullandığı için iki tetikleyici **olay sırasından bağımsız** olarak aynı faturayı üretir. Hatalı davranışı sabitleyen iki test yeniden yazıldı.                                                       |
| **P0-2** Para birimi muhasebe olayına geçmiyor       | `SALES_INVOICE_ISSUED` payload'ına `currency` eklendi. Artık EUR/USD fatura posting'de fonksiyonel paraya çevrilir (Model A); eskiden `draft.currency ?? functional` kuralıyla TRY sanılıyordu.                                                                                                                                                                                                                                               |
| **P0-3** e-Belge job retry'ında mükerrer yasal belge | **Gönderim hakkı sahiplenme** (claim) eklendi: `claimForEDocumentDispatch` koşullu tek UPDATE ile `einvoiceStatus` DRAFT→QUEUED çeker; işleyici hakkı alamazsa portu **hiç** çağırmaz. Port hatası → fatura `FAILED` işaretlenir (hak bir daha otomatik sahiplenilemez) + CRITICAL alarm + hata yükseltilir. `EDocumentRequest.idempotencyKey` sözleşmeye eklendi (gerçek adapter'lar sağlayıcı tarafında da tekilleştirir).                  |
| **P1-1** Belge numarası üzerine yazılabiliyor        | `applyEDocumentResult` iki guard kazandı: iptal edilmiş fatura finalize edilemez, basılmış numara değiştirilemez (aynı numara idempotent geçer). Sonuç artık **satır kilidi altında** uygulanıyor (`findByIdForUpdate`).                                                                                                                                                                                                                      |
| **P1-2** KDV oranı yasal kümeye zorlanmıyor          | Oran `VatRate.create` ile `STATUTORY_VAT_RATES` kümesinden geçiyor. `TaxSpecification` jenerik kaldı (0–100; stopaj gibi KDV dışı oranları da taşır) — KDV'ye özgü kümeyi VO zorluyor.                                                                                                                                                                                                                                                        |
| **P1-3** Kesim hiç olay üretmiyor                    | PENDING→ISSUED geçişinde `InvoiceIssuedEvent`, gönderim hatasında `InvoiceFailedEvent` fırlatılıyor; ikisini dinleyen `InvoiceDocumentLifecycleListener` audit log yazıyor. Ölü `issue()` kaldırıldı, `fail()` → `markEDocumentFailed()` olarak gerçek çağırana bağlandı.                                                                                                                                                                     |
| **P1-4** Katman ihlali                               | `InvoiceNumber` VO artık `InvoiceNumberInvalidException` fırlatıyor (`BadRequestException` değil); handler `InvoiceNotFoundException` kullanıyor; çıplak `Error` kalmadı. Yeni kodlar: `INVOICE.NOT_FOUND / INVALID_NUMBER / NUMBER_IMMUTABLE / NOT_FINALIZABLE / CURRENCY_MISMATCH`.                                                                                                                                                         |
| **P1-5** Para yolunda `number`                       | `CreateInvoiceProps.amount` → `Decimal`; handler ve dinleyicideki `.toNumber()` çağrıları kalktı.                                                                                                                                                                                                                                                                                                                                             |
| **P1-6** Yutulan hata için telafi yok                | **Mutabakat sorgusu + backfill komutu** eklendi: `GET /invoices/uninvoiced-payments` (tahsilatı alınmış ama faturası kesilmemiş ödemeler) ve `POST /invoices/backfill`. Aday liste payment modülünden QueryBus ile (`FindCollectedPaymentsQuery`), fatura varlığı kendi tablosundan okunuyor; telafi `IssueInvoiceCommand`'i yeniden dispatch ediyor (idempotent). Tek tahsilatın hatası turu durdurmuyor, başarısızlar gerekçesiyle dönüyor. |
| **P1-7** Satır para birimi yok sayılıyor             | `resolveCurrency` eklendi: satır özeti varsa onun para birimi esas, tahsilatla ayrışırsa `InvoiceCurrencyMismatchException` (kapıda durur).                                                                                                                                                                                                                                                                                                   |
| **P2-1** Ölü `trigger` alanı                         | Komut girdisinden ve `invoice-triggers.ts` sabitinden kaldırıldı (hiçbir yerde okunmuyordu).                                                                                                                                                                                                                                                                                                                                                  |
| **P2-2** Ölü `??` dalı                               | `currency` tek kaynaktan (`resolveCurrency`) geliyor; VO/`CurrencyType` karışımı kalktı.                                                                                                                                                                                                                                                                                                                                                      |
| **P2-3** `toPersistence()` yan etkisi                | `updatedAt` artık entity alanından okunuyor; domain metotları alanı kendileri güncelliyor.                                                                                                                                                                                                                                                                                                                                                    |
| **P2-5** Mapping testi yok                           | `invoice.command.repository.spec.ts`: `create`'in tüm para kolonlarını Decimal yazdığını ve `update`'in para kolonlarına **dokunmadığını** kilitliyor (kural 9).                                                                                                                                                                                                                                                                              |

### 14.2 `purchase-invoice` — alış faturası

| Bulgu                                      | Ne yapıldı                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P0-1** Mükerrer alış faturası            | Doğal anahtar kısıtı: `@@unique([clinicId, supplierId, invoiceNumber])` + migration `20261010090000_purchase_invoice_natural_key` (teşhis sorgusu yorumda). Repo P2002'yi `PurchaseInvoiceDuplicateException`'a (409) çeviriyor. Satış faturasının aksine **kazananın kaydı dönülmüyor**: alış belgesini kullanıcı girer, tutarı farklı olabilir; sessizce kabul etmek yanlış tutarı onaylamak olurdu. |
| **P0-2** Köprü hatası yutuluyor            | `try/catch` kaldırıldı: hata yükselir, fatura kaydı + sipariş eşleştirmesi + olay birlikte rollback olur. Kardeş modülle (satış faturası) aynı politika. Komut doğal anahtar + `dedupeKey` ile idempotent olduğu için çağıran güvenle yeniden deneyebilir.                                                                                                                                             |
| **P0-3** Para birimi olaya geçmiyor        | `PURCHASE_INVOICE_RECEIVED` payload'ına `currency` eklendi (şema USD/EUR/GBP kabul ediyor; ithal fatura artık TRY sanılmıyor).                                                                                                                                                                                                                                                                         |
| **P1-1** Denge çağıranda                   | `PurchaseInvoice.create` artık **kendi** kurallarını zorluyor: genel toplam = net + KDV (`PurchaseInvoiceUnbalancedTotalsException`).                                                                                                                                                                                                                                                                  |
| **P1-2** KDV ↔ oran çapraz doğrulaması yok | `assertVatMatchesRate`: beyan edilen KDV, matrah × oranla ±1 kuruş içinde uyuşmalı (`PurchaseInvoiceVatMismatchException`). Tolerans matrah yuvarlamasından doğan sapma kadar; daha geniş tolerans gerçek hatayı geçirirdi.                                                                                                                                                                            |
| **P1-3** Kuruş altı girdi                  | Entity 2 ondalık sınırını zorluyor (`PurchaseInvoiceInvalidPrecisionException`); DTO şeması da `.multipleOf(0.01)` ile daraltıldı (kapı kullanım yerinden geniş olamaz).                                                                                                                                                                                                                               |
| **P1-4** Belge tarihi sınırsız             | Gelecek tarihli fatura reddediliyor (`PurchaseInvoiceInvalidDateException`). Kapalı döneme fatura kabulü **ertelendi** — bkz. §15.                                                                                                                                                                                                                                                                     |
| **P1-5** Aktör izi kayboluyor              | Köprü çağrıları artık gerçek `ctx` ile yapılıyor (`internalCtx` değil) ve entity `PurchaseInvoiceRecordedEvent` fırlatıyor; `PurchaseInvoiceRecordedListener` audit log yazıyor (`LogAction.PURCHASE_INVOICE_RECORDED`).                                                                                                                                                                               |
| **P2-1** Ölü `sync()` upsert               | Kaldırıldı (create/update disiplinini bypass eden, hiç çağrılmayan kapı).                                                                                                                                                                                                                                                                                                                              |

### 14.3 Testler

| Dosya                                                     | Ne kilitler                                                                                                                                                                             |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payment-paid.listener.spec.ts` (yeniden yazıldı, 4 test) | **P0-1**: ödemenin tamamı faturalanıyor, hangi taksitin olayı düşerse düşsün tutar aynı; para birimi taşınıyor                                                                          |
| `issue-invoice.spec.ts` (+4 test)                         | **P0-2** olay payload'ında `currency`; **P1-2** %8 oran reddediliyor; **P1-5** tutarlar Decimal; **P1-7** satır/tahsilat para birimi uyuşmazlığı; satır varsa tutar satırlardan türüyor |
| `invoice.entity.spec.ts` (yeni, 8 test)                   | **P1-1** numara değişmezliği + idempotent aynı numara + iptal edilmişin dirilmemesi; **P1-3** kesim/hata olayları; REJECTED sonucun yine finalize etmesi                                |
| `invoice.command.repository.spec.ts` (yeni, 6 test)       | **P0-3** claim yalnız DRAFT'ı hedefler / alınamazsa `false`; kural 9 mapping kilidi; P2002 → tipli hata                                                                                 |
| `e-document.processor.spec.ts` (+4 test)                  | **P0-3**: hak alınamazsa port **hiç** çağrılmaz, claim port'tan ÖNCE, `idempotencyKey` geçer, port hatasında FAILED + alarm + hata yükselir                                             |
| `backfill-missing-invoices.spec.ts` (yeni, 3 test)        | **P1-6**: eksikler yeniden faturalanıyor, tek hata turu durdurmuyor, eksik yoksa dispatch yok                                                                                           |
| `purchase-invoice.entity.spec.ts` (yeni, 12 test)         | **P1-1/2/3/4**: denge, KDV↔oran (+1 kuruş toleransı), kuruş hassasiyeti, gelecek tarih, yasal oran kümesi; **P1-5** kayıt olayı; eşleştirme guard'ları                                  |
| `record-purchase-invoice.spec.ts` (yeni, 6 test)          | **P0-2** köprü hatası yükseliyor; **P0-3** olayda `currency`; **P1-5** gerçek aktör ctx'i; mükerrer belge hatası yutulmuyor; sipariş eşleştirmesi köprüden önce                         |

`tsc` 0; finans + seed/DI suite'leri **64 suite / 399 test** yeşil.

**Migration (kullanıcı uygular):** `20261010090000_purchase_invoice_natural_key`. Mevcut veride
aynı `(clinic_id, supplier_id, invoice_number)` üçlüsü birden fazla satırda varsa **hata verir**;
migration yorumundaki teşhis sorgusu çalıştırılıp mükerrer kayıtlar temizlenmelidir. Hangi
satırın kalacağı ve mükerrer fişin storno'lanıp lanmayacağı **muhasebe kararıdır** — otomatik
silme yapılmaz.

---

## 15. Bilinçli yapılmayanlar — `invoice` / `purchase-invoice`

| Konu                                                                            | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fatura iptali / storno akışı (iki modülde)** ✅ **KAPANDI (§47)**             | `InvoiceStatus.CANCELLED` ve `PurchaseInvoiceStatus.CANCELLED` hâlâ erişilemez; yanlış kesilmiş fatura yalnız muhasebe tarafında storno'lanabiliyor (`reverse-journal-entry`), belge kaydı `ISSUED`/`RECORDED` kalıyor. Bunu kapatmak tek bir durum geçişi eklemek değil: belge iptali e-Belge tarafında da iptal (`EInvoicePort.cancel`), ters kayıt ve iade tavanıyla koordine olmalı; `purchase-invoice` tarafında ayrıca sipariş sayacı ve stok girişi geri alınmalı. Ayrı bir tur ister (doc 04 §storno + doc 07 §iptal birlikte). **Tetikleyici:** canlıda ilk hatalı fatura; ya da e-Belge entegratörü devreye alınırken (iptal penceresi mevzuatla sınırlı). **§57 taramasında ölçüldü:** belge iptali turu (§47) iki modülde de durum geçişini, e-Belge iptal bildirimini ve ters kaydı kurdu. |
| **Alış faturası ödeme durumu (`PAID` / `PARTIALLY_PAID`)**                      | Enum'da duruyor ama hiçbir geçiş yok; tedarikçiye ne kadar ödendiği bugün yalnız defterden (320 bakiyesi) okunuyor ve `record-supplier-payment` akışı bunu zaten yazıyor. Belge üzerinde ikinci bir sayaç tutmak, defterle ayrışabilen ikinci bir doğruluk kaynağı yaratır. **Tetikleyici:** tedarikçi bazlı vade/yaşlandırma raporu istenirse — o zaman sayaç değil, defterden türeyen bir read-model doğru cevap.                                                                                                                                                                                                                                                                                                                                                                                     |
| **Dönem kapısının fatura kapısına taşınması** ✅ **KAPANDI (2026-10-11)**       | Erteleme gerekçesi "`assertPeriodOpenAt` servisi yok ve onu tek kullanım için açmak dönem modülünün sözleşmesini tek çağrı üzerinden tasarlamak olur" idi; tetikleyici olarak **ikinci bir tüketici** belirlenmişti. §34 P1-2'de üç tüketici çıktı (alış faturası `invoiceDate`, satıcı ödemesi `paidAt`, bordro `accrualDate`) ve servis üçüyle birlikte tasarlandı: `PERIOD_GATE_SERVICE.assertPeriodNotSealedAt` — bkz. §36.                                                                                                                                                                                                                                                                                                                                                                         |
| **e-Belge `FAILED` durumundan çıkış (elle yeniden kuyruğa alma)**               | Gönderim hatası artık faturayı `FAILED` işaretliyor ve gönderim hakkı bir daha **otomatik** sahiplenilemiyor (mükerrer yasal belge riski kasıtlı olarak elde kalan belgeye tercih edildi). Elle yeniden deneme ucu yok: operatörün önce entegratörde belgenin oluşup oluşmadığını doğrulaması gerekir, bu da adapter'ın `getStatus` çağrısına bağlıdır ve Noop adapter'da anlamsızdır. **Tetikleyici:** gerçek entegratör adapter'ı yazılırken — `getStatus` ile doğrula, sonra `requeue` komutu ekle.                                                                                                                                                                                                                                                                                                  |
| **Alış faturası eşleştirme/koparma için audit olayı**                           | `matchToOrder` / `unmatchFromOrder` hâlâ olay üretmiyor. İkisi de para yazmıyor (yalnız sipariş bağı kuruyor) ve sipariş tarafındaki sayaç değişimi `purchasing` modülünün kendi olaylarıyla izleniyor. Kayıt (borç yazan) işlemi için olay eklendi; bağ değişikliği için ikinci bir olay zinciri, izlenen değerle kıyaslandığında bakım maliyeti fazla. **Tetikleyici:** sipariş-fatura mutabakatında "bu bağ ne zaman koptu" sorusu operasyonda sorulursa.                                                                                                                                                                                                                                                                                                                                            |
| **Sipariş sayacına para `.toNumber()` ile geçiyor** ✅ **KAPANDI (2026-10-12)** | Tetikleyici `purchasing` denetim turuydu; o tur yapıldı: `ApplyInvoiceToPurchaseOrderCommand` / `RevertInvoiceFromPurchaseOrderCommand` artık kuruş ölçeğinde ondalık **string** alıyor, üç çağıran `toFixed(2)` gönderiyor — bkz. §39 (P2-2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **KDV oranı kolonlarının `Decimal(5,2)`'ye taşınması**                          | §11'de verilen karar değişmedi: yazma kapıları yasal kümeyi (tamsayı) zorladığı için `Int` kolonlara ondalık düşemiyor. Satış faturası bu turda aynı kümeye bağlandı, yani çelişki daha da daraldı. **Tetikleyici:** yasal bir orana ondalık gelirse.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

---

## 16. `payment` — Tahsilat / Taksit

Denetim tarihi: **2026-10-10**. Kapsam: `Payment` aggregate (ödeme + taksit satırları),
4 durum geçişi komutu, 2 oluşturma komutu, 6 query, repo'lar, kurallar (`PaymentRules`),
olaylar/yayıncı, raporlar (AR aging + hekim cirosu), `@shared` şemaları, şema (`finance.prisma`).

> **Durum (2026-10-10):** §16'daki bulgular **kayıt** olarak duruyor. Hangisinin nasıl
> kapatıldığı §18.1'de; kasıtlı olarak yapılmayanlar §19'da.

### 16.1 Kontrol listesi sonucu

| Başlık                                 | Durum                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| Tutarlar `Decimal`                     | ✅ entity/VO `Money`; DB `Decimal(10,2)`                                                    |
| Para birimi her satırda                | ⚠️ kayıtta var, **raporlarda yok** (**P1-4**)                                               |
| Yuvarlama / kuruş sınırı               | ❌ **P1-3** kuruştan ince tutar kabul ediliyor (taksit toplamı ↔ ana tutar diskte ayrışır)  |
| Negatif/sıfır guard                    | ✅ `Money` negatifi ve NaN'ı reddediyor                                                     |
| İdempotentlik — tahsilat bildirimi     | ❌ **P1-1** tekrarlanan callback mükerrer event üretiyor                                    |
| Eşzamanlılık — kilitli okuma           | ✅ `findByInstallmentIdForUpdate` + `outboxRun`                                             |
| Durum makinesi — taksit                | ❌ **P0-4** geçiş guard'ı **yok** (iade→tahsil, tahsil→başarısız, mükerrer iade mümkün)     |
| Durum makinesi — ödeme durumu türetimi | ⚠️ her metotta kopya mantık; `recalculate...` ölü kod (**P2-1**)                            |
| İade — tahsilat önkoşulu               | ❌ **P0-3** kural her zaman reddediyor / `systemOverride`'da hiç kontrol yok                |
| İade — kümülatif tavan                 | ⚠️ taksit bazlı doğal tavan (tam iade); kısmi tutar iadesi yok (§19)                        |
| Dış sağlayıcı                          | — (POS/iyzico turunda)                                                                      |
| Kritik event `outboxRun`               | ✅ tahsilat/iade/başarısızlık outbox'ta                                                     |
| Tüketici idempotentliği                | ⚠️ ledger kuyruğu `installmentId` ile tekil; mükerrer event'in kaynağı kapatıldı (**P1-1**) |
| Yetki — rapor kapsamı                  | ✅ `canAccessClinicFinances` + capability                                                   |
| Yetki — tahsilat/iade kaydı            | ⚠️ komutlar aktör taşımıyordu (**P1-2**)                                                    |
| **Audit izi**                          | ❌ **P1-2** tahsilat ve **iade** için audit log yazan dinleyici **yok**                     |
| Kimlik eşlemesi                        | ❌ **P0-1** `patientId` yanlış VO; **P0-2** `appointmentId` = `clinicId`                    |
| Mutabakat raporu                       | ✅ `findCollectedPayments` (fatura eksiği taraması, invoice turunda eklendi)                |
| Kalıcı testler                         | ⚠️ yalnız iade durum türetimi; geçiş guard'ları ve mapping test edilmemiş                   |

### 16.2 Bulgular

**P0-1 — `patientId` Firebase UID olarak modellenmiş; her ödeme okuması patlar.**
`payment.entity.ts` ctor'u `FirebaseUid.create(data.patientId).orThrow()` çağırıyordu;
`Patient.id` ise **UUID** (`patient.prisma`: `id String @id` + ayrı, nullable `firebaseUid`
kolonu — `patient.entity.ts:299` `UUID.createOrGenerate`). Firebase UID şeması "tam 28
alfanümerik" dayattığı için 36 karakterlik UUID reddediliyor: `findById` /
`findByInstallmentIdForUpdate` **her çağrıda** `InvalidFirebaseUidException` atıyor →
tahsil/iade/iptal yolunun tamamı kapalı. Entity testi bu hatayı doğrulamak yerine ona
uyarlanmıştı (28 karakterlik sahte `patientId` sabiti).

**P0-2 — `appointmentId` kliniğin kimliğiyle doldurulmuş.**
`Payment.create` içinde `appointmentId: UUID.create(props.clinicId).instance?.value ?? null`
— kopyala/yapıştır hatası. `payments.appointment_id` **tekil** (`@unique`) ve Appointment'a
**FK**: değer her zaman dolu (clinicId) ve karşılığı olmadığı için insert FK ihlaliyle
düşüyor; FK olmasaydı aynı klinikteki ikinci ödeme unique ihlali alacaktı. `props.appointmentId`
ise hiç kullanılmıyordu → randevu-ödeme bağı (ve ona bağlı faturalama) kurulamıyor.

**P0-3 — `canRefund` / `canCancel` koşulu Guard _nesnesini_ değerlendiriyor.**
`payment.rules.ts` `!this.payment.validate.status.isCompleted` yazıyordu; `validate.status.*`
alanları `Guard<boolean>` **nesnesi** döndüğü için `!nesne` daima `false` →
`evaluate(false)` → kural "asla geçerli değil". Sonuç çift taraflı: (a) normal aktör hiçbir
ödemeyi iade/iptal **edemiyor**, (b) `systemOverride` taşıyan aktör (iç akış/webhook,
`EntityPolicy.getValidateOptions` → `isSystem()`) için kural hiç değerlendirilmediğinden
**hiçbir** kontrol kalmıyor. Ayrıca `canRefund`'ın yazılı koşulu kendi hata mesajının tersi
("iptal edilmiş veya bekleyen ödemeler iade edilemez" derken `!isCompleted` istiyordu);
ölü `assertCompleted` private metodu asıl niyeti gösteriyordu.

**P0-4 — Taksit durum geçişlerinin guard'ı yok.**
`completeInstallment` / `refundInstallment` / `failInstallment` / `cancelInstallment`
yalnız "taksit var mı" kontrol ediyordu. Mümkün olanlar:

- **iade edilmiş taksit yeniden tahsil** → aynı para ikinci kez gelir yazılır;
- **tahsil edilmemiş taksit iade** → defterde karşılığı olmayan ters kayıt (gelir eksiği);
- **mükerrer iade** → `PaymentRefundedEvent` ikinci kez → `RefundLedgerEntries` iki kez;
- **tahsil edilmiş taksit "başarısız"** → durum `PENDING`, `paidAt` yerinde kalıyor: taksit
  açık alacak sayılırken defterde tahsilat duruyor (rapor ↔ defter kalıcı çelişki).

**P1-1 — Tekrarlanan tahsilat bildirimi mükerrer event üretiyor.**
`completeInstallment` zaten COMPLETED taksitte sessizce dönüyordu ama handler
`paymentPaid` event'ini **koşulsuz** yayınlıyordu (`mark-installment-as-paid.handler.ts:41`).
POS/sanal POS callback'i iki kez geldiğinde: ikinci cari kayıt işi kuyruğa giriyor
(`PaymentCompletedListener`) ve fatura kesme denemesi tekrar koşuyor.

**P1-2 — Para hareketlerinin audit izi yok.**
`PaymentPaidEvent` / `PaymentRefundedEvent` / `PaymentFailedEvent` baştan beri `IAuditLog`
alanları taşıyor ama **hiçbir dinleyici** `AuditLogService`'e yazmıyordu (yalnız
finance-ledger ve invoice dinleyicileri var). Yani "bu parayı kim, ne zaman, hangi kanaldan
iade etti" sorusunun kalıcı yanıtı yok; iade için kayıtta damga bile yok. Ayrıca
`MarkInstallmentAsPaid/Failed` komutları `ctx` taşımadığı için aktör bilgisi zincire hiç
girmiyordu ve `PaymentPaidEvent`/`PaymentFailedEvent` ctor'ları `actorId`'yi `super`'e
geçirmiyordu.

**P1-3 — Kuruştan ince tutar kabul ediliyor.**
`CreatePaymentSchema.amount` yalnız `positive()`; `InstallmentPlanItem.amount` düz `number`.
333,333 ₺ × 3 bellekte 999,999 ediyor ve `Payment.create`'in "taksitler toplamı = ana tutar"
invariant'ı geçiyor; DB `Decimal(10,2)` olduğu için satırlar 333,33 (toplam 999,99) ve ana
tutar 1000,00 olarak yazılıyor → invariant **diskte** bozuluyor.

**P1-4 — Raporlar para birimlerini topluyor.**
`arAging` tek bir `_sum(amount)` ile tahsilat toplamı üretiyor, `providerRevenue` satırları
para birimi taşımıyordu; sağlık turizmi klinikleri aynı kasada TRY ve EUR tahsil ettiği için
(iyzico TRY + Stripe EUR/USD) 1.000 EUR + 1.000 TRY yönetime **2.000** olarak görünüyordu.
`collectionRate` de aynı sebeple anlamsızlaşıyordu.

**P1-5 — `payment-plan` komutu sözleşmeyi bozuyordu.** `CreatePaymentPlanCommandResponse = {}`
ve handler `savedPayment.id` (UUID **VO**'su) döndürüyordu: create komutları ham `id` döner
(CLAUDE.md). Ayrıca `crypto.randomUUID()` kullanılıyordu (`UUID.generate()` değil).

**P2-1 — Ölü/ikiz durum mantığı.** `recalculateStatusAfterInstallmentChange` hiç
çağrılmıyordu ve metot başına kopyalanmış sayaçlardan sapmıştı.
**P2-2 — `getCompletedInstallments`** `!!dizi` ile guard kuruyordu (dizi daima truthy) ve
hiçbir yerden çağrılmıyordu.
**P2-3 — Boş ölü dosya** `domain/repositories/payment.repository.interface.ts` (0 bayt).
**P2-4 — `updateMany`** hiç çağrılmıyordu ve `payment.upsert` ile "update asla upsert yapmaz"
kuralını ihlal ediyordu.
**P2-5 — Entity ham `Error` fırlatıyordu** (taksit bulunamadı) → 500; tipli
`InstallmentNotFoundException` zaten mevcuttu.

---

## 17. `payment-gateway` — Klinik Ödeme Altyapısı (iyzico alt üye işyeri)

Denetim tarihi: **2026-10-10**. Kapsam: entity, kontratlar, repo'lar, 1 command + 1 query,
controller'lar, iyzico sağlayıcı sözleşmesi.

### 17.1 Kontrol listesi sonucu

| Başlık                     | Durum                                                                          |
| -------------------------- | ------------------------------------------------------------------------------ |
| Yetki — klinik kapsamı     | ✅ `actorCanManageTargetClinic` + `CLINICPAYMENTGATEWAY.update` capability     |
| Yetki — okuma              | ✅ `canAccessClinicFinances` + serileştirme grupları                           |
| Hassas veri                | ✅ IBAN/kimlik no yerelde **saklanmıyor** (iyzico'ya iletiliyor)               |
| **Audit izi**              | ❌ **P0-1** hak edişlerin yatacağı hesap değişiyor, hiçbir kalıcı iz yok       |
| Dış sağlayıcı — kısmi hata | ❌ **P1-1** dış kayıt açıldıktan sonra yerel yazma düşerse kurtarma yolu yok   |
| İdempotentlik              | ⚠️ yerel yazma doğal anahtarla (`clinicId`) upsert; dış çağrı değil (**P1-1**) |

### 17.2 Bulgular

**P0-1 — IBAN değişikliğinin hiçbir izi yok.**
`RegisterClinicSubMerchantDto` **IBAN + kimlik numarası** taşıyor ve bu çağrı kliniğin
marketplace hak edişlerinin **yatacağı hesabı** belirliyor. Kayıtta IBAN tutulmadığı
(iyzico'ya iletilip bırakıldığı) için değişiklik hiçbir yerde görünmüyordu: ne event, ne
kolon, ne audit log — `CLINIC_EVENTS.REGISTER_SUBMERCHANT` yalnız yetki hatası etiketi
olarak kullanılıyordu. `update` capability'si olan bir aktör ödemeleri başka bir hesaba
yönlendirip iz bırakmadan çıkabilirdi (CLAUDE.md finans kuralı 7: yüksek etkili işlem
**kalıcı damga** ister).

**P1-1 — Dış kayıt başarılı + yerel yazma başarısız = kalıcı çıkmaz.**
`createSubMerchant` transaction dışında (doğru) çağrılıyor, sonra sonuç yazılıyor. Yazma
düşerse (tx hatası, süreç ölümü) anahtar kayboluyor; sonraki deneme yerelde kayıt
bulamadığı için yine `create` çağırıyor ve iyzico aynı `subMerchantExternalId` için
"zaten kayıtlı" hatası veriyor → klinik elle müdahale olmadan bir daha kurulamıyor.
Sağlayıcı sözleşmesinde `retrieve` ucu yoktu (SDK'da var: `subMerchant.retrieve`).

---

## 18. Uygulanan düzeltmeler (2026-10-10, 2. tur)

### 18.1 `payment`

| #        | Düzeltme                                                                                                                                                                                                                                                                                         | Dosya                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1     | `patientId` → `UUID` (ctor + `create` + `toPersistence`); `FirebaseUid` bağımlılığı kaldırıldı                                                                                                                                                                                                   | `domain/entities/payment.entity.ts`                                                                                                                                              |
| P0-2     | `appointmentId` artık `props.appointmentId`'den geliyor; regresyon testiyle kilitlendi                                                                                                                                                                                                           | `payment.entity.ts`, `payment.entity.spec.ts`                                                                                                                                    |
| P0-3     | `validate.status.*` **düz boolean** döner (Guard nesnesi dönen 5 private yüklem silindi); `canRefund` = "COMPLETED ∨ PARTIAL", `canCancel` = "¬COMPLETED ∧ ¬REFUNDED"; ölü `assertCompleted` silindi                                                                                             | `domain/rules/payment.rules.ts`, `payment.entity.ts`                                                                                                                             |
| P0-4     | Taksit geçiş guard'ları entity'de (politika **değil**, invariant → `systemOverride` atlayamaz): tahsil yalnız PENDING/OVERDUE'dan, iade yalnız COMPLETED'dan, "başarısız" yalnız tahsil edilmemişten; iptal tahsil/iade edilmişte yasak. Tekrarlanan tahsilat/iade bildirimi **event'siz no-op** | `payment.entity.ts` + 4 yeni tipli istisna                                                                                                                                       |
| P1-1     | `PaymentPaidEvent` artık entity'de, **yalnız gerçek geçişte** fırlıyor; handler'ın koşulsuz publish'i kaldırıldı. `PaymentFailedEvent` de entity'ye taşındı (+ `installmentId` alanı)                                                                                                            | `payment.entity.ts`, `mark-installment-as-paid.handler.ts`, `mark-installment-as-failed.handler.ts`                                                                              |
| P1-2     | `PaymentLifecycleListener` (PAID/REFUNDED/FAILED → `AuditLogService`); `MarkInstallmentAsPaid/Failed` komutları `payload{installmentId, details?, ctx}` oldu ve aktörü entity'ye taşıyor; `actorId` artık event `super`'ine geçiyor                                                              | yeni `infrastructure/messaging/events/listeners/payment-lifecycle.listener.ts`, `payment-event.module.ts`, komut/handler'lar, `payment-paid.event.ts`, `payment-failed.event.ts` |
| P1-3     | `Payment.create` kuruş hassasiyetini zorluyor (`decimalPlaces() > 2` → `PaymentInvalidPrecisionException`); `@shared` şemalarına `.multipleOf(0.01)`                                                                                                                                             | `payment.entity.ts`, `create-payment.schema.ts`, `init-checkout-form.schema.ts`                                                                                                  |
| P1-4     | Raporlar **para birimi başına**: `arAging` `groupBy(currency)`, satırlar `currency` taşıyor; `ArAgingReport.summary` → `summaries[]`, `ProviderRevenueReport.totalCollected` → `totals[]`; DTO'lar güncellendi                                                                                   | `payment.query.repository.ts`, `payment-queries.contracts.ts`, 2 handler + 2 response + `payment-response.dto.ts`                                                                |
| P1-5     | `CreatePaymentPlanCommandResponse = string`; handler `id.value` döner; `UUID.generate()`                                                                                                                                                                                                         | `create-payment-plan.*`                                                                                                                                                          |
| P2-1     | Durum türetimi tek metotta (`recalculateStatusAfterInstallmentChange`) ve 4 geçişin tamamı onu çağırıyor                                                                                                                                                                                         | `payment.entity.ts`                                                                                                                                                              |
| P2-2/3/4 | `getCompletedInstallments`, boş `payment.repository.interface.ts`, `updateMany` silindi                                                                                                                                                                                                          | —                                                                                                                                                                                |
| P2-5     | Taksit bulunamadı → `InstallmentNotFoundException`                                                                                                                                                                                                                                               | `payment.entity.ts`                                                                                                                                                              |
| —        | Yayıncı sözleşmesi daraltıldı: `paymentPaid/paymentFailed/paymentRefund` kaldırıldı (event'in tek kaynağı entity; mükerrer ters kayıt bu yüzden iki kez koşuyordu)                                                                                                                               | `payment-event-publisher.interface.ts`, `payment-event-publisher.service.ts`                                                                                                     |

### 18.2 `payment-gateway`

| #    | Düzeltme                                                                                                                                                                                                                                                                                                                         | Dosya                                                                                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1 | `ClinicPaymentGatewayRegisteredEvent` entity'de raise ediliyor (kuruldu/güncellendi ayrımı, **maskeli IBAN** = son 4 hane, aktör/kanal) + `ClinicPaymentGatewayRegisteredListener` → audit log. Yeni `LogAction.PAYMENT_GATEWAY_REGISTERED`. Tam IBAN ve kimlik numarası bilerek **taşınmıyor** (KVKK) — test bunu da kilitliyor | yeni `domain/events/`, yeni `infrastructure/messaging/`, `clinic-payment-gateway.entity.ts`, `clinic-payment-gateway.contracts.ts`                      |
| P1-1 | Kurtarma yolu: yerel kayıt yoksa **önce** `retrieveSubMerchant(clinicId)` sorulur; dönerse `update`, dönmezse `create` → akış dış kimlikte idempotent. `IIyzicoProvider.retrieveSubMerchant` + client/adapter eklendi                                                                                                            | `register-clinic-payment-gateway.handler.ts`, `iyzico.provider.interface.ts`, `iyzico.client.ts`, `iyzico.provider.ts`, `create-submerchant.request.ts` |

### 18.3 Eklenen/güncellenen testler

| Dosya                                                                                          | Kapsam                                                                                                                                       |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `payment/domain/entities/payment.entity.spec.ts` (yeniden yazıldı, 19 test)                    | kimlik eşlemesi (appointmentId/patientId), kuruş sınırı, tahsilat event'inin tekliği, iade/tahsil/iptal/başarısız guard'ları, durum türetimi |
| `payment/domain/rules/payment.rules.spec.ts` (yeni, 8 test)                                    | `canRefund`/`canCancel` doğruluk tablosu + Guard-nesnesi regresyonu + "override politikayı atlar, invariant'ı atlamaz"                       |
| `payment/infrastructure/.../payment.command.repository.spec.ts` (yeni, 4 test)                 | mapping kilidi (para kolonları + `appointmentId`), `update` tutarlara dokunmaz, kilit sırası                                                 |
| `payment/application/queries/get-ar-aging/get-ar-aging.spec.ts` (yeni, 3 test)                 | para birimi başına özet/kova/hasta kırılımı + vade                                                                                           |
| `payment/application/queries/get-provider-revenue/get-provider-revenue.spec.ts` (yeni, 2 test) | hekim+para birimi kırılımı, atanmamış grubun sırası                                                                                          |
| `payment-gateway/.../register-clinic-payment-gateway.spec.ts` (yeni, 4 test)                   | create/retrieve/update yolları + denetim event'i + IBAN/kimlik no sızmaması                                                                  |
| `mark-installment-as-paid\|failed.handler.spec.ts` (yeniden yazıldı)                           | event sahipliği entity'de; aktör entity'ye taşınıyor                                                                                         |
| `handle-payment-callback.handler.spec.ts`                                                      | yeni komut payload'ı + iç bağlam aktörü                                                                                                      |

**Doğrulama:** `tsc --noEmit` 0 hata; `jest` **168 suite / 1028 test** yeşil
(`app.module.spec` dahil → yeni dinleyiciler ve modüller DI grafiğinde ayakta).
**Migration gerekmedi** (şema değişikliği yok).

---

## 19. Bilinçli yapılmayanlar — `payment` / `payment-gateway`

| Konu                                                                         | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kısmi tutar iadesi (taksitin bir kısmı)**                                  | İade bugün taksit granülerliğinde: tavan doğal olarak taksit tutarı ve mükerrer iade artık imkânsız. Tutar bazlı kısmi iade, taksit satırında kümülatif `refundedAmount` kolonu + tavan kontrolü + kısmi ters kayıt ister (defter tarafı da satır bölmeyi bilmiyor). **Tetikleyici:** operasyonda "şu 1.000 ₺'nin 300'ünü iade et" talebi; o zaman kolon + tavan + posting kuralı birlikte tasarlanır.                                                                                                                                                                                                                                   |
| **POS/webhook aktörünün gerçek kullanıcıya bağlanması** ✅ **KAPANDI (§57)** | `MarkInstallmentAsPaid/Failed` artık `ctx` taşıyor ama POS çağrı yerleri (8 handler) iç bağlam (`SYSTEM`) geçiyor; tahsilatı fiilen bildiren terminal callback'i olduğu için bu **doğru** ve personel kimliği POS işlem kaydında duruyor. Zinciri uçtan uca taşımak `pos/physical` sözleşmesini değiştirmek demek. **Tetikleyici:** `pos` denetim turu (§2 tablosunda sırada). **§57'de ölçüldü ve bu notun gerekçesi ÇÜRÜK çıktı:** "personel kimliği POS işlem kaydında duruyor" cümlesi doğru değildi — `pos_transactions` tablosunda aktör kolonu **hiç yoktu**. §57 `initiated_by_id` kolonunu + ters kayıt denetim olayını ekledi. |
| **`InstallmentStatus.OVERDUE`'yu yazan otomasyon**                           | Enum'da ve yaşlandırma sorgusunda duruyor ama hiçbir kod `OVERDUE` yazmıyor; rapor zaten `dueDate` üzerinden vadeyi hesapladığı için **sonuç doğru**. Durumu materyalize etmek (gece işi) ikinci bir doğruluk kaynağı yaratır. **Tetikleyici:** "vadesi geçmiş taksit" üzerinden tetiklenen bir iş akışı (otomatik hatırlatma/faiz) istenirse.                                                                                                                                                                                                                                                                                           |
| **İade sonrası dış sağlayıcı ↔ yerel durum mutabakatı**                      | iyzico iade SDK çağrısı başarılı olup yerel yazma düşerse para geri gitmiş, taksit `COMPLETED` kalmış olur (gelir fazla raporlanır). Bu `pos/virtual` akışının içinde (claim/mutabakat taraması oraya ait) ve payment tarafı artık mükerrer iadeyi reddediyor. **Tetikleyici:** `pos/virtual` denetim turu.                                                                                                                                                                                                                                                                                                                              |
| **Rapor sorgularında `paginate`**                                            | `arAging` / `providerRevenue` sayfalamasız `findMany` kullanıyor (CLAUDE.md istisnası: bunlar liste değil toplama girdisi). Büyük kliniklerde satır sayısı artarsa bellek baskısı doğar; doğru çözüm sayfalama değil **DB tarafında gruplama** (`groupBy` + vade kovası SQL'i). **Tetikleyici:** tek klinikte açık taksit sayısı ~10⁵'e yaklaşırsa.                                                                                                                                                                                                                                                                                      |
| **`payment` modülünde dönem kapısı**                                         | Tahsilat kapanmış döneme tarihli olamıyor (tahsilat anı `now`), bu yüzden kapı gerekmiyor; iade tarihi de `now`. **Tetikleyici:** geriye dönük tarihli tahsilat girişi (elle kasa düzeltmesi) eklenirse.                                                                                                                                                                                                                                                                                                                                                                                                                                 |

---

## 20. `pos/physical` + `pos/virtual` — POS (Fiziksel Terminal / Sanal POS)

Denetim tarihi: **2026-10-11**. Kapsam: `PosTransaction` + `PosDevice` +
`ClinicIyzicoTerminalConfig` + `IyzicoTransaction` aggregate'leri, 13 fiziksel +
4 sanal komut, mutabakat işi (BullMQ, 5 dk), callback uçları, sağlayıcı
servisleri (PAX TCP / iyzico Terminal HTTP / iyzico checkout), `@shared`
şemaları, şema (`pos.prisma`, `finance.prisma`).

> **Önceki tur:** iptal/iade bağı, iptal kilidi (`activeVoidOriginalId`) ve
> kümülatif iade tavanı 2026-08-13 eşzamanlılık turunda kapatıldı
> (`documents/concurrency-followups.md` §1). Bu tur **o turun kapsamadığı**
> başlıklara bakar: callback güvenliği, tutar eşleşmesi, sağlayıcı kısmi
> hataları, mutabakat kapsamı, köprü telafisi, denetim izi.

### 20.1 Kontrol listesi sonucu

| Başlık                           | Durum                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Tutarlar `Decimal`               | ⚠️ entity/VO `Money`, ama `pax-sale` cihaza giden tutarı `Math.round(amount*100)` ile hesaplıyordu (**P2-1**)  |
| Kuruş sınırı                     | ❌ **P1-5** şemalarda ve entity'de hassasiyet guard'ı yok                                                      |
| Para birimi                      | ✅ işlem satırında açık (`currency`)                                                                           |
| İdempotentlik — callback         | ✅ kilitli okuma + `isPending` kontrolü                                                                        |
| **Callback kimlik doğrulama**    | ❌ **P0-2** fiziksel POS callback'i **kimlik doğrulamasız ve imzasız**; gövdedeki durum doğrudan uygulanıyor   |
| **Callback kayıt bağı (sanal)**  | ❌ **P0-4** `token` ile `conversationId` bağlanmıyor → başka ödemenin token'ı bekleyen işlemi başarılı yapıyor |
| Eşzamanlılık / kilit             | ✅ `findByIdForUpdate`, `findByExternalRefForUpdate`, DB kısıtı                                                |
| Ters kayıt bağı + iptal kilidi   | ✅ (önceki tur)                                                                                                |
| İade tavanı (kümülatif)          | ✅ (önceki tur)                                                                                                |
| **Ödeme tarafına yansıtma**      | ❌ **P0-3** taksit **tutara bakılmadan** seçiliyor (hem tahsilat hem iade)                                     |
| Dış sağlayıcı — timeout/UNKNOWN  | ⚠️ PAX'ta mutabakat var; **iyzico Terminal'de yok** (**P1-1**)                                                 |
| Dış sağlayıcı — mutabakat kararı | ❌ **P1-2** 4 saat sonra cihaza **sorulmadan** TIMEOUT; yalnız `logger.warn`                                   |
| Muhasebe köprüsü                 | ⚠️ 3 yerde **kopyalanmış**; hata yutuluyor, **telafi yolu yok** (**P1-3**)                                     |
| Kritik event `outboxRun`         | ✅ üç fazlı akışta sonuç fazı outbox'ta                                                                        |
| Audit izi                        | ⚠️ POS olayları yalnız app logger'a yazıyor; para hareketinin aktörü ödeme tarafına taşınmıyordu (**P1-4**)    |
| Yetki — klinik kapsamı           | ✅ `canAccessClinicFinances` + cihaz/işlem `assertBelongsToClinic`                                             |
| Hassas veri                      | ✅ kart verisi saklanmıyor (maskeli son 4 hane); terminal kimlikleri satellite'te                              |
| Kimlik eşlemesi                  | ❌ **P0-1** `patientId` yanlış VO (`FirebaseUid`) → hasta taşıyan her kayıt hidrasyonda patlıyor               |
| Mutabakat raporu                 | ❌ **P1-1/P1-3** askıda kalanlar ve köprüsüz tahsilatlar için sorgu yok                                        |
| Kalıcı testler                   | ⚠️ ters kayıt/kilit testleri var; callback güvenliği, tutar eşleşmesi, mutabakat görünürlüğü test edilmemiş    |

### 20.2 Bulgular

**P0-1 — `patientId` Firebase UID olarak okunuyor; hasta taşıyan her işlem
hidrasyonda patlıyor.** `pos-transaction.entity.ts` ctor'u
`FirebaseUid.create(data.patientId).instance ?? null` çağırıyordu ama `create()`
aynı alana **UUID** yazıyor (`UUID.create(props.patientId)`). `FirebaseUid.create`
geçersiz değerde `instance`'ı boş bırakmaz — ctor'u **fırlatır**. Sonuç:
`findByIdForUpdate` / `findByExternalRefForUpdate` hasta bağlı her kayıtta
`InvalidFirebaseUidException` atıyor → o satışların iptali, iadesi ve mutabakatı
tamamen kapalı. (Aynı kök hata `payment` modülünde de vardı — bkz. §16 P0-1.)

**P0-2 — Fiziksel POS callback'i kimlik doğrulamasız ve imzasız.**
`POST /pos/callback/:externalRef` üzerinde ne `@UseGuards`, ne `@Public`, ne
throttle, ne imza doğrulaması vardı; **gövdedeki durum** doğrudan işleme
uygulanıyordu (`parseCallback` yalnız ayrıştırır). Uygulamada tek global guard
`ThrottleMonitorGuard`'dır (AuthGuard controller başına verilir), yani uç
gerçekten herkese açıktı. `externalRef` bilen biri PENDING bir işlemi SUCCESS'e
çevirip: taksiti "tahsil edildi" yapar, cari/defter tahsilat yazar, hasta
borcunu kapatır — **para girmeden**. Şu an sömürülememesinin tek nedeni fiziksel
POS sağlayıcı adapter'ının henüz `NullPhysicalPosProvider` olması (çağrı 500
veriyor); gerçek adapter yazıldığı an kapı açık hale gelirdi.

**P0-3 — Ödeme taksiti tutara bakılmadan seçiliyor.**
`PosPaymentSyncService.resolveInstallmentId` yalnız **duruma** bakıp ilk uygun
taksiti seçiyordu. İki sessiz para hatası:

- 3×1.000 ₺ planı olan bir ödemeye 500 ₺ POS çekimi yapılınca 1.000 ₺'lik taksit
  COMPLETED işaretleniyor → **500 ₺ hayalet gelir** ve hastanın borcu olduğundan
  fazla kapanıyor;
- **kısmi** POS iadesi (`pax-refund`/`iyzico-terminal-refund` `input.amount`)
  1.000 ₺'lik taksiti tümüyle REFUNDED yapıyor → muhasebe ters kaydı 300 ₺
  yerine **1.000 ₺** gelir düşürüyor.

**P0-4 — Sanal POS callback'inde token ile kayıt bağlanmıyor.**
`handle-payment-callback` sonucu `retrieveCheckoutForm(token)` ile iyzico'dan
okur (doğru: gövdeye güvenmiyor) ama **güncellenecek kaydı** `conversationId`'den
bulur ve ikisinin aynı ödemeye ait olduğunu hiç doğrulamaz. Uç `@Public`
olduğundan, başarılı bir ödemenin token'ını bilen biri onu **başka** bir
ödemenin `conversationId`'siyle eşleyip o işlemi SUCCESS'e çevirebilir.
Komutun `signature` alanı alınıyor ama hiç kullanılmıyordu.

**P1-1 — iyzico Terminal işlemleri mutabakata hiç girmiyor.**
`findPendingForReconcile` sorgusu `posDevice: { provider: PAX }` ile sınırlı
(doğru: T05 durum sorgusu PAX'a özgü) ama iyzico Terminal satış handler'ı geçici
hatada "PENDING kalıyor — reconcile/manuel" diyor. Sonuç: iyzico terminal
işlemi **sonsuza dek PENDING** kalıyor; kart çekilmiş olabilir, taksit açık
görünüyor, deftere hiçbir şey düşmüyor ve **hiçbir alarm/liste** yok. Sağlayıcı
servisinde durum sorgusu metodu da yok (`completePayment`/`void`/`refund`/`endOfDay`).

**P1-2 — 4 saat sonra cihaza sorulmadan TIMEOUT.** Mutabakat, yaşı
`STALE_THRESHOLD_MS`'i aşan işlemi cihaza **sormadan** TIMEOUT'a düşürüyordu ve
yalnız `logger.warn` yazıyordu. Entity'deki `markTimeout` yorumu ise "tarama bir
işlemi TIMEOUT'a ancak cihazın onu tanımadığını doğruladıktan sonra düşürür"
diyor — yani belgelenen invariant kodda yok. Kart çekilmiş olabilecek bir işlem,
kimsenin görmediği bir log satırıyla kapanıyordu.

**P1-3 — Muhasebe köprüsü üç yerde kopya; hata yutuluyor, telafi yolu yok.**
`recordPosPaymentReceived` gövdesi `pax-sale`, `iyzico-terminal-sale` ve
`reconcile` içinde ayrı ayrı yazılmıştı (dedupeKey/sourceModule'ün üçünde aynı
kalması tesadüfe bağlı). Hata CRITICAL alarmla **yutuluyor** — kart çekildiği
için doğru karar; ama olay hiç yazılmadığından `sweep-unposted-financial-events`
onu göremez ve **yeniden deneyecek hiçbir mekanizma yoktu**: tahsilat kalıcı
olarak deftere düşmemiş kalıyordu (CLAUDE.md finans kuralı 4 ihlali).

**P1-4 — Para hareketinin aktörü kaybolıyordu.** POS void/iade/satış
handler'larının elinde `ctx` var ama `PosPaymentSyncService` ödeme komutlarına
aktör taşımıyordu; `pos-transaction.listener.ts` de yalnız app logger'a yazıyor
(audit log yok). §16 P1-2 ile ödeme tarafı artık audit yazdığı için POS'tan
gelen aktörü taşımak tek eksik halkaydı.

**P1-5 — Kuruş hassasiyeti guard'ı yok.** `PaxSaleSchema`/`IyzicoTerminalSaleSchema`
`amount` alanı yalnız `positive()`; `PosTransaction.create` de hassasiyet
kontrolü yapmıyordu. Fazla ondalık hem `Decimal(10,2)` kolonunda hem minor-unit
çevriminde sessizce yuvarlanır.

**P2-1 — `Math.round(input.amount * 100)`** (pax-sale) kayan nokta aritmetiği;
kardeş akışlar (`pax-refund`) Decimal kullanıyor.
**P2-2 — Mutabakat handler'ında `policyFactory` inject edilip hiç kullanılmıyor.**
**P2-3 — Entity'de ham `Error`** (`externalRef mevcut değil`, `Pos işlemi
beklemede değil`) → 500; tipli karşılıkları mevcut.
**P2-4 — `crypto.randomUUID()`** (pax-sale) yerine `UUID.generate()` kuralı.
**P2-5 — Entity sınıf yorumu** geçişlerin "sessizce yok sayıldığını" söylüyordu;
kod `PosTransactionAlreadySettledException` fırlatıyor (yeni bir çağıran yorumu
okuyup 500 üretebilirdi).

---

## 21. Uygulanan düzeltmeler (2026-10-11)

| #      | Düzeltme                                                                                                                                                                                                                                                                                                              | Dosya                                                                                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------- | --------------------------------- |
| P0-1   | `patientId` → `UUID` (ctor); getter tipi düzeltildi; regresyon testi hidrasyonu da kapsıyor                                                                                                                                                                                                                           | `domain/entities/pos-transaction.entity.ts`, `pos-transaction.entity.spec.ts`                                                                                               |
| P0-2   | Callback **HMAC-SHA256 imza kapısı**: `X-Pos-Signature` ham gövde üzerinden `CryptoManager.verifyWebhookSignature` ile doğrulanır (WhatsApp/Instagram webhook'larıyla aynı kalıp); `POS_CALLBACK_SECRET` tanımsızsa istek **reddedilir** (fail-closed), `@Public` + `@Throttle(SENSITIVE_ENDPOINT)` açıkça bildirilir | `presentation/http/controllers/pos-callback.controller.ts`, `env.constant.ts`                                                                                               |
| P0-3   | Taksit seçimi **tutara birebir eşit** olanı arar; eşleşme yoksa ödeme planına **dokunulmaz** + CRITICAL alarm (yanlış taksiti kapatmaktansa açık bırakmak). "Ödeme yok" ile "eşleşen taksit yok" ayrı raporlanır                                                                                                      | `application/services/pos-payment-sync.service.ts` (+ 8 çağrı yeri tutar/ctx geçiyor)                                                                                       |
| P0-4   | Callback'te `transaction.token !== token` ise `IyzicoCallbackTokenMismatchException` (403); `signature` alanının neden doğrulanmadığı belgelendi                                                                                                                                                                      | `virtual/.../handle-payment-callback.handler.ts`, `iyzico.exceptions.ts`                                                                                                    |
| P1-1   | Yeni **PosTransaction Query repo** + `findStalePendingAnyClinic(excludeProviders)`; mutabakat işi PAX dışı askıda işlemleri tarayıp CRITICAL alarm üretir (cihaza sormaz — sağlayıcıda sorgu yok, otomatik karar vermez) + operasyon listesi `GET /pos/transactions/stale-pending`                                    | `pos-transaction.query.repository.ts` (domain+infra), `reconcile-pos-transactions.handler.ts`, `find-stale-pos-transactions/*`                                              |
| P1-2   | Kör TIMEOUT artık CRITICAL alarm üretir ve kilitli okuma + `isPending` kontrolüyle yapılır; entity yorumu gerçeğe göre düzeltildi                                                                                                                                                                                     | `reconcile-pos-transactions.handler.ts`, `pos-transaction.entity.ts`                                                                                                        |
| P1-3   | Köprü tek serviste toplandı (`record` = fırlatır, `recordBestEffort` = yutar+alarm); telafi zinciri: `GET /pos/transactions/unbridged` (adaylar POS'tan, "olayı var mı" `financial-events`'ten QueryBus ile) + `POST /pos/transactions/backfill-accounting`                                                           | yeni `pos-accounting-bridge.service.ts`, `find-unbridged-pos-transactions/*`, `backfill-pos-accounting-events/*`, `find-existing-financial-event-refs/*` (financial-events) |
| P1-4   | `PosPaymentSyncInput.ctx` zorunlu; 8 çağrı yeri gerçek `ctx`'i (void/iade/satış) ya da iç bağlamı (callback/mutabakat) geçiyor → tahsilat/iade audit kaydı aktörlü yazılıyor                                                                                                                                          | `pos-payment-sync.service.ts`, 6 handler + callback + reconcile                                                                                                             |
| P1-5   | `PosTransaction.create` kuruş hassasiyetini zorluyor (`PosAmountInvalidPrecisionException`); 4 `@shared` şemasına `.multipleOf(0.01)`                                                                                                                                                                                 | `pos-transaction.entity.ts`, `pax-sale                                                                                                                                      | pax-refund | iyzico-terminal-sale | iyzico-terminal-refund.schema.ts` |
| P2-1/4 | Cihaza giden tutar `Money`→`Decimal.times(100).round()`; `crypto.randomUUID()` → `UUID.generate()`                                                                                                                                                                                                                    | `pax-sale.handler.ts`                                                                                                                                                       |
| P2-2   | Kullanılmayan `policyFactory` kaldırıldı                                                                                                                                                                                                                                                                              | `reconcile-pos-transactions.handler.ts`                                                                                                                                     |
| P2-3   | Ham `Error`lar tipli domain hatalarına çevrildi                                                                                                                                                                                                                                                                       | `pos-transaction.entity.ts`                                                                                                                                                 |
| P2-5   | Sınıf yorumu koda uygun hale getirildi (geçişler sessiz değil, çağıran `isPending` ile kontrol eder)                                                                                                                                                                                                                  | `pos-transaction.entity.ts`                                                                                                                                                 |

### 21.1 Eklenen/güncellenen testler

| Dosya                                                   | Kapsam                                                                                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pos-callback.controller.spec.ts` (yeni, 5 test)        | imza kapısı: geçerli imza dispatch eder; imza yok/geçersiz → 403; **anahtar yoksa 503 (fail-closed)**; ham gövde yoksa 400                                |
| `pos-payment-sync.service.spec.ts` (yeni, 6 test)       | tutara eşit taksit seçimi; eşleşme yoksa ödemeye dokunmama + alarm; kısmi iade regresyonu; başarısızlıkta tutar zorunlu değil; ödeme yoksa alarmsız çıkış |
| `reconcile-pos-transactions.spec.ts` (yeni, 4 test)     | kör TIMEOUT alarmı; kilit altında sonuçlanmışı atlama; PAX dışı askıda işlemlerin cihaza sorulmadan alarmla görünür kılınması                             |
| `backfill-pos-accounting-events.spec.ts` (yeni, 3 test) | eksiklerin köprülenmesi; eksik yoksa no-op; satır hatası turu durdurmaz                                                                                   |
| `pos-transaction.entity.spec.ts` (+3 test)              | `patientId` UUID hidrasyonu (regresyon), hasta yoksa null, kuruş sınırı                                                                                   |
| `handle-payment-callback.handler.spec.ts` (+1 test)     | başka ödemenin token'ı ile işlem başarılı yapılamaz                                                                                                       |

**Doğrulama:** `tsc --noEmit` 0 hata; `jest` **172 suite / 1050 test** yeşil
(`app.module.spec` dahil → yeni controller/handler/servisler DI grafiğinde
ayakta). **Migration gerekmedi** (şema değişikliği yok).

> ⚙️ **Ortam değişkeni:** `POS_CALLBACK_SECRET`. Tanımlı değilse fiziksel POS
> callback ucu 503 döner (uç zaten gerçek adapter olmadan çalışmıyordu);
> env doğrulamasına **zorunlu olarak eklenmedi** ki mevcut kurulumlar açılışta
> patlamasın.

---

## 22. Bilinçli yapılmayanlar — `pos/physical` / `pos/virtual`

| Konu                                                                    | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **iyzico Terminal için durum sorgusu (inquiry) entegrasyonu**           | Mutabakatın PAX'taki gibi otomatik karar verebilmesi için sağlayıcıda bir "işlem durumu" ucu gerekiyor; `IyzicoTerminalService` bugün yalnız `completePayment/void/refund/endOfDay` taşıyor ve dokümante edilmiş bir inquiry ucu kullanılmıyor. Bu tur, otomatik karar yerine **görünürlük** (alarm + liste) sağladı. **Tetikleyici:** iyzico Terminal dokümantasyonunda inquiry ucu doğrulandığında — o zaman `reconcile` sağlayıcıya göre dallanır.                                                                                 |
| **POS entity olaylarının audit log'a yazılması**                        | `PosTransactionSucceeded/Failed/Cancelled/Timeout` olayları `IAuditLog` alanları taşımıyor; eklemek 8+ çağrı yerinde `mark*` imzalarını değiştirmek demek. Para hareketinin denetim izi bu turda **ödeme tarafından** (aktörlü `PaymentPaid/Refunded` + `PaymentLifecycleListener`) kapatıldı; POS satırı ayrıca kind/orijinal bağ/tutar/zaman taşıyor. **Tetikleyici:** hastasız (ödeme kaydı olmayan) kart çekimleri operasyonel olarak kullanılmaya başlanırsa — o akışta ödeme tarafı hiç devreye girmiyor.                       |
| **Kısmi iadenin ödeme planına yansıtılması**                            | POS kısmi iadesi artık taksiti yanlış kapatmıyor (alarm üretiyor) ama planda "kısmen iade edilmiş taksit" diye bir durum yok. Doğru çözüm §19'da yazılı: taksitte kümülatif `refundedAmount` + tavan + kısmi ters kayıt. **Tetikleyici:** aynı §19 maddesi (kısmi tutar iadesi talebi).                                                                                                                                                                                                                                               |
| **`initiate-pos-transaction` akışındaki `TODO: logic hatası olabilir`** | Jenerik sağlayıcı akışı (`NullPhysicalPosProvider`) bugün hiçbir gerçek entegrasyonla kullanılmıyor; `paymentId` çözümleme dalı PAX/iyzico akışlarıyla aynı kalıpta ama test edilemiyor. Bu turda imza kapısı ve kimlik eşlemesi düzeltildi; akışın kendisi gerçek adapter gelmeden yeniden yazılmıyor. **Tetikleyici:** gerçek banka/terminal adapter'ı yazılırken.                                                                                                                                                                  |
| **Gün sonu (EOD / batch-close) tutarlarının defterle mutabakatı**       | `pax-batch-close` ve `iyzico-terminal-eod` cihazdan gün sonu özetini alıyor ama sonucu **kaydetmiyor** (yanıt çağırana dönüyor). Cihaz toplamı ile o günün POS tahsilat toplamını karşılaştıran bir mutabakat, POS tarafında değil `bank`/`cash-register` turlarındaki ekstre mutabakatıyla aynı tasarımı ister. **Tetikleyici:** `bank` denetim turu (§2) — oto-eşleştirme oradaki kalıpla birlikte tasarlanır. **Gerekçe §56'da keskinleştirildi:** PAX hiç toplam döndürmüyor, iyzico toplamlarının birimi doğrulanamıyor (§55.3). |
| **POS cihaz kimliklerinin şifrelenmesi (at-rest)**                      | `ClinicIyzicoTerminalConfig` `clientSecret`/`password` alanlarını düz metin tutuyor. Token şifreleme altyapısı projede var (`TokenCipherService`) ama bu alanları şifrelemek migration + anahtar rotasyonu planı ister ve POS dışındaki satellite'leri (Meta, WhatsApp) de kapsamalı. **Tetikleyici:** sır yönetimi/PCI turu — tek modülde çözülmemeli.                                                                                                                                                                               |

---

## 23. `cash-register` + `bank` — Kasa ve Banka Mutabakatı

Denetim tarihi: **2026-10-11**. Kapsam: `CashRegister` + `CashSession` +
`CashMovement` ve `BankAccount` + `BankStatement` + `BankStatementLine`
aggregate'leri, 5 + 5 komut, 6 + 6 query, eşleştirme motoru
(`statement-line-matcher`), repo'lar, `@shared` şemaları, şema
(`cash.prisma`, `bank.prisma`).

> **Önceki turlar:** kasa açılış/kapanış kilitleri 2026-08-12 eşzamanlılık
> turunda, oto-eşleştirme kuralları `project_bank_auto_matching` turunda
> kuruldu. Bu tur kimlik eşlemesi, tutar hassasiyeti, tek-açık-oturum kısıtı,
> ekstre bütünlüğü ve çift eşleştirme başlıklarına bakar.

### 23.1 Kontrol listesi sonucu

| Başlık                         | Durum                                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tutarlar `Decimal`             | ✅ entity'lerde Decimal; DB `Decimal(14,2)` / `Decimal(16,2)`                                                                                                                               |
| Kuruş sınırı                   | ❌ **P1-2** açılış nakdi, sayım, hareket ve ekstre tutarlarında guard yok                                                                                                                   |
| Para birimi                    | ✅ hareket para birimini oturumdan alır (karışma imkânsız)                                                                                                                                  |
| Negatif/sıfır guard            | ✅ `openingFloat ≥ 0`, hareket `> 0`                                                                                                                                                        |
| **Kimlik eşlemesi (aktör)**    | ❌ **P0-1** `openedById` / `performedById` / `importedById` UUID VO'sundan geçiyor; gerçek personel kimliği **Firebase UID** → kasa açılışı, hareket kaydı ve ekstre importu HİÇ çalışmıyor |
| İdempotentlik — kasa köprüsü   | ✅ `dedupeKey` + `accountingEventId` damgası + `markAsPostedToAccounting` no-op                                                                                                             |
| Eşzamanlılık — oturum aç       | ✅ kasa satırı `FOR UPDATE` + açık-oturum kontrolü aynı kilit altında                                                                                                                       |
| Eşzamanlılık — hareket/kapanış | ✅ oturum `FOR UPDATE` (kapanış-anında-hareket serialize)                                                                                                                                   |
| Check-then-act DB kısıtı       | ❌ **P1-1** "bir kasada tek açık oturum" yalnız kilitle korunuyor, DB kısıtı yok                                                                                                            |
| Açılış nakdinin çift sayımı    | ❌ **P1-3** `OPENING_FLOAT` hareket olarak kaydedilebiliyor → beklenen tutar iki kez şişiyor                                                                                                |
| Kasa farkı (fazla/açık)        | ⚠️ kalıcı damga var (`difference`/`closedById`/`closedAt`) ama **görünür liste yok**, ayrı onay yok (**P2-1**, §25)                                                                         |
| Defter — kasa köprüsü          | ✅ `CASH_SESSION_CLOSED` olayı (102/770/100/679/689); `SALE_COLLECTION` postlanmıyor (mükerrer önlendi)                                                                                     |
| **Ekstre bütünlüğü**           | ❌ **P1-4** `açılış + Σ hareket = kapanış` hiç kontrol edilmiyor                                                                                                                            |
| Çift eşleştirme (oto)          | ✅ `findUsedMatchRefs` + tur içi bellek kümesi                                                                                                                                              |
| **Çift eşleştirme (elle)**     | ❌ **P1-5** elle mutabakatta kontrol yok → iki satır aynı 102 hareketine bağlanabiliyor                                                                                                     |
| Eşleştirme izi                 | ✅ `matchSource` (AUTO/MANUAL), `reconciledById`, `reconciledAt`; geri alımda iz temizleniyor                                                                                               |
| Yetki — klinik kapsamı         | ✅ tüm komut/query'lerde `canAccessClinicFinances`                                                                                                                                          |
| Kiracı kimliği                 | ⚠️ **P2-2** `CreateCashRegisterSchema` `organizationId` taşıyor (resolver doğruluyor ama DTO'da olmamalı), `clinicId` `z.string()`                                                          |
| Kalıcı testler                 | ⚠️ eşleştirme motoru + oto-eşleştirme test edilmiş; entity invariant'ları ve elle mutabakat test edilmemiş                                                                                  |

### 23.2 Bulgular

**P0-1 — Aktör kimliği UUID sanılıyor; kasa ve ekstre akışları tamamen kapalı.**
Üç yerde `UUID.create(actorId).orThrow()` çağrılıyordu:
`cash-session.entity.ts:172` (`openedById`), `cash-movement.entity.ts:147`
(`performedById`), `bank-statement.entity.ts:142` (`importedById`). Oysa
`User.id = firebaseUid`'dir (`create-user.handler.ts:26`; `User` entity'si de
`FirebaseUid.fromTrusted` kullanıyor) — 28 karakterli alfanümerik, UUID değil.
Dolayısıyla **kasa oturumu açmak, nakit hareketi kaydetmek ve banka ekstresi
içe almak** gerçek bir personelle imkânsızdı (`InvalidUuidException`). Kardeş
alanlar (`closedById`, `FinancialEvent.performedById`, `JournalEntry.performedById`)
zaten ham string tutuyor; yani doğru ev kalıbı mevcuttu, bu üç yer ondan sapmıştı.

> Aynı hata sınıfı `payment` (§16 P0-1) ve `pos` (§20 P0-1) turlarında da
> çıktı — oradaki yön tersti (hasta kimliği UUID iken `FirebaseUid` sanılıyordu).
> Kimlik VO'ları derleyiciye aynı görünüyor (`string` → `string`), bu yüzden
> tek kaynak kuralı net olmalı: **kullanıcı/personel kimliği = ham string
> (Firebase UID), hasta/kayıt kimliği = `UUID`**. Kapsam dışı ama aynı hatayı
> taşıyan yerler: `supply/purchasing` `requestedById`, `supply/inventory`
> `stock-movement.performedById`, `clinical/provider` `userId` (kendi turlarında).

**P1-1 — "Bir kasada tek açık oturum" kuralının DB kısıtı yok.**
Açılış akışı kasayı `FOR UPDATE` kilitleyip kontrol ediyor (doğru) ama kural
yalnız bu kilitle yaşıyor. İleride eklenecek ikinci bir açılış yolu (veya
kilidin atlanması) çift açık oturum üretir: aynı kasadaki nakit iki ayrı
beklenen tutara bölünür ve iki kapanışın da sayım farkı anlamsız çıkar.

**P1-2 — Kuruş hassasiyeti guard'ı yok.** `openingFloat`, `countedAmount`,
hareket `amount`, ekstre `openingBalance`/`closingBalance`/satır `amount` —
hepsi `z.number()` ve entity'de ham `new Decimal(...)`. Kolonlar `Decimal(14,2)`
/ `Decimal(16,2)` olduğundan fazla hane **sessizce** yuvarlanır: kasada sayılan
para ile kayıt ayrışır ve gerçekte olmayan bir fark raporlanır.

**P1-3 — Açılış nakdi iki kez sayılabiliyor.** Açılış nakdi oturumun kendi
kolonunda yaşıyor ve kapanışta `beklenen = openingFloat + girişler − çıkışlar`
formülüne dahil. Ama `RecordCashMovementSchema.type` tüm enum'u kabul ediyordu
ve `OPENING_FLOAT` **giriş** türlerinden biri: aynı tutar bir de hareket olarak
girilirse beklenen tutar iki kez şişer, gerçek bir kasa açığı "denk" görünür.

**P1-4 — Ekstre kendi içinde doğrulanmıyor.** `openingBalance + Σ satır =
closingBalance` kontrolü hiç yapılmıyordu. Ekstre bu modülün tek gerçeklik
kaynağı: CSV ayrıştırmasında bir satır düşerse ya da iki kez okunursa hiçbir
hata oluşmaz; eksik hareket "bankada yok" gibi görünür ve defterle farkı
aylarca kovalanır.

**P1-5 — Elle mutabakatta çift eşleştirme serbest.** Oto-eşleştirme aynı defter
hareketinin iki ekstre satırına bağlanmasını açıkça engelliyor
(`findUsedMatchRefs` + tur içi küme) ama **elle** mutabakat yolunda hiç kontrol
yok. İki satır aynı 102 hareketine bağlanınca mutabakat özeti onu iki kez
"mutabık" sayar ve gerçekten mutabık olmayan bir hareket gizlenir. (CLAUDE.md
kural 10: bir kuralı tek çağrı yerine koymak, diğer N−1 yolu korumasız bırakır.)

**P2-1 — Kasa farkının görünür listesi yok.** Fark kapanışta deftere yazılıyor
(689 kasa açığı / 679 kasa fazlası) ve kayıtta damgalı; ama "farkı olan
kapanışlar" sorgusu yoktu, ayrı bir onay/yetki de yok (§25).
**P2-2 — `CreateCashRegisterSchema`**: `organizationId` DTO'da (kiracı kimliği
istemciden alınmamalı — resolver doğruladığı için sömürülebilir değil ama
sözleşme kuralı ihlal ediliyor), `clinicId` `z.uuid()` değil `z.string()`.
**P2-3 — `get-cash-sessions` handler'ı** aktörün kliniği yoksa `clinicId`'yi
boş string yapıyor (yetki kontrolü reddediyor ama hata sebebi görünmez).

---

## 24. Uygulanan düzeltmeler (2026-10-11, 2. tur)

| #    | Düzeltme                                                                                                                                                                                                                                                                                                    | Dosya                                                                                                                      |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| P0-1 | Aktör kimlikleri **ham string** (ev kalıbı: `FinancialEvent.performedById`); üç yerdeki `UUID.create(...).orThrow()` kaldırıldı, her birine nedenini söyleyen yorum eklendi. Ayrıca `finance-ledger` entity'sindeki aynı sınıf hata (gizli/latent: bugün `performedById` hiç geçilmiyor) birlikte kapatıldı | `cash-session.entity.ts`, `cash-movement.entity.ts`, `bank-statement.entity.ts`, `finance-ledger.entity.ts`                |
| P1-1 | `CashSession.activeRegisterId` (`@unique`): yalnız AÇIK oturumda dolu, kapanışta null'a çekilir → Postgres'te kısmî unique index gibi davranır (POS `activeVoidOriginalId` kalıbı). **Migration var**                                                                                                       | `cash.prisma`, `cash-session.entity.ts`, migration `20261011090000_cash_session_single_open`                               |
| P1-2 | Kuruş guard'ları: entity'lerde (`CashInvalidPrecisionException`, `BankStatementInvalidPrecisionException`) + 5 `@shared` şemasında `.multipleOf(0.01)`                                                                                                                                                      | cash/bank entity'leri, `open-cash-session`, `close-cash-session`, `record-cash-movement`, `import-bank-statement` şemaları |
| P1-3 | `OPENING_FLOAT` hareket olarak kaydedilemez: entity invariant'ı (`CashOpeningFloatNotAMovementException`) + şemada `RecordableCashMovementTypeSchema` (enum'dan dışlama). Kapı ve kullanım yeri **aynı kümeyi** kullanır (kural 12)                                                                         | `cash-movement.entity.ts`, `record-cash-movement.schema.ts`                                                                |
| P1-4 | `BankStatement.create` artık `açılış + Σ satır = kapanış`ı zorluyor (**tolerans yok**); iki bakiye de verilmediyse kontrol atlanır (bazı CSV formatlarında kolon yok)                                                                                                                                       | `bank-statement.entity.ts`                                                                                                 |
| P1-5 | Elle mutabakat, hedef referansı başka satır kullanıyorsa reddediyor (`BankStatementLineMatchRefAlreadyUsedException`, 409); satırın **kendi** referansını yeniden yazmak serbest (idempotent not düzeltme). Okuma satır kilidi altında                                                                      | `reconcile-statement-line.handler.ts`                                                                                      |
| P2-1 | `GET /cash-sessions?hasDifference=true` — sayım farkı olan kapanışların listesi (fark deftere yazıldığı için denetimsiz kalmamalı)                                                                                                                                                                          | `get-cash-sessions.schema.ts`, contracts, handler, `cash-session.query.repository.ts`                                      |
| P2-2 | `CreateCashRegisterSchema`: `organizationId` kaldırıldı (kapsam `clinicId`'den çözülür), `clinicId` → `z.uuid()`                                                                                                                                                                                            | `create-cash-register.schema.ts`                                                                                           |

### 24.1 Eklenen testler

| Dosya                                             | Kapsam                                                                                                                                                                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cash-session.entity.spec.ts` (yeni, 10 test)     | Firebase UID ile açılış/hareket (regresyon), açık-oturum kilidinin tutulup kapanışta bırakılması, beklenen/fark hesabı, çift kapanış, kuruş sınırı, köprü izinin idempotentliği, `OPENING_FLOAT` reddi, yön türetimi |
| `bank-statement.entity.spec.ts` (yeni, 6 test)    | Firebase UID ile import (regresyon), bakiye denkliği, düşen satırın yakalanması, bakiye beyanı yoksa atlanması, kuruş sınırı, satırsız ekstre                                                                        |
| `reconcile-statement-line.spec.ts` (yeni, 4 test) | serbest referansa eşleştirme, kullanılmış referansın reddi, kendi referansını yeniden yazma, IGNORED/UNMATCHED'de kontrol yapılmaması                                                                                |

**Doğrulama:** `tsc --noEmit` 0 hata; `jest` **175 suite / 1070 test** yeşil.
`pnpm prisma:generate` çalıştırıldı (yeni kolon için zod/client yenilendi).

> ⚠️ **Migration kullanıcı uygular:** `20261011090000_cash_session_single_open`.
> Aynı kasada birden fazla AÇIK oturum varsa unique index **hata verir** —
> teşhis sorgusu migration yorumunda. Hangi oturumun geçerli olduğu (hangi
> sayım gerçek kasayı temsil ediyor) bir **muhasebe kararıdır**; otomatik
> kapatma/silme yapılmaz.

---

## 25. Bilinçli yapılmayanlar — `cash-register` / `bank`

| Konu                                                                             | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kasa farkı için eşik + ayrı onay (SoD)**                                       | Fark artık listelenebiliyor ve kayıtta damgalı, ama "şu tutarın üstündeki açık ikinci bir imza ister" kuralı yok. Eşik bir klinik politikası değeridir (`ClinicFinanceSettings`) ve uydurulmamalı; ayrıca onay akışı kapanışı bloklayacağı için kasiyerin vardiya sonunu kilitler — operasyonla kararlaştırılmalı. **Tetikleyici:** klinik "X TL üstü kasa açığı müdür onayına düşsün" dediğinde; o zaman eşik ayarı + `CASHSESSION.approveDifference` capability + bekleyen kapanış durumu birlikte tasarlanır.                                                                        |
| **Aynı ekstrenin iki kez içe alınması**                                          | Doğal anahtar konmadı. `(hesap, dönem)` üzerine unique koymak meşru yeniden importu (ayrıştırma düzeltmesi sonrası) bloklar; satır bazlı parmak izi ise aynı gün aynı tutarlı **gerçek** iki hareketi reddeder. Para hatası hâlihazırda kapalı: oto ve elle eşleştirme aynı defter hareketini iki ekstre satırına bağlayamıyor (P1-5), yani mükerrer import en kötü ihtimalle kalıcı UNMATCHED satır gürültüsü üretir. **Tetikleyici:** mutabakat ekranında mükerrer satır şikâyeti gelirse — doğru çözüm import yanıtında "bu satırların N tanesi zaten mevcut" uyarısı (bloklamadan). |
| **Kasa → banka transferinin iki uçlu eşleştirilmesi**                            | `BANK_DEPOSIT` hareketi kasadan çıkışı yazıyor, banka ekstresindeki girişi ise mutabakat eşleştiriyor; ama ikisinin **aynı** transfer olduğunu bağlayan bir referans yok (`referenceId` serbest metin). Bağlamak için kasa tarafında bir "transfer" aggregate'i gerekir. **Tetikleyici:** "para kasadan çıktı, bankaya hiç girmedi" vakası; o zaman transfer kaydı + iki ucun durum makinesi birlikte kurulur.                                                                                                                                                                          |
| **POS gün sonu (EOD/batch-close) toplamlarının defterle mutabakatı**             | §22'den devredildi. Doğru tasarım ekstre mutabakatının aynısı: cihaz özetini bir "beyan" olarak saklamak + o günün POS tahsilat toplamıyla satır bazında eşleştirmek. Bugün EOD yanıtı hiç saklanmıyor, yani eşleştirilecek bir kaynak yok. **Tetikleyici:** EOD yanıtını kalıcı hale getiren bir iş (POS tarafı) yazıldığında. **Gerekçe §56'da keskinleştirildi:** PAX hiç toplam döndürmüyor, iyzico toplamlarının birimi doğrulanamıyor (§55.3).                                                                                                                                    |
| **`statement-line-matcher`'ın açıklama/karşı taraf benzerliğine göre öğrenmesi** | Motor bugün tutar+yön birebir, ±3 gün ve eşit adayda UNMATCHED bırakıyor (makine tahmin etmiyor). Metin benzerliği eklemek yanlış eşleşme riskini doğrudan artırır ve yanlış eşleşme, eşleşmemekten **daha** pahalıdır (mutabık görünen bir hareket bir daha incelenmez). **Tetikleyici:** elle eşleştirme hacmi ölçülüp "makine şu kalıbı %100 doğrulukla buluyor" denebildiğinde.                                                                                                                                                                                                     |

---

## 26. `finance-ledger` — Cari Defter (hasta/klinik hareketleri)

Denetim tarihi: **2026-10-11**. Kapsam: entity, kurallar, repo'lar, 2 command + 5 query,
kuyruk (producer/processor), iki olay dinleyicisi, controller ve şema (`finance.prisma`).

> **Not — bu defter çift taraflı defter DEĞİL.** `FinanceLedger` tek satırlı bir _cari
> hareket_ defteridir (hasta bakiyesi, şube tahsilat özeti, reklam ROI'si). Çift taraflı
> kayıt `accounting/posting` tarafındadır. Dolayısıyla buradaki bulgular "mizan bozuldu"
> değil "**hasta bakiyesi ve yönetim özeti yanlış**" sınıfındadır — ama para hareketinin
> tek görünür yüzü çoğu ekranda burasıdır.

### 26.1 Kontrol listesi sonucu

| Başlık                     | Durum                                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Para/matematik             | ⚠️ `Decimal` kullanılıyor ama kuruş kapısı yoktu (**P2-1**)                                                           |
| Para birimi                | ❌ **P1-1** üç özet sorgusu da para birimlerini topluyordu                                                            |
| İdempotentlik              | ⚠️ `installment_id` unique vardı (mükerrer satır engelli) ama P2002 "zaten yapıldı" olarak yorumlanmıyordu (**P1-2**) |
| Event sırası               | ❌ **P0-1** iade, tahsilat kaydından önce işlenirse kalıcı olarak kayboluyordu                                        |
| Yutulan kritik iş / telafi | ❌ **P0-2** mutabakat sorgusu ve backfill yok; eksiğin tek izi BullMQ failed set'i                                    |
| Eşzamanlılık               | ⚠️ kayıt yazımı tek INSERT; yarış unique kısıtla kapalı ama sonuç hata olarak dışarı çıkıyordu                        |
| Durum makinesi             | ❌ **P1-3** iade yolu entity'yi baypas ediyor, kurallar hiç çalışmıyordu; REFUNDED → COMPLETED geri dönüşü serbestti  |
| Bounded context            | ❌ **P1-4** dinleyici başka modüllerin tablolarını doğrudan Prisma ile okuyor + "klinik yoksa sessizce atla"          |
| Dönem/tarih atfı           | ❌ **P1-5** kaydın tarihi tahsilatın değil kaydın **yazıldığı** an                                                    |
| Audit izi                  | ⚠️ **P2-2** `performedById` hiç doldurulmuyordu (kolon var, hep null)                                                 |
| Yetki kapsamı              | ✅ dört okuma ucunda da kaydın kliniği üzerinden doğrulanıyor                                                         |
| Gider tarafı               | ⚠️ **P2-3** `EXPENSE` satırı hiç üretilmiyor → `totalExpenses` yapısal olarak 0                                       |
| Ölü kod                    | ⚠️ **P2-4** 3 ölü repo metodu + `update(entity)` yerine `upsert` + boş publisher/event modülü                         |
| Testler                    | ❌ modülde tek bir test yoktu                                                                                         |

### 26.2 P0 — Canlı öncesi kapanmalı

#### P0-1 · Olay sırası: iade, tahsilat kaydından önce işlenirse **kalıcı olarak** kaybolur

**Kanıt.** Tahsilat kaydı asenkron yazılıyordu:
`payment-completed.listener.ts` → BullMQ (`attempts: 5`, `backoff: 5s`) → `FinanceLedgerProcessor`
→ `CreateLedgerEntyCommand`. İade ise **doğrudan** `refund-ledger-entries.handler.ts:29`
üzerinden `updateStatusByInstallmentId` → `financeLedger.updateMany({ where: { installmentId } })`
çağırıyordu.

**Neden bozuk.** `updateMany` eşleşen satır yoksa **0 satır** güncelleyip hatasız döner.
Kayıt henüz yazılmamışsa (iş kuyrukta bekliyor, ilk deneme backoff'ta, ya da Redis yavaş)
iade hiçbir şeyi değiştirmiyor; listener "Cari kayıt iade edildi" logunu basıyor; ardından
kuyruktaki iş kaydı **COMPLETED** olarak yazıyor. Sonuç: para hastaya geri gitmiş, defter
tahsilat göstermeye devam ediyor — ve bunu gösteren hiçbir alarm yok (iki taraf da kendi
içinde "başarılı"). Hasta bakiyesi ve şube cirosu iade tutarı kadar şişik kalıyor.

**Düzeltme.** İki yazma yolu **tek** idempotent yola indirildi:
`SyncInstallmentLedgerEntryCommand`. Komut, kaydı yazdığı anda kaynağın (taksit) **nihai**
durumunu payment modülünden okur (`GetInstallmentForLedgerQuery`) ve defteri ona hizalar —
yoksa yazar, varsa durumunu günceller. Tahsilat ve iade olayları artık aynı komutu kuyruğa
koyar; **hangisinin önce işlendiği önemsizdir**. Entity tarafında REFUNDED/CANCELLED →
COMPLETED geçişi yasaklandı (`syncStatus`), yani geç gelen tahsilat işi iadeyi geri alamaz.

#### P0-2 · Yutulan kritik iş için telafi yolu yok (CLAUDE.md finans kuralı 4)

**Kanıt.** `payment-completed.listener.ts:64-83` kuyruğa ekleme hatasını `try/catch` ile
yutup CRITICAL alarm basıyor (kuyrukta yeniden denenecek bir iş **yok**). İşin kendisi 5
denemede de başarısız olursa BullMQ'nun failed set'inde kalıyor. Modülde ne "eksikler"
sorgusu ne de backfill komutu vardı; `removeOnFail` ayarlanmamıştı.

**Neden bozuk.** Kural 4 açık: her yutulan kritik iş için ya retry ya **backfill komutu +
eksikler sorgusu** bulunmak zorunda. Tahsilat alınıp cari kaydı hiç yazılmadığında hasta
"borçlu" görünmeye devam eder, şube cirosu eksik raporlanır ve bunu fark etmenin tek yolu
Redis'teki failed set'e bakmaktır — operasyonun bakmadığı bir yer.

**Düzeltme.** Mutabakat + telafi çifti eklendi:
`GET /finance/finance-ledger/reconciliation/mismatches` (`FindLedgerMismatchesQuery`) ve
`POST /finance/finance-ledger/reconciliation/backfill` (`BackfillLedgerEntriesCommand`).
Sorgu, payment modülünden aralıkta **sonuçlanmış** (tahsil/iade) taksitleri alıp defterdeki
durumlarla karşılaştırır: kayıt hiç yoksa `MISSING`, durum kaymışsa `STATUS_DRIFT`. Telafi
komutu her satır için aynı idempotent sync komutunu çağırır. `removeOnFail: false` ile
başarısız iş de yerinde kalır (ikinci bağımsız iz).

### 26.3 P1

#### P1-1 · Üç özet sorgusu da para birimlerini topluyordu

**Kanıt (eski hâl).** `finance-ledger.query.repository.ts`: `getClinicSummary` ve
`getPatientSummary` `groupBy({ by: ['type'] })`, `sumIncomeByPatientIds`
`groupBy({ by: ['patientId'] })`. `FinanceLedger.currency` kolonu hiçbirinde yok.

**Neden bozuk.** Sağlık turizmi kliniği aynı deftere TRY ve EUR yazıyor. 1.000 EUR + 1.000 TRY
= "2.000" oluyordu; hasta bakiyesi (`totalPayments − totalServiceAmount`) iki para biriminin
karışımı olduğu için hiçbir anlam taşımıyordu. Aynı hata ödeme turunda yaşlandırma ve hekim
cirosunda kapatılmıştı (§18.1); defter tarafı atlanmıştı.

**Düzeltme.** Üçü de para birimi kırılımında döner: `LedgerSummary.totals[]`,
`PatientFinanceSummary.balances[]`, `PatientRevenue.currency`. Kur çevrimi yapılmaz
(fonksiyonel paraya çevirme yalnız fişleme anında — doc 07). Kırılımı **kilitleyen** bir
repository testi yazıldı: gruplama anahtarından `currency` düşerse test kırılır.
Reklam ROI raporu (`get-agency-roi-report`) referans para birimi dışındaki geliri orana
katmaz ve `excludedRevenueCurrencies` ile bildirir — sessizce düşürmek yerine.

#### P1-2 · "Zaten yazılmış" bir hata olarak dışarı çıkıyordu

**Kanıt.** `FinanceLedgerCommandRepository.create` P2002'yi çevirmiyordu; aynı taksit için
ikinci yazma denemesi (olayın tekrar teslimi) ham Prisma hatası olarak yukarı çıkıp işi
başarısız yapıyordu.

**Düzeltme.** P2002 → `LedgerEntryAlreadyExistsException`; sync komutu bunu "zaten var"
olarak yorumlayıp mevcut kaydı okuyup durumunu hizalar. Yeniden okuma **transaction'ın
dışında** yapılır: unique ihlali transaction'ı abort ettiği için aynı tx içindeki her sorgu
da hata verirdi (party modülündeki aynı kalıp bu yüzden tx dışında duruyor).

#### P1-3 · İade yolu entity'yi baypas ediyordu; kurallar hiç çalışmıyordu

**Kanıt.** `updateStatusByInstallmentId` ham `updateMany` idi. `FinanceLedgerRules`
(`refund()` yalnız COMPLETED kayıtlara izin verir) ve entity'nin `refund()`/`cancel()`
metotları **hiçbir yerden** çağrılmıyordu; `isCompleted/isRefunded/isCancelled` guard'ları
çıplak `Error` fırlatıyordu (500, `errorCode` yok).

**Düzeltme.** Durum değişikliği artık `findByInstallmentId` → `entity.syncStatus()` →
`update(entity)` yolundan geçiyor. Geçiş matrisi tek yerde (entity) ve tipli hata üretiyor;
ham `updateMany` metotları silindi.

#### P1-4 · Dinleyici başka modülün tablolarını doğrudan okuyordu (+ sessiz atlama)

**Kanıt (eski hâl).** `payment-completed.listener.ts:26-48` `prisma.paymentInstallment`
(include: `payment`) ve `prisma.clinic` tablolarını **doğrudan** okuyor; klinik satırı
bulunamazsa `return` ile kaydı sessizce atlıyordu. Tutar/para birimi kuyruğa **kopyalanıyordu**.

**Neden bozuk.** (a) Bounded context ihlali (CLAUDE.md: `findForAuth` dışında yasak);
(b) "klinik bulunamadı" tahsilatı defterden tamamen düşürüyor ve geride hiç iz bırakmıyordu;
(c) kuyruğa kopyalanan tutar, iş geciktiğinde/yeniden denendiğinde bayat veriyle yazma riski.

**Düzeltme.** İş yükü yalnız kimlik taşıyor (`installmentId`, `paymentId`, `clinicId`,
`reason`, `actorId`); tutar/para birimi/durum yazma anında kaynağın kendi modülünden
QueryBus ile okunuyor; organizasyon `TENANT_SCOPE_RESOLVER` ile **şubeden** çözülüyor.
Kaynak taksit bulunamazsa iş sessizce dönmüyor, tipli hata fırlatıyor (failed set + mutabakat).

#### P1-5 · Kaydın tarihi tahsilatın tarihi değil, kaydın yazıldığı an

**Kanıt (eski hâl).** `CreateLedgerEntyCommand` payload'ında `entryDate` hiç gönderilmiyordu;
entity `props.entryDate ?? DateTimeManager.create()` ile **now()** yazıyordu.

**Neden bozuk.** Kuyruk gecikir, iş yeniden denenir ya da backfill geç çalışırsa ayın son
günü alınan tahsilat **sonraki ayın** gelirine düşer. Aylık ciro raporu ile ödeme tarafı
arasında, sebebi görünmeyen bir kayma oluşur (ve ay kapandıktan sonra fark edilir).

**Düzeltme.** `entryDate = installment.paidAt` (yoksa now). Entity testi tarihi kilitliyor.

### 26.4 P2

| #    | Bulgu                                                                                                                                                                             | Düzeltme                                                                                                                                                                                    |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-1 | Kuruş kapısı yok: `Money.create` 2 basamağı zorlamıyor, DB `Decimal(10,2)` üçüncü basamağı sessizce yuvarlıyor                                                                    | Entity `create`'de `assertKurusPrecision` + tipli hata                                                                                                                                      |
| P2-2 | `performedById` kolonu hep `null` — tahsilatı kimin aldığı defterde yok                                                                                                           | Olayın `actorId`'si iş yüküyle taşınıp kayda damgalanıyor                                                                                                                                   |
| P2-3 | `totalExpenses`/`balance` yapısal olarak uydurma: `EXPENSE` satırı hiç yazılmıyor (gider muhasebe defterinde)                                                                     | Alan korundu (defter tipi EXPENSE taşıyor), sorguya ve kontrata **neden 0 olduğu** yazıldı; kaynak eklenirse sorgu değişmiyor. Panelde "kâr/zarar" gösterilecekse kaynak mizan olmalı → §28 |
| P2-4 | Ölü kod: `updateMany` (hem ölü hem `update` yerine `upsert` yapıyordu — CLAUDE.md ihlali), `updateStatus`, `updateManyStatusByPaymentId`, 0 byte'lık publisher + boş event modülü | Hepsi silindi; repo arayüzü `create`/`update`/`findByInstallmentId`'ye indi                                                                                                                 |
| P2-5 | `toPersistence()` her çağrıda `now()` üretiyordu (chart-of-accounts P2-1 ile aynı)                                                                                                | Saf hâle getirildi; `updatedAt`'ı yalnız gerçek geçiş günceller                                                                                                                             |
| P2-6 | `CreateLedgerEntryDto` command dosyasının içinde, "TODO: sharede eklenecek" ile                                                                                                   | Komut tamamen kaldırıldı; HTTP sözleşmeleri `@shared/modules/finance-ledger`'da (şema + DTO + tip + endpoint kaydı)                                                                         |

---

## 27. `party` — Cari Taraf (hasta / tedarikçi / personel kartı)

Denetim tarihi: **2026-10-11**. Kapsam: entity, 3 ensure komutu, 2 query, repo'lar,
controller, response DTO ve şema (`party.prisma`).

### 27.1 Kontrol listesi sonucu

| Başlık                 | Durum                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Para/matematik         | — (cari tutar taşımaz)                                                                |
| İdempotentlik (ensure) | ✅ `(clinicId, originType, originId)` unique + yarışta yeniden okuma                  |
| Rol birikimi           | ❌ **P1-1** `addRole` hiç rol eklemiyordu (Guard nesnesi truthy)                      |
| Yetki kapsamı — liste  | ❌ **P1-2** kapı şube seviyesinde, veri **organizasyon** geneliydi                    |
| Kiracı kimliği         | ❌ **P1-3** hasta carisinde `organizationId` hastadan geliyordu, şubeden çözülmüyordu |
| Hata tipleri           | ❌ **P1-4** `PartyAlreadyExistsError extends Error` (500), `hasRole` çıplak `Error`   |
| Kimlik snapshot'ı      | ⚠️ **P2-1** kaynakta boş TCKN bilinen TCKN'yi siliyordu                               |
| `isActive`             | ⚠️ **P2-2** hiçbir yerde okunmuyordu (süs)                                            |
| Muhasebe hesap bağı    | ⚠️ **P2-3** `receivableAccountId`/`payableAccountId` ne yazılıyor ne okunuyor         |
| KVKK                   | ✅ `nationalId` yalnız DATA_OWNER/MANAGEMENT/ADMIN grubunda                           |
| Audit izi              | ⚠️ olay yok; cari otomatik köprülerle açılıyor (bkz. §28)                             |
| Testler                | ❌ modülde tek bir test yoktu                                                         |

### 27.2 P1

#### P1-1 · `addRole` hiç rol eklemiyordu — aynı kişinin ikinci rolü hiç kazanılmıyordu

**Kanıt (eski hâl).** `party.entity.ts`:

```ts
public addRole(role: PartyRole): boolean {
  if (this.hasRole(role)) return false;   // hasRole → Guard<boolean> NESNESİ
  ...
}
```

`hasRole` bir `Guard` **nesnesi** döndürüyor; koşul nesnenin kendisi üzerinde çalıştığı için
daima `true`. Yani `addRole` her çağrıda `false` dönüp **hiçbir rol eklemiyordu**.

**Neden bozuk.** `ensure()` tek giriş noktası: hasta olarak açılmış bir cari sonradan
`CUSTOMER`, tedarikçi olarak açılmış bir cari sonradan `EMPLOYEE` rolünü hiç kazanmıyor.
Rol süzgeçli cari listesi (`?role=SUPPLIER`) o kaydı hiç göstermiyor; rol bazlı hesap
çözümlemesi (120/320) yarın bu alana bağlandığında yanlış hesaba fiş atacaktı. Derleyici
göremez: nesne de geçerli bir koşul ifadesidir. **Ödeme turunda kapatılan
`validate.status.*` hatasının aynısı** (§18.1 P0-2) — bu kalıbın üçüncü tekrarı.

**Düzeltme.** `if (this.hasRole(role).value)`. Ayrıca tüm finans/supply/hr entity'lerinde
`if (this.isX())` çağrıları tarandı: diğerlerinin hepsi düz `boolean` döndürüyor, başka
örnek yok.

#### P1-2 · Cari listesi şube yetkisiyle **organizasyon** geneli dönüyordu

**Kanıt (eski hâl).** `find-parties.handler.ts` kapıyı `canAccessClinicFinances(clinicId)`
ile açıyor, sonra `partyRepo.findMany({ organizationId })` çağırıyordu; alan görünürlüğü de
`getOrganizationSerializationOptions` ile org seviyesinde veriliyordu.

**Neden bozuk.** A şubesinin `finance:read` yetkili personeli, aynı organizasyondaki **B
şubesinin** tedarikçilerini, hastalarını, telefon/adreslerini ve vergi numaralarını
listeleyebiliyordu. Cari, şemadaki yorumla da "defteri tutan şubeye ait" (`clinicId`
source-of-truth, `organizationId` yalnız konsolide raporlama için denormalize). Kapı ile
veri iki ayrı eksende olduğu için şube yalıtımı fiilen yoktu.

**Düzeltme.** Süzgeç yetkiyle aynı eksene alındı: `findMany({ clinicId })` + alan
görünürlüğü `getSerializationOptions({ clinicId })`. Cari **detay** ucu da org
serileştirmesinden şube serileştirmesine çekildi. Konsolide (org geneli) cari listesi
gerektiğinde `find-invoices`'taki kalıp uygulanır: **org yönetimi** kapısı
(`actorCanManageTargetOrganization`) + org serileştirmesi.

#### P1-3 · Hasta carisinde organizasyon istemciden/hastadan geliyordu

**Kanıt (eski hâl).** `ensure-party-for-patient.handler.ts:39`
`organizationId: patient.organizationId`.

**Neden bozuk.** Cari, işlemin geçtiği **şubenin** defterine yazılıyor (`clinicId` çağrıdan).
Hastanın kayıtlı olduğu şube başka bir organizasyona bağlıysa (ortak klinik / sağlık turizmi
iş birliği) cari satırı `clinicId = B şubesi`, `organizationId = A organizasyonu` olarak
damgalanıyor: defter satırları B'de, cari ise A'nın konsolide raporunda görünüyor — cari
mutabakatı iki tarafta da tutmuyor. CLAUDE.md kuralı net: kiracı kimliği istemciden/başka
kayıttan alınmaz, `TENANT_SCOPE_RESOLVER` ile `clinicId`'den çözülür.

**Düzeltme.** `tenantScopeResolver.resolve({ clinicId })`. (Personel carisi bunu zaten doğru
yapıyordu — hasta tarafı sapmıştı.)

#### P1-4 · Yarış hatası 500'e dönüşüyordu

**Kanıt.** `PartyAlreadyExistsError extends Error`. `EnsurePartyHandler` yarışta bunu
yakalayıp mevcut kaydı okuyor; ama yeniden okuma da boş dönerse hata `DomainException`
olmadığı için `errorCode`'suz 500 olarak dışarı çıkıyordu — fatura/tahsilat köprüsü
sebebi görünmeyen bir hatayla duruyordu.

**Düzeltme.** `PartyAlreadyExistsException extends DomainException` (409, meta: origin),
`PartyRoleMissingException`, `PatientNotFoundForPartyException` (handler'daki
`NotFoundException` — application katmanında HTTP hatası — kaldırıldı).

### 27.3 P2

| #    | Bulgu                                                                                                     | Düzeltme                                                                                                                                                                                                                                       |
| ---- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-1 | `ensure` kaynakta boş olan TCKN/VKN ile **bilinen** değeri siliyordu (`isNotUndefined(null)` → true)      | Kimlik alanlarında `null` "bilinmiyor" sayılıyor: otomatik köprü bilinen kimliği silmiyor. Gerçek kişide TCKN olmadan e-fatura kesilemez; kayıp sessiz ve geri dönüşsüzdü (kural 9)                                                            |
| P2-2 | `isActive` hiçbir çözümleme/fişleme noktasında okunmuyordu — güvence değil süs (kural 10)                 | `ensure` pasif cariyi **yeniden aktifleştiriyor**: yeni bir mali hareket geldiyse cari fiilen aktiftir. Engellemek parayı defter dışında bırakırdı; pasif bırakmak `?isActive=true` süzgeçli mutabakatta bakiyesi olan cariyi görünmez yapardı |
| P2-3 | `receivableAccountId`/`payableAccountId` ne yazılıyor ne okunuyor; fişleme hesabı **rol bazında** çözüyor | Şemaya "bugün okunmuyor" uyarısı + ihtiyaç doğduğunda çözüm noktasında (account-resolver) zorlanacağı notu (kural 10)                                                                                                                          |

---

## 28. Uygulanan düzeltmeler (2026-10-11, 3. tur)

| #            | Düzeltme                                                                                                                                                    | Dosya(lar)                                                                                                                                                                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §26 P0-1     | İki yazma yolu tek **idempotent + sıraya duyarsız** komuta indirildi; kayıt yazılırken kaynağın nihai durumu okunuyor; REFUNDED/CANCELLED → COMPLETED yasak | `sync-installment-ledger-entry/*` (yeni), `finance-ledger.entity.ts` (`syncStatus`, `status` prop), `payment-refunded.listener.ts`, `create-ledger-enty/` + `refund-ledger-entries/` **silindi**                                                                            |
| §26 P0-2     | Mutabakat sorgusu + telafi komutu + HTTP uçları; başarısız iş kuyrukta kalıyor                                                                              | `find-ledger-mismatches/*`, `backfill-ledger-entries/*`, `finance-ledger.command.controller.ts` (yeni), `finance-ledger.query.controller.ts`, `finance-ledger.producer.ts` (`jobId`, `removeOnFail: false`)                                                                 |
| §26 P0-2     | Mutabakatın kaynak tarafı: payment modülünde sonuçlanmış taksitler + tek taksit okuması                                                                     | `find-settled-installments/*`, `get-installment-for-ledger/*` (yeni), `payment.query.repository.ts` (+`SETTLED_STATUSES`), `payment-queries.contracts.ts`                                                                                                                   |
| §26 P1-1     | Üç özet de para birimi kırılımında; ROI raporu referans dışı para birimini orana katmıyor ve bildiriyor                                                     | `finance-ledger.query.repository.ts`, `finance-ledger-queries.contracts.ts`, `finance-ledger-response.dto.ts`, `get-agency-roi-report.handler.ts`, `agency-roi-response.interface.ts`, `apps/web/.../finance-summary-cards.tsx`, `apps/web/.../patient-finance-summary.tsx` |
| §26 P1-2     | P2002 → tipli "zaten var"; yarışta tx **dışında** yeniden okuma                                                                                             | `finance-ledger.command.repository.ts`, `finance-ledger.exceptions.ts` (yeni)                                                                                                                                                                                               |
| §26 P1-3     | Durum geçişi entity üzerinden; tipli hatalar; ham `updateMany` metotları silindi                                                                            | `finance-ledger.entity.ts`, `finance-ledger.rules.ts`, repo arayüzü + implementasyonu                                                                                                                                                                                       |
| §26 P1-4     | Dinleyiciler hiçbir tabloyu okumuyor; iş yükü yalnız kimlik; org şubeden çözülüyor; kaynak yoksa tipli hata                                                 | `payment-completed.listener.ts`, `payment-refunded.listener.ts`, `finance-ledger.producer.ts`, `finance-ledger.proccessor.ts`                                                                                                                                               |
| §26 P1-5     | `entryDate` = taksitin `paidAt`'i                                                                                                                           | `sync-installment-ledger-entry.handler.ts`                                                                                                                                                                                                                                  |
| §26 P2-1,2,5 | Kuruş kapısı, `performedById` damgası, saf `toPersistence`                                                                                                  | `finance-ledger.entity.ts`                                                                                                                                                                                                                                                  |
| §26 P2-4,6   | Ölü repo metotları + boş publisher/event modülü silindi; HTTP sözleşmeleri shared'a taşındı                                                                 | repo'lar, `packages/shared/modules/finance-ledger/**` (şema/tip/DTO/endpoint)                                                                                                                                                                                               |
| §27 P1-1     | `addRole` Guard truthiness hatası (hiç rol eklenmiyordu)                                                                                                    | `party.entity.ts`                                                                                                                                                                                                                                                           |
| §27 P1-2     | Cari listesi ve detayı şube kapsamına alındı                                                                                                                | `find-parties.handler.ts`, `party.query.repository.ts`, `party-queries.contracts.ts`, `get-party-by-id.handler.ts`                                                                                                                                                          |
| §27 P1-3     | Hasta carisinde organizasyon `TENANT_SCOPE_RESOLVER` ile şubeden                                                                                            | `ensure-party-for-patient.handler.ts`                                                                                                                                                                                                                                       |
| §27 P1-4     | Tipli domain hataları (409/404)                                                                                                                             | `party.exceptions.ts`, `party.command.repository.ts`, `ensure-party.handler.ts`                                                                                                                                                                                             |
| §27 P2-1,2   | Bilinen kimlik silinmiyor; pasif cari yeniden aktifleşiyor                                                                                                  | `party.entity.ts`                                                                                                                                                                                                                                                           |
| §27 P2-3     | Okunmayan hesap kolonlarına uyarı notu                                                                                                                      | `schema/party.prisma`                                                                                                                                                                                                                                                       |
| —            | Yeni hata kodları                                                                                                                                           | `error-codes.constant.ts` (`FINANCE_LEDGER.*`, `PARTY.ALREADY_EXISTS/ROLE_MISSING/TENANT_MISMATCH`)                                                                                                                                                                         |

### Testler

| Dosya                                                    | Kapsam                                                                                                                                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `finance-ledger.entity.spec.ts` (yeni, 10 test)          | kuruş sınırı, dışarıdan durum, idempotent hizalama, COMPLETED→REFUNDED, **iadeyi geri alma yasağı**, iptal sonrası gelire dönüş yasağı, `entryDate` tahsilat tarihi, saf `toPersistence`, ham string aktör kimliği                                           |
| `sync-installment-ledger-entry.spec.ts` (yeni, 8 test)   | kayıt yazımı (tutar/para birimi/tarih/damga), **iade önce gelirse REFUNDED yazılması**, geç tahsilat işinin iadeyi geri alamaması, durum hizalama, tahsil edilmemiş taksitte yazmama, unique yarışında hizalama, kaynak yoksa hata, org'un şubeden çözülmesi |
| `find-ledger-mismatches.spec.ts` (yeni, 4 test)          | `MISSING`, `STATUS_DRIFT`, fark yok, boş kaynakta deftere hiç gitmeme                                                                                                                                                                                        |
| `backfill-ledger-entries.spec.ts` (yeni, 3 test)         | sayımlar (recorded/synced), fark yoksa dispatch yok, bir satırın hatası turu durdurmuyor                                                                                                                                                                     |
| `finance-ledger.query.repository.spec.ts` (yeni, 4 test) | **para birimi kırılımını kilitleyen** gruplama anahtarı testleri (klinik özeti, hasta bakiyesi, hasta-başı gelir) + iade edilen planın borç yazmaması + boş id listesi                                                                                       |
| `party.entity.spec.ts` (yeni, 5 test)                    | rol ekleme (regresyon: Guard truthiness), pasif cariyi aktifleştirme, bilinen TCKN'nin silinmemesi, yeni kimliğin yazılması, tipli rol hatası                                                                                                                |
| `find-parties.spec.ts` (yeni, 2 test)                    | şube kapsamlı süzgeç (regresyon: `organizationId` yok), yetkisiz aktörde deftere hiç gitmeme                                                                                                                                                                 |
| `get-agency-roi-report.handler.spec.ts` (+1 test)        | referans dışı para biriminin orana katılmaması + bildirilmesi                                                                                                                                                                                                |

**Doğrulama:** `tsc --noEmit` 0 hata (api **ve** web); `jest` **182 suite / 1107 test**
yeşil (`app.module.spec.ts` dahil → DI grafiği yeni controller/handler'larla ayakta).
Migration **yok** (şema değişikliği yalnız yorum).

---

## 29. Bilinçli yapılmayanlar — `finance-ledger` / `party`

| Konu                                                                           | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cari defterin gider tarafını beslemek**                                      | `LedgerType.EXPENSE` hiç üretilmiyor: alış faturası, bordro ve kasa gideri muhasebe defterine yazılıyor. Yani klinik özetindeki `totalExpenses` daima 0, `balance` = gelir. Bunu "düzeltmek" iki yoldan biriyle olur: (a) gider olaylarını bu deftere de yazmak → **mükerrer kayıt** riski ve iki defteri birbirine bağlayan yeni bir mutabakat ihtiyacı; (b) yönetim özetini mizandan üretmek → doğru ama yeni bir rapor tasarımı. İkisi de para güvenliği düzeltmesi değil ürün kararı. Şimdilik sorguya ve kontrata "neden 0" yazıldı. **Tetikleyici:** panelde "kâr/zarar" ya da "gider" gösterilecekse kaynak `accounting` mizanı olmalı; o rapor yazılırken bu alanlar kaldırılır. |
| **Cari hareket için ayrı audit event**                                         | Kayıt otomatik türetiliyor ve ekonomik olay zaten ödeme tarafında loglanıyor (`PAYMENT_SUCCESS`, `correlationId` ortak); satırın kendisi `entryDate` + `performedById` ile damgalı. Bir de defter olayı yazmak aynı olayı ikinci kez loglamak olurdu. **Tetikleyici:** elle cari hareket girişi (ör. `MANUAL_ENTRY` kaynağı) ya da cari kartı düzenleme ucu açıldığında audit event zorunlu olur — o işlem başka hiçbir yerde loglanmıyor.                                                                                                                                                                                                                                               |
| **`patientId` ile cari hareket listesinin payment tablosuna `include` etmesi** | `findManyByPatientIdWithDetails` ödeme yöntemi ve hekim adını `include: { payment: { provider } }` ile çekiyor (iki seviye, başka modülün ilişkisi). Sayfa başına QueryBus turuna çevirmek N+1 üretir; veri de aynı kiracıya ait tek bir okuma. **Tetikleyici:** payment ayrı servise taşındığında (o noktada satırlara `paymentMethod`/`providerName` denormalize edilir ya da liste projeksiyonu payment tarafında kurulur).                                                                                                                                                                                                                                                           |
| **Organizasyon geneli (konsolide) cari listesi**                               | Liste şube kapsamına alındı; org geneli görünüm **kaldırıldı**, geri eklenmedi. Doğru hâli `find-invoices` kalıbı: org **yönetimi** kapısı + org serileştirmesi + ayrı sorgu. Bunu şimdi yazmak, kullanıcısı olmayan bir uç açmak olurdu. **Tetikleyici:** franchise sahibinin "tüm şubelerin carileri" ekranı istendiğinde.                                                                                                                                                                                                                                                                                                                                                             |
| **Cari kartı için elle düzenleme/pasifleştirme ucu**                           | `deactivate()` hiçbir yerden çağrılmıyor, düzenleme ucu yok (cari tamamen otomatik köprülerden doğuyor). Uç açmak yetki (`PARTY.update`), audit event ve "hangi alan kaynaktan hangisi elle" ayrımını birlikte gerektirir — kimlik alanları her `ensure`'da kaynaktan yeniden yazıldığı için elle düzeltme bir sonraki tahsilatta geri alınır. **Tetikleyici:** "tedarikçinin vergi dairesi yanlış, elle düzeltmek istiyorum" ihtiyacı; o zaman alan-bazlı "elle kilitlendi" işareti de gerekir.                                                                                                                                                                                         |
| **Mutabakat turunun zamanlanmış işe bağlanması**                               | Sorgu ve telafi komutu elle çağrılıyor (operatör penceresini kendisi seçiyor). Günlük süpürme eklemek, `accounting/financial-events`'teki günlük tarama ile aynı kalıpta kolay; ama telafi turu **yazma** yapıyor ve hangi pencerede ne kadar geriye gideceği bir operasyon kararı. **Tetikleyici:** mutabakat ekranı canlıda kullanılmaya başlayıp "her sabah otomatik dönsün" dendiğinde.                                                                                                                                                                                                                                                                                              |

---

## 30. `treatment-charge` — Fiyatlı İşlem Satırı (faturanın ticari dayanağı)

Denetim tarihi: **2026-10-11**. Kapsam: entity, toplam hesaplayıcı, repo'lar, 3 command +
2 query, controller'lar, şema (`treatment.prisma`) ve satırın **dışa dönük sözleşmesi**
(fatura ve tahsilat tutarının kaynağı olması).

### 30.1 Kontrol listesi sonucu

| Başlık                              | Durum                                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| Para/matematik                      | ✅ `Decimal` + satır tutarında tek yuvarlama noktası; ⚠️ kuruş kapısı yoktu (**P1-3**)         |
| Hesap sırası (indirim → KDV)        | ✅ KDV iskonto sonrası matrah üzerinden                                                        |
| Para birimi                         | ✅ satırda açık; karışık para birimi/oran özet üretirken reddediliyor                          |
| Donmuş fiyat                        | ✅ `listPrice` satır doğarken kopyalanıyor, sonradan değişmiyor                                |
| Eşzamanlılık — satır mutasyonu      | ✅ `findByIdForUpdate` (indirim/iptal)                                                         |
| Eşzamanlılık — **tutarın tüketimi** | ❌ **P0-1** fatura/tahsilat tutarı kilitsiz, Query Repo'dan, ayrı tx'te okunuyordu             |
| Para birimi tutarlılığı (tahsilat)  | ❌ **P0-2** tutar satırlardan, para birimi **istemciden** alınıyordu                           |
| Varlık invariant'ları               | ❌ **P1-1** adet ≤ 0 / 3 ondalıktan ince, indirim < 0 veya > 100 entity'de serbest             |
| Kabul kümesi (KDV)                  | ❌ **P1-2** kapı 0–100, kullanım yeri `{0,1,10,20}` (kural 12)                                 |
| Audit izi                           | ❌ **P1-4** başarılı ekleme/indirim/iptal hiçbir yere yazılmıyordu; `voidedById` kolonu yok    |
| Yetki ayrımı (SoD)                  | ⚠️ tavan aşımı yöneticinin **öz-onayı** (ayrı capability yok) — bkz. §32                       |
| Durum geçişi                        | ✅ iptal tek yönlü, çift iptal tipli hata; fatura kesildiyse mutasyon kapalı                   |
| Testler                             | ⚠️ entity + hesaplayıcı + iptal handler'ı test edilmişti; invariant/audit/kilit testleri yoktu |

### 30.2 P0 — Canlı öncesi kapanmalı

#### P0-1 · Fatura tutarı kilitsiz okunuyordu: fatura kendi satırlarıyla uyuşmaz hâle gelebiliyor

**Kanıt (eski hâl).** `issue-invoice.handler.ts:88` satır toplamını
`GetAppointmentChargeSummaryQuery` ile — yani **Query Repo**'dan, **hiçbir transaction
olmadan** — okuyor; faturayı `:120` satırında **ayrı** bir `outboxRun()` içinde yazıyordu.
`create-payment.handler.ts:81` aynı sorguyu kullanıyor ve handler'da hiç
`TransactionManager` yoktu. Command Repo'daki `findActiveByAppointmentId` metodu
(yorumunda "fatura/tahsilat tutarı bu satırlardan türer ve karar besler" yazıyor)
**hiçbir yerden çağrılmıyordu.**

**Neden bozuk.** Okuma ile yazma arasındaki pencerede bir satır iptal edilebilir
(`void-treatment-charge`) ya da indirimi değişebilir (`update-charge-discount`) — ikisi de
kendi satırını kilitliyor ama **özet okuması hiçbir şey kilitlemiyordu**. Fatura o zaman
kendi satırlarının toplamından farklı bir tutarla kesilir; `assertAppointmentNotInvoiced`
fatura varken satır düzeltmesini de engellediği için fark **kalıcı** kalır — tek çıkış
faturayı iptal etmek. Query Repo'ların read-replica'ya yönlenebilir olması (bkz. CLAUDE.md
Command/Query Repo kuralı) aynı hatayı replication lag ile **yarış olmadan da** üretir.
Bu, §3 P0-1'deki (dönem kapısı TOCTOU) kalıbın satır toplamına uygulanmış hâlidir.

**Düzeltme.** Toplam artık **kilitli** bir domain servisinden okunuyor:
`CHARGE_TOTALS_SERVICE.lockAndGetAppointmentTotals(appointmentId)` — satırları
`SELECT … FOR UPDATE` ile kilitler, `ChargeTotalsCalculator`'dan geçirir ve sonucu bir
**Value Object** (`AppointmentChargeTotals`, `Money` alanlarıyla) olarak döner. Çağrı
fatura/tahsilat transaction'ının **içinden** yapılır. İptal ve indirim yolları aynı
satırları kilitlediği için artık serileşiyorlar: fatura önce commit ederse iptal
`assertAppointmentNotInvoiced` ile reddedilir; iptal önce commit ederse fatura iptal
sonrası toplamı görür.

> Kalan (bilinçli) pencere: **yeni satır eklenmesi**. Satır kilidi mevcut satırları
> serileştirir ama INSERT'i engellemez (phantom). Fatura commit ettikten sonra gelen
> ekleme zaten `assertAppointmentNotInvoiced` ile reddedilir; faturadan hemen önce
> commit eden ekleme ise faturaya girmemiş **görünür** bir satır bırakır (sessiz bozulma
> değil). Tam serileştirme randevu satırını kilitlemeyi gerektirir — başka modülün
> tablosu; bkz. §32.

#### P0-2 · Tahsilat tutarı satırlardan, para birimi istemciden: yanlış birimli tahsilat

**Kanıt (eski hâl).** `create-payment.handler.ts:89`
`Money.create(summary.grandTotal, data.currency)` — tutar satır özetinden, para birimi
ise `CreatePaymentSchema.currency` ile **istemciden** geliyordu.

**Neden bozuk.** Satırlar EUR iken istemci TRY gönderirse EUR tutar TRY olarak kaydedilir.
Cari defter ve muhasebe köprüsü bu yanlış birimi devralır (fişleme fonksiyonel paraya
çevirirken yanlış kurdan geçirir); fatura ise kendi uyuşmazlık kontrolü (§12 P1-7,
`InvoiceCurrencyMismatchException`) sayesinde **hiç kesilemez**. Yani sonuç "tahsilat
yanlış birimde kayıtlı + fatura kesilemiyor" durumudur ve sebebi tahsilat tarafında
görünmez.

**Düzeltme.** Tutar ve para birimi **aynı kaynaktan** gelir: tutar satırlardan türüyorsa
para birimi de satırlardan alınır; istemcinin gönderdiği birim farklıysa
`PaymentChargeCurrencyMismatchException` (409) ile kapıda durdurulur.

### 30.3 P1

#### P1-1 · Varlığın kendi invariant'ları yoktu (kapı dışındaki her çağıran korumasız)

**Kanıt.** `TreatmentCharge.create` yalnız indirim **tavanını** (politika) kontrol
ediyordu. Entity'de adet ve oran aralığı kontrolü yoktu; kapıdaki zod şeması
(`quantity.positive()`, `discountRate.min(0).max(100)`) bunları zorluyordu.

**Neden bozuk.** Negatif indirim sessizce **zam**a dönüşüyordu: `netAmount = listTotal −
(−X) = listTotal + X`, `Money.fromTrusted` negatif indirim tutarını doğrulamadığı için
hiçbir yerde hata vermiyordu. %100 üstü indirim ise `Money.subtract` içinde
`InsufficientFundsException` ("yetersiz bakiye") üretiyordu — sebebinden tamamen kopuk bir
hata. Sıfır/negatif adet bedelsiz ya da negatif satır yazıyordu. Kural 10: varlığın
değişmez kuralı, varlığın çözümlendiği yerde zorlanır; tek bir çağrı yolunda tutmak
diğer N−1 yolu (paket atama, içe aktarma, telafi) korumasız bırakır.

**Düzeltme.** `assertValidQuantity` (pozitif + ≤3 ondalık, DB `Decimal(10,3)`),
`assertValidDiscountRate` (0–100; **yönetici bile aşamaz** — tavan politikadır, aralık
invariant'tır), `assertKurusPrecision` (liste fiyatı ≤2 ondalık). Üçü de tipli domain
hatası fırlatır ve `applyDiscount` yolunda da çalışır.

#### P1-2 · KDV kabul kümesi kapıda geniş, kullanım yerinde dar (kural 12)

**Kanıt.** `AddTreatmentChargeSchema.vatRate: z.coerce.number().int().min(0).max(100)`
ve `SetTaxParameterSchema.rate: z.number().min(0).max(100)` — oysa `VatRate` VO yalnız
`STATUTORY_VAT_RATES` (`{0,1,10,20}`) kabul ediyor. Sabit `apps/api`'de durduğu için
shared şemalar onu import **edemiyordu** (shared → apps/api bağımlılığı yasak).

**Düzeltme.** Sabit `packages/shared/common/constants/tax.constant.ts`'e taşındı; api
tarafındaki `@src/domain/constants/tax` yolu onu yeniden dışa açıyor (import yolları
bozulmadı). Her iki HTTP kapısı artık aynı sabiti import ediyor; `TaxParameter` entity'si
ve `VatRate` VO'su da aynı listeyi zorluyor. Vergi parametresine ondalık sınırı
(`multipleOf(0.01)`, DB `Decimal(5,2)`) ve KDV anahtarlarına yasal küme kontrolü eklendi.

#### P1-3 · Adet ve liste fiyatında kuruş/ondalık kapısı

`quantity` DB'de `Decimal(10,3)`, `listPrice` `Decimal(10,2)`. Kapı yalnız "pozitif"
diyordu; 1.2345 adet ya da 100.555 TL liste fiyatı **sessizce** yuvarlanıp satırın
dondurulmuş fiyatını kaynağından kaydırıyordu. Hem şemaya (`multipleOf(0.001)`) hem
entity'ye guard eklendi.

#### P1-4 · İndirim ve iptal kararlarının denetim izi yoktu

**Kanıt.** `TREATMENT_CHARGE_EVENTS` sabitleri (`ADDED`, `DISCOUNT_UPDATED`, `VOIDED`)
yalnız **yetki hatası** loglamasında (`orThrow(...)` argümanı) kullanılıyordu; başarılı
işlemde hiçbir event raise edilmiyordu ve modülde dinleyici yoktu. Şemada `voidedAt` +
`voidReason` vardı ama **`voidedById` yoktu**.

**Neden bozuk.** Satır faturanın ticari dayanağıdır: bir satırın faturadan çıkarılması
(iptal) ya da indirimin değiştirilmesi doğrudan tahsil edilecek parayı değiştirir. "Kim
iptal etti" sorusunun yanıtı **hiçbir yerde** yoktu; indirim geçmişi (%40 → %0 → %45) de
tutulmuyordu (satırda yalnız güncel oran var). Tavan aşımında `discountApprovedById`
damgası vardı, tavan altındaki değişiklikler izsizdi. Kural 7 kalıcı damga (event +
kolon) istiyor.

**Düzeltme.** Üç domain olayı entity içinde raise ediliyor
(`TreatmentCharge.add` / `applyDiscount` / `void`), `TreatmentChargeLifecycleListener`
bunları audit log'a yazıyor (indirim olayı **önceki oranı** da taşır), ve `voidedById`
kolonu eklendi (**migration**). Olaylar `IAuditLog` alanlarını aktörden alıyor
(`ctx.actor.userId` + `ctx.actor.source`).

### 30.4 P2

| #    | Bulgu                                                                                     | Düzeltme                                                                                    |
| ---- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| P2-1 | `create-payment` handler'ında hiç `TransactionManager` yoktu (CLAUDE.md KURAL 2)          | Yazma + kilitli okuma `txManager.run()` içine alındı (iç içe çağrıda dıştaki tx kullanılır) |
| P2-2 | Satır toplamının iki tüketicisi (fatura, tahsilat) aynı okumayı iki ayrı yoldan yapıyordu | Tek kilitli domain servisi + `AppointmentChargeTotals` VO                                   |

---

## 31. `payroll` — Bordro Tahakkuku

Denetim tarihi: **2026-10-11**. Kapsam: tek command (`record-payroll-accrual`),
controller, `PayrollBreakdown` VO ve şema. Modül kalıcı bir tablo tutmaz: hesaplanmış
brüt→net rakamları dışarıdan alıp **ekonomik olay** (`PAYROLL_ACCRUED`) yazar, fişi
posting üretir (770×2 / 335 + 360 + 361).

### 31.1 Kontrol listesi sonucu

| Başlık          | Durum                                                                                |
| --------------- | ------------------------------------------------------------------------------------ |
| Kimlik tipi     | ❌ **P0-3** `employeeUserId: z.uuid()` — `User.id` Firebase UID; uç hiç çalışmıyordu |
| Para/matematik  | ❌ **P1-5** kuruş kapısı yok; döküm `toFixed(2)` ile sessizce yuvarlanıyor           |
| Denge özdeşliği | ✅ brüt = net + stopaj + işçi SGK (VO'da), işveren SGK doğru şekilde dışarıda        |
| Hata tipleri    | ❌ **P1-6** dengesiz dökümde çıplak `Error` (500, `errorCode` yok)                   |
| İdempotentlik   | ✅ `dedupeKey`/`sourceRefId` = personel + ay (aya inilebilir)                        |
| Atomiklik       | ✅ `outboxRun` + köprü hatasında komut hataya düşüyor (kısmi durum yok)              |
| Kiracı kimliği  | ⚠️ **P2-3** `organizationId` DTO'da zorunluydu (resolver doğruluyor ama gereksiz)    |
| Dönem kapısı    | ✅ `RecordFinancialEventCommand` üzerinden (posting dönem kapısını tutuyor)          |
| Yetki ayrımı    | ⚠️ `FINANCIALEVENT.create` + klinik **erişimi**; ayrı bordro yetkisi yok — bkz. §32  |
| Testler         | ❌ modülde tek bir test yoktu                                                        |

### 31.2 P0

#### P0-3 · `employeeUserId` UUID sanılıyordu: bordro tahakkuku hiç çalışmıyordu

**Kanıt.** `RecordPayrollAccrualSchema.employeeUserId: z.uuid()`. Oysa aynı değer
`EnsurePartyForEmployeeCommand` → `FindOneWithIdOrEmailQuery` zincirine gidiyor ve
`User.id` bir **Firebase UID**'dir (28 alfanümerik karakter, UUID değil).

**Neden bozuk.** Gerçek bir personel kimliğiyle yapılan her istek HTTP kapısında 400 ile
düşüyordu; yani bordro tahakkuku uç olarak var ama **hiç kullanılamaz** durumdaydı.
Kasa/banka turundaki (§23 P0) kimlik hatasının **şema kapısı** versiyonu — aynı yanlış
varsayımın dördüncü tekrarı.

**Düzeltme.** `employeeUserId` ham string (uzunluk sınırlı); şemaya kuralın **neden**
böyle olduğu yazıldı. Kapıyı kilitleyen bir şema testi eklendi.

### 31.3 P1

#### P1-5 · Bordro tutarlarında kuruş kapısı yok → fiş dengesizliği

`z.number().nonnegative()` kuruştan ince değere izin veriyordu. `PayrollBreakdown` denge
kontrolünü **yuvarlanmamış** Decimal'lerle yapıyor, sonra her bileşeni `toFixed(2)` ile
dışa veriyor: 100.005 + 0.005 = 100.01 girdi dengeli, yuvarlanmış hâli (100.01 + 0.01 ≠
100.01) **dengesiz**. Bu döküm fişe dönüştüğünde hata yevmiyenin "Σborç = Σalacak"
kontrolünde, sebebinden kopuk bir yerde çıkıyordu. Beş tutara `multipleOf(0.01)` eklendi.

#### P1-6 · Dengesiz dökümde çıplak `Error`

`PayrollBreakdown.create().orThrow()` `new Error(...)` fırlatıyordu → 500, `errorCode`
yok, frontend hangi iki tutarın uyuşmadığını göremiyor. Tipli
`UnbalancedPayrollBreakdownException` (brüt + çözümlenen tutar `meta`'da).

### 31.4 P2

| #    | Bulgu                                                          | Düzeltme                                                                                        |
| ---- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| P2-3 | `organizationId` DTO'da zorunluydu (kiracı kimliği istemciden) | Şemadan kaldırıldı; `TENANT_SCOPE_RESOLVER` `clinicId`'den çözer (kasa turundaki aynı düzeltme) |

---

## 32. Uygulanan düzeltmeler (2026-10-11, 4. tur)

| #        | Düzeltme                                                                                        | Dosya(lar)                                                                                                                                                                                                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §30 P0-1 | Satır toplamı **kilitli** domain servisinden, fatura/tahsilat transaction'ının içinden okunuyor | `domain/services/charge-totals/*` (yeni: interface + token + yerel servis + yaprak modül), `domain/value-objects/appointment-charge-totals.vo.ts` (yeni), `treatment-charge.command.repository.ts` (+`findActiveByAppointmentIdForUpdate`), `issue-invoice.handler.ts`, `create-payment.handler.ts` |
| §30 P0-2 | Tahsilatta tutar ve para birimi aynı kaynaktan; uyuşmazlık tipli 409                            | `create-payment.handler.ts`, `payment.exceptions.ts` (+`PaymentChargeCurrencyMismatchException`)                                                                                                                                                                                                    |
| §30 P1-1 | Adet/oran/kuruş invariant'ları entity'de (yönetici de %100'ü aşamaz)                            | `treatment-charge.entity.ts`, `treatment-charge.exceptions.ts` (+3 tipli hata)                                                                                                                                                                                                                      |
| §30 P1-2 | KDV kabul kümesi tek sabitte; iki HTTP kapısı onu import ediyor                                 | `packages/shared/common/constants/tax.constant.ts` (yeni), `apps/api/src/domain/constants/tax/statutory-tax-rates.constant.ts` (re-export), `add-treatment-charge.schema.ts`, `set-tax-parameter.schema.ts`                                                                                         |
| §30 P1-3 | Adet ≤3 ondalık (şema + entity), liste fiyatı ≤2 ondalık                                        | `add-treatment-charge.schema.ts`, `treatment-charge.entity.ts`                                                                                                                                                                                                                                      |
| §30 P1-4 | Ekleme/indirim/iptal denetim olayları + `voidedById` damgası                                    | `domain/events/treatment-charge.events.ts` (yeni), `treatment-charge-lifecycle.listener.ts` + `treatment-charge-event.module.ts` (yeni), `treatment-charge.entity.ts` (`add`, `void` damgası), 3 handler, `schema/treatment.prisma`, **migration** `20261011140000_treatment_charge_voided_by`      |
| §30 P2-1 | `create-payment` artık `TransactionManager` kullanıyor                                          | `create-payment.handler.ts`, `payment/application/commands/command.module.ts`                                                                                                                                                                                                                       |
| §31 P0-3 | `employeeUserId` ham string (Firebase UID)                                                      | `record-payroll-accrual.schema.ts`                                                                                                                                                                                                                                                                  |
| §31 P1-5 | Bordro tutarlarına kuruş kapısı                                                                 | `record-payroll-accrual.schema.ts`                                                                                                                                                                                                                                                                  |
| §31 P1-6 | Dengesiz dökümde tipli domain hatası                                                            | `payroll-breakdown.vo.ts`, `payroll-breakdown.exceptions.ts` (yeni)                                                                                                                                                                                                                                 |
| §31 P2-3 | `organizationId` bordro DTO'sundan kaldırıldı                                                   | `record-payroll-accrual.schema.ts`                                                                                                                                                                                                                                                                  |
| —        | Yeni hata kodları + log eylemleri                                                               | `error-codes.constant.ts` (`TREATMENT_CHARGE.INVALID_*`, `PAYMENT.CURRENCY_MISMATCH`, `PAYROLL.UNBALANCED_BREAKDOWN`), `log-action.constant.ts` (3 `TREATMENT_CHARGE_*`)                                                                                                                            |

### Testler

| Dosya                                                  | Kapsam                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `treatment-charge.entity.spec.ts` (+9 test)            | sıfır/negatif adet, 3 ondalıktan ince adet, negatif indirim (sessiz zam regresyonu), %100 üstü indirimin yöneticide de reddi, kuruştan ince liste fiyatı, indirim değişikliğinde aralık kontrolü, ekleme olayı (tutar + ham string aktör), indirim olayının **önceki oranı** taşıması, iptalin `voidedById` damgası |
| `local-charge-totals.service.spec.ts` (yeni, 2 test)   | **kilitli** varyantın çağrıldığı (kilitsiz olanın çağrılmadığı), toplamların `Money` olarak dönmesi, satırsızda `null`                                                                                                                                                                                              |
| `create-payment.spec.ts` (yeni, 3 test)                | tutar+para biriminin satırlardan gelmesi, okumanın transaction **içinde** olması (çağrı sırası), para birimi uyuşmazlığında yazmama, satırsızda tipli hata                                                                                                                                                          |
| `issue-invoice.spec.ts` (+1 test, mevcut 8 uyarlandı)  | satır toplamının `outboxRun` **içinde** ve kilitli servisten okunduğu                                                                                                                                                                                                                                               |
| `payroll-breakdown.spec.ts` (yeni, 3 test)             | dengeli döküm, dengesizde tipli hata + `meta`, işveren SGK'nın dengeye girmemesi                                                                                                                                                                                                                                    |
| `record-payroll-accrual.schema.spec.ts` (yeni, 3 test) | Firebase UID kabulü (regresyon), kuruştan ince tutar reddi, `organizationId`'nin şemada olmaması                                                                                                                                                                                                                    |
| `add-treatment-charge.schema.spec.ts` (yeni, 3 test)   | yasal KDV kümesi kabulü/reddi (kural 12 regresyonu), 3 ondalıktan ince adet reddi                                                                                                                                                                                                                                   |

**Doğrulama:** `tsc --noEmit` 0 hata (api **ve** web); `jest` **187 suite / 1131 test**
yeşil (`app.module.spec.ts` dahil → yeni yaprak servis modülü ve dinleyici DI grafiğinde
ayakta). `pnpm prisma:generate` çalıştırıldı (yeni kolon).

> ⚠️ **Migration kullanıcı uygular:** `20261011140000_treatment_charge_voided_by`.
> Tek nullable kolon ekler, backfill **yok**: geçmiş iptallerin aktörü bilinmiyor ve
> uydurulamaz (boş değer "damga eklenmeden önce yapıldı" demektir).

---

## 33. Bilinçli yapılmayanlar — `treatment-charge` / `payroll`

| Konu                                                                    | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Faturadan önce eklenen satır (phantom INSERT) için tam serileştirme** | Satır kilidi mevcut satırları serileştirir, INSERT'i engellemez. Tam serileştirme randevu satırını (`appointments`) kilitlemeyi gerektirir — **başka modülün tablosu**; bounded context'i ham SQL ile aşmak, kazanılan güvenceden pahalı. Kalan pencere sessiz değil: faturadan sonra gelen ekleme `assertAppointmentNotInvoiced` ile reddedilir, hemen öncesinde commit eden ekleme ise "faturaya girmemiş satır" olarak **görünür** kalır. **Tetikleyici:** randevu bazlı bir "fiyatlandırma kapandı" bayrağı/aggregate'i çıkarsa (ör. `Appointment.pricingClosedAt`), kilit oraya taşınır.                                                                                |
| **İndirim tavanı aşımı için ayrı capability + 4-göz onayı**             | Bugün tavanı yalnız kliniği **yöneten** aktör aşabiliyor ve satıra kendi id'si `discountApprovedById` olarak damgalanıyor — yani bu bir **öz-onay**. Ayrı bir capability eklemek yetki matrisinin model-türevli olmasıyla çakışıyor (`roles.ts` capability'leri Prisma modellerinden üretiyor; `TREATMENTCHARGE.approveDiscount` gibi bir eylem-bazlı yetki yeni bir mekanizma ister) ve gerçek 4-göz onayı satırı "onay bekliyor" durumunda tutmayı gerektirir — randevu kasasını bekletir. **Tetikleyici:** klinik "şu orandan fazlasını müdür onaylasın" dediğinde; o zaman eşik + bekleyen durum + ayrı yetki birlikte tasarlanır (kasa farkı onayı §25 ile aynı kalıp). |
| **Bordro için ayrı yetki (`payroll:*`)**                                | Tahakkuk `FINANCIALEVENT.create` ile yapılıyor; maaş rakamları dışarıdan geldiği için veri **sızdırma** değil **yazma** riski var. Ayrı yetki, capability üretiminin model-türevli olması nedeniyle ya bir `Payroll` modeli ya da sanal capability mekanizması ister. **Tetikleyici:** bordro kalıcı bir tabloya bağlandığında (aşağıdaki madde) yetki de onunla birlikte doğar.                                                                                                                                                                                                                                                                                             |
| **Bordronun kalıcı belgesi (tablo) ve mutabakatı**                      | Modül yalnız ekonomik olay yazıyor; "bu ay kaç personele ne kadar tahakkuk edildi" sorusu `financial_events` üzerinden yanıtlanıyor. Tablo eklemek bordro hesaplamasını (brüt→net, asgari geçim, kümülatif vergi dilimi) sahiplenmeye doğru bir adımdır ve bu bilinçle **dışarıda** bırakıldı (doc 05 §2.9). **Tetikleyici:** bordro hesabı sisteme alınırsa.                                                                                                                                                                                                                                                                                                                |
| **Satır bazlı fatura kalemleri (invoice line items)**                   | Fatura tek başlık + tek KDV oranı taşıyor; satırlar `treatment_charges`'ta duruyor ve fatura onların **toplamından** doğuyor. e-Belge XML'i kalem bazlı istediğinde satırlar oradan türetilecek; şimdiden `invoice_lines` tablosu açmak aynı veriyi iki yerde tutmak olurdu. **Tetikleyici:** gerçek e-belge adapter'ı (§14.1'de de bekliyor).                                                                                                                                                                                                                                                                                                                               |
| **Karışık KDV oranlı randevunun faturalanması**                         | Özet hesaplayıcı karışık oran/para birimini **reddediyor** (fatura başlığı tek oran taşıyor). Doğru çözüm kalem bazlı fatura; o gelene kadar hata mesajı operatöre durumu açıkça söylüyor. **Tetikleyici:** yukarıdaki madde.                                                                                                                                                                                                                                                                                                                                                                                                                                                |

---

## 34. `accounting/financial-events` — Ekonomik Olay Defteri

Denetim tarihi: **2026-10-11**. Kapsam: entity, iki command (`record-financial-event`,
`record-supplier-payment`), beş query, iki repo, `posting-completeness` domain servisi,
controller'lar, `financial-event.prisma` ve **defterin dışa dönük yazma sözleşmesi**
(`RecordFinancialEventSchema` + tip-başına gövde şemaları).

Bu modül finansın **tek darboğazıdır**: fatura, POS, kasa, bordro, satıcı ödemesi ve
sağlık turizmi tahsilatı — hepsi fişe dönüşmek için buradan geçer. Bu yüzden kapının
genişliği, kullanım yerinin (posting) kabul ettiğinden fazla olduğunda hata tek bir
modülde kalmaz.

### 34.1 Kontrol listesi sonucu

| Başlık                       | Durum                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| Para/matematik — tip         | ✅ tutarlar string (Decimal hassasiyeti), `undefined`/sayı/VO kapıda durduruluyor      |
| Para/matematik — ölçek       | ❌ **P1-1** gövde kapısı sınırsız ondalık kabul ediyor; fiş satırı 2 haneye yuvarlıyor |
| Para birimi                  | ✅ gövdede açık; eksikse defterin fonksiyonel parası (Model A)                         |
| İdempotentlik                | ✅ `dedupeKey` unique + `ON CONFLICT DO NOTHING` (çağıranın tx'i sağ kalır)            |
| Aynı anahtar / farklı kiracı | ✅ `FinancialEventDedupeKeyCollisionException` (sessiz "zaten var" demiyor)            |
| Eşzamanlılık                 | ✅ yarışı kaybeden kazananın kaydını aynı tx içinde okuyor                             |
| Değişmezlik (append-only)    | ✅ `update` yok; entity yalnız `record` + `toPersistence`                              |
| Dönem kapısı (yazma tarafı)  | ❌ **P1-2** geriye dönük tarih sınırsız → fişlenemeyen, düzeltilemeyen olay            |
| Olay ve teslim               | ✅ `outboxRun`; tüketici hatası yutuluyor ama backfill + süpürme + mutabakat var       |
| Teslim görünürlüğü           | ⚠️ **P1-3** CRITICAL uyarı `clinicId: null` → hangi defterin eksik olduğu yazmıyor     |
| Kimlik tipleri               | ❌ **P1-4** `performedById: z.uuid()` — personel kimliği Firebase UID                  |
| Yetki kapsamı                | ✅ beş uçta da kapsam kaydın/kliniğin kendisinden; kapsamsız tarama yalnız sistem      |
| HTTP sınırı                  | ⚠️ **P2-1** ölü `RecordFinancialEventDto` (genel amaçlı defter kapısı)                 |
| Mutabakat                    | ✅ fişlenmemiş olay listesi + backfill + günlük süpürme (§6 P0-4 turunda eklendi)      |
| Aralık doğrulaması           | ⚠️ **P2-2** `from > to` sessizce boş sonuç → "defter temiz" yanılgısı                  |
| Testler                      | ⚠️ entity + iki handler kapsanıyor; **gövde şemasının** ve kapı tiplerinin testi yok   |

### 34.2 P1 — Yakın turda kapanmalı

#### P1-1 · Gövde kapısı kuruş ölçeğini zorlamıyor; 3 ondalık = kalıcı fişsiz olay

**Kanıt.** `finance/shared/domain/contracts/financial-event-payload.schemas.ts:37-42`
(`/^\d+(\.\d+)?$/` — "kasıtlı olarak ondalık hane sayısını sınırlamaz") ↔
`posting/domain/posting/rules/*.rule.ts` (her satır `.toFixed(2)`) ↔
`schema/journal-entry.prisma:9-10` (`Decimal(14,2)`).

Posting her fiş satırını iki haneye yuvarlayıp yazıyor ve `JournalLines.validateBalance()`
**yuvarlanmış** satırlar üzerinde çalışıyor. Bir gövde üç ondalık taşıdığında, tutarın
bölündüğü kurallarda (satış faturası net/KDV, platform komisyon/tedarikçi payı) satırlar
ayrı ayrı yuvarlanınca toplam bir kuruş kayabiliyor:

```
commission 10.005 + supplierAmount 89.995 = saleAmount 100.00   ← kural eşitliği TUTAR
satırlar:  10.01  +            90.00      ≠           100.00   ← fiş DENGESİZ → ret
```

Sonuç sessiz değil ama **kalıcı**: olay defteri append-only olduğu için gövde
düzeltilemez; olay sonsuza dek fişsiz kalır, `sweep-unposted-financial-events` her
turda aynı hatayı tekrarlar ve tek çıkış yolu yoktur. Kural 12'nin tam tanımı: kapı,
kullanım yerinin kabul ettiğinden geniş.

Şemadaki gerekçe ("sıkı kural çalışan bir tahsilatı reddedebilirdi") ölçüldü ve **geçerli
değil**: sekiz üreticinin tamamı ya `toFixed(2)` kullanıyor ya kaynağı `Decimal(x,2)`
kolon; kullanıcıdan tutar alan tek uç (`record-supplier-payment`) kapıda zaten
`\.\d{1,2}` zorluyor.

#### P1-2 · Geriye dönük belge tarihi kapanmış döneme olay yazıyor

**Kanıt.** `financial-event.entity.ts:111` yalnız **üst** sınır koyuyor (gelecek tarih).
Alt sınır hiçbir yerde yok; dönem kapısı yalnız posting'de
(`post-financial-event.handler.ts:88-91`).

Tarihi kullanıcıdan alan üç yol var: `record-purchase-invoice` (`invoiceDate`),
`record-supplier-payment` (`paidAt`), `record-payroll-accrual` (`accrualDate`). Üçünde de
kapanmış/kilitli yıla tarihli belge **kabul ediliyor**, olay yazılıyor, fişi hiç
üretilemiyor. Kullanıcı başarı cevabı alıyor; borç/alacak defterde hiç doğmuyor.

Bu, §13 P1-4'ün açık kalan yarısı ve §15'te "**ikinci bir modül de kapıda dönem kontrolü
isterse servis iki tüketiciyle birlikte tasarlanır**" diye ertelenmişti. Tetikleyici geldi:
satıcı ödemesi ve bordro da aynı kapıyı istiyor, yani üç tüketici var.

#### P1-3 · "Mizan eksik" uyarısı hangi defteri söylemiyor

**Kanıt.** `financial-event-recorded.event.ts:5-9` (payload `clinicId` taşımıyor) →
`financial-event-recorded.listener.ts:54` (`clinicId: null`, yorumu "bu event klinik
taşımıyor (defter organizasyon kapsamında kaydediliyor)").

Yorum yanlış: `financial-event.prisma:3` `clinicId`'yi "defter sahibi şube
(source-of-truth)" olarak tanımlıyor ve entity de taşıyor. Posting hatası bilerek
yutulduğu için bu uyarı, "ekonomik olay var ama fişi yok" durumunun **tek anlık** yüzü;
kiracısız gittiğinde operasyon hangi şubenin mizanının eksik kaldığını alarmdan
okuyamıyor (`OpsAlertInput.clinicId` yönlendirme/etiket alanıdır).

#### P1-4 · Aktör kimliği sözleşmede UUID, gerçekte Firebase UID

**Kanıt.** `record-financial-event.schema.ts:16` (`performedById: z.uuid()`) ↔
`cash-session.entity.ts:191` ("defter tarafı da (`FinancialEvent.performedById`) ham
string tutuyor") ↔ `close-cash-session.handler.ts:118`,
`record-supplier-payment.handler.ts:75`, `close-period.handler.ts:101` (hepsi
`ctx.actor.userId` damgalıyor).

Kimlik varsayımı hatasının **beşinci** tekrarı (öncekiler: kasa oturumu, kasa hareketi,
banka ekstresi, finance-ledger, bordro şeması). Bugün patlamıyor çünkü bu şema HTTP
sınırında hiç `parse` edilmiyor — ama aynı dosyada duran `RecordFinancialEventDto`
(P2-1) bir controller'a bağlandığı gün bütün iç çağıranlar 400'e düşer.

### 34.3 P2

| Bulgu                                                                                                                                                                              | Kanıt                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **P2-1** Ölü `RecordFinancialEventDto` — genel amaçlı "serbest gövdeyle olay yaz" kapısı; bir controller'a bağlanırsa tip-başına gövde doğrulaması ve dedupe disiplini atlanabilir | `financial-event/dto/commands/record-financial-event.dto.ts`                          |
| **P2-2** `from > to` doğrulanmıyor: mutabakat listesi boş ("defter temiz"), backfill "0 olay denendi" ("iş bitti") diye okunur                                                     | `get-unposted-financial-events.schema.ts`, `post-unposted-financial-events.schema.ts` |
| **P2-3** Üretici tarafta iki tutar `.toString()` ile geçiyor — kuruş ölçeği kolon şemasına bağlı, sözleşmede açık değil                                                            | `pos-accounting-bridge.service.ts:60,99`, `handle-payment-callback.handler.ts:110`    |

---

## 35. `e-document` — e-Belge (entegratör portu)

Denetim tarihi: **2026-10-11**. Kapsam: `EInvoicePort` + sözleşmeler, `Noop` adapter,
kuyruk (producer/processor), belge türü çözücüsü ve faturadaki üç uç
(`claim-invoice-edocument-dispatch`, `mark-invoice-edocument-result`,
`mark-invoice-edocument-failed`).

> **Kapsam notu:** §2'de bu modül "⏳ kısmen" olarak işaretliydi; **gerçek entegratör
> adapter'ı yazılmadan** tam denetim mümkün değil (satıcı unvanı, kalem bazlı XML,
> `getStatus` ile doğrulama hepsi adapter'a bağlı — §15'te ertelenmiş maddeler).
> Bu tur, adapter'dan **bağımsız** olan kısmı kapatıyor: belgenin tarihi, gönderim
> hakkının yaşam döngüsü ve hata görünürlüğü.

### 35.1 Kontrol listesi sonucu

| Başlık                  | Durum                                                                           |
| ----------------------- | ------------------------------------------------------------------------------- |
| Belge tarihi            | ❌ **P1-5** üç ayrı zaman damgası: fatura kaydı, defter, belge                  |
| Mükerrer yasal belge    | ✅ gönderim hakkı koşullu tek UPDATE ile sahiplenilir (§14.1 turunda eklendi)   |
| Enqueue ↔ commit sırası | ✅ kuyruğa alma `outboxRun` **dışında**, commit sonrası                         |
| İdempotentlik (kuyruk)  | ✅ `jobId: e-document:<invoiceId>` → aynı fatura tek job                        |
| Timeout / UNKNOWN       | ✅ belge oluştu mu bilinmiyor → `FAILED` + hak bir daha otomatik alınamaz       |
| `FAILED`'dan çıkış      | ⚠️ elle yeniden kuyruğa alma yok — §15'te ertelendi (adapter `getStatus` ister) |
| Sağlayıcı kimlikleri    | ✅ `einvoiceUuid` (ETTN), `invoiceNumber`, `rawResponse` saklanıyor             |
| Hata görünürlüğü        | ⚠️ **P2-4** CRITICAL uyarılar `clinicId: null` (fatura elde olduğu hâlde)       |
| Retry politikası        | ⚠️ **P2-5** `attempts: 5` claim sonrası hiç işe yaramıyor (yanıltıcı ayar)      |
| Fatura bulunamadı       | ⚠️ **P2-6** yasal belge sessizce atlanıyor (yalnız `warn`)                      |
| Para/matematik          | — (tutarlar faturadan birebir taşınıyor)                                        |

### 35.2 P1-5 · Belgenin tarihi, defterin tarihinden kopuyor

**Kanıt.** `issue-invoice.handler.ts` faturayı `issuedAt` **vermeden** yazıyordu
(`invoiceRepo.create({...})` — alan `invoice-inputs.contracts.ts:31`'de opsiyonel) ve
ekonomik olaya ayrı bir `DateTimeManager.create()` geçiyordu; `invoice.entity.ts:239`
damgayı ancak **e-belge sonucu döndüğünde** (`isFinalizing`) atıyor;
`e-document.processor.ts:116` ise `invoice.issuedAt ?? DateTimeManager.create()` ile
belgeyi **gönderim anına** tarihliyordu.

Üç bağımsız zaman damgası:

| Damga                       | Ne zaman yazılıyordu              |
| --------------------------- | --------------------------------- |
| `FinancialEvent.occurredAt` | fatura kesilirken (`now` #1)      |
| `Invoice.issuedAt`          | e-belge sonucu dönünce (`now` #2) |
| e-belge `issueDate`         | gönderim anında (`now` #3)        |

Aynı gün üçü aynı tarihe düşüyor; ayrıştıkları an üç durumda geliyor: kuyruk birikmesi
veya işçinin kapalı olması, `FAILED` sonrası elle tamamlama, ve ay/dönem dönümü. Son
hâli mevzuat açısından kritiktir: **belge tarihi KDV beyanını, defter tarihi mizanı**
belirler; ikisi ayrı aya düştüğünde beyan ile defter birbirini tutmaz. Gönderim `FAILED`
kalırsa `issuedAt` **sonsuza dek `NULL`** kalıyor — "fatura ne zaman kesildi" sorusu
cevapsız, listeler boş tarihle sıralanıyor.

### 35.3 P2

| Bulgu                                                                                                                                                                      | Kanıt                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **P2-4** Gönderim ve kuyruğa alma uyarıları `clinicId: null` — elde kalmış yasal belgeyi hangi şubenin takip edeceği alarmdan okunamıyor                                   | `e-document.processor.ts:206`, `issue-invoice.handler.ts:231` |
| **P2-5** `attempts: 5` + exponential backoff, claim **sonrası** hatada hiçbir şey kurtarmıyor: 2–5. denemeler hakkı alamayıp `return` ediyor ve job **başarılı** sayılıyor | `e-document.producer.ts:23`, `processor:103-108`              |
| **P2-6** Fatura bulunamazsa `warn` + `return`: yasal belge sessizce atlanıyor, job siliniyor (`removeOnComplete`)                                                          | `e-document.processor.ts:67-70`                               |

---

## 36. Uygulanan düzeltmeler (2026-10-11) — `financial-events` / `e-document`

| Bulgu    | Ne yapıldı                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Dosyalar                                                                                                                                                                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §34 P1-1 | Gövde kapısı kuruş ölçeğine daraltıldı (`\.\d{1,2}`, işaretli alan dahil) ve gerekçesi kuralla (12) birlikte yazıldı. Üretici tarafta iki `.toString()` → `.toFixed(2)` (P2-3): ölçek artık kolon şemasına değil sözleşmeye bağlı                                                                                                                                                                                                                                                        | `financial-event-payload.schemas.ts`, `pos-accounting-bridge.service.ts`, `handle-payment-callback.handler.ts`                                                                                                                                                  |
| §34 P1-2 | **Dönem kapısı domain servisi** (`PERIOD_GATE_SERVICE.assertPeriodNotSealedAt`): okuma Command Repo'dan (yeni `findByDate`), kabul kümesi tek sabitten (`POSTABLE_PERIOD_STATUSES`) ve posting de artık o sabiti kullanıyor. Tarihi kullanıcıdan alan **üç** yola takıldı; `where` koşulu iki repo için tek tanımda. Tipli hata: `PeriodSealedForDateException` (409, yıl + durum meta'sı). **Dönemi olmayan klinik bilinçli olarak geçirilir** — gerekçe interface'te, karşılığı §37'de | `period-gate/*` (yeni), `postable-period-statuses.constant.ts` (yeni), `accounting-period-date.query.ts` (yeni), period command repo + interface, `period.exceptions.ts`, `services.module.ts`, `post-financial-event.handler.ts`, 3 handler + 3 command.module |
| §34 P1-3 | `FinancialEventRecordedEvent` artık `clinicId` taşıyor; "fiş üretilemedi" uyarısı defteri adıyla söylüyor (yanlış yorum da düzeltildi)                                                                                                                                                                                                                                                                                                                                                   | `financial-event-recorded.event.ts`, `financial-event.entity.ts`, `financial-event-recorded.listener.ts`                                                                                                                                                        |
| §34 P1-4 | `performedById` ham string (Firebase UID). Kabul kümesi **tek yerde**: `@shared/common/schemas/FirebaseUidSchema` — bordro şemasındaki yerel kopya da ona bağlandı (kimlik varsayımı hatasının beşinci tekrarı)                                                                                                                                                                                                                                                                          | `firebase-uid-schema.ts` (yeni), `shared/common/schemas/index.ts`, `record-financial-event.schema.ts`, `record-payroll-accrual.schema.ts`                                                                                                                       |
| §34 P2-1 | Ölü `RecordFinancialEventDto` silindi; şemanın başına "bu sözleşme HTTP sınırında kullanılmaz, defterin kapısı tipli komutlardır" notu yazıldı                                                                                                                                                                                                                                                                                                                                           | `record-financial-event.dto.ts` (silindi), `dto/commands/index.ts`, `record-financial-event.schema.ts`                                                                                                                                                          |
| §34 P2-2 | Mutabakat ve backfill şemalarına `from <= to` kontrolü                                                                                                                                                                                                                                                                                                                                                                                                                                   | `get-unposted-financial-events.schema.ts`, `post-unposted-financial-events.schema.ts`                                                                                                                                                                           |
| §35 P1-5 | **Tek zaman damgası**: `issuedAt` fatura yazılırken damgalanıyor ve aynı değer ekonomik olayın `occurredAt`'i oluyor; e-belge de onu okuyor. `?? now` yalnız bu damgadan önce kesilmiş kayıtlar için duruyor (gerekçesi yorumda)                                                                                                                                                                                                                                                         | `issue-invoice.handler.ts`, `e-document.processor.ts`                                                                                                                                                                                                           |
| §35 P2-4 | e-belge gönderim ve kuyruğa alma uyarıları kiracısıyla gidiyor                                                                                                                                                                                                                                                                                                                                                                                                                           | `e-document.processor.ts`, `issue-invoice.handler.ts`                                                                                                                                                                                                           |
| —        | Yeni hata kodu                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `error-codes.constant.ts` (`PERIOD.SEALED_FOR_DATE`)                                                                                                                                                                                                            |

### Testler

| Dosya                                                    | Kapsam                                                                                                                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `financial-event-payload.schemas.spec.ts` (yeni, 5 test) | 0–2 ondalık kabulü, 3. ondalığın reddi (dengesiz fiş regresyonu), işaretli sayım farkında aynı kural, bölünmüş tutarların kuruş toplamının korunması, sayı/VO geçirilmesinin durdurulması                                      |
| `period-gate.service.spec.ts` (yeni, 6 test)             | OPEN kabulü, LOCKED/CLOSED reddi (`it.each`), hata meta'sı (yıl + durum), **dönemi olmayan klinikte geçirme** (bilinçli karar kilitlendi), okumanın Command Repo'dan ve belge tarihiyle yapılması                              |
| `record-financial-event.schema.spec.ts` (yeni, 4 test)   | Firebase UID kabulü (regresyon), aktörsüz sistem akışı, boş `sourceModule` reddi, `clinicId`'nin UUID zorunluluğu                                                                                                              |
| `record-payroll-accrual.spec.ts` (yeni, 4 test)          | dedupe anahtarının personel+ay olması, gövdeye kuruş ölçekli string geçmesi, mühürlü dönemde **hiçbir şey yazılmaması** (`outboxRun` bile açılmıyor), kapının kullanıcının verdiği tarihe bakması, dengesiz dökümde tipli hata |
| `record-supplier-payment.spec.ts` (+2 test)              | mühürlü dönemde olayın hiç yazılmaması; tarih verilmediğinde kapının baktığı tarih ile olaya damgalanan tarihin **aynı** olması (iki ayrı `now` gece yarısı farklı döneme düşer)                                               |
| `record-purchase-invoice.spec.ts` (+1 test)              | mühürlü dönemde belgenin de köprünün de yazılmaması                                                                                                                                                                            |
| `financial-event.entity.spec.ts` (+1 test)               | raise edilen olayın defter sahibi şubeyi taşıması (uyarı yönlendirmesi)                                                                                                                                                        |
| `issue-invoice.spec.ts` (+1 test)                        | fatura `issuedAt`'i ile ekonomik olayın `occurredAt`'inin **aynı an** olması                                                                                                                                                   |
| `handle-payment-callback.handler.spec.ts` (uyarlandı)    | elle kurulmuş `{ toString }` taklidi yerine gerçek `Decimal` — taklit sözleşmeyi değil kendini doğruluyordu                                                                                                                    |

**Doğrulama:** `tsc --noEmit` 0 hata (api **ve** web); `jest` **191 suite / 1155 test**
yeşil. `app.module.spec.ts` dahil: "her provider'ın bağımlılığı kendi modül bağlamında
çözülebiliyor" testi yeni `PERIOD_GATE_SERVICE`'in üç tüketici modülde de ayakta
olduğunu doğruluyor. **Migration yok** (şema değişmedi).

---

## 37. Bilinçli yapılmayanlar — `financial-events` / `e-document`

| Konu                                                                             | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dönem kapısının `now` tarihli akışlara (tahsilat/POS/kasa) uygulanması**       | Kapı yalnız tarihi **kullanıcıdan** alan üç yola takıldı. Tahsilat, POS callback'i, kasa kapanışı ve rezervasyon tahsilatı `occurredAt = now` ile yazıyor; oraya fail-closed bir kapı koymak, dönem yanlış yapılandırıldığında **kartı çekilmiş** bir tahsilatı geri sarardı — para alınmış, kayıt yok. Bu takasta "fişi sonra atılır" hâli, "para kayıtsız" hâlinden kesinlikle iyidir; boşluk da sessiz değil (süpürme + CRITICAL + mutabakat listesi). **Tetikleyici:** geriye dönük tarihli elle tahsilat/kasa düzeltmesi eklenirse (§18.1'de de aynı not var) — o uç kullanıcıdan tarih aldığı anda kapıya takılır.                                    |
| **Dönemi olmayan klinikte belge kaydının reddi**                                 | `assertPeriodNotSealedAt` dönem satırı **bulamazsa geçirir**. Muhasebesi hiç kurulmamış bir şubede alış faturası / satıcı ödemesi / bordro kaydını reddetmek, muhasebeyle ilgisi olmayan operasyonu komple durdururdu; posting'in kapısı ise (haklı olarak) dönemin hem var hem OPEN olmasını ister. Kapının kullanım yerinden **dar** olduğu bu tek nokta bilinçlidir ve karşılığı testle kilitlendi. Boşluk `sweep-unposted-financial-events` uyarısıyla görünür. **Tetikleyici:** klinik kurulumunda dönem açma zorunlu hale gelirse (`ensure-ledger-periods` bütün kiracıları kapsadığında) — o zaman "dönem yok" bir veri hatasıdır ve kapı sertleşir. |
| **Kapanmış döneme düşen belgenin cari açık döneme fişlenmesi (geç gelen belge)** | Muhasebenin standart cevabı budur: belge tarihi korunur, fiş **açık döneme** atılır. Uygulamak için posting'in dönem çözümünün "olayın tarihi" yerine "olayın tarihi veya ilk açık dönem" olması, fişin iki tarih (belge tarihi + kayıt tarihi) taşıması ve KDV beyanının belge tarihinden türemesi gerekir — üçü birlikte tasarlanacak bir tur. Şimdilik ret, kullanıcıya durumu **anında** söylüyor ve yanlış bir kayıt üretmiyor. **Tetikleyici:** canlıda ilk "dönem kapandı ama fatura elimde" vakası.                                                                                                                                                 |
| **Gövde şemalarının posting kurallarından üretilmesi**                           | Bugün gövde sözleşmesi (`FINANCIAL_EVENT_PAYLOAD_SCHEMAS`) ile kuralın okuduğu tip (`event-payloads.ts`) **iki ayrı dosyada** ve el ile hizalı; kural yeni bir alan okumaya başlarsa şema bunu bilmez. Tek kaynağa indirmek şemadan tip çıkarmayı (`z.infer`) ve kuralların `as unknown as X` okumasını değiştirmeyi gerektiriyor — posting modülünün kendi turunda (§6/§7) yapılacak iş. **Tetikleyici:** yeni bir posting kuralı eklenirken (o anda iki dosya birlikte düzenlenir).                                                                                                                                                                       |
| **`attempts: 5`'in anlamlı hâle getirilmesi (P2-5)**                             | Claim **öncesi** hatalar (fatura/klinik/cari okuması) için retry gerçekten işe yarıyor; claim **sonrası** hatada ise mükerrer yasal belge riski yüzünden yeniden denememek kasıtlı. Ayarı bölmek (ör. claim öncesi retry'lı, sonrası retry'sız iki job) kuyruk topolojisini ikiye çıkarır; kazanç yalnız dört gereksiz uyandırmayı önlemek. Durum görünür: fatura `FAILED`, uyarı CRITICAL. **Tetikleyici:** gerçek adapter'ın `getStatus`'u geldiğinde — o zaman claim sonrası retry **anlamlı** olur (önce doğrula, sonra gönder) ve ayar yeniden tasarlanır.                                                                                             |
| **Faturası bulunamayan e-belge job'unun sesli hâle getirilmesi (P2-6)**          | Fatura commit edildikten **sonra** kuyruğa alındığı için "bulunamadı" ancak kaydın silinmesiyle oluşur; fatura soft-delete taşıyor ve silinmiş bir faturaya yasal belge göndermemek doğru davranış. Uyarıya çevirmek, silme akışının meşru sonucunu alarm gürültüsüne dönüştürürdü. **Tetikleyici:** fatura iptali akışı (§15) yazılırken — o zaman "iptal edildi" ile "kayboldu" ayrışır ve ikincisi alarm olur.                                                                                                                                                                                                                                           |
| **e-Belge kalem bazlı XML + satıcı unvanı + `FAILED` → requeue**                 | Üçü de gerçek entegratör adapter'ına bağlı ve §15'te kayıtlı. `Noop` adapter bunların hiçbirini kullanmıyor; şimdiden doldurmak doğrulanamayan kod üretir. **Tetikleyici:** entegratör adapter'ı yazılırken (§2'deki `e-document` satırının tam denetimi de o tura kalıyor).                                                                                                                                                                                                                                                                                                                                                                                |

---

## 38. `supply/purchasing` — Satın Alma (Talep → Sipariş → Mal Kabul)

Finans modülü değil ama **parayı o modüllere veren** yer: sipariş tutarı alış faturasının
dayanağı (3'lü eşleştirme), mal kabul ise stok partisinin maliyetini — dolayısıyla envanter
değerini ve SMM'yi — yazar. §15'te `.toNumber()` maddesinin tetikleyicisi bu tur olarak
belirlenmişti.

### Kontrol listesi

| Konu                                 | Durum | Not                                                                                                                                                |
| ------------------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tutarlar `Decimal`                   | ✅    | Entity ve kurallar `decimal.js`; kolonlar `Decimal(14,2)` / `Decimal(12,2)` / `Decimal(12,3)`.                                                     |
| Ondalık ölçeği kapıda zorlanıyor     | ❌    | **P1-1**: fiyat/miktar kapısı sınırsız ondalık kabul ediyordu, kolon yuvarlıyordu.                                                                 |
| KDV oranı tek kaynaktan              | ❌    | **P1-2**: kapı 0–100; `VatRate` yasal küme → %8'lik sipariş **mal kabul edilemez** hâle geliyordu.                                                 |
| Para birimi                          | ✅    | Sipariş başlığında `currency`; fatura eşleştirmede eşitlik zorlanıyor (sessiz kur çevrimi yok).                                                    |
| Kümülatif sayaç kilit altında        | ✅    | `invoicedTotal` ve `quantityReceived` `findByIdForUpdate` ile; `applyInvoice`/`revertInvoice`/`receive` aynı tx.                                   |
| Sayaç negatife/aşıma kapalı          | ✅    | `PurchaseOrderOverInvoicedException` / `OverReceiptException`; geri alma negatife düşmüyor (sessiz kırpma yok).                                    |
| Tüm geçişler korumalı (kural 3)      | ❌    | **P2-1**: `cancel()` sayacı dolu siparişi iptal ediyordu.                                                                                          |
| Personel kimliği sözleşmesi          | ❌    | **P0-1 / P0-2**: `requestedById` ve `performedById` UUID VO'sundan geçiyordu (Firebase UID) → talep açma ve **tüm stok hareketleri** çalışmıyordu. |
| Kiracı sınırı (yazma)                | ❌    | **P1-3**: yabancı klinik talebi ORDERED yapılabiliyordu. **P1-4**: tedarikçi/ürün hiç doğrulanmıyordu.                                             |
| Bayrak kolonları okunuyor (kural 10) | ❌    | **P1-4**: `Product.isActive` / `deletedAt` ve `Supplier.isActive` hiçbir yazma yolunda okunmuyordu.                                                |
| Modül sınırı sözleşmesi              | ❌    | **P2-2**: sipariş sayacına para `number` olarak geçiyordu (§15 ertelemesi).                                                                        |
| Okuma modeli para tipi               | ❌    | **P2-3**: eşleştirme özeti parayı `number` veriyordu (finansın geri kalanı string).                                                                |
| Yetki                                | ✅    | `PurchasingPolicy`: talep görüntüleme/açma klinik personeli, onay + sipariş yaşam döngüsü yönetici; sorgular `ctx.actor.clinicId` ile süzülüyor.   |
| Onay izi                             | ✅    | `reviewedById` / `reviewedAt` / `reviewNote` kalıcı damga (kural 7'nin talep tarafı).                                                              |
| Mal kabul izi                        | ⚠️    | Stok hareketi `performedById` ile kimin aldığını yazıyor (P0-1 düzeltildikten sonra); sipariş tarafında gönderim/iptal için olay yok — bkz. §40.   |
| Mal kabul geri alınabilir mi         | ⚠️    | Hayır: `quantityReceived` yalnız artar, ters kabul yok. Bilinçli — bkz. §40.                                                                       |
| Atomiklik                            | ✅    | Mal kabul → `ReceiveStockCommand` iç içe `run()` ile aynı ALS tx'inde; stok girişi başarısızsa sipariş sayacı da geri sarılıyor.                   |

### P0-1 — Her stok hareketi personel kimliğinde patlıyordu

**Kanıt.** `stock-movement.entity.ts:164` → `performedById: UUID.create(props.performedById).orThrow()`.
Çağıranlar: `receive-stock.handler.ts:106`, `adjust-stock.handler.ts:74`,
`record-product-usage.handler.ts:87` — hepsi `actor.userId` geçiyor.

**Neden bozuk.** `User.id = firebaseUid` (bkz. `create-user.handler.ts:26`): gerçek personel
kimliği 28 karakterli bir Firebase UID, UUID değil. Yani **mal kabul, sayım düzeltmesi ve
ürün kullanımı** gerçek bir kullanıcıyla hiç çalışmıyordu; satın almanın teslim akışı da bu
yüzden hiç tamamlanamıyordu (`InvalidUuidException`, tx rollback). Aynı varsayımın **altıncı
ve yedinci** tekrarı (öncekiler: kasa oturumu, bordro, satıcı ödemesi, olay defteri, talep).

**İkinci yarısı sessiz.** Aynı alan constructor'da `UUID.create(...).instance ?? null` ile
okunuyordu: kayıttan gelen Firebase UID `null`'a düşüyor, `toPersistence()` o `null`'ı geri
yazıyordu → hareketi kimin yaptığı bir **güncellemede siliniyordu**.

**Düzeltme.** Alan ham string: constructor, `create` ve `toPersistence` üçü birlikte.

### P0-2 — Satın alma talebi hiç açılamıyordu

**Kanıt.** `purchase-request.entity.ts:140` → `requestedById: UUID.create(props.requestedById).orThrow()`,
çağıran `create-purchase-request.handler.ts:46` → `requestedById: actor.userId`.
Kardeş alan `reviewedById` zaten ham string tutuluyordu — tutarsızlık dosyanın içinde duruyordu.

**Düzeltme.** Ham string + regresyon testi (Firebase UID ile talep açılır).

### P1-1 — Fiyat/miktar kapısı kolondan geniş (kural 12)

**Kanıt.** `CreatePurchaseOrderSchema.items[].unitPrice: z.number().nonnegative()` (ondalık
sınırı yok) ↔ `purchase_order_items.unit_price Decimal(12,2)`;
`quantity: z.number().positive()` ↔ `quantity_ordered Decimal(12,3)`.
Aynısı talep (`estimatedUnitPrice`) ve mal kabulde (`quantity_received`).

**Neden bozuk.** `10.555` kabul edilir; entity satır tutarını **yuvarlanmamış** fiyattan
hesaplayıp `lineNet`/`grandTotal`'ı yazar, kolon ise fiyatı `10.56`'ya yuvarlar. Okuma tarafı
(`calculateReceivedValue`, eşleştirme özeti) kolondan okuduğu için **aynı sipariş iki farklı
tutar** verir: tamamı teslim alınmış sipariş bile sıfırdan farklı bir "teslim − fatura"
sapması gösterir ve sapmanın sebebi hiçbir ekranda görünmez. Mal kabulde aynı durum kümülatif
sayaçta: "tamamı teslim alındı" kararı yuvarlanmamış toplamdan verilir, kolon yuvarlar.

**Düzeltme.** Üç kapıya `multipleOf` (para 2, miktar 3) + gerekçeli yorum + şema testi.

### P1-2 — KDV oranı kapısı yasal kümeden geniş (kural 12)

**Kanıt.** `CreatePurchaseOrderSchema...vatRate: z.number().int().min(0).max(100)` ↔
`stock-movement.entity.ts:155` → `VatRate.create(props.vatRate).orThrow()` (yasal küme
`STATUTORY_VAT_RATES`).

**Neden bozuk.** %8'lik bir sipariş **yazılabiliyor**, ama mal kabul edilmeye çalışıldığında
`StockMovement.create` oranı reddediyor → tüm mal kabul tx'i rollback. Sipariş kalıcı olarak
teslim alınamaz hâle geliyor ve hata, oranı giren ekrandan tamamen kopuk bir yerde çıkıyor.
Aynı artık `RecordPurchaseInvoiceSchema.vatRate`'te de duruyordu (entity `VatRate`'e sokuyor).

**Düzeltme.** İki kapı da `STATUTORY_VAT_RATES`'i import ediyor (§10/§11 ve
`add-treatment-charge` ile aynı desen).

### P1-3 — Yabancı kliniğin onaylı talebi tüketilebiliyordu

**Kanıt.** `create-purchase-order.handler.ts` — yetki `data.clinicId` üzerinden kontrol
ediliyor, ardından `purchaseRequestRepo.findByIdForUpdate(data.purchaseRequestId)` ile talep
yükleniyor ve `markOrdered()` çağrılıyordu; **talebin kliniği hiç karşılaştırılmıyordu.**

**Neden bozuk.** A kliniğinin satın alma yöneticisi, kendi kliniğinde sipariş açarken
B kliniğinin onaylı talebini `ORDERED`'a çekebiliyordu: B'de o talep bir daha siparişe
dönüştürülemez (`markOrdered` yalnız `APPROVED`'ta çalışır) ve A'nın siparişi yabancı bir
talebe bağlı kalıyordu. Kardeş kontrol fatura tarafında zaten vardı
(`PurchaseOrderClinicMismatchException`) — eksik olan talep tarafıydı.

**Düzeltme.** `PurchaseRequestClinicMismatchException` (409) + test (`update` ve `create`
çağrılmadığı doğrulanıyor).

### P1-4 — Tedarikçi ve ürün hiç doğrulanmıyordu (kural 10)

**Kanıt.** `PurchaseOrder.supplierId` / `items[].productId` bounded-context gereği **FK'siz
skaler**; `create-purchase-order.handler.ts` ikisini de doğrulamıyordu.
`receive-stock.handler.ts:79` ürünü yüklüyor ama `product.clinicId`'yi mal kabul edilen
klinikle karşılaştırmıyordu. `Product.isActive` / `Product.deletedAt` / `Supplier.isActive`
kolonları **yalnız** bir sorgu repo'sunda (`get-low-stock-alerts`) okunuyordu.

**Neden bozuk.** Üç ayrı sonuç, hepsi sessiz:

1. **Başka kiracının ürünü** — parti `clinicId` mal kabul edilen kliniğe yazılırken ürün
   kaydı başka kliniğe ait olur. İki tarafın listeleri de kendi kliniğiyle süzdüğü için
   **ortaya çıkan stok hiçbir ekranda görünmez**: ödenen mal bedeli envanter değerinden düşer.
2. **Silinmiş (soft-delete) ürün** — ürün listeleri `deletedAt: null` süzüyor; girilen malın
   değeri yine görünmez. "Okunmayan bayrak kolonu güvence değil süstür" (kural 10).
3. **Var olmayan/pasif tedarikçi** — sipariş açılır, kimse teslim etmez; alış faturası
   eşleştirmesi tedarikçi eşitliği istediği için o sipariş hiç faturalanamaz.

**Düzeltme.** `INVENTORY_CATALOG_SERVICE` (yaprak domain servisi, `assert*`, Command Repo'dan
okur) + kural fonksiyonları tek dosyada (`catalog-usability.rules.ts`) — aynı kural hem
siparişin kapısında hem mal kabulde zorlanıyor, kopya yazılmadığı için ayrışamıyor.

### P2 bulguları

| #        | Bulgu                                                                                                                                                                                                                                                                            |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P2-1** | `cancel()` yalnız duruma bakıyordu: `invoicedTotal > 0` olan sipariş iptal edilebiliyordu. İptal sonrası `applyInvoice` reddedildiği için sayaç bir daha doğru değere getirilemez → üçlü eşleştirme o sipariş için kalıcı anlamsızlaşır. Doğru sıra: önce eşleştirmeyi kaldır.   |
| **P2-2** | Sipariş sayacına para `number` geçiyordu (`ApplyInvoice…Command.grandTotal`, §15'te ertelenmişti). Kuruş ölçeğinde kayıp yok ama sözleşme defterin kuralından sapıyordu; sapma tek yerde kalmazsa bir sonraki alan sessizce `number` olur. İki komut da ondalık **string** aldı. |
| **P2-3** | Eşleştirme özeti (`PurchaseOrderMatchSummary`) parayı `number` döndürüyordu; finansın bütün okuma modelleri string taşıyor (cari defter, banka ekstresi). JSON'a kayan nokta olarak çıkan tutar istemcide toplanınca kuruş artığı üretir.                                        |
| **P2-4** | `organizationId` iki yazma kapısında (`CreatePurchaseOrder/Request`) duruyordu. Doğrulamadan geçiyor (`TENANT_SCOPE_RESOLVER` uyuşmazlıkta 403 atıyor) yani açık değil, ama kiracı kimliğinin istemciden alınmaması kuralına aykırı; alış faturası kapısında zaten alınmıyordu.  |
| **P2-5** | Kalem kimlikleri ham `randomUUID()` ile üretiliyordu (iki entity); proje kuralı `UUID.generate()`.                                                                                                                                                                               |
| **P2-6** | `ProductNotFoundException` / `SupplierNotFoundException` içinde `override httpStatus: HttpStatus.NOT_FOUND;` — **iki nokta atama değil tip anotasyonu**: alan tanımsız kalıp taban sınıfın 400'ünü döndürüyordu. Aynı tuzak `UserNotFoundException`'da notlanmıştı.              |

---

## 39. Uygulanan düzeltmeler (2026-10-12) — `supply/purchasing`

| Bulgu    | Düzeltme                                                                                                                                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0-1** | `stock-movement.entity.ts`: `performedById` constructor + `create` + `toPersistence` üçünde ham string. Yorum, kimlik kuralını ve "güncellemede silinme" yan etkisini yerinde anlatıyor.                                                                         |
| **P0-2** | `purchase-request.entity.ts`: `requestedById` ham string; `reviewedById` ile tutarlı.                                                                                                                                                                            |
| **P1-1** | `create-purchase-order.schema.ts`, `create-purchase-request.schema.ts`, `receive-purchase-order.schema.ts`: para `multipleOf(0.01)`, miktar `multipleOf(0.001)`.                                                                                                 |
| **P1-2** | Aynı şema + `record-purchase-invoice.schema.ts`: `vatRate` artık `STATUTORY_VAT_RATES` kümesinden.                                                                                                                                                               |
| **P1-3** | `create-purchase-order.handler.ts`: talebin kliniği siparişin kliniğiyle karşılaştırılıyor → `PurchaseRequestClinicMismatchException` (yeni, 409, `PURCHASE_REQUEST.CLINIC_MISMATCH`).                                                                           |
| **P1-4** | Yeni `catalog-usability.rules.ts` (saf kural) + `INVENTORY_CATALOG_SERVICE` / `InventoryCatalogService` + `InventoryDomainServicesModule` (yaprak). `create-purchase-order` tedarikçi ve katalog ürünlerini, `receive-stock` yüklediği ürünü aynı kuralla süzer. |
| **P2-1** | `PurchaseOrder.cancel()`: `invoicedTotal` sıfır değilse `PurchaseOrderCancelWithInvoicesException` (yeni, 409).                                                                                                                                                  |
| **P2-2** | `ApplyInvoiceToPurchaseOrderCommand` / `RevertInvoiceFromPurchaseOrderCommand`: `grandTotal: string`; üç çağıran `toFixed(2)` gönderiyor.                                                                                                                        |
| **P2-3** | `PurchaseOrderMatchSummary` beş para alanı `string` (`toFixed(2)`).                                                                                                                                                                                              |
| **P2-4** | `organizationId` iki kapıdan kaldırıldı; gerekçe yorumda.                                                                                                                                                                                                        |
| **P2-5** | İki entity'de `randomUUID()` → `UUID.generate().value` (import temizliği dahil).                                                                                                                                                                                 |
| **P2-6** | `inventory.exceptions.ts`: iki exception'da `httpStatus` **ataması** + tuzağı anlatan yorum.                                                                                                                                                                     |

### Testler

| Dosya                                                      | Kapsam                                                                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `purchase-request.entity.spec.ts` (yeni, 5)                | Firebase UID ile talep açma (P0-2 regresyonu), onaylayan damgası, tekrar onay reddi, yalnız onaylı talebin siparişe dönüşmesi, kalem id'si |
| `inventory-catalog.service.spec.ts` (yeni, 10)             | başka klinik / silinmiş / pasif / yok olan ürün ve tedarikçi; aynı ürün tekrarında tek okuma                                               |
| `create-purchase-order.spec.ts` (yeni, 6)                  | katalog kapısı çağrıları, kullanılamaz tedarikçide hiç yazmama, katalog-dışı kalem, yabancı klinik talebi (P1-3), kendi talebi, talep yok  |
| `create-purchase-order.schema.spec.ts` (yeni, 9)           | kuruş/miktar ondalık sınırları (P1-1), yasal KDV kümesi (P1-2), `organizationId` taşınmaması                                               |
| `receive-stock.handler.spec.ts` (+4)                       | yabancı/silinmiş/pasif ürüne stok girişinin reddi, Firebase UID ile mal kabulün tamamlanması (P0-1)                                        |
| `purchase-order-billing.spec.ts` (+3, özet testi string'e) | faturası eşleşmiş siparişin iptal edilemezliği (P2-1), eşleştirme kaldırıldıktan sonra iptal, özetin string tutarları (P2-3)               |
| `stock-quantity-changed.listener.spec.ts` (güncellendi)    | `performedById` artık ham Firebase UID olarak yazılıyor                                                                                    |

### Doğrulama

- `npx tsc --noEmit` → `apps/api` **0 hata**, `apps/web` **0 hata**.
- `npx jest` → **195 suite / 1192 test** yeşil (tur öncesi 191/1155).
- `app.module.spec.ts` (her provider'ın bağımlılığı kendi modül bağlamında çözülüyor)
  `INVENTORY_CATALOG_SERVICE`'in satın alma komut modülünde çözüldüğünü doğruluyor.
- ESLint: turda dokunulan dosyalarda 0 hata. **Migration yok** (şema değişmedi).

---

## 40. Bilinçli yapılmayanlar — `supply/purchasing`

| Konu                                                                                           | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mal kabul belgesi (geri alınabilir teslim) **                                                | Bugün teslim tek yönlü bir sayaç (`quantityReceived` yalnız artar) ve ayrı bir "mal kabul fişi" kaydı yok. Sonuçları: (a) yanlış girilen miktar ancak stok sayım düzeltmesiyle telafi edilir, sipariş satırında yanlış kalır; (b) çift gönderim (çifte tıklama / ağ tekrarı) sipariş miktarını aşmadığı sürece aynı teslimi iki kez yazar ve **stoğa iki kez girer** — ayıklanacak doğal anahtar yok. İkisini de kapatmak `GoodsReceipt` belgesi (başlık + satır + idempotency anahtarı + ters kabul) demek; sipariş sayacı o belgeden türetilir. **Tetikleyici:** ilk hatalı mal kabul vakası ya da depo ekranının canlıya alınması.                                                                            |
| **Sayaç ↔ fatura toplamı sapma raporu**                                                        | `invoicedTotal` kaynak-doğru veriden (`purchase_invoices.purchase_order_id`) türeyen bir sayaç ve aynı tx + satır kilidi altında güncellendiği için sapmaması gerekir. Yine de kural 11'in mantığı burada da geçerli: türetilmiş sayaç ile kaynağı karşılaştıran bir mutabakat sorgusu yok. Veri düzeltmesi (elle SQL, migration) ya da ileride eklenecek bir toplu iptal akışı sapma üretirse hiçbir yerde görünmez. **Tetikleyici:** fatura iptali akışı (§15) yazılırken — o akış sayaca dokunan ilk "tx dışı" yol olur.                                                                                                                                                                                      |
| **Sipariş gönderimi/iptali için audit olayı**                                                  | Satın alma modülünde hiç domain olayı yok. Para yazan iki uç zaten izli: mal kabul `StockMovement.performedById` + `StockQuantityChangedEvent`, onay `reviewedById/At/Note` damgası. İzsiz kalanlar `send` ve `cancel` — ikisi de para yazmıyor, sipariş durumu değiştiriyor. Olay + publisher + listener zincirini üç durum geçişi için kurmak, izlenen değerle kıyaslandığında bakım maliyeti fazla. **Tetikleyici:** "bu siparişi kim iptal etti" sorusu operasyonda sorulursa (ya da satın alma ekranları canlıya alınırken).                                                                                                                                                                                |
| **Mal kabul için ayrı capability (kural 7)**                                                   | `send`, `receive` ve `cancel` aynı `purchaseorder:update` yetkisiyle yapılıyor. Mal kabul geri alınamaz ve stok değeri yazıyor — ayrı bir yetki savunulabilir. Ama satın alma yöneticisi rolü bugün üçünü de yapan tek rol; yetkiyi bölmek rol matrisini (`roles.ts`) ve seed'i de bölmek demek. **Tetikleyici:** depo personelinin satın alma yöneticisinden ayrıldığı ilk kurulum — o an mal kabul depo rolüne, iptal yöneticide kalır.                                                                                                                                                                                                                                                                        |
| **`ReceiveStockDto.purchasePrice` / `quantity`'nin `number` kalması**                          | Sipariş kapısı artık kuruş/üç-ondalık zorladığı için mal kabulde modül sınırını geçen değer zaten ölçeğinde. Alanı `string`'e çevirmek `inventory`'nin **HTTP sözleşmesini** (ve `apps/web` tarafını) değiştirmek demek; o modülün kendi denetim turu yapılmadan dokunulmaz. ~~**Tetikleyici:** `supply/inventory` turu.~~ **§57'de ölçüldü — tetikleyici geçti, iş yapılmadı:** şema kapısı `multipleOf(0.01)`/`multipleOf(0.001)` ile ölçeği zorluyor ve `decimal.js` JS sayısını string üzerinden okuduğu için 15 anlamlı haneye kadar kayıp yok → **P2, tutarsızlık** (diğer para kapıları string alıyor), veri kaybı değil. **Yeni tetikleyici:** para tiplerinin uçtan uca string'e çekildiği hijyen turu. |
| **`adjust-stock` / `record-product-usage`'ın kendi kapıları** ✅ **KAPANDI (§41–§43 turunda)** | Tetikleyici `supply/inventory` turuydu ve o tur ikisini de düzeltti; bu not **bayat kalmıştı** (bkz. §55.3). Bugün `adjust-stock` kiracıyı URL `clinicId`'sinden çözüp yetkiyi onun üzerinden veriyor ve `findProductUnusableReason`'ı zorluyor; `record-product-usage` aynı kuralı kilit altında zorluyor, `BadRequestException` kalmadı, parti seçimi ürünün kullanılabilir partileriyle sınırlı.                                                                                                                                                                                                                                                                                                              |
| **Sipariş tutarının talep tahmininden sapmasının raporlanması**                                | Talepte `estimatedUnitPrice`, siparişte `unitPrice` var; ikisi arasındaki fark (bütçe aşımı) hiçbir yerde karşılaştırılmıyor. Bu bir **özellik** eksiği, bütünlük hatası değil: tahmin bağlayıcı değil ve sipariş kendi tutarını taşıyor. **Tetikleyici:** bütçe/onay limiti (tutara göre onay kademesi) istenirse — o zaman tahmin bağlayıcı hâle gelir ve onay kapısı tutarı okur.                                                                                                                                                                                                                                                                                                                             |

---

## 41. `supply/inventory` — Envanter (ürün kartı, parti/lot, stok hareketi)

Stok, bilançoda **150 Ticari Mallar**'ın karşılığıdır: mal kabulde ödenen bedel parti
maliyetine, tüketimde o maliyet gidere (SMM) döner. Bu turda modülün tamamı denetlendi
(satın alma turunda yalnız mal kabul yolu görülmüştü).

### Kontrol listesi

| Konu                                | Durum | Not                                                                                                                                                                |
| ----------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tutarlar `Decimal`                  | ✅    | Parti `purchase_price Decimal(10,2)`, hareket `unit_price/vat_amount/total_amount Decimal(10,2)`, miktarlar `Decimal(10,3)`; entity `Money`/`Quantity` VO taşıyor. |
| Ondalık ölçeği kapıda zorlanıyor    | ❌    | **P1-1**: alış fiyatı/miktar/delta kapıları sınırsız ondalık kabul ediyordu.                                                                                       |
| KDV oranı tek kaynaktan             | ❌    | **P1-2**: kapılar 0–100; `VatRate` yasal küme → mal kabul kaydın ortasında patlıyordu.                                                                             |
| Negatif stok engeli                 | ✅    | `Quantity.sub` yetersiz bakiyede `QuantityInsufficientException`; parti bazında zorlanıyor.                                                                        |
| Eşzamanlılık                        | ✅    | Düşüm/düzeltme ürün satırını `FOR UPDATE` kilitleyip partileri kilit altında okuyor (`outboxRun`).                                                                 |
| Miktar değişimi gerçekten yazılıyor | ❌    | **P0-1**: partisi olmayan ürüne "artış" yalnız hareket kaydı yazıyordu; stok seviyesi `Σ parti.quantity` olduğu için **miktar hiç artmıyordu**.                    |
| Hareket kaydı değer taşıyor         | ❌    | **P1-3**: yalnız mal kabul girişleri fiyat taşıyordu; tüm çıkışlar değersiz → tüketilen malın maliyeti hiçbir yerden türetilemiyordu.                              |
| Tüketimin sebebi kayıtlı            | ❌    | **P1-4**: uç `appointmentId` alıyor, hiçbir yere yazmıyordu (`product_usages` tablosu hiç kullanılmıyordu).                                                        |
| Kiracı sınırı (yazma)               | ❌    | **P1-5**: düzeltmede yetki ürünün kliniğinden, yazma isteğin kliniğinden; tüketimde parti kimliği kapsamsız okunuyordu.                                            |
| Kiracı sınırı (okuma)               | ❌    | **P1-6**: ürün listesi organizasyon kapsamında; ayrıca boş katalogda 500.                                                                                          |
| Kritik stok uyarısı                 | ❌    | **P1-7**: liste partilerden kurulduğu için **tükenen ürün** hiç uyarı üretmiyordu.                                                                                 |
| Silme güvenliği                     | ❌    | **P1-8**: üzerinde stok duran ürün silinebiliyordu; partiler kalıyor, değer listelerden düşüyordu.                                                                 |
| Benzersizlik kapsamı                | ❌    | **P1-9**: `stock_code`/`barcode` **global** unique → başka kiracı o kodu hiç kullanamıyor, silinen ürün kodu sonsuza dek rezerve tutuyordu. **Migration var.**     |
| Katman disiplini (HTTP sızması)     | ❌    | **P2-1**: domainde 3 ham `Error`, application'da `BadRequestException`.                                                                                            |
| Bağların kiracısı                   | ❌    | **P2-2**: ürün kartına başka kliniğin kategorisi/tedarikçisi bağlanabiliyordu.                                                                                     |
| Yüksek etkili işlem izi (kural 7)   | ⚠️    | Sayım düzeltmesi stoğu belgesiz değiştiren tek uç; gerekçe **opsiyoneldi** → zorunlu yapıldı. Ayrı capability ertelendi (§43).                                     |
| Ölü şema / okunmayan kolon          | ⚠️    | `product_prices` tablosu ve `stock_movements.finance_ledger_id` hiç yazılmıyor — bkz. §43.                                                                         |
| Envanter değeri ↔ 150 mutabakatı    | ❌    | Stok **değeri** üreten hiçbir sorgu yok (yalnız miktar); defterdeki 150 bakiyesiyle karşılaştırma yapılamıyor — bkz. §43.                                          |

### P0-1 — Sayım düzeltmesinde "giriş" sessiz bir yalandı

**Kanıt.** `product.entity.ts` → `handleStockChange`: parti bulunamayan **artışta**
`StockQuantityChangedEvent` fırlatıp `null` dönüyordu; `adjust-stock.handler.ts` da bu
durumda ürünü yazıp çıkıyordu. Stok seviyesi ise `product.query.repository.ts` içinde
`productBatch.groupBy` ile, yani **yalnız partilerden** hesaplanıyor.

**Neden bozuk.** Partisi olmayan bir ürüne +10 girildiğinde: hareket kaydı yazılır, cevap
başarılı döner, **stok 0 kalır**. Operatör düzeltmeyi yaptığını sanar; ikinci kez dener,
yine olmaz. Üstelik hareket kaydının maliyeti de yoktur — parti açılsa bile envanter değerine
sıfır maliyetle girerdi ve sonraki tüketimler bedava mal gibi gider yazardı.

**Düzeltme.** Partisiz artış `StockIncreaseRequiresReceiptException` ile reddediliyor ve
kullanıcı mal kabule yönlendiriliyor (orada tedarikçi + fiyat + lot alınır). Partisiz düşüm
zaten reddediliyordu; o da adını söyleyen bir domain hatasına bağlandı
(`NoLotToDeductException`). `handleStockChange` artık **her zaman** parti döndürüyor.

### P1-1 / P1-2 — Kapılar kolondan ve yasal kümeden geniş (kural 12)

`ReceiveStockSchema.purchasePrice: z.number().min(0)` ↔ `purchase_price Decimal(10,2)`:
kuruş altı fiyat DB'de yuvarlanıyor, parti maliyeti kaynağından kayıyordu (envanter değeri
ve tüketim maliyeti onun üzerine kuruluyor). Aynısı `quantity` / `quantityDelta` ↔
`Decimal(10,3)` ve ürün kartındaki `criticalStockQty` / `reorderQty` için geçerli.

`vatRate` kapıları 0–100 iken `StockMovement.create` oranı `VatRate.create` ile yasal kümeye
sokuyordu: %8'lik bir mal kabul isteği kapıdan geçiyor, hareket kaydı yazılırken
"Yasal olmayan KDV oranı" ile düşüyordu — hata, oranın girildiği yerden kopuk.

### P1-3 — Çıkan malın maliyeti hiçbir yere yazılmıyordu

**Kanıt.** `StockQuantityChangedEvent` yalnız miktar taşıyordu; hareket kaydını yazan
dinleyici partiyi okumadığı için `unitPrice`/`vat_amount`/`total_amount` **null** kalıyordu.
Fiyat taşıyan tek hareket, `receive-stock` içinde doğrudan yazılan `PURCHASE` girişiydi.

**Neden bozuk.** Hareketler üzerinden alınan her değer raporu girişleri sayar, çıkışları
saymaz: stok değeri yalnız artar. Tüketilen malın maliyeti (SMM) ve zayi değeri hiçbir
yerden türetilemez — oysa kolonlar bu veriyi tutmak için duruyor.

**Düzeltme.** Maliyet temeli (partinin alış fiyatı + para birimi) olayla taşınıyor; dinleyici
`Money` kurup hareketi değerliyor. KDV geçmiyor: bu bir vergi değil **maliyet** kaydı.

### P1-4 — Tüketimin sebebi (randevu) sessizce düşüyordu

**Kanıt.** `RecordProductUsageSchema.appointmentId` alınıyor; handler onu hiçbir yere
yazmıyordu. `product_usages` tablosu şemada tüm alanlarıyla (randevu, hekim, parti, hareket
bağı) duruyor ama **hiç yazılmıyordu**.

**Neden bozuk.** Tedavinin malzeme maliyeti yalnız bu bağ üzerinden hesaplanabilir; bağ
olmadığı sürece "bu işlem bize kaça mal oldu" sorusu cevapsız. Girdi kabul edilip atılması
rule 9'un (mapping'de alan düşmesi) uç biçimi: hata vermez, log üretmez, geri getirilemez.

**Düzeltme.** `ProductUsage` entity + command repo (yalnız `create`; kayıt değişmez) ve
tüketim akışında yazım. Hareket kimliği handler'da üretilip hem partiye hem tüketim kaydına
geçiyor → hareket ile tüketim eşleşiyor.

### P1-5 — Kiracı sınırı yazma yollarında eksikti

- `adjust-stock`: yetki **ürünün** kliniğiyle (`product.clinicId`) kontrol ediliyor, hareket
  ise URL'den gelen `clinicId` ile damgalanıyordu; iki klinik ayrıştığında kontrol bir
  kliniğe, yazma başka kliniğe bakıyordu (araya giren tek koruma `handleStockChange` içindeki
  ham `Error`'du → 500).
- `record-product-usage`: `dto.batchId` verildiğinde parti `findById` ile **kapsamsız**
  okunuyordu — başka ürünün, hatta başka kliniğin partisinden düşülebiliyordu; SKT'si geçmiş
  parti de tüketilebiliyordu (uygunluk süzgeci atlanıyordu).

**Düzeltme.** İkisinde de yetki isteğin kliniği üzerinden, ürün `catalog-usability.rules`
ile süzülüyor; parti **daima** `findAvailableByProduct` (ürün + klinik + uygunluk) listesinden
seçiliyor.

### P1-6 / P1-7 — Okuma tarafı

- Ürün listesi `findMany(organizationId, …)` ile **organizasyon** kapsamındaydı: çok klinikli
  organizasyonda personel başka şubenin kataloğunu görüyordu. Serileştirme ayarları
  `result.items[0].clinicId`'den okunuyordu → **boş katalogda `TypeError` (500)**, dolu
  listede alan görünürlüğü rastgele bir satırın kliniğine göre. Ayrıca controller
  `organizationId`'yi `ParseUUIDPipe` ile **opsiyonel** alıyordu (`optional: true` yok) →
  parametre gönderilmediğinde istek 400'e düşüyordu.
- Kritik stok uyarısı partilerden kurulup `quantity > 0` süzüldüğü için **stoğu tükenen ürün
  listeden tamamen düşüyordu**: uyarı en kritik durumu hiç göstermiyordu. Liste artık
  ürünlerden kurulup parti toplamı ekleniyor (stok yok → `0`, kritik).

### P1-8 — Üzerinde stok duran ürün silinebiliyordu

Silme `deletedAt` damgalıyor; stok seviyesi sorgusu ürünleri `deletedAt: null` süzdüğü için
partiler yerinde kalıyor ama **envanter değeri hiçbir listede görünmüyor**. Artık eldeki
toplam > 0 ise silme `ProductHasStockException` ile reddediliyor (önce stok sıfırlanır).

### P1-9 — Stok kodu/barkod global benzersizdi (migration)

`products.stock_code` ve `barcode` `@unique`: (a) A kliniğinin kullandığı kodu B kliniği bir
daha asla kullanamıyor ve hata mesajı başka kiracıda o kodun varlığını sızdırıyordu;
(b) soft-delete nedeniyle silinen ürün kodunu sonsuza dek rezerve tutuyordu. Kısıt klinik
kapsamına ve `deleted_at IS NULL` koşuluna alındı (kısmî unique index — Prisma şemasında
ifade edilemediği için ham SQL).

### P2 bulguları

| #        | Bulgu                                                                                                                                                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P2-1** | Domain katmanında 3 ham `Error` (SKT geçmiş parti, klinik uyuşmazlığı, lot bulunamadı) ve application katmanında `BadRequestException` ("Kullanılabilir stok bulunamadı"). İlki 500'e dönüşüp sebebi kullanıcıya hiç gitmiyordu; ikincisi CLAUDE.md katman kuralının ihlali. Beşi de `DomainException`. |
| **P2-2** | Ürün kartının `categoryId`/`supplierId` bağları kiracı doğrulamasından geçmiyordu (hem create hem update) → başka kliniğin kaydı bağlanabiliyordu. Katalog servisine `assertCategoryUsable` eklendi; iki kapı da `assertSupplierUsable`/`assertCategoryUsable` çağırıyor.                               |
| **P2-3** | `UpdateProductSchema.categoryId/supplierId` `z.string()` idi (oluşturma kapısında `z.uuid()`): aynı alan iki kapıda farklı sıkılıkta.                                                                                                                                                                   |
| **P2-4** | `CreateProductSchema.organizationId` istemciden alınıyordu (kiracı kimliği `clinicId`'den çözülür).                                                                                                                                                                                                     |
| **P2-5** | `IStockMovementCommandRepository` boş interface'ti (lint hatası) — hareketin **değişmez** olduğunu söyleyen bir not ile `type` alias'a çevrildi.                                                                                                                                                        |

---

## 42. Uygulanan düzeltmeler (2026-10-12, 2. tur) — `supply/inventory`

| Bulgu    | Düzeltme                                                                                                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0-1** | `handleStockChange` artık her zaman parti döndürüyor; partisiz artış `StockIncreaseRequiresReceiptException`, partisiz düşüm `NoLotToDeductException`. `adjust-stock` sadeleşti (ürün yazma dalı kalktı).                                         |
| **P1-1** | `receive-stock`, `adjust-stock`, `record-product-usage`, `create/update-product` şemalarına `multipleOf` (para 2, miktar 3).                                                                                                                      |
| **P1-2** | Aynı şemalarda `vatRate` artık `STATUTORY_VAT_RATES` kümesinden.                                                                                                                                                                                  |
| **P1-3** | `StockQuantityChangedEvent` maliyet temeli (`unitPrice` + `currency`) taşıyor; `ProductBatch` olayı partinin alış fiyatıyla dolduruyor, dinleyici `Money` kurup hareketi değerliyor.                                                              |
| **P1-4** | Yeni `ProductUsage` entity + `PRODUCT_USAGE_COMMAND_REPOSITORY` (+ repo modülü, repositories.module kaydı); tüketim akışı randevu/parti/hareket bağıyla kayıt yazıyor.                                                                            |
| **P1-5** | `adjust-stock`: kiracı `clinicId`'den çözülüyor, yetki isteğin kliniğine, ürün `findProductUnusableReason`'dan geçiyor. `record-product-usage`: parti daima uygun partiler listesinden seçiliyor + aynı ürün kapısı.                              |
| **P1-6** | `IProductQueryRepository.findMany` klinik kapsamlı; `find-products` handler'ı kiracıyı çözüp yetki kontrolü yapıyor, `items[0]` okuması kalktı; controller/query sınıfından `organizationId` kaldırıldı.                                          |
| **P1-7** | `getStockLevels` ürünlerden kuruluyor (parti toplamı eklenir, yoksa `0`) → tükenen ürün kritik uyarıda görünüyor.                                                                                                                                 |
| **P1-8** | `IProductBatchCommandRepository.sumOnHandByProduct` + `soft-delete-product` içinde `ProductHasStockException` koruması.                                                                                                                           |
| **P1-9** | **Migration** `20261012090000_product_code_scoped_to_clinic`: global unique'ler düşürülüp `(clinic_id, stock_code)` ve `(clinic_id, barcode)` kısmî unique index'leri (yalnız `deleted_at IS NULL`) kuruluyor; şemadaki `@unique`'ler kaldırıldı. |
| **P2-1** | Beş yeni `DomainException` (+ `ERROR_CODES.INVENTORY` kodları); ham `Error` ve `BadRequestException` kalmadı. `ProductNotFound`/`SupplierNotFound`'daki `httpStatus` **atama** hatası satın alma turunda düzeltilmişti.                           |
| **P2-2** | Katalog servisine `assertCategoryUsable`; `create-product` ve `update-product` kategori + tedarikçi bağlarını doğruluyor (envanterin kendi yaprak servis modülü üzerinden).                                                                       |
| **P2-3** | `UpdateProductSchema` alanları `z.uuid()`.                                                                                                                                                                                                        |
| **P2-4** | `CreateProductSchema.organizationId` kaldırıldı.                                                                                                                                                                                                  |
| **P2-5** | `IStockMovementCommandRepository` → `type` alias + değişmezlik notu.                                                                                                                                                                              |

### Testler

| Dosya                                                | Kapsam                                                                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `product.entity.spec.ts` (güncellendi, +1)           | partisiz artışın reddi (P0-1 regresyonu), partisiz düşüm, klinik uyuşmazlığının domain hatası olması, düşüm olayının maliyet taşıması |
| `adjust-stock.spec.ts` (yeni, 4)                     | yabancı kiracı kliniği, başka kliniğin ürünü, silinmiş ürün, kendi kliniğinde partiye yazma                                           |
| `adjust-stock.schema.spec.ts` (yeni, 11)             | zorunlu gerekçe, ±3 ondalık delta, sıfır delta reddi, alış fiyatı kuruş sınırı, yasal KDV kümesi, `organizationId` taşınmaması        |
| `record-product-usage.handler.spec.ts` (+4)          | tüketim kaydının randevu/parti/hareket kimliğiyle yazılması, yabancı parti kimliğinin kullanılmaması, domain hatası, yabancı ürün     |
| `soft-delete-product.spec.ts` (yeni, 3)              | eldeki stokta silmenin reddi, sıfır stokta silme, ürün yok                                                                            |
| `product.query.repository.spec.ts` (yeni, 4)         | tükenen ürünün `0` ile listelenmesi ve kritik sayılması (P1-7), klinik süzgeci, ürünsüz klinikte parti sorgusunun hiç yapılmaması     |
| `find-products.spec.ts` (yeni, 3)                    | boş katalogda hata vermemesi (P1-6), klinik kapsamı, yabancı klinik reddi                                                             |
| `inventory-catalog.service.spec.ts` (+3)             | kategori kapısı (kliniğin kategorisi / yabancı kategori / olmayan kategori)                                                           |
| `stock-quantity-changed.listener.spec.ts` (+2 iddia) | hareketin maliyetle yazılması (`unitPrice` 12.50 → `totalAmount` 43.75)                                                               |

### Doğrulama

- `npx tsc --noEmit` → `apps/api` **0 hata**, `apps/web` **0 hata**; `pnpm prisma:generate` çalıştırıldı.
- `npx jest` → **200 suite / 1225 test** yeşil (tur öncesi 195/1192).
- ESLint: envanter modülünün tamamında 0 hata (pre-existing boş interface de kapatıldı).
- **Migration var:** `20261012090000_product_code_scoped_to_clinic` — kullanıcı uygular
  (`pnpm migrate:dev`). Aynı klinikte mükerrer kod/barkod varsa index oluşturma hata verir;
  teşhis sorguları migration yorumunda.

---

## 43. Bilinçli yapılmayanlar — `supply/inventory`

| Konu                                                                                 | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Envanter değeri raporu + 150 hesabıyla mutabakat** ✅ **KAPANDI (§44)**            | Stok **değeri** üreten hiçbir sorgu yok (yalnız miktar). Defterde 150 bakiyesi alış faturalarından oluşuyor; envanter tarafında karşılığı hesaplanamadığı için "stok sayımı ile defter tutuyor mu" sorusu sorulamıyor. Doğru tasarım bir değerleme politikası seçmeyi (parti bazlı fiili maliyet mi, ağırlıklı ortalama mı) ve **çok para birimli** partilerde kur anını sabitlemeyi gerektiriyor (parti `currency` taşıyor, hiçbir yerde çevrilmiyor). Bu bir tur: değerleme + SMM fişleme + mutabakat birlikte. **Tetikleyici:** stok sayımı canlıya alınırken ya da 150 bakiyesi ilk kez sorgulandığında. **§57 taramasında ölçüldü:** değerleme turu (§44) raporu ve 150 mutabakatını kurdu. |
| **Tüketimin muhasebeye fişlenmesi (SMM) / `finance_ledger_id`** ✅ **KAPANDI (§44)** | `stock_movements.finance_ledger_id` kolonu "PURCHASE ve WASTE hareketlerinden sonra handler tarafından yazılır" diyor ama **hiç yazılmıyor**; tüketim/zayi için ekonomik olay da üretilmiyor. Artık hareketler maliyet taşıdığı için fişlemenin girdisi hazır, ama hangi hesaba (621/150 mi, 689 mu) ve hangi sıklıkta (hareket başına mı, dönem sonu mu) yazılacağı muhasebe kararı. **Tetikleyici:** yukarıdaki değerleme turu — ikisi aynı turda tasarlanır. **§57 taramasında ölçüldü:** aynı turda fişleme bağlandı.                                                                                                                                                                        |
| **`product_prices` tablosu (ölü şema)**                                              | Tablo (PURCHASE/SALE, `validFrom`/`validTo`) hiç yazılmıyor ve hiç okunmuyor; ürün satış fiyatı bugün tedavi/fatura tarafında yaşıyor. Silmek destructive migration demek, doldurmak ise yeni bir özellik (ürün satışı). Kalırsa kural 12'nin tarih-versiyonlu kısıtı (aynı anda tek açık sürüm) **DB'de kurulmalı** — bugün yok. **Tetikleyici:** ürün satışı (hasta ya da perakende) ürün fiyatını kullanmaya başlarsa; o an kısmî unique index de eklenir.                                                                                                                                                                                                                                    |
| **Çok partili tüketim (FEFO bölüştürme)**                                            | Tüketim tek partiden düşüyor; ilk uygun partinin bakiyesi yetmezse istek `QuantityInsufficientException` ile reddediliyor — toplam stok yeterli olsa bile. Bölüştürme (FEFO sırasıyla birkaç partiden) partilerin ayrı ayrı yazılmasını, hareketlerin parti başına üretilmesini ve kısmi başarısızlıkta tx davranışının netleşmesini gerektiriyor. Bugünkü hâli **fail-closed** ve sebebi açık. **Tetikleyici:** operasyonda "stok var ama düşemiyorum" vakası.                                                                                                                                                                                                                                  |
| **Sayım düzeltmesi için ayrı capability (kural 7)**                                  | Mal kabul, tüketim ve düzeltme aynı `stockmovement:create` ile yapılıyor. Düzeltme stoğu **belgesiz** değiştiren tek uç olduğu için ayrı yetki savunulabilir (zayi/kayıp örtme riski). Bu turda kuralın "kalıcı damga" yarısı uygulandı: gerekçe zorunlu + hareket kaydı maliyet ve personel taşıyor. Yetki bölmek `roles.ts` demetlerini ve seed'i de bölmek demek. **Tetikleyici:** depo personelinin satın alma/klinik yöneticisinden ayrıldığı ilk kurulum (satın alma turunda da aynı not var).                                                                                                                                                                                             |
| **Tüketimde `usedByProviderId`**                                                     | `product_usages.used_by_provider_id` kolonu duruyor; uç bu alanı almıyor (bugün yalnız `appointmentId`). Randevudan türetmek için randevunun hekimini çözmek (QueryBus) ve randevunun kliniğiyle tüketimin kliniğini doğrulamak gerekir — randevu-tüketim bağının kendi turu. Şimdilik `null` yazılıyor ve bu entity'de notlandı. **Tetikleyici:** hekim bazlı malzeme tüketimi raporu istenirse.                                                                                                                                                                                                                                                                                                |
| **Ürün KDV oranında `hasTax` çelişkisi** ✅ **KAPANDI (2026-10-13)**                 | Çelişki §55.1'de kapatıldı: `0` yasal kümenin (`STATUTORY_VAT_RATES`) üyesidir ve istisna/muafiyet malının oranı gerçekten sıfırdır — iki `hasTax.orThrow()` kaldırıldı. Ayrıca `vatRate` DTO'da **zorunlu** oldu: opsiyonelken handler `?? 0` ile dolduruyor, yani oranı söylemeyen istek sessizce istisna sayılıyor ve 191 indirilecek KDV eksik kullanılıyordu (§55.2).                                                                                                                                                                                                                                                                                                                       |
| **Parti miktarının hareketlerle mutabakatı**                                         | Şema `product_batches.quantity`'yi "denormalize koşan toplam, kaynak-doğru veri `StockMovement`" diye tanımlıyor ama ikisini karşılaştıran bir sorgu yok. Bugün sapma üretecek bir yol görünmüyor (miktar ve hareket aynı tx + kilit altında yazılıyor; hareket kaydı idempotent), ama elle veri düzeltmesi ya da ileride eklenecek bir toplu işlem sapma üretirse hiçbir yerde görünmez. Kural 11'in mantığı. **Tetikleyici:** stok sayımı ekranı ya da ilk elle veri düzeltmesi.                                                                                                                                                                                                               |

---

## 44. Envanter değerlemesi + 150 mutabakatı + SMM fişlemesi (2026-10-12, 3. tur)

§43'te ertelenen üç madde birlikte tasarlanıp uygulandı: **değerleme politikası**,
**tüketimin deftere fişlenmesi** ve **envanter ↔ 150 mutabakatı**. Üçü ayrı
yapılamazdı — fişleme olmadan 150 yalnız artar (mutabakat ilk tüketimde kopar),
değerleme olmadan karşılaştırılacak sayı yoktur, mutabakat olmadan ikisinin
ayrışması görünmez.

### 44.1 Değerleme politikası: parti bazlı fiili maliyet

**Karar.** Stok, **partinin kendi alış fiyatıyla** değerlenir (specific
identification). Ağırlıklı ortalama ya da ayrı bir FIFO katmanı **kurulmadı**:
sistem fiilen bunu uyguluyor — tüketim FEFO sırasıyla **belirli** bir partiden
düşüyor (`findAvailableByProduct`, `expiresAt ASC`) ve hareket o partinin
fiyatıyla değerleniyor (§42 P1-3). Üçüncü bir politika eklemek, defterden düşen
tutar ile stoktan düşen değeri ayrıştırırdı; mutabakat da anlamsızlaşırdı.

**Para birimi.** Parti kendi para biriminde değerlenir, **çevrilmez**. Yabancı
para partisinin fonksiyonel (TRY) maliyeti mal kabul anındaki kura bağlıdır ve o
kur bugün hiçbir yerde saklanmıyor. Rapor-anı kuruyla çevirmek tarihî maliyeti
bozar (stok değeri kur hareketiyle dalgalanırdı); mal kabulde kur çağırmak ise
TCMB erişilemediğinde **fiziksel mal kabulü bloke ederdi** — bu takas finansın
kendi kuralına aykırı ("fiş sonra atılır" > "iş durur"). Bu yüzden değerleme
para birimi başına toplanır, fonksiyonel toplam ayrı verilir ve mutabakat
yabancı para varsa kendini **"mutabık" ilan etmez**. Kalıcı çözüm §46'da
(parti ↔ alış faturası bağı) tetikleyicisiyle kayıtlı.

### 44.2 Stok hareketlerinin fişlenmesi (SMM)

Yeni tek kaynak: `finance/shared/domain/constants/stock-movement-ledger.constant.ts`.
Hem **üretici** (envanter köprüsü: "bu hareket için olay yazılır mı") hem **kural**
(posting: "hangi hesaba") buradan okur — iki yerde liste tutmak kuralın 12'nin
tam ihlali olurdu (üretilip hesabı olmayan olay sonsuza dek fişsiz kalır ve dönem
kapanışını bloke eder; hesabı olup üretilmeyen tip defteri sessizce eksik bırakır).

| Hareket                    | Fiş                                        |
| -------------------------- | ------------------------------------------ |
| `USAGE` (tedavide tüketim) | **B 740.01** Sarf Malzeme Tüketimi / A 150 |
| `WASTE` (zayi/fire)        | **B 689** Olağandışı Gider / A 150         |
| `ADJUSTMENT` çıkış (açık)  | **B 689** / A 150                          |
| `ADJUSTMENT` giriş (fazla) | **B 150** / A 679 Olağandışı Gelir         |
| `PURCHASE`                 | **fiş yok** — borç kaydı alış faturasından |
| `TRANSFER_*`, `RETURN_*`   | **fiş yok** — bkz. §46                     |

`PURCHASE`'ın köprülenmemesi kritik: alış faturası stoğu zaten 150'ye
borçlandırıyor (`lineAccountCode: '150'`), ikisi birlikte yazılsaydı stok **iki
kez** borçlanır ve envanter değeri defterin yarısı görünürdü.

**Nerede üretiliyor.** `StockQuantityChangedListener` — hareket kaydını yazan
yer. Üç sonucu var: (a) tek üretici (tüketim, zayi, sayım düzeltmesi hepsi aynı
yoldan geçer), (b) maliyet temeli elde (`unitPrice`), (c) idempotentlik hareket
kimliğinden (`dedupeKey: stock-movement:<movementId>`). Olay outbox'tan
geldiği için teslim at-least-once; hata **yutulmuyor**, yukarı fırlatılıp yeniden
deneniyor (kural 4'ün (a) şıkkı — ayrı bir backfill komutu bu yüzden gerekmedi).

**Düzeltilen yan bulgu (P1).** `record-product-usage` partiden düşerken hareket
tipini geçmiyordu; `deductQuantity` varsayılanı `ADJUSTMENT` olduğu için
**tedavide tüketilen malzeme defterde "sayım düzeltmesi" olarak** kaydediliyordu.
Hareket raporu yanlış olmakla kalmaz, yeni eşlemede maliyet 740.01 yerine 689'a
(olağandışı gider) düşerdi: hizmet üretim maliyeti olduğundan az, olağandışı
zarar olduğundan fazla görünürdü. Tip artık açıkça `USAGE`.

**Erken dönüş hatası kapatıldı.** Dinleyici "hareket zaten yazılmış" durumunda
`return` ediyordu. Köprü eklendiğinde bu, tekrar teslimin **tam sebebi** köprünün
ilk denemede patlaması olduğunda defter kaydını sonsuza dek eksik bırakırdı:
artık mevcut hareket üzerinden köprü yine denenir (kendi dedupeKey'i korur).

### 44.3 Envanter ↔ 150 mutabakatı

Yeni iki sorgu (`GET /clinics/:clinicId/stock/valuation`,
`GET /clinics/:clinicId/stock/ledger-reconciliation`), ikisi de **`finance:read`**
ister: miktarı görmek (depo) ile değeri görmek (muhasebe) aynı şey değil.
Mutabakat iki tarafı da **bus üzerinden** okur (envanter değerleme sorgusu +
muhasebe mizanı); `journal_lines`'a bakmaz, bounded context korunur.

Rapor farkı gösterir, **otomatik düzeltme yapmaz** (kural 11). Gösterdiği
kalemler: envanter değeri, 150 bakiyesi, fark, yabancı para toplamları
(karşılaştırmaya girmeyen) ve **silinmiş ürün üzerindeki stok değeri** — stok
listeleri silinmiş ürünü süzdüğü için farkın en olası sebebi budur (§42 P1-8
bunu önleyen kapıyı kurdu; eski veri için rapor bu kalemi gösterir).

Meşru fark kalemleri (rapor hesaplayamaz, §46'da kayıtlı): mal gelmiş faturası
gelmemiş, fatura stok yerine gidere (770/740) kaydedilmiş.

### 44.4 Uygulanan dosyalar

| Alan                | Değişiklik                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eşleme (tek kaynak) | **yeni** `stock-movement-ledger.constant.ts`: 150/740.01/689/679 kodları + `isLedgerBridgedStockMovement` + `resolveStockCounterAccount`.               |
| Gövde sözleşmesi    | `event-payloads.ts` (`StockOutEventPayload`, `StockInEventPayload`) + `financial-event-payload.schemas.ts` (kuruş + 3 ondalık miktar kapısı).           |
| Kurallar            | **yeni** `stock-out.rule.ts`, `stock-in.rule.ts`; eşlemesi olmayan tipte `UnmappedStockMovementTypeException` (sessiz yanlış hesap yok).                |
| Kapanış kapsamı     | `POSTABLE_FINANCIAL_EVENT_TYPES` += `STOCK_OUT`, `STOCK_IN` (registry açılışta kapsamı doğruluyor).                                                     |
| Üretici             | `StockQuantityChangedListener` → `RecordFinancialEventCommand`; `FINANCIAL_EVENT_SOURCE_MODULES.INVENTORY` + `FinancialEventDedupeKeys.stock_movement`. |
| Hareket tipi        | `record-product-usage` → `movementType: USAGE`.                                                                                                         |
| Değerleme           | `IProductQueryRepository.getInventoryValuation` (SQL'de `SUM(quantity × purchase_price)`) + `GetInventoryValuationQuery/Handler`.                       |
| Mutabakat           | **yeni** `GetInventoryLedgerReconciliationQuery/Handler` + iki HTTP ucu.                                                                                |

### 44.5 Testler ve doğrulama

| Dosya                                                   | Kapsam                                                                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `stock-movement-ledger.spec.ts` (yeni, 4)               | tip→hesap eşlemesi, girişte yalnız sayım fazlası, satın alma/transfer/iade köprülenmez, liste ↔ eşleme aynı küme                                                         |
| `stock-movement.rule.spec.ts` (yeni, 7)                 | 740.01/689/679 fişleri (dengeli), eşlemesi olmayan tipte hata, satın almanın iki kuraldan da geçmemesi                                                                   |
| `financial-event-payload.schemas.spec.ts` (+5)          | kuruş altı/sıfır tutar reddi, 3 ondalıktan ince miktar reddi, hareket kimliği zorunluluğu                                                                                |
| `stock-quantity-changed.listener.spec.ts` (+5)          | tüketimin STOCK_OUT yazması (3.5 × 12.50 = 43.75), sayım fazlasının STOCK_IN, satın almanın köprülenmemesi, maliyetsiz hareket, mevcut harekette köprünün yine denenmesi |
| `get-inventory-valuation.spec.ts` (yeni, 4)             | para birimi başına toplam + fonksiyonel toplam, yabancı para işareti, boş stok, yabancı klinik reddi                                                                     |
| `get-inventory-ledger-reconciliation.spec.ts` (yeni, 6) | eşitlikte mutabık, fark raporu, 150 hiç hareket görmemişse, yabancı parada "mutabık" dememe, silinmiş ürün kalemi, 150'nin alacak bakiyesi                               |

- `npx tsc --noEmit` → `apps/api` **0 hata**, `apps/web` **0 hata**.
- `npx jest` → **204 suite / 1256 test** yeşil (tur öncesi 200/1225).
- `app.module.spec.ts` yeni kuralların ve sorguların DI'da çözüldüğünü doğruluyor
  (`PostingRuleRegistry` açılışta kapsam kontrolü yaptığı için yanlış kayıt
  uygulamayı başlatmaz).
- ESLint: turda eklenen/düzenlenen dosyalarda 0 hata. **Migration yok** (şema
  değişmedi; stok kodu migration'ı §42'den bekliyor).

---

## 45. Finans güvence durumu — özet (2026-10-20, §89 turundan sonra güncel)

| Alan                       | Durum                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Modül kapsamı**          | §2'deki **17 finans modülü + `supply/purchasing` + `supply/inventory` + `platform/subscription` + `crm/health-tourism` (ödeme yolu **ve** fiyat türetmesi)** denetlendi. Son ikisi finans ağacında değil ama **kart çekiyor**: denetim yüzeyi modül yoluna değil **paranın geçtiği yola** göre belirlenir (§59, §61, §63). Tek kısmi satır: `e-document`. **Kalan para yüzeyi:** `ProjectCost` / `work-order` maliyetlerinin deftere girmemesi (ölçüldü: depolama güvenli, posting bilinçli yok).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Kapatılan bulgu**        | Toplam **~64×P0, ~108×P1, ~74×P2** + **2 eksik akış** (§85: settlement, §87: kart itirazı; tur 31 §89: 3×P0 + 1×P1) (tur bazlı dökümler §3–§44, §47, §49, §51, §53, §55, §57, §59, §61, §63, §65, §67, §69, §71, §73, §75, §77, §79, §81, §83, §85, §87).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Çift taraflı defter**    | Olay defteri (append-only) → posting kuralları → yevmiye. **İade** artık kendi olay tipini taşıyor — klinik defterinde `PAYMENT_REFUNDED` (§65), platform defterinde `PLATFORM_BOOKING_REFUNDED` (§67, 610/320/689) — tahsilatın storno'su değil, kendi tarihi olan ayrı fiş. Platform fişi §67'ye kadar **hiç postlanamıyordu** (320 `requiresParty` taşırken satır carisiz üretiliyordu). Kural kapsamı açılışta `POSTABLE_FINANCIAL_EVENT_TYPES` ile karşılaştırılıyor; dengesiz fiş yazılamıyor; storno defterden silmiyor. **Belge iptali** aynı storno mekanizmasını kullanıyor (§47.1) — belge → olay → fiş zinciri.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Para**                   | Tüm tutarlar `Decimal`; kuruş ölçeği **yazma kapılarında** zorlanıyor (olay gövdesi, fatura, POS, kasa, satın alma, envanter, **sağlık turizmi satış fiyatı** — §63.3); okuma modelleri parayı string taşıyor. Yuvarlama **tek kapıdan** geçiyor: `Money.scale` (ölçek + mod birlikte, global `Decimal.rounding`'den bağımsız — §53.6). **Para birimi çevrimi de tek kapıdan**: `Money.convert(rate, to)` (§71.2) — `multiply` etiketi bilerek korur, kurla çarpıp etiketi bırakmak TRY tutarı taşıyan "EUR" üretiyordu. Kuruş ölçeği artık **defterin kendi kapısında** da zorlanıyor (`Money.isKurusScaled` → yevmiye satırı + orijinal para tutarı): üst kapılar (olay gövdesi regex'i, kuralların `toFixed(2)`'si) ayakta ama ölçünün tanımı tek yerde (§81.3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Yabancı para**           | Model A: defter tek fonksiyonel parada (bugün her klinikte TRY — `clinic_finance_settings` 0 satır), yabancı işlem **posting anında** olay tarihli TCMB döviz alış kuruyla çevrilir ve `original*`/`fxRate` satırda saklanır (storno'da terslenerek taşınır). Paranın **fiilen hareket ettiği** cins esastır: iyzico yabancı satışı TRY çeker → gövde TRY yazılır ve **kayıttaki kilitli kur** kullanılır, posting ikinci bir kur kaynağına başvurmaz (§71.1). Satır-seviyesi temel (320'nin EUR borcu) fiş-seviyesi çevrimle birlikte kullanılamaz (§71.4). Yayın olmayan günde en çok 7 gün geriye yürünür (§71.5). **Henüz yok:** realize kur farkı (646/656), dönem sonu değerlemesi, yabancı alt defter raporu (§72). |
| **Eşzamanlılık**           | Dönem kapısı + yevmiye no tek-UPDATE; kasa oturumu, stok partisi, sipariş sayacı, fatura eşleştirme `FOR UPDATE`; randevu/abonelik optimistic `version`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **İdempotentlik**          | `dedupeKey` + unique kısıt (olay defteri), POS/iyzico callback'leri, outbox at-least-once + idempotent tüketiciler, doğal anahtarlar (alış faturası, kasa oturumu). |
| **Webhook kimliği**        | Para getiren dört `@Public` uç: Stripe (imza + ham gövde, fail-closed) ve fiziksel POS (HMAC, fail-closed) **kimliklendirilmiş**; iyzico'nun iki callback'i imza taşımıyor → bildirim ↔ kayıt **bağı** tek kuraldan (`checkIyzicoCallbackBinding`) geçiyor: yerel token kanıtı + sağlayıcı yankısı, çelişkide ve kanıtsızlıkta **ret** (§73). Rezervasyonda ayrıca sepet tutarı kapısı. Reddedilen bildirim CRITICAL basar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Hassas veri**            | Ham kart numarası/CVV sistemde **hiç yok** (sağlayıcılardan yalnız maskeli alanlar gelir) → PAN açısından PCI kapsamı dışı; TC kimlik sağlayıcıya yer tutucu olarak gider. Credential'lar üç sınırda da kapatıldı: **log** (`redactSensitive`, derin), **saklama** (sağlayıcı blob'ları entity'nin yazma kapısında maskelenir) ve **HTTP yanıtı** (yanıt DTO'ları tarama testiyle kilitli — `@Expose` edilmiş credential adı testi kırmızıya düşürür). Alarm gövdeleri ve exception `meta`'ları yalnız kimlik taşıyor (§75). |
| **Event teslimi**          | Kritik event `outboxRun()` ile mühürlenir (**55 çağrı yeri**) ve `@OnDomainEvent` kapısından teslim edilir: dinleyici **beklenir**, hatası çağırana **ulaşır**. Kayıt sahiplenilir (`FOR UPDATE SKIP LOCKED` + kiralama), 10 denemede ölü mektuba düşer (CRITICAL + `pnpm outbox:dead-letters`), sıra `seq` ile verilir. Çıplak `@OnEvent` **taramayla** yasak. In-memory kanal bilinçle beklemez ama WARNING üretir. |
| **Önbellek**               | Karar besleyen önbellekler ölçüldü: entitlement kapısı **fail-closed** (miss → DB, Redis hatası → ret), klinik/aktör önbellekleri kapsamlı + TTL'li, slot kilidi Lua ile sahip kontrollü. Teklif önbellekleri **kiracı kapsamlı** ve okuma sahipliği doğrular; kimlikler tam UUID. Transfer müsaitlik önbelleğinin kiracısız anahtarı **ölçülerek** meşru bulundu (platform-global kimlik + hizmet bedeli) ve koşulu §79.1'de kayıtlı. |
| **Kiracı sınırı**          | Yazma yollarında klinik/organizasyon doğrulaması; `TENANT_SCOPE_RESOLVER` org'u istemciden almıyor; katalog kapısı (ürün/tedarikçi/kategori) ve talep-klinik eşleşmesi bu turlarda kapatıldı.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **§79'dan sonra önbellek de kapsamlı**: para kararı taşıyan teklif kayıtları kiracı kapsamlı anahtarla yazılır ve okuma sahipliği doğrular (anahtar bir adres, yetki değil).
| **Değişmezler**            | Saklanan defterin değişmezleri artık **sorgulanıyor**: `pnpm finans:degismezler` yirmi kontrol çalıştırıyor (son yedisi tur 31, §89: platform dönemi, rezervasyon iadesi, 336) (dengesiz fiş, iki satırdan az satırlı fiş, satır tutarı ihlali, geçersiz kur, fiş ↔ dönem klinik uyuşmazlığı, **eksi 108** (§85), eksi kasa, açık oturumda eksi çekmece, **eksi 127**, **127 ↔ açık itiraz mutabakatı**, **itiraz tavan aşımı** (POS + sanal POS), **itiraz ↔ ödeme planı uyumu** — §87) ve aykırılıkta çıkış kodu 1, **çalıştırılamayan kontrolde 2** verir (çalışmayan kontrol "sağlam" sayılmaz — §87.4); otomatik onarım yok (dengesiz fişi düzeltmek muhasebe kararıdır). Satır değişmezleri **DB'ye** de yazıldı (`financial_invariant_checks`, `NOT VALID` → mevcut veriye dokunmaz, `VALIDATE CONSTRAINT` operasyon adımı). **Negatif bakiye:** kasa çıkışı çekmecedeki nakitle sınırlı (`CashSession.assertCanWithdraw`, oturum kilidi altında, kapanış beklentisiyle **aynı formül**); eski verinin izi kapanışta CRITICAL basar. Hasta borç tavanı ayarı hâlâ okunmuyor — ürün kararı (§81.5, iş paketi 21). |
| **Alarm**                  | Zincirin tamamı denetlendi (§83): Slack adaptörü olgun (fırlatmaz, kanal düşerse log'a düşer, `dedupeKey` 10 dk bastırır ama susturmaz, Redis hatası geçirme yönünde). **Kanal hiçbir ortamda bağlı değil** — artık `.env.example`'da belgeli ve seçim açılışta duyuruluyor (üretimde `error`). Denetim izi yazma hatası artık uyarı basıyor **ve çağırana ulaşıyor** (yutma kararı dinleyicinin). Grafikten düşen dinleyici `app.module.spec.ts` ile yasak; alarmın son durağı dinleyicisizse içeriği log'a basıyor. Sürecin ölümü (yakalanmayan promise reddi/exception) CRITICAL uyarı üretip süreci yine kapatıyor. |
| **Settlement**             | Kartla tahsil edilen paranın bankaya geçişi artık deftere yazılıyor: `B 102 net + B 653 komisyon / A 108 brüt` (§85). Kayıt sağlayıcının payout raporundan girilir (API yok), `(clinicId, provider, reference)` DB'de tekil (aynı payout iki kez girilirse 108 iki kez kapanırdı). 108 bakiyesinden fazlası kapatılamaz — bakiye **danışma kilidi** altında okunur (`lockConcept` + `lockAndGetAccountBalance`). Komisyonun KDV'si bilinçli ayrıştırılmadı (fatura ayrı belge); 108'in sağlayıcı bazında alt hesaplanması ve FIFO yaşlandırma ertelendi (§86). **Platform defterinin 108'i hâlâ kapanmıyor** (iş paketi 16). |
| **Kart itirazı** | Sağlayıcının kart sahibi lehine parayı geri kesmesi artık deftere yazılıyor (§87): açıldı `B 127 / A 108\|102` (+ ücret `B 653`), kazanıldı `B 108\|102 / A 127`, kaybedildi `B 120 / A 127`. İtiraz süresince para **127 ara hesabında**; kaybedilen itiraz `REFUNDED` değil **`CHARGED_BACK`** ve aynı tutarda **telafi taksidi** açar (hasta borcu geçerli). Kayıt sağlayıcı bildiriminden elle girilir, `(clinicId, provider, caseReference)` DB'de tekil. **Çift iade deliği kapatıldı:** iade/iptal/ters ibraz aynı kümülatif tavanı paylaşır ve aynı satışı `FOR UPDATE` kilitler (6 handler'a tavan kapısı; **CLAUDE.md kural 17**). Platform tarafı (Stripe), kısmi itirazın plana yansıması ve değersiz alacak ertelendi (§88). |
| **Mutabakat**              | Banka ekstresi ↔ 102, POS ↔ köprülenmemiş işlemler, fişlenmemiş olay süpürmesi (45 gün + CRITICAL), hesap planı şablon sapması, envanter ↔ 150, mal kabul ↔ fatura (GRNI), parti miktarı ↔ hareket toplamı. Rapor pencerelerinin **son günü** artık düşmüyor (§51.2). Rezervasyonda **teklif ↔ fiilî tedarikçi maliyeti** sapması kalıcı kolondan ölçülüyor ve alarma bağlı (§63.1); **iptal cezası** da öyle (§67.3) — bilinmeyen ceza cezasız ters kayıt + WARNING, sıfır ceza sessiz. Rezervasyon köprüsünün **telafi yolu** §69'da kuruldu (eksik fiş raporu + backfill, iki yön; `dedupeKey` varlığına bakan yeni sorgu sayesinde tahsilat ↔ iade ayırt ediliyor).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Ertelenen kalemler**     | **218 kalem** tek tek `11-eksik-kalanlar.md`'de (üretilmiş: `pnpm finans:eksik`; 206 açık), konu bazında gruplanmış hâli `10-kalan-isler.md`'de (**22 iş paketi**, 16 numaralı paketin klinik yarısı §85'te kapandı; §88'in 13 kalemi mevcut paketlere işlendi). Durum sütununun sınırı §70'te kayıtlı. |
| **Bekleyen operasyon işi** | **16 migration'ın hepsi uygulandı** (2026-10-19 itibarıyla `migrate status` 87/87 "up to date" — §57, §59, §63, §65, §67, §77, §81 ve §85 migration'ları dahil; 2026-10-13'te uygulanan ilk 8'in üstüne). **Bekleyen: 2** — §89 `booking_payment_refunds` (4 enum, 2 olay tipi, tablo + 7 CHECK, legacy REFUNDED→UNCONFIRMED işaretleme; ek-yönlü) ve §87 `card_chargeback` (4 enum, 5 enum değeri, `card_chargebacks` tablosu, nullable `recovers_installment_id`; hepsi ek-yönlü, mevcut veriye dokunmaz). **Sekiz `NOT VALID` kısıt (§81) hâlâ doğrulanmadı** — `pnpm finans:degismezler` temiz çıktı, `VALIDATE CONSTRAINT` operasyon adımı bekliyor — `migrate status` "up to date", `migrate diff` **sapma yok**; üç riskli migration (alış faturası doğal anahtarı, kasa tek-açık-oturum, ürün kodu klinik kapsamı) veri çatışması olmadan geçti; `journal_entry_kind` için öngörülen elle düzeltme **gerekmedi** (defterde hiç fiş yoktu → eski kapanış fişi yok). Kalanlar ölçüldü: (1) `POS_CALLBACK_SECRET` **`envs/.env.example`'a belgelendi** (2026-10-13: imza biçimi `x-pos-signature: sha256=<hex>`, üretim komutu, fail-closed notu) ama `envs/.env.development` ve `.env.production`'da **değer yok** → POS callback 503. Joi şemasına **bilinçli eklenmedi**: zorunlu yapılsaydı fiziksel POS kullanmayan kurulum hiç açılmazdı; doğru yer kullanım noktasındaki fail-closed kapı (`rawBody: true` zaten açık, uç gerçekten çalışabilir); (2) **yetki matrisi bayat** — DB'de 364 yetki satırı var, **58 model ailesi hiç yok** (`cashregister`, `cashsession`, `bankaccount`, `treatmentcharge`, `payroll` + sanal **`finance`**); sanal `finance` yetkisi olmadığı için `FinancePolicy`'nin parasal görünürlük kararı ve FINANCE kapılı uçlar **kapalı**; seed yeniden çalıştırılmalı (idempotent: `upsert` + `skipDuplicates`; tek yan etkisi rol↔yetki atamalarını `roles.ts'ten yeniden kurması); (3) kurulum adımları yapılmamış: **0 muhasebe dönemi, 0 hesap planı satırı** (2 klinik mevcut) → dönem kapısı ve her posting yolu kapalı. (4) **operasyonel uyarı kanalı bağlı değil**: `SLACK_OPS_WEBHOOK_URL` hiçbir ortamda tanımsız → 41 uyarı yalnız log'a yazılıyor; artık `.env.example`'da belgeli ve açılışta duyuruluyor (üretimde `error` seviyesinde), değerini koymak operasyon kararı (§83.2). **API kırıcı değişiklik:** `GET /reports/balance-sheet`artık`dateFrom`/`dateTo`değil`asOf`alıyor; ürün`vatRate` zorunlu (ikisinin de frontend tüketicisi yok). |
| **Bilinçli ertelenenler**  | **Tek liste: `10-kalan-isler.md`** — 19 erteleme tablosundaki 120+ satır konu bazında **13 iş paketine** indirildi (tetikleyici + adres + bağımlılık sırası). Kaynak hâlâ §9, §11, §15, §19, §22, §25, §29, §33, §37, §40, §43, §46, §48, §50, §52, §54, §56, §58. Liste iki kez **ölçüldü** (§55, §57): toplam **8 satır düştü** — ikisi canlı hataydı, altısı zaten kapanmış olduğu hâlde açık görünüyordu. En büyük iki paket: gerçek e-belge adapter'ı (kalem bazlı XML + yasal iptal penceresi) ve dönem sonu fiş takımı.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

**Kalan en büyük yapısal boşluklar.** Belge iptali/storno akışı (§47), iki
mutabakat kalemi (§49: GRNI + parti sapması) ve raporlama semantiği (§51: bilanço
anı, gün sınırı, kapanış fişi) **kapandı**. Henüz turu yapılmamış olanlar:

1. **Dönem sonu fişleri** — GRNI tahakkuku (159/326) ile maliyet aktarımı
   (740 → 622/620) **ve açılış fişi** (590 → 570) yıl sonu kapanış komutuyla
   birlikte tasarlanmalı. Üçünün altyapısı artık hazır: kapanış fişi
   `JournalEntryKind.CLOSING` ile işaretli, açılış fişi `OPENING` olarak eklenir
   ve gelir tablosundan aynı süzgeçle dışlanır (§51.3, §52).
2. **Yabancı para parti maliyeti** — somut plan §50'de (siparişin faturalarının
   ağırlıklı ortalama kuru), tüketicisiyle birlikte eklenecek.
3. **Gerçek e-belge adapter'ına bağlı kalemler** — kalem bazlı XML, `getStatus`,
   yasal iptal penceresi / iade faturası ayrımı, e-Defter dışa aktarımı (§52).
   Faturanın kalem bazına geçmesi §53.4'ün pay hesabını da gereksiz kılar: KDV
   doğrudan satırdan okunur (§54).
4. **Envanter değerlemesinin `asOf` desteği** — bilanço artık geçmiş bir tarihe
   doğru bakıyor (append-only defter sayesinde), envanter bakamıyor (§46, §52).
5. `product_prices` ölü tablosu.

Hepsi §43/§46/§48/§50/§52'de tetikleyicileriyle duruyor.

---

## 46. Bilinçli yapılmayanlar — değerleme / fişleme turu

| Konu                                                                                | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Parti ↔ alış faturası bağı (yabancı para maliyeti + "mal geldi fatura gelmedi")** | Mal kabul ile fatura bugün **bağlantısız** iki olay. Bağ kurulsaydı üç şey birlikte çözülürdü: (a) yabancı para partisinin fonksiyonel maliyeti faturanın posting kurundan türer (bugün çevrilmiyor), (b) "mal geldi faturası gelmedi" farkı **hesaplanabilir** bir mutabakat kalemi olur (159/326 tahakkuku dahil), (c) sipariş↔teslim↔fatura üçlüsü tek yerden izlenir. Parti tarafına fatura kalemi referansı + mal kabulde fatura seçimi gerekiyor. **Tetikleyici:** ilk yabancı para alımı ya da ay sonunda ilk "faturası gelmemiş mal" sorusu. |
| **Dönem sonu maliyet aktarımı (740 → 622/620 yansıtma)**                            | Tüketim artık 740.01'e yazılıyor; 7/A grubunda dönem sonunda 741 yansıtma ile 622'ye aktarım yapılması gerekir (gelir tablosu maliyeti oradan okur). Hesaplar şablonda hazır (`740`, `741`). Aktarım bir **dönem sonu** işlemidir: yıl sonu kapanış komutuyla (§6) birlikte tasarlanmalı, tek tek fişlerle değil. **Tetikleyici:** ilk gerçek dönem kapanışı ya da gelir tablosunda hizmet maliyetinin sorulması.                                                                                                                                    |
| **Transfer / iade hareketlerinin fişlenmesi**                                       | `TRANSFER_IN/OUT` iki defter arasında yer değiştirmedir (tek defterde gider/gelir doğurmaz, karşı klinik defterine eş kayıt ister); `RETURN_TO_SUPPLIER` / `RETURN_FROM_PATIENT` ise ilgili faturanın ters kaydıyla yürümeli (cari + KDV birlikte düzelmeli) — stok bacağını tek başına yazmak faturayla ayrışma üretir. İkisinin de bugün **üreticisi yok**. **Tetikleyici:** klinikler arası transfer ya da tedarikçi iadesi akışı yazılırken (eşleme haritası o anda birlikte güncellenir).                                                       |
| **Değerlemenin tarih bazlı (asOf) olması**                                          | Rapor **anlık** değer veriyor (partilerin bugünkü miktarı). Geçmiş bir tarihe ait stok değeri için hareketlerden geriye sarmak gerekir (`quantity` denormalize koşan toplam). Dönem sonu envanter değeri sorulduğunda bu gerekecek; o zaman parti-miktar ↔ hareket mutabakatı (§43) da aynı altyapıyı kullanır. **Tetikleyici:** dönem sonu envanter raporu ya da geçmişe dönük mutabakat ihtiyacı.                                                                                                                                                  |
| **Sıfır maliyetli (bedelsiz numune) hareketin fişi**                                | Tutar sıfırsa köprü kurulmuyor: sıfır tutarlı fiş satırı muhasebe kuralınca geçersiz ve bedelsiz numunenin **maliyeti yok**. Bedelsiz malın piyasa değeriyle kayda alınması (VUK emsal bedel) ayrı bir karar; bugün parti fiyatı 0 girilerek yapılıyor ve defterde iz bırakmıyor. **Tetikleyici:** bedelsiz numune/promosyon akışı tanımlanırsa.                                                                                                                                                                                                     |
| **`_ctx` lint borcu (posting kuralları)**                                           | Yedi mevcut kural `build(event, _ctx)` imzasıyla yazılmış ve `no-unused-vars` hatası veriyor (tur öncesinden beri). Yeni iki kural parametreyi **hiç almıyor** (TS arayüzü daha az parametreyle uygulanmaya izin verir). Mevcut yedisini düzeltmek kuralların hiçbirinin davranışını değiştirmez ama turun diff'ini şişirir. **Tetikleyici:** posting modülünün kendi turu (§6/§7) ya da lint'in CI'da zorunlu olması.                                                                                                                               |

---

## 47. Belge iptali / storno akışı (2026-10-12, 4. tur)

§15'in ilk ertelemesi ve §45'in "kalan en büyük yapısal boşluk" olarak işaretlediği
madde kapandı: **satış ve alış faturası iptal edilebiliyor**, defter etkisi storno
ile gidiyor, belge yerinde kalıyor ve iptalden sonra **doğru fatura yeniden
kesilebiliyor**.

Boşluğun şekli şuydu: `InvoiceStatus.CANCELLED` ve `PurchaseInvoiceStatus.CANCELLED`
enum'da **vardı** ama hiçbir kod yolu oraya götürmüyordu. Fatura gövdesi append-only
(tutar değiştirilemez), `assertAppointmentNotInvoiced` da düzeltmeyi engelliyordu →
**hatalı kesilmiş bir fatura kalıcı olarak hatalı kalıyordu**. Defter tarafında
storno mekanizması (`ReverseJournalEntryCommand`) hazırdı ama yalnız yevmiye
ucundan, **fiş kimliğiyle** çağrılabiliyordu; bir belgeyi iptal eden operatör o
fişin id'sini bilmiyor.

### 47.1 Muhasebe bacağı: yeni olay tipi DEĞİL, mevcut storno

**Karar.** İptal, `SALES_INVOICE_CANCELLED` gibi **yeni bir olay tipi + posting
kuralı** ile yapılmadı; mevcut storno mekanizması kullanıldı.

**Gerekçe (kural 8).** Yeni bir olay yazıp ters fişi kural motorundan üretmek
orijinal fişi `REVERSED` **işaretlemez**. O zaman `LEDGER_EFFECTIVE_ENTRY_STATUSES`
süzgeci iki fişi de "etkin" sayar: tutarlar doğru netleşir ama (a) orijinal fiş
sonsuza dek `POSTED` görünür, (b) `reversedById` izi hiç kurulmaz, (c) `ensureReversible`
guard'ı devreye girmediği için ikinci bir iptal **mükerrer storno** üretebilir. Bu
hata sessizdir — her iki fiş kendi içinde dengelidir, "Σborç = Σalacak" kontrolü
tutmaya devam eder.

**Yeni primitif:** `ReverseJournalEntryByEventCommand({ dedupeKey, reason, ctx })`
(`accounting/posting`). Belgeyi deftere bağlayan zinciri yürür:

```
dedupeKey (FinancialEventDedupeKeys.sales_invoice / .purchase_invoice)
   → FinancialEvent.id          (findByDedupeKey — Command Repo)
   → JournalEntry.eventId       (findByEventId   — Command Repo, unique)
   → ReverseJournalEntryCommand (kilit + ensureReversible + dönem kapısı onda)
```

İki okuma da **Command Repo'dan**: ikisi de bir yazma kararını (storno) besliyor ve
çağıranın transaction'ı içinde çalışıyor. Yetki kontrolü, satır kilidi
(`findByIdForUpdate`) ve mükerrer-storno guard'ı devrettiği komutun içinde durur —
tekrarlanmadı.

### 47.2 Fişlenmemiş olay penceresi: iptal **reddedilir**

En ince yarış: olay yazılmış ama fişi henüz üretilmemiş (Outbox kaydı işlenmeyi
bekliyor ya da fiş `DRAFT` kalmış). Bu pencerede iptale izin verilseydi belge
`CANCELLED` olurken fiş birkaç saniye sonra üretilir ve **iptal edilmiş bir belgenin
hasılatı defterde kalıcı olarak kalırdı** — onu götürecek storno da hiç atılmazdı
(iptal akışı bir daha çalışmaz, `cancel()` guard'ı ikinci denemeyi reddeder).

Çözüm, olayı "iptal edildi" diye işaretlemek **değil** (olay defteri append-only),
pencereyi kapatmak: `FinancialEventNotPostedYetException` (409) — "belge henüz
deftere işlenmedi, birkaç saniye sonra tekrar deneyin". Geçici bir durumdur ve
operatöre doğru şeyi söyler. Olayın **hiç** olmaması ise farklı bir arızadır
(`FinancialEventNotFoundForPostingException`): belge ile defter arasında köprü hiç
kurulmamış demektir, sessizce "iptal edildi" demek o farkı gizlerdi.

### 47.3 Yeniden faturalama: tam unique → kısmî unique

`invoices.appointment_id` ve `invoices.payment_id` **tam** unique'ti. İptalden sonra
aynı randevu/tahsilat için doğru fatura kesilemiyordu (`InvoiceDuplicateException`)
— yani iptal akışı tek başına yarım kalırdı. Tekillik yalnız **iptal edilmemiş**
faturalar arasında anlamlıdır:

| Önce (tam unique)             | Sonra (kısmî unique)                                                 |
| ----------------------------- | -------------------------------------------------------------------- |
| `invoices_appointment_id_key` | `invoices_appointment_id_active_key` … `WHERE status <> 'CANCELLED'` |
| `invoices_payment_id_key`     | `invoices_payment_id_active_key` … `WHERE status <> 'CANCELLED'`     |

Prisma kısmî index'i şemada ifade edemediği için model tarafındaki `@unique`
kaldırıldı, kısıt migration'da elle kuruldu ve şemaya gerekçesi `///` ile yazıldı
(ürün stok kodu turundaki desenin aynısı, §42). Yan etki: `Appointment.invoice` ve
`Payment.invoice` tekil navigasyonları `invoices Invoice[]` oldu — hiçbir kod bu
ilişkiyi kullanmıyordu (ölçüldü).

**Kabul kümesi tek sabitte** (kural 12): `ACTIVE_INVOICE_STATUSES`
(`PENDING | ISSUED | FAILED`). Hem kod tarafındaki lookup'lar hem DB index'inin
koşulu bu kümenin tümleyenidir. Kapı index'ten geniş olsaydı mükerrer **etkin**
fatura yazılırdı; kod geniş olsaydı yazılamayan bir faturaya "zaten var" denirdi.
Süzgecin uygulandığı yerler:

| Yer                                                 | Neden                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| `findByAppointmentId` / `findByPaymentId` (Command) | "fatura var mı" kararı; iptal edilmiş belge doğrusunu engellememeli |
| aynı ikisi (Query)                                  | ekranda **geçerli** belge gösterilmeli                              |
| `findExistingPaymentIds` (Query)                    | iptal sonrası tahsilat yeniden "faturası eksik" adayı olmalı        |
| `claimForEDocumentDispatch` (Command)               | iptal edilmiş faturanın belgesi entegratöre **gönderilmemeli**      |

`assertAppointmentNotInvoiced` da aynı lookup'tan beslendiği için iptalden sonra
randevunun işlem satırları **otomatik olarak düzeltilebilir** hâle geldi (donmuş
satır sorunu, iptalin varlık sebebiydi).

### 47.4 e-Belge: yerel iptal + outbound bildirim

Belge entegratöre gittiyse yerel iptal yetmez; vergi idaresindeki belgenin de iptal
bildirimi gerekir. `EInvoicePort.cancel(uuid, reason)` zaten tanımlıydı ama hiç
çağrılmıyordu. Üç durum ayrıldı — ayrım `invoice-status.constant.ts`'te:

| `einvoiceStatus`                          | Davranış                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `QUEUED`                                  | **iptal reddedilir** — gönderim havada, belgenin oluşup oluşmadığı bilinmiyor |
| `SENT`, `ACCEPTED`                        | iptal **edilir** + entegratör bildirimi kuyruğa alınır (commit sonrası)       |
| `DRAFT`, `INTERNAL`, `REJECTED`, `FAILED` | iptal edilir, bildirim yok (ortada yasal belge yok ya da referans yok)        |

`QUEUED` reddi şart: iptal ettiğimiz anda processor belgeyi entegratörde
oluşturabilir ve elde "yerelde iptal, vergi idaresinde geçerli" bir belge kalır.
`FAILED` bilinçli olarak dışarıda: gönderim hatasında belgenin oluşup oluşmadığı
bilinmiyor ve `einvoiceUuid` boş kalır — çağrılacak referans yoktur; o durumu
`edocument-send-failed:<invoiceId>` CRITICAL alarmı zaten takip ediyor.

Bildirim **commit sonrası** kuyruğa düşer (`E_DOCUMENT_JOBS.CANCEL`, jobId
`e-document-cancel:<invoiceId>` → idempotent): doc 07 §5'e göre e-belge outbound bir
durumdur ve muhasebeyi bloklamaz. Enqueue hatası iptali geri **almaz** (yalnız
loglanır — iş zaten commit edildi); kuyruk içindeki port hatası ise **yutulmaz**:
CRITICAL alarm + 5 deneme + dead-letter (kural 4).

### 47.5 Alış faturası: üç yazma tek transaction

Alış faturası iptali defter stornosuna ek olarak **siparişin kümülatif sayacını**
da düşürmek zorunda. Üçü (belge damgası + storno + sayaç) tek `outboxRun` içinde:
storno atılıp sayaç düşmezse sipariş kalıcı "fazla faturalanmış" kalır ve kalan
bakiyesine fatura kesilemez; sayaç düşüp storno atılmazsa 320 borcu iptal edilmiş
bir belgeyle ayakta kalır.

Sipariş **bağı korunur** (`purchaseOrderId` silinmez) — hangi siparişin faturası
iptal edildi izlenebilir kalmalı. Bu yüzden `unmatchFromOrder()` artık iptal edilmiş
faturada reddediliyor (`PurchaseInvoiceNotUnmatchableException`): sayaç iptalde
zaten düşüldü, ayrıca "eşleştirmeyi kaldır" çağrılırsa aynı tutar **ikinci kez**
düşülür ve sipariş hiç faturalanmamış (hatta negatif) görünür.

### 47.6 Tahsilatlı fatura iptal **edilebilir** (bilinçli)

Tahsilatı olan satış faturası reddedilmedi. İptal belgeyi hükümsüz kılar, **parayı
geri vermez**: storno 120 (alıcı cari) alacağını kapatır, tahsilatın kendi fişi
(100/102 / 120) yerinde durur → hasta o anda **belgesiz bir alacaklıdır** ve
düzeltilmiş fatura kesildiğinde cari netleşir. Bu doğru muhasebedir; iade ayrı bir
akıştır (POS/ödeme iadesi) ve belge iptalinin işi değildir.

Alış faturasında ise karar **ters**: `PAID`/`PARTIALLY_PAID` fatura iptal edilemez
(`PurchaseInvoiceNotCancellableException`). Fark şu — satış tarafında paranın karşı
bacağı bizim **tahsilat** fişimizdir ve cari hesap hastanın lehine kalır (izlenebilir,
geçici); alış tarafında ödeme zaten yapılmıştır ve storno 320'yi kapatınca tedarikçi
cari bakiyesi **ters işarete** düşer (bizim alacaklı göründüğümüz, yanlış bir durum).
Doğru yol tedarikçi ödemesini önce geri almaktır — faturadan bağımsız bir karar.

### 47.7 Yetki ve kalıcı damga (kural 7)

İptal uçları `invoice.delete` / `purchaseinvoice.delete` yetkisi ister — `create`
veya `update` değil. Ölçüt yevmiye storno ucuyla aynı: iptal, defterdeki bir kaydın
etkisini götüren **yıkıcı bir düzeltmedir** ve fatura kesmekle (ki normalde onu
sistem yapar) aynı yetkiye bağlanmamalıdır. Rol matrisi bugün bunu zaten ayırıyor:
`fullAccess(...BILLING)` taşıyan roller (organizasyon sahibi, klinik yöneticisi,
muhasebe/finans sorumlusu) iptal edebilir; resepsiyon (`submitOnly(INVOICE)`) ve
satın alma (`readOnly(PURCHASEINVOICE)`) **edemez** — seed değişikliği gerekmedi.

Kapsam doğrulaması faturanın **kendi kliniğinden** yapılır (istekten gelen id'den
değil) ve ölçüt "erişim" değil **yönetim** (`actorCanManageTargetClinic`): storno
yetkisi olan personel başka bir şubenin belgesini hükümsüz kılamaz.

Kalıcı damga üç yerde: **kolonlar** (`cancelled_at`, `cancelled_by_id`,
`cancel_reason` — iki tabloda), **olay** (`InvoiceCancelledEvent` /
`PurchaseInvoiceCancelledEvent` → `SECURITY` seviyesinde audit log) ve **gerekçe
kapısı** (`reason` zorunlu, `min(5).max(1000)` — tek harflik gerekçe denetimde
"neden" sorusunu yanıtlamaz). Belge **numarası yakılır**: iptalde silinmez, `@unique`
olarak yerinde kalır. İptal izi okuma modeline de taşındı (`InvoiceView.cancelledAt`
/ `cancelReason`, operasyon tier'ı) — iz yalnız audit log'da kalsaydı ekranda
görünmezdi.

### 47.8 Uygulanan düzeltmeler

| #    | Konu                                                                     | Düzeltme                                                                                                                                                                                     |
| ---- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1 | Belge iptali erişilemez (`CANCELLED` ölü enum)                           | `Invoice.cancel()` + `PurchaseInvoice.cancel()` + `CancelInvoiceCommand` / `CancelPurchaseInvoiceCommand` + iki HTTP ucu (`POST /invoices/:id/cancel`, `POST /purchase-invoices/:id/cancel`) |
| P0-2 | İptal edilen belgenin defter etkisi kalıyordu                            | `ReverseJournalEntryByEventCommand` (dedupeKey → olay → fiş → storno); belge damgası + storno **tek** `outboxRun`, köprü hatası yutulmuyor                                                   |
| P0-3 | İptalden sonra doğru fatura kesilemiyordu                                | `appointment_id` / `payment_id` tam unique → **kısmî** unique (`WHERE status <> 'CANCELLED'`); `ACTIVE_INVOICE_STATUSES` tek kaynak                                                          |
| P0-4 | İptal edilmiş faturanın e-belgesi entegratöre gidebiliyordu              | `claimForEDocumentDispatch` artık `status in ACTIVE_INVOICE_STATUSES` koşulunu da taşıyor (kural 10 — hakkı veren UPDATE'in kendisi zorlar)                                                  |
| P1-1 | Fişlenmemiş olay penceresinde iptal defteri bozuyordu                    | `FinancialEventNotPostedYetException` (409, "birkaç saniye sonra tekrar deneyin")                                                                                                            |
| P1-2 | Entegratördeki belge iptal edilmiyordu                                   | `E_DOCUMENT_JOBS.CANCEL` + `enqueueCancel` + processor `handleCancel` (`EInvoicePort.cancel`); hata CRITICAL + retry                                                                         |
| P1-3 | `QUEUED` durumunda iptal "yerelde iptal, idarede geçerli" belge üretirdi | `InvoiceEDocumentDispatchInFlightException` (409)                                                                                                                                            |
| P1-4 | Alış faturası iptalinde sipariş sayacı şişik kalırdı                     | `RevertInvoiceFromPurchaseOrderCommand` aynı tx içinde; `unmatchFromOrder` iptal sonrası reddediliyor (çift düşüm)                                                                           |
| P1-5 | Ödenmiş alış faturası iptali tedarikçi carisini ters işarete düşürürdü   | `PurchaseInvoiceNotCancellableException` (`PAID` / `PARTIALLY_PAID`)                                                                                                                         |
| P1-6 | İptal kalıcı iz bırakmıyordu (kural 7)                                   | `cancelled_at` / `cancelled_by_id` / `cancel_reason` (iki tablo) + iki domain olayı + `SECURITY` audit log; `reason` zorunlu (`min(5)`)                                                      |
| P1-7 | Mükerrer iptal mükerrer storno üretebilirdi                              | Fatura **kilitli** okunuyor (`findByIdForUpdate`) + entity guard'ı (`*AlreadyCancelledException`)                                                                                            |
| P2-1 | İptal izi ekranda görünmüyordu                                           | `InvoiceView` + `InvoiceViewResponseDto` + `PurchaseInvoiceResponseDto` iptal alanları; `cancelledById` yalnız yönetim/denetim tier'ı                                                        |
| P2-2 | Mapping'de damga düşmesi sessiz veri kaybı olurdu (kural 9)              | `InvoiceCommandRepository.update` alan listesine iptal kolonları + bunu kilitleyen repository testi                                                                                          |
| P2-3 | Telafi (backfill) iptal edilmiş faturayı "var" sayıyordu                 | `findExistingPaymentIds` etkin durum süzgeci — iptal sonrası tahsilat yeniden aday                                                                                                           |
| P2-4 | Frontend sözleşmesinde iptal ucu yoktu                                   | `invoiceEndpoints.cancel` + `InvoiceDetailView.cancelledAt/cancelReason`; dosyanın "yalnız okuma" notu düzeltildi                                                                            |

### 47.9 Doğrulama

| Ne             | Sonuç                                                                                                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tsc --noEmit` | `apps/api` **0**, `apps/web` **0**                                                                                                                                                                                                                                                         |
| Test           | **208 suite / 1301 test** yeşil (tur öncesi 204/1256 → **+4 suite, +45 test**)                                                                                                                                                                                                             |
| Yeni testler   | `invoice.entity.spec`(+8 iptal), `purchase-invoice.entity.spec`(+6 iptal), `cancel-invoice.spec`(8), `cancel-purchase-invoice.spec`(5), `reverse-journal-entry-by-event.spec`(4), `cancel-invoice.schema.spec`(10), `invoice.command.repository.spec`(+2), `e-document.processor.spec`(+2) |
| DI             | `app.module.spec` yeşil — yeni handler'lar (iptal ×2, storno-by-event, e-belge iptal kuyruğu) çözülüyor                                                                                                                                                                                    |
| Lint           | yeni/değişen dosyalar temiz; kalan borç yalnız §46'daki `_ctx` (7 eski posting kuralı)                                                                                                                                                                                                     |
| Migration      | `20261012120000_invoice_cancellation` **yazıldı, uygulanmadı** (kullanıcı uygular)                                                                                                                                                                                                         |

---

## 48. Bilinçli yapılmayanlar — belge iptali turu

| Konu                                                  | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **İade (refund) akışının iptale bağlanması**          | İptal belgeyi hükümsüz kılar, parayı geri vermez (§47.6). Tahsilatlı faturada hasta belgesiz alacaklı kalır; düzeltilmiş fatura kesilince cari netleşir. Parayı gerçekten geri vermek POS iadesi / banka transferi ister ve **ayrı bir karardır** (tutar kısmi olabilir, komisyon geri gelmez, taksit iptali gerekir). İkisini tek komutta birleştirmek "iptal ettim" diyen operatöre farkında olmadan para çıkışı yaptırırdı. **Tetikleyici:** hasta iadesi akışı yazılırken (iptal → iade önerisi olarak bağlanır, otomatik değil). |
| **Olay defterinde "iptal edildi" işareti**            | `FinancialEvent` append-only; iptal olayın kendisini değiştirmiyor, fişini storno ediyor. "Bu olay iptal edildi" sorusunun cevabı bugün fiş tarafından (`REVERSED` + `reversedById`) veriliyor. Olaya bir `reversedAt` kolonu eklemek append-only sözleşmesini gevşetir ve iki doğruluk kaynağı yaratır. Fişlenmemiş olay penceresi bunun yerine **reddedilerek** kapatıldı (§47.2). **Tetikleyici:** olay defteri üzerinden doğrudan rapor üreten bir ekran çıkarsa.                                                                 |
| **`InvoiceStatus.FAILED` ölü değerinin kaldırılması** | Hiçbir kod yolu faturayı `FAILED` yapmıyor (e-belge hatası yalnız `einvoiceStatus`'ü değiştiriyor — `markEDocumentFailed`). Enum değerini kaldırmak migration + olası eski satır temizliği ister; `ACTIVE_INVOICE_STATUSES` onu bilinçli olarak **etkin** kabul ederek davranışı belirsizlikten çıkardı (elle/veri taşıma yoluyla oluşmuş bir satır iptal edilmediği sürece o randevunun faturası sayılır). **Tetikleyici:** fatura durum makinesinin kendi turu.                                                                     |
| **Dönem kapalıysa iptalin reddi yerine uyarısı**      | Storno **bugünün açık dönemine** girilir (devrettiği komutun kuralı); orijinal fişin dönemi kapalı olsa bile iptal çalışır — doğru muhasebe budur. Ama bugünün dönemi açık değilse iptal `PeriodNotOpenForPostingException` ile durur ve operatör "dönem aç" demeyi bilemez. Hata mesajını zenginleştirmek ya da ön kontrol eklemek **UX işi**; defter davranışı doğru. **Tetikleyici:** dönem otomasyonu (§5 kuralı) sonrası ilk operatör şikâyeti.                                                                                  |
| **Kısmî iptal (satır bazlı düzeltme)**                | Fatura bugün tek satırlı ("Hizmet bedeli" toplamı); kalem bazlı iptal/düzeltme ancak kalem bazlı fatura modeliyle anlamlı — o da e-belge XML'inin kalem bazına geçmesine bağlı (§37, `e-document` kısmi satırı). Bugünkü doğru yol: tüm faturayı iptal et, satırları düzelt, yeniden kes (artık mümkün — §47.3). **Tetikleyici:** gerçek entegratör adapter'ı + kalem bazlı fatura.                                                                                                                                                   |
| **İade faturası (düzeltme belgesi) olarak iptal**     | Türkiye'de kesilmiş e-faturanın yasal iptali 8 gün penceresiyle sınırlı; sonrasında **iade faturası** kesilir (alıcı tarafından) ya da düzeltme belgesi düzenlenir. Bugün ayrım yapılmıyor: iptal her zaman storno üretiyor. Doğru ayrımın yeri entegratör adapter'ı (pencereyi o bilir) ve karar muhasebecinindir. **Tetikleyici:** gerçek entegratör adapter'ı; `cancel()` 8 gün dışında hata dönerse iptal yerine iade faturası akışı önerilir.                                                                                    |

---

## 49. Mutabakat turu: GRNI + parti sapması + ödeme yöntemi kapısı (2026-10-12, 5. tur)

§43/§46'da ertelenen iki mutabakat kalemi kapandı ve tur sırasında posting
tarafında **canlı bir sessiz hata** bulunup düzeltildi.

### 49.1 Mal kabul ↔ fatura mutabakatı (GRNI)

Ay sonunun "malı gelmiş faturası gelmemiş alım var mı" sorusu artık
**hesaplanabilir** bir kalem. Tek sipariş ekranındaki sapma
(`GetPurchaseOrderMatchSummaryQuery` → `receiptVariance`) zaten vardı ama klinik
seviyesinde toplanmıyordu: tahakkuk edilecek tutar yalnız siparişleri tek tek
gezerek bulunabiliyordu.

Yeni: `GET /purchasing/orders/goods-received-not-invoiced?clinicId=…`
(`GetGoodsReceivedNotInvoicedQuery`).

**İki yön netleştirilmez** — raporun asıl tasarım kararı bu:

| Sapma yönü                    | Ne demek                       | Muhasebe karşılığı                 |
| ----------------------------- | ------------------------------ | ---------------------------------- |
| **pozitif** (teslim > fatura) | mal elimizde, faturası gelmedi | **borç tahakkuku** adayı (159/326) |
| **negatif** (fatura > teslim) | fatura geldi, mal gelmedi      | **avans / varlık** kalemi          |

Netleştirilseydi ikisi birbirini götürür, toplam sıfıra yakın çıkar ve ay sonunda
hem eksik borç hem eksik avans **görünmez** olurdu (toplam sıfıra yakın olduğu
için de kimse bakmazdı). Bu yüzden para birimi başına iki ayrı toplam verilir
(`notInvoicedTotal` / `notReceivedTotal`) ve para birimleri **çevrilmez**.

Hesap, tek sipariş özetiyle **aynı fonksiyondan** gelir (`buildMatchSummary`):
ekranda görünen sapma ile tahakkuk listesindeki sapma ayrı hesaplanırsa sessizce
ayrışır — dosyanın kendi docstring'i bu yüzden "aynı sayıyı iki yerde
hesaplamayın" diyor. Aday kümesi SQL'de daraltılır (herhangi bir teslim **ya da**
herhangi bir fatura eşleşmesi olan siparişler); sapması sıfır olan sipariş rapora
girmez. `paginate` **kullanılmaz**: bu bir liste ekranı değil **bakiye**
mutabakatıdır — sayfalanırsa toplam yalnız o sayfanın toplamı olurdu.

Yetki `purchaseorder:read` değil **`finance:read`** (uç, sınıf seviyesindeki
yetkiyi ezer): "sipariş geçebilmek" ile "klinikte faturalanmamış ne kadar borç
birikmiş görebilmek" aynı yetki değildir (envanter değerlemesiyle aynı ölçüt).

### 49.2 Parti miktarı ↔ hareket toplamı sapması

`product_batches.quantity` **türetilmiş** bir alandır — şemanın kendi notu:
"denormalized running total, source of truth is StockMovement". Türetilmiş veri
için sapma raporu zorunludur (kural 11) ve burada özel bir ağırlığı var:
**envanter değerlemesi ve dolayısıyla 150 mutabakatı bu alandan besleniyor.**
Taban kayarsa fark defterde değil **kaynakta** oluşur ve §44'ün mutabakatı onu
"sebebi bilinmeyen fark" olarak gösterir.

Yeni: `GET /clinics/:clinicId/stock/batch-drift` (`GetBatchQuantityDriftQuery`).
Tek SQL, yalnız **eşit olmayan** satırlar (sağlıklı sistemde boş küme):

```
Σ(giriş) − Σ(çıkış)  vs  product_batches.quantity
```

Satır, sapmanın **değerlemeye etkisini** de taşır (`valueDrift` = sapma × parti
alış fiyatı) ve para birimi başına toplanır: asıl soru "kaç adet kaymış" değil,
"değerleme ne kadar yanlış". Burada iki yön **netleşir** (GRNI'nin aksine): ikisi
de aynı şeyin ölçüsüdür.

`batchUpdatedAt` bilinçli olarak satırda: tüketim/düzeltme hareketini **dinleyici**
yazar (outbox), yani parti güncellendikten saniyeler sonra oluşur — saniyeler
önceki bir sapma normaldir. Mal kabul hareketi aynı transaction içinde yazıldığı
için orada gecikme penceresi yoktur.

**Otomatik onarım yok** (kural 11): miktarı hareketlere eşitlemek eksik hareketi
uydurmak, hareketleri miktara eşitlemek ise fiilî stoğu yalanlamak olurdu —
hangisinin doğru olduğu bir **sayım** kararıdır.

### 49.3 P0 — ödeme yöntemi sessizce 102 Bankalar'a yazıyordu

Tur sırasında bulundu. `PaymentReceivedRule` hesabı şöyle seçiyordu:

```ts
payload.method === 'CASH'
  ? '100'
  : payload.method === 'POS_CARD'
    ? '108'
    : '102';
```

…ve gövde doğrulaması `method: z.string().min(1)` idi. Yani **kapı, kullanım
yerinden sonsuz kere geniş**ti (kural 12'nin tam şekli): `method: 'CHECK'`,
`'TRANSFER'`, `'Cash'` ya da ileride eklenecek herhangi bir yöntem yazılabiliyor
ve tahsilat **sessizce 102 Bankalar'a** düşüyordu.

Sonuç zinciri: fiş dengeli olduğu için "Σborç = Σalacak" kontrolü tutar, hiçbir
bütünlük kontrolü yakalamaz; 102'ye **hiçbir banka ekstresiyle eşleşmeyecek** bir
hareket düşer (banka mutabakatında kalıcı `UNMATCHED`) ve gerçek hesabın
(100 Kasa / 108 kart alacağı) bakiyesi eksik kalır. `PaymentMadeRule` aynı
şekilde `CASH` dışındaki her şeyi 102'ye yazıyordu.

Bugün **canlı olarak** tetiklenmiyordu — ölçüldü: üreticiler yalnız `'POS_CARD'`
(iki yerde literal) ve `RecordSupplierPaymentSchema`'nın `z.enum(['CASH','BANK_TRANSFER'])`
değerlerini gönderiyor. Yani hata **gizli**: `RecordFinancialEventCommand` birçok
modülden iç çağrıyla dispatch ediliyor ve eklenecek ilk yeni yöntem sessizce
yanlış hesaba yazardı.

**Düzeltme — kabul kümesi tek sabitte** (`packages/shared/common/constants/payment-method.constant.ts`,
`STATUTORY_VAT_RATES` deseninin aynısı):

| Yön                    | Kabul edilen                          | Hesap           |
| ---------------------- | ------------------------------------- | --------------- |
| **INBOUND** (tahsilat) | `CASH` / `BANK_TRANSFER` / `POS_CARD` | 100 / 102 / 108 |
| **OUTBOUND** (ödeme)   | `CASH` / `BANK_TRANSFER`              | 100 / 102       |

`POS_CARD` çıkışta bilinçli olarak **yok**: 108 bankadan tahsil edilmeyi bekleyen
**kart alacağımızı** taşır; tedarikçiye kartla ödeme onu azaltmaz (kurumsal kart
borcu ya da banka çıkışıdır). Kümeyi geniş tutmak çıkışı yanlış hesaba yazardı.

Defter karşılığı `payment-method-ledger.constant.ts`'te; `resolvePaymentFundsAccount(method, direction)`
eşlemesi olmayan girdide `null` döner ve kural `UnmappedPaymentMethodException`
fırlatır — `resolveStockCounterAccount` ile birebir aynı sözleşme (§44). Üç kapı
artık aynı kümeden besleniyor: DTO (`RecordSupplierPaymentSchema`), olay gövdesi
(`validateFinancialEventPayload`) ve kullanım yeri (posting kuralları). Tip
tarafında `method: 'CASH' | … | string` birleşimindeki `| string` de kaldırıldı —
açık birleşim hiçbir şeyi kısıtlamıyordu.

Yan bulgu: **sistemin en sık işleyen kuralının (`PaymentReceivedRule` — her
tahsilat buradan geçer) hiç testi yoktu.** Yazıldı (8 test), kart → 108 ayrımı
dahil.

### 49.4 `_ctx` lint borcu kapandı + iki `any` okuma modeli tiplendi

§46'daki `_ctx` borcu, minimal yama yerine **sebebinden** çözüldü: dokuz posting
kuralının **hiçbiri** ikinci parametreyi (`PostingContext { clinicId, organizationId }`)
okumuyordu — fişin bütün girdileri olay gövdesinde, kiracı kimliği de olayın
kendisinde (`event.clinicId`). Okunmayan bir parametre güvence değil süstür
(kural 10'un aynı mantığı), üstelik her kuralda `no-unused-vars` üretiyordu.
Parametre arayüzden, handler çağrısından ve dokuz kuraldan kaldırıldı;
`PostingContext` tipi silindi. Davranış değişmedi (hiçbir kural onu okumuyordu);
19 lint hatası kapandı.

Ayrıca `PurchaseOrderWithItems` ve `PurchaseRequestWithItems` okuma modelleri
`any` idi (`// Infer from @shared if available`). GRNI hesabı bu tipin para
alanlarından beslendiği için tiplendi: `any` altında `quantityReceived`/`unitPrice`
adının yanlış yazılması **derleme hatası vermiyor**, `undefined` olarak çarpıma
giriyordu.

### 49.5 Uygulanan düzeltmeler

| #    | Konu                                                            | Düzeltme                                                                                                                                              |
| ---- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1 | Tanınmayan ödeme yöntemi sessizce 102 Bankalar'a yazılıyordu    | Kabul kümesi tek sabitte (`INBOUND/OUTBOUND_PAYMENT_METHODS`), `resolvePaymentFundsAccount` + `UnmappedPaymentMethodException`; gövde kapısı `z.enum` |
| P1-1 | "Malı gelmiş faturası gelmemiş alım" klinik seviyesinde yoktu   | `GetGoodsReceivedNotInvoicedQuery` — para birimi başına, iki yön **netleştirilmeden**                                                                 |
| P1-2 | Türetilmiş `product_batches.quantity` için sapma raporu yoktu   | `GetBatchQuantityDriftQuery` — miktar + **değer** etkisi, onarım yok                                                                                  |
| P1-3 | `PaymentReceivedRule`'un hiç testi yoktu (en sık işleyen kural) | 8 test (nakit/havale/kart ayrımı, cari yönü, denge, yabancı para, tanınmayan yöntem)                                                                  |
| P2-1 | Dokuz posting kuralında okunmayan `_ctx` parametresi            | Parametre arayüzden + handler'dan + kurallardan kaldırıldı, `PostingContext` silindi (§46 borcu kapandı)                                              |
| P2-2 | `PurchaseOrderWithItems` / `PurchaseRequestWithItems` = `any`   | Gerçek okuma modeli (`PurchaseOrder & { items: PurchaseOrderItem[] }`) — para alanları artık tip güvenli                                              |

### 49.6 Doğrulama

| Ne        | Sonuç                                                                                                                                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tsc`     | `apps/api` **0**                                                                                                                                                                                                                                                                                       |
| Test      | **214 suite / 1343 test** yeşil (tur öncesi 208/1301 → **+6 suite, +42 test**)                                                                                                                                                                                                                         |
| Yeni test | `goods-receipt-variance.spec`(8), `get-goods-received-not-invoiced.spec`(5), `get-batch-quantity-drift.spec`(5), `stock-movement.query.repository.spec`(5), `payment-method-ledger.spec`(6), `payment-received.rule.spec`(8), `payment-made.rule.spec`(+2), `financial-event-payload.schemas.spec`(+4) |
| Lint      | turun bütün dosyaları temiz; `_ctx` borcu kapandı. Kalan: `price-breakdown.vo.ts` + eski spec'ler (tur öncesinden)                                                                                                                                                                                     |
| Migration | **yok** (iki rapor da mevcut kolonlardan türüyor)                                                                                                                                                                                                                                                      |

---

## 50. Bilinçli yapılmayanlar — mutabakat turu

| Konu                                                         | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GRNI tahakkuk fişinin otomatik atılması (159/326)**        | Rapor tahakkuk **adayını** gösterir, fiş atmaz. Tahakkuk bir dönem sonu kararıdır: tutar, hesap (159 mi 326 mı) ve dönem muhasebecinin tercihidir; ayrıca ters kaydı bir sonraki dönemde atılmak zorundadır (aksi halde fatura geldiğinde borç iki kez görünür). Otomatik atılsaydı fatura gecikmesi her gece defteri şişirip boşaltan bir fiş trafiği üretirdi. **Tetikleyici:** ilk gerçek dönem kapanışı — yıl sonu kapanış komutuyla (§6) ve 740 → 622 yansıtmasıyla (§46) **birlikte** tasarlanmalı.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Parti ↔ alış faturası bağı (yabancı para parti maliyeti)** | §46'daki madde duruyor ama gerekçesi **keskinleşti**: kolon eklemek tek başına yetmez, çünkü doğru fonksiyonel maliyet faturanın **posting kurundan** gelir. Mal kabul anındaki kurla damgalanırsa (en kolay yol) fatura farklı bir günde farklı kurla fişlenir ve envanter ↔ 150 mutabakatı **kalıcı bir kur farkı** gösterir — bugünkü dürüst "yabancı para varsa mutabık demem" tavrından kötü. Kısmi faturalamada hangi faturanın hangi partiyi kapattığı da belirsiz. Somut plan: siparişin faturalarının **ağırlıklı ortalama kuru** partiye uygulanır (bağ sipariş seviyesinde kurulur, kısmi faturalama ortalamayla çözülür) ve faturası gelmemiş parti "kuru henüz belirsiz" olarak işaretlenir — ki bu küme **tam olarak** §49.1'in pozitif sapma kümesidir. **Tetikleyici:** ilk yabancı para alımı. Kolon, tüketicisi (ağırlıklı kur hesabı) ile **birlikte** eklenir — okunmayan kolon eklemek kural 10'un yasakladığı şeydir. |
| **Parti sapmasının alarma bağlanması**                       | Sapma raporu talep üzerine çalışıyor; zamanlanmış bir iş + CRITICAL uyarı yok. Sapmanın tek meşru sebebi outbox gecikmesidir (saniyeler) — kalıcı bir sapma ise kod hatasıdır ve fark edilmesi gerekir. Ama alarm eşiği "kaç saniye sonra kalıcı sayılır" kararını ister ve bu, outbox süpürme periyoduna bağlıdır. **Tetikleyici:** fişlenmemiş olay süpürmesine (§34) bir kalem daha eklenirken aynı işte birlikte yapılır.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Ödeme yöntemi kümesinin DB enum'una çevrilmesi**           | `method` bugün olay gövdesinde (JSON) string olarak duruyor; kabul kümesi uygulama sabitinde. DB enum'u olsaydı kısıt veritabanında da dururdu ama olay gövdesi append-only **JSON**'dur: enum'a çevirmek gövdeyi şemalaştırmak (olay tipi başına kolon) demektir ve olay defterinin esnekliğini bitirir. Üç kapının aynı sabitten beslenmesi (DTO + gövde doğrulaması + posting kuralı) bu tasarımda ulaşılabilir en dar güvencedir. **Tetikleyici:** olay gövdesi şemalaştırılırsa (bugün planda yok).                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **GRNI raporunun tarih penceresi / sayfalama**               | Rapor **bakiye** niteliğinde: kümülatif sapmayı verir, bu yüzden tarihle daraltılamaz (daraltılsa tahakkuk eksik çıkar) ve sayfalanamaz (sayfa toplamı bakiye değildir). Aday kümesi "herhangi bir teslimi ya da faturası olan sipariş" ile sınırlı; klinik başına yıllık sipariş hacminde bu sorun değil. **Tetikleyici:** bir klinikte sipariş sayısı binleri aşarsa — o zaman doğru çözüm sayfalama değil, siparişe **kapanmış** (üçlü eşleşmesi tamamlanmış) damgası basıp aday kümesini daraltmaktır.                                                                                                                                                                                                                                                                                                                                                                                                                                  |

---

## 51. Raporlama semantiği turu: bilanço anı + gün sınırı + kapanış fişi (2026-10-13, 6. tur)

§5 ve §7'de iki kez "raporlama turuna bırakıldı" diye işaretlenen kalemler kapandı.
Tur, denetim listesinin **"Bakiye/mizan kaynaktan yeniden üretilebilir mi"** ve
**"Mutabakat raporu var mı"** satırlarını doğrudan ilgilendiriyor: üç bulgunun
hepsinde defter **doğru**, rapor **yanlıştı** — ve üçünün hepsi **sessizdi**, çünkü
eksik/fazla sayılan fişler kendi içinde dengeli olduğu için `isBalanced`,
"Σborç = Σalacak" ve "Aktif = Pasif" kontrolleri tutmaya devam ediyordu.

### 51.1 P0-1 · Bilanço bir **an** değil **aralık** olarak hesaplanıyordu

`get-balance-sheet` `dateFrom`/`dateTo` alıyor ve ikisini olduğu gibi mizana
geçiriyordu (`get-balance-sheet.handler.ts`). Oysa bilançonun hesapları (1–5)
**kümülatiftir**: bakiyeleri defterin başından rapor tarihine kadar birikir.

`?dateFrom=2026-01-01` verildiğinde rapordan düşenler:

- 100 Kasa / 102 Bankalar'ın 2026 öncesi tüm hareketi (yani açılış bakiyesi),
- 120 Alıcılar / 320 Satıcılar'ın devreden cari bakiyeleri,
- geçmiş yılların kârı (590) — ki o fiş kapanış gününde, yani aralığın **dışında**
  atılmıştır.

**Hata neden sessiz:** `isBalanced` bu kurguda totolojiktir. Pencerenin içindeki her
fiş kendi içinde dengeli olduğu için aktif ve pasif **birlikte** eksik çıkar ve
"Aktif = Pasif" yine tutar. Rapor "dengeli" damgasıyla yanlış bir bilanço gösterir.

**Düzeltme:** sorgunun tek tarih parametresi var — `asOf`. Alt sınır kaldırıldı
(uç `?asOf=`), yanıt `dateFrom`/`dateTo` yerine tek `asOf` döner. `asOf`
verilmezse tüm defter.

### 51.2 P0-2 · Rapor aralığının **son günü** her yerde düşüyordu

`entryDate` tam bir zaman damgasıdır (olayın `occurredAt`'i), rapor isteği ise bir
**gün** taşır: `?dateTo=2026-01-31` → `DateTimeManager.create('2026-01-31')` →
`00:00:00`. Ham `lte: dateTo` ile ayın son günü **tamamen** rapor dışında kalıyordu
— yalnız tam gece yarısına damgalanmış bir fiş sayılırdı.

Etkilenen yerler ve somut sonuçları:

| Yer                                   | Sonucu                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| KDV beyan özeti                       | ayın son günü kesilen faturaların KDV'si **beyana girmez** (yasal)            |
| Banka mutabakatı adayları             | son günün 102 hareketi aday değil → ekstre satırı kalıcı `UNMATCHED`          |
| Mizan / kebir / yevmiye / nakit akışı | son gün atlanır; kebirde kapanış bakiyesi kayar                               |
| Cari defter özeti (`finance-ledger`)  | **ekranda görünen** ciro kartı eksik (web `use-finance-params` bunu besliyor) |
| Hekim hasılatı (`providerRevenue`)    | son günün tahsilatı hasılata girmez → prim/komisyon eksik hesaplanır          |
| Cari mutabakat + telafi               | son günün taksiti ne listelenir ne backfill tarafından onarılır               |
| Faturasız tahsilat + telafi           | aynı — eksik fatura kalıcı hâle gelir                                         |
| Köprülenmemiş POS işlemi + telafi     | aynı — köprüsüz tahsilat kalıcı hâle gelir                                    |
| Fişlenmemiş olay raporu               | son günün fişsiz olayı listede görünmez                                       |

Son üç satır en ağırı: rapor ile **telafi komutu** aynı pencereyi kullanıyor, yani
eksik yalnız görünmez olmakla kalmıyor, onarılamaz da oluyordu.

**Düzeltme:** `normalizeReportDateRange` (`finance/shared/domain/reporting/`) —
`dateFrom` gün başına, `dateTo` gün sonuna genişler; verilmeyen uç `undefined`
kalır (açık uçlu rapor korunur); idempotenttir (dönem sınırı ikinci kez geçerken
kaymaz). Gün sınırı kliniğin saat diliminde hesaplanır (`Europe/Istanbul` —
README varsayımı), UTC gününde değil.

Defter raporlarında normalizasyon **çağırana bırakılmadı**: altı sorgunun fiş
filtresi tek bir kurucudan geliyor artık (`buildLedgerEntryWhere`).

**Fişlenmemiş olay raporunda** normalizasyon bilinçli olarak ortak `where`
kurucusuna değil, yalnız HTTP yoluna (`findUnpostedInRange`) konuldu: aynı tanımı
dönem kapanış **kapısı** ve zamanlanmış süpürme de kullanıyor, onların penceresi
hesaplanmış bir **an**dır (`now`, dönem sınırı). Bir raporu düzeltmek için bir
kararın penceresini genişletmek yanlış olurdu.

### 51.3 P0-3 · Kapanış fişi gelir tablosunu **sıfırlıyordu**

Yıl sonu kapanış fişi (`YearEndClosingService`) bütün 6/7 hesaplarını ters kayıtla
kapatır ve kârı 690 → 590'a taşır. Bu fişi ekonomik bir fişten ayırt eden hiçbir
işaret yoktu: `eventId` hem kapanışta hem stornoda `null`.

Sonuç: **bir yıl kapatıldıktan sonra o yılın gelir tablosu sıfır ciro gösterir.**
Kapanış fişinin ters satırları gerçek satışları birebir götürür. Hata sessiz —
kapanış fişi kendi içinde dengeli olduğu için mizan kontrolleri tutar.

**Düzeltme:** `JournalEntry.kind` (`JournalEntryKind { OPERATIONAL, CLOSING }`,
**migration var**).

- `createDraft` varsayılanı `OPERATIONAL` → posting kurallarının ürettiği her fiş.
- Kapanış servisi iki fişi de açıkça `CLOSING` işaretler.
- **Storno niteliği DEVRALIR** (`buildReversalDraft`). `OPERATIONAL` kalsaydı bir
  kapanış fişinin stornosu gelir tablosuna **ters işaretle** girer ve kapanmış
  yılın cirosunu kapanış tutarı kadar şişirirdi.
- Kabul kümesi tek sabitte: `INCOME_STATEMENT_ENTRY_KINDS` (kural 12).

**Asimetri bilinçli ve belgelenmiş:** gelir tablosu kapanışı **dışlar**, bilanço
**sayar**. Bilanço için zorunludur, kârı öz kaynağa taşıyan kayıt odur; dışlansaydı
kapanmış yılda aynı kâr iki kez görünürdü (hem 6/7 hem 590). Kapanmış yılda 6/7
zaten sıfırlandığı için bilançonun `periodResult`'ı doğru biçimde 0 çıkar ve kâr
öz kaynak satırında görünür.

Enum'a üçüncü bir değer (`OPENING`) **eklenmedi**: bugün yazılmıyor, okunmayan bir
değer eklemek kural 10'un yasakladığı şey. Açılış fişi özelliği yazıldığında o
turda eklenir.

### 51.4 P1 · Durum süzgeci + tarih penceresi + devir bölüşümü altı sorguda elle tekrarlanıyordu

`journal.query.repository.ts`'in altı metodu `status: { in: LEDGER_EFFECTIVE... }`
ve `entryDate: { gte, lte }`'yi ayrı ayrı kuruyordu; kebir ve nakit akışında bir de
açılış devri (`lt: dateFrom`) elle hesaplanıyordu. Yeni bir rapor metodu üçünden
herhangi birini atlayabilir ve sonuç yine "dengeli" görünürdü.

`buildLedgerEntryWhere` üçünü birlikte garanti ediyor ve hiçbirini çağırana
bırakmıyor. En kritik üçüncüsü: **devir ↔ hareket bölüşümü** aynı normalize edilmiş
`dateFrom` değerinden türüyor artık. İki ayrı yerde hesaplanırsa bir fiş ya iki kez
sayılır ya hiç sayılmaz — kebirde/nakit akışında bu, kapanış bakiyesinin sessizce
kaymasıdır.

### 51.5 P1 · Yıl sonu kapanışının hiç testi yoktu

Defterdeki en yüksek etkili **yazma** (kapanan dönemin bütün sonuç hesaplarını
sıfırlar, kârı öz kaynağa taşır) test edilmiyordu — geçen turun
`PaymentReceivedRule` bulgusuyla aynı desen. `year-and-closing.service.spec.ts`
altı iddiayı kilitliyor: `CLOSING` işareti (+ persistence'a taşınması), bilanço
hesabının kapatılmaması, kârda 690 → 590 yönü, zararda 591 → 690 yönü, 690
havuzunun kendisinin kapatılmaması, ve hareket yoksa fiş üretilmemesi (dönem
yeniden açılıp kapatılırsa mükerrer kapanış fişi atılmaz).

### 51.6 Uygulanan düzeltmeler

| #    | Bulgu                                   | Düzeltme                                                                                                                              |
| ---- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1 | Bilanço aralıkla kesiliyor              | `dateFrom` kaldırıldı → tek `asOf`; uç `?asOf=`; yanıt + DTO tek tarih taşır                                                          |
| P0-2 | Rapor aralığının son günü düşüyor       | `normalizeReportDateRange` + `buildLedgerEntryWhere`; ayrıca cari özet, hekim hasılatı, 3 mutabakat taraması, fişlenmemiş olay raporu |
| P0-3 | Kapanış fişi gelir tablosunu sıfırlıyor | `JournalEntryKind` kolonu (migration), `INCOME_STATEMENT_ENTRY_KINDS`, stornonun niteliği devralması                                  |
| P1-1 | Süzgeç/pencere/devir altı yerde tekrar  | tek `buildLedgerEntryWhere`; `journal-trial-balance.query` de ona bağlandı                                                            |
| P1-2 | Yıl sonu kapanışının testi yok          | `year-and-closing.service.spec.ts` (6 test)                                                                                           |

### 51.7 Testler

| Dosya                                        | Kilitlenen                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `report-date-range.spec.ts`                  | gün sonu/başı genişlemesi, açık uç, idempotentlik, saat dilimi (24 saat − 1 ms) |
| `journal.query.repository.spec.ts` (+2 blok) | altı sorguda gün sınırı + devir `lt` ↔ hareket `gte` bölüşümü + `kinds` süzgeci |
| `journal-entry.entity.spec.ts` (+4 test)     | varsayılan `OPERATIONAL`, açık `CLOSING`, stornonun niteliği devralması         |
| `get-balance-sheet.handler.spec.ts` (yeni)   | alt sınır yok, `kinds` yok, `asOf` gün sonuna genişler, dönem sonucu dengeler   |
| `get-income-statement.handler.spec.ts` (+1)  | karşılaştırma dönemi dahil **her** mizan okumasında `kinds` süzgeci             |
| `year-and-closing.service.spec.ts` (yeni)    | §51.5'teki altı iddia                                                           |

**Doğrulama:** `tsc --noEmit` api 0 / web 0; `jest` **217 suite / 1373 test** yeşil
(+3 suite, +30 test); turun bütün dosyaları lint-temiz.

### 51.8 Doğrulanan, sorun çıkmayan noktalar

- **Envanter ↔ 150 mutabakatı** mizanı tarih vermeden okuyor (`GetTrialBalanceQuery({ clinicId, ctx })`)
  → kümülatif, doğru. Değerleme de anlık olduğu için iki taraf aynı anı görüyor.
- **Yıl sonu kapanış fişinin tutarları** dönem sınırından (`startsAt`/`endsAt`
  = `23:59:59.999`) geldiği için P0-2'den **etkilenmemişti**; normalizasyon o yolda
  idempotent (spec bunu kilitliyor).
- **Zamanlanmış süpürme** penceresini `now`'dan hesaplıyor; dokunulmadı (§51.2 son
  paragraf).
- **Yevmiye defteri** storno edilmiş fişi gizlemiyor (resmî defter kronolojik ve
  eksiksiz); `kinds` süzgeci oraya da verilmedi — kapanış fişi yevmiyede görünmeli.

---

## 52. Bilinçli yapılmayanlar — raporlama turu

| Konu                                                      | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Açılış fişi (590 → 570 devri)**                         | §5'ten devrediyor. Kapanış kârı 590'da birikiyor: üç yıl kapatılmış bir klinikte 590 üç yılın toplamını taşır, oysa TDHP'de geçmiş yıl kârı 570'e devredilmelidir. Bilanço bu hâlde de **dengeli ve eksiksiz** (yalnız kalem 570 yerine 590 etiketiyle duruyor), o yüzden para güvenliği bulgusu değil **muhasebe özelliği**. Artık `JournalEntryKind` altyapısı hazır: fiş `OPENING` olarak işaretlenir ve gelir tablosundan dışlanır. **Tetikleyici:** ikinci dönem kapanışı ya da resmî bilanço çıktısı istendiğinde. |
| **Kapanmış dönemin eski kapanış fişlerinin damgalanması** | Migration mevcut satırları `OPERATIONAL` yapıyor. Bu, bugüne kadar hiç dönem kapanışı yapılmamış kurulumlar için **doğru** varsayım. Kapanış yapılmış bir veritabanında eski kapanış fişleri işaretsiz kalır ve o yılın gelir tablosu hâlâ sıfır görünür. Otomatik `UPDATE` yazılmadı: geçmişi geriye dönük yorumlayan bir değişiklik (kural 11) ve `event_id IS NULL` + açıklama eşlemesi bir muhasebe kararıyla doğrulanmalı. Migration'da elle düzeltme notu bırakıldı. **Tetikleyici:** kapanışı olan bir kurulum.   |
| **`isBalanced`'ın totolojik kalması**                     | Bilanço artık doğru kümeyi okuyor ama `isBalanced` hâlâ her zaman `true` döner: bütün fişler dengeli olduğundan Aktif − (Pasif + Öz Kaynak + Sonuç) özdeş olarak sıfırdır. Yakaladığı tek şey **sınıflandırılamayan hesap kodu** (1–5 ve 6/7 dışı, ya da hesap planında bulunamayıp `'?'` olarak gelen satır). Anlamlı bir kontrol hâline gelmesi için rapora "sınıflandırılamayan satırlar" bölümü eklenmesi gerekir — raporlama UX işi. **Tetikleyici:** nazım hesaplar (9xx) kullanılmaya başlanırsa.                 |
| **Bilançonun geçmişe dönük (`asOf`) doğruluğu**           | `asOf` artık doğru çalışıyor **çünkü** defter append-only ve storno yerinde kalıyor: geçmiş bir tarihe bakıldığında o tarihten sonra atılan storno fişi de doğal olarak dışarıda kalır. Yani "31 Aralık bilançosu" bugün bakıldığında da 31 Aralık'ta bakıldığı gibi çıkar. Bu bir şans değil, append-only tasarımın kazanımı — ama **envanter değerlemesi** için aynı şey geçerli değil (§46: `quantity` denormalize). İkisinin aynı tarihe bakabilmesi envanterin `asOf` desteğine bağlı.                              |
| **Yarı-açık dönem aralığı (`[from, to)`)**                | §5'ten devrediyor ve **artık gereksiz**: rapor tarafındaki asıl sorun gün sınırının hiç genişletilmemesiydi (§51.2) ve o kapandı. `endsAt = 23:59:59.999` + `lte` ile `endOfDay` + `lte` aynı anı veriyor; JS `Date` milisaniye hassasiyetinde olduğu için pratik boşluk yok. Kapalı aralığın tek kuramsal riski milisaniyenin altı — Postgres `timestamp(3)` bunu saklamıyor. **Kapatıldı: konu artık açık bir borç değil.**                                                                                            |
| **Rapor çıktılarının dışa aktarımı (e-Defter/XBRL)**      | Mizan, kebir, yevmiye artık doğru üretiliyor ama resmî formatta (e-Defter XML / GİB berat) dışa aktarılmıyor. Bu `FilingExportPort`'un işi (bkz. `project_finance_accounting_integration`) ve gerçek entegratör adapter'ıyla birlikte ele alınmalı. **Tetikleyici:** ilk resmî e-Defter dönemi.                                                                                                                                                                                                                          |

---

## 53. Yuvarlama turu: KDV toleransı + para yuvarlamasının tek kapısı (2026-10-13, 7. tur)

§7'nin "P2-1 · Açık yuvarlama modu — **fatura/tahsilat turunda proje geneli ele
alınmalı**" ertelemesi kapandı. Denetim listesinin **"Yuvarlama kuralı tanımlı ve
tek yerde mi? Yuvarlama artığı nereye yazılıyor?"** satırı proje genelinde tarandı
ve P2 sanılan yerde **iki P0** çıktı: çok satırlı fatura **hiç kesilemiyordu** ve
kesilmiş fatura **okunamaz** hâle gelebiliyordu.

### 53.1 P0-1 · Çok satırlı satış faturası kesilemiyordu

`TaxSpecification.create(net, rate, customTaxAmount?)` verilen vergi tutarını
`net × oran` ile karşılaştırıp **sabit 2 kuruş** tolerans uyguluyordu
(`tax-specification.vo.ts`). KDV ise **yasal olarak satır bazında** yuvarlanır
(e-fatura kalem bazlı KDV bekler) ve `TreatmentCharge` da öyle yapıyor
(`treatment-charge.entity.ts` — satır KDV'si kuruşa yuvarlanır).

Sonuç: `Σ round(net_i × r)` ile `(Σ net_i) × r` satır sayısı arttıkça ayrışır.

**Ölçülen tekrar üretim** (10 satır × 33,33 TRY @ %20):

| Büyüklük                            | Değer     |
| ----------------------------------- | --------- |
| Satır KDV'si: `round(33,33 × 0,20)` | 6,67      |
| Satır toplamı (`vatTotal`)          | **66,70** |
| Orandan hesap: `333,30 × 0,20`      | **66,66** |
| Sapma                               | 0,04      |
| Sabit tolerans                      | 0,02      |

→ `InvalidTaxSpecificationException: Vergi tutarı uyuşmuyor.` (422) →
**fatura kesilemiyor.** Hata sabit toleransın satır sayısından habersiz
olmasından geliyor: kapı yanlış yerde, kural 12'nin tersi — kapı kullanım
yerinden **dar**.

### 53.2 P0-2 · Kesilmiş fatura kalıcı olarak okunamaz hâle gelebiliyordu

Aynı doğrulama **okuma yolunda** da çalışıyordu: `taxSpecificationOf`
(`invoice-tax.ts`) → `find-invoices`, `get-invoice-by-id`,
`get-invoice-by-payment-id`; ve `Invoice` ile `FinanceLedgerEntity`'nin
**constructor**'ları (rehidrasyon) da doğrulayan `create`'i çağırıyordu.

Yani toleransı aşan bir satır veritabanında bir kez oluştuğunda (bu kontrolden
önce yazılmış kayıt, veri taşıma, farklı bir yazma yolu) o fatura **422 veriyor**:
görüntülenemiyor, listede patlıyor, iptal edilemiyor, düzeltilemiyor. Saklanmış
veriyi okuma anında yeniden yargılamak, bir kuruşluk sapmayı **kaydı kaybetmeye**
çeviriyor.

### 53.3 P1 · `create()` vergiyi yuvarlamıyordu

`calculatedTax = net.mul(rate).div(100)` — **yuvarlama yok**. 333,33 @ %20 →
`taxAmount = 66,666`, `grossAmount = 399,996`. Tutarlar `Decimal(x,2)` kolonlara
yazılırken veritabanı sessizce yuvarlıyor; o andan sonra entity'nin hesapladığı
brüt (399,996) ile saklanan brüt (400,00) ayrışıyor ve fark hiçbir yerde
görünmüyor. Satış faturası yolu `customTaxAmount` geçtiği için bu değeri
kullanmıyordu; **`FinanceLedgerEntity.create`** (tek argümanla çağırıyor) tam
bu yoldan geçiyordu.

### 53.4 Düzeltme · otoritesini adıyla söyleyen dört fabrika

`TaxSpecification`'ın tek `create(net, rate, custom?)` imzası, verginin **nereden
geldiğini** gizliyordu. Dört ayrı otorite var ve her biri ayrı fabrika oldu:

| Fabrika           | Otorite                         | Çapraz kontrol                           |
| ----------------- | ------------------------------- | ---------------------------------------- |
| `create`          | oran (matrahtan hesaplanır)     | — (hesabın kendisi); **kuruşa yuvarlar** |
| `fromGrossAmount` | brüt tutar (orana göre ayrılır) | — (artık matrahtan düşülür)              |
| `fromLineTotals`  | **satırlar**                    | `lineCount × 0,005`                      |
| `fromTrusted`     | veritabanı                      | **yok** (rehidrasyon)                    |

`fromLineTotals`'ın payı **türetilmiş**, uydurulmuş değil: `round(x, 2)` tek
satırda en çok yarım kuruş kaydırır, yani `n` satırın üst sınırı tam olarak
`n × 0,005`'tir. Kapı böylece kullanım yeriyle **aynı genişlikte** olur (kural 12)
— ne meşru yuvarlamayı reddeder ne gerçek hatayı (yanlış oran, karışmış para
birimi, eksik satır) geçirir. `lineCount` zaten `AppointmentChargeTotals`'ta
vardı; satır sayısı verilmezse/geçersizse fabrika reddediyor, pay uydurulamıyor.

Çağrı yerlerinin hepsini **derleyici** gösterdi (üç argümanlı `create` kaldırılınca
dört hata): rehidrasyon iki constructor + okuma yolu → `fromTrusted`; faturalama
→ `fromLineTotals`; cari defter → `create`.

### 53.5 P0-3 · Alış faturasında aynı hata: tedarikçinin gerçek belgesi kaydedilemiyordu

`PurchaseInvoice.assertVatMatchesRate` tolerans olarak **sabit 1 kuruş**
kullanıyordu (`VAT_TOLERANCE`). Ama bu model **satır tutmaz** — tek
matrah/KDV/oran üçlüsü, tedarikçinin belgesinden kopyalanır. O belge kendi içinde
satır bazında yuvarlanmış olabilir: 10 satırlık bir alış faturasında sapma 4 kuruş
olur ve belge **hiç kaydedilemez**. Tedarikçinin gerçek belgesini reddetmek
yanlıştır: o belge bizim için hesaplanan değil **kayıtlanan** bir dış olgudur.

Tolerans iki rejimi birlikte karşılayacak şekilde değişti:
**`max(1 kuruş, matrahın binde 5'i)`**.

- **Oransal tavan** (binde 5 = 0,5 oran puanı) çok satırlı belgeyi kabul eder.
- **Kuruş tabanı** küçük tutarları kurtarır: 1,00 TRY @ %20'de oransal pay yalnız
  0,005 olurdu; tedarikçi 0,21 basmışsa taban bunu kabul eder.
- Kontrolün asıl işi **veri girişi hatasını** yakalamak: yasal oranlar
  `{0, 1, 10, 20}` olduğu için yanlış oran seçimi en az **1 oran puanı** kaydırır
  ve tolerans 0,5 puan olduğundan her karışıklık iki tavanı da aşar (spec bunu
  kilitliyor).

### 53.6 P1 · Para yuvarlamasının modu görünmez bir global ayardan geliyordu

14 yerde `toDecimalPlaces(2)` **mod geçilmeden** çağrılıyordu; davranış
`decimal.js`'in global `Decimal.rounding` ayarına (bugün `ROUND_HALF_UP`)
bağlıydı. Bu ayar `Decimal.set({ rounding })` ile her yerden değiştirilebilir ve
o anda **bütün** para aritmetiği sessizce başka davranır — mod bazı yerlerde
açıkça geçilmiş, bazılarında geçilmemiş olduğu için ikisi ayrışabilirdi de.

Tek kapı `Money`'de kuruldu (ölçek sabiti zaten oradaydı):

```ts
static readonly PRECISION = 2;
static readonly ROUNDING = Decimal.ROUND_HALF_UP;
/** Kuruş ölçeğine yuvarlar — para yuvarlamasının TEK kapısı. */
static scale(value: Decimal): Decimal
```

14 para yuvarlaması `Money.scale(...)`'a taşındı (fatura, tedavi satırı, alış
faturası, satın alma siparişi, GRNI hesabı, kambiyo çevrimi, `Money.round`,
`Money.allocate`). **Para olmayan** iki yuvarlama bilinçli olarak dışarıda kaldı:
gelir tablosundaki yüzde değişim ve proje bütçe oranı — onların ölçeği farklıdır.

Spec, global ayarı test içinde `ROUND_DOWN`'a çevirip `Money.scale`'in
etkilenmediğini, ham `toDecimalPlaces(2)`'nin ise etkilendiğini birlikte gösteriyor.

### 53.7 Doğrulanan, sorun çıkmayan noktalar

- **Kambiyo yuvarlama artığı** → `FxConversion.roundingBalance` ile 646/656'ya
  yazılıyor; satır-başı yuvarlamanın fişi dengesiz bırakması kapatılmış.
- **`fromGrossAmount`** doğru deseni zaten uyguluyordu: matrah yuvarlanır, vergi
  **brütten düşülerek** bulunur → `matrah + vergi = brüt` birebir tutar.
- **Ödeme planı taksitleri** sunucuda bölüştürülmüyor: istemci satır tutarlarını
  gönderiyor, toplam satırlardan **türüyor** (`create-payment-plan.handler.ts`)
  → bölüştürme artığı diye bir şey oluşmuyor.
- **`Money.allocate`** artığı ilk parçaya yazıyor ve parçaların toplamı daima ana
  tutara eşit (iki yönde de — spec `1,00 / 8` ile negatif artığı da kilitliyor).
  Bugün **tüketicisi yok**; dead-code olarak §54'te kayıtlı.
- **`TreatmentCharge`** satır tutarını yuvarlayıp indirim/matrahı o tutardan
  türetiyor (`listTotal.round()` → indirim → matrah → KDV) — "liste − indirim =
  matrah" eşitliği toplamda kaymıyor.

### 53.8 Uygulanan düzeltmeler

| #    | Bulgu                                           | Düzeltme                                                                       |
| ---- | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| P0-1 | Çok satırlı satış faturası kesilemiyor          | `TaxSpecification.fromLineTotals` — pay `lineCount × 0,005` ile **türetilmiş** |
| P0-2 | Kesilmiş fatura okunamaz hâle gelebiliyor       | rehidrasyon + okuma yolu `fromTrusted` (çapraz kontrol yok)                    |
| P0-3 | Tedarikçinin çok satırlı belgesi kaydedilemiyor | tolerans `max(1 kuruş, matrahın binde 5'i)`                                    |
| P1-1 | `create()` vergiyi yuvarlamıyor                 | `Money.scale` ile kuruşa yuvarlanıyor                                          |
| P1-2 | Yuvarlama modu global ayardan geliyor           | `Money.ROUNDING` + `Money.scale` tek kapı; 14 çağrı taşındı                    |

### 53.9 Testler

| Dosya                                  | Kilitlenen                                                                                                                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tax-specification.spec.ts` (yeni, 10) | `create` yuvarlaması; 10×33,33 satırın kabulü; payın satır sayısıyla büyümesi; yanlış oranın reddi; `lineCount` zorunluluğu; `fromTrusted`'ın kontrol yapmaması; `fromGrossAmount`'ta `net + vergi = brüt` |
| `money.vo.spec.ts` (yeni, 7)           | `Money.scale`'in global `Decimal.rounding`'den bağımsızlığı (ham çağrının bağımlılığıyla yan yana); `allocate` artığının iki yönde de kapanması                                                            |
| `purchase-invoice.entity.spec.ts` (+3) | çok satırlı tedarikçi belgesinin kabulü; kuruş tabanının küçük tutarı kurtarması; yanlış oranın hâlâ reddi                                                                                                 |

**Doğrulama:** `tsc --noEmit` api 0 / web 0; `jest` **219 suite / 1393 test** yeşil
(+2 suite, +20 test); turun bütün dosyaları lint-temiz. **Migration yok** (davranış
düzeltmesi, şema değişmedi) → bekleyen hâlâ **8**.

---

## 54. Bilinçli yapılmayanlar — yuvarlama turu

| Konu                                                         | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`Money`'nin kuruş ölçeğini VO'da zorlaması**               | `Money.create` sonlu + negatif-değil kontrolü yapıyor, **ölçek kontrolü yapmıyor** — `TaxSpecification.create`'in 3 haneli vergi üretebilmesinin sebebi buydu. Ama zorlamak **yanlış** olur: ara hesaplar (birim fiyat × kesirli adet, oran çarpımı) bilinçli olarak yuvarlanmamış kalır (bkz. `Money.round` yorumu) ve VO'da ölçek zorlanırsa bu ara değerler `Money` olarak taşınamaz. Doğru tasarım bugünkü: **ara değer serbest, satır tutarı `scale()`'den geçer**. Kapı DTO/olay gövdesi seviyesinde ayrıca zorlanıyor. |
| **`toFixed(2)` ailesinin global ayara bağlılığı**            | `toApiFormat()` ve rapor çıktıları `toFixed(2)` kullanıyor; o da `Decimal.rounding`'e bakar. Ama bu çağrılar **zaten `scale()`'den geçmiş** değerleri biçimlendirdiği için mod ne olursa olsun sonuç aynıdır (yuvarlanacak bir şey kalmamıştır). Riskli olan "yuvarlanmamış değeri `toFixed` ile serileştirmek"ti ve bilinen örneği (§53.3) kapatıldı. Hepsini `scale()`'e çevirmek 60+ dosyalık mekanik bir diff üretir, davranış değiştirmez. **Tetikleyici:** yeni bir yuvarlanmamış-değer sızıntısı bulunursa.            |
| **Açılışta `Decimal` global ayarının doğrulanması**          | `Decimal.set({ rounding })` / `{ precision }` çağrısı bugün codebase'de **hiç yok** (arandı) ve para yuvarlaması artık moddan bağımsız. Bir açılış assert'i (hesap planı şablon doğrulaması gibi) ucuz bir sigorta olurdu ama bugün koruduğu somut bir yol kalmadı — okunmayan güvence süstür (kural 10). **Tetikleyici:** `Decimal.set` çağıran bir bağımlılık ya da `div` sonucu hassasiyete (`precision: 20`) dayanan bir hesap girerse.                                                                                   |
| **`Money.allocate`'in tüketicisiz durması**                  | Doğru primitif (artık ilk parçaya, toplam daima kapanır) ama hiçbir yer çağırmıyor: taksit tutarlarını istemci gönderiyor, toplam satırlardan türüyor. Silmek yerine **test altına alındı**: sunucu tarafı bölüştürme gerektiğinde (eşit taksitli plan, kampanya bölüştürmesi) yeniden yazılması kuruş kaybı riskidir — bir kez doğru yazılmış ve davranışı belgelenmiş bir fonksiyon durması daha güvenli. **Tetikleyici:** sunucuda taksit bölüştürme özelliği.                                                             |
| **Satış faturasının kalem bazına geçmesi**                   | `fromLineTotals` satır **toplamını** alıyor, satırların kendisini değil: fatura hâlâ tek satırlı ("Hizmet bedeli"). Kalem bazlı KDV'yi faturanın kendisinde taşımak e-belge XML'inin kalem bazına geçmesine bağlı (§37, §48). O zaman `lineCount` yerine satırlar doğrudan verilir ve pay hesabına gerek kalmaz — KDV satırdan okunur. **Tetikleyici:** gerçek entegratör adapter'ı + kalem bazlı fatura.                                                                                                                     |
| **Yuvarlama artığının ayrı hesaba yazılması (kuruş hesabı)** | Bazı ülkelerde/ERP'lerde satır-başı yuvarlama farkı ayrı bir "yuvarlama farkı" hesabına yazılır. Bu projede gerek yok: fatura brütü satır toplamlarından **türüyor** (`grandTotal = net + KDV`, ikisi de satır toplamı), yani defterde kapatılacak bir artık oluşmuyor. Artık yalnız **çevrimde** doğuyor ve orada 646/656'ya yazılıyor (§53.7). **Tetikleyici:** nakit yuvarlaması (ör. 5 kuruşa yuvarlama) gibi yasal bir kural gelirse.                                                                                    |

---

## 55. Ürün KDV kapısı + düşen/bayatlayan ertelemeler (2026-10-13, 8. tur)

Bu tur, **kalan erteleme listelerinin tetikleyicilerini tek tek ölçerek** başladı
(§9, §11, §15, §19, §22, §25, §29, §33, §37, §40, §43). Sonuç: üç kalem yanlış
kayıtlıydı — biri **canlı hata**, ikisi **zaten kapanmış**, biri de gerekçesi
**eksik** yazılmış bir erteleme. Ölçümün kendisi turun çıktısıdır: erteleme listesi
ancak doğru olduğu sürece işe yarar.

### 55.1 P1 · Sıfır KDV'li ürün ne oluşturulabiliyor ne güncellenebiliyordu

`Product.create` ve `Product.update` ikisi de `vatRate.validate.hasTax.orThrow()`
çağırıyordu — yani oranın **sıfır olmamasını** şart koşuyordu. Oysa:

- `STATUTORY_VAT_RATES = [0, 1, 10, 20]` → **0 yasal kümenin üyesidir** ve
  istisna/muafiyet kapsamındaki malın oranı gerçekten sıfırdır.
- `CreateProductSchema` ve `UpdateProductSchema` ikisi de 0'ı **kabul ediyordu**.
- Alış faturası (`vatRate: 0` testi §13'te), satış faturası (`fromGrossAmount(.., 0)`)
  ve işlem satırı 0'ı zaten kabul ediyor. **Tek istisna bu entity'ydi.**

Yani kapı kullanım yerinden **geniş**ti (kural 12) ve `vatRate: 0` gönderen istek
sebebinden kopuk bir "KDV oranı sıfır olamaz" hatasıyla duruyordu. `update`
tarafında daha kötüsü vardı: sıfır KDV'li bir ürün (kolon varsayılanı 0) bir kez
oluşmuşsa oranı **hiç** güncellenemiyordu — kart kilitli kalıyordu.

`update-product.schema.ts` bu çelişkiyi yorum olarak **belgelemiş** ama
kapatmamıştı; §43'te de kayıtlıydı.

**Düzeltme:** iki `hasTax.orThrow()` kaldırıldı. `VatRate.validate.hasTax` yerinde
duruyor — gerçekten sıfır oranın geçersiz olduğu yerler için (ürün kartı o yerlerden
biri değil).

### 55.2 P1 · `vatRate` opsiyoneldi ve handler sessizce 0'a düşürüyordu

`CreateProductSchema.vatRate` **opsiyonel**di, `create-product.handler.ts` ise
`vatRate: data.vatRate ?? 0` yazıyordu. Yani oranı söylemeyen bir istek sessizce
**"istisna kapsamında"** sayılıyordu (ve §55.1'deki guard yüzünden zaten
reddediliyordu — iki hata birbirini maskeliyordu).

Bu bir para etkisidir: ürünün oranı alış faturasının **191 indirilecek KDV**'sini
besliyor. Sessiz sıfır, indirimi kimse seçmemişken eksik kullandırır.

**Düzeltme:** `vatRate` DTO'da **zorunlu** (kabul kümesi aynı, 0 dahil); handler'ın
`?? 0` varsayılanı kaldırıldı. Oran bir **beyandır**, varsayılanı olamaz. Eşik
alanları (`criticalStockQty`, `reorderQty`) para taşımadığı için 0 varsayılanı
orada doğru kalıyor. `apps/web` ürün kartını henüz tüketmiyor → kırılma yok.

### 55.3 Düzeltilen erteleme kayıtları

| Kayıt                                                              | Gerçek durum                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| §40 · "`adjust-stock` / `record-product-usage`'ın kendi kapıları"  | **Zaten kapanmış.** Tetikleyici "`supply/inventory` turu (sıradaki)" yazıyordu; o tur (§41–§43) ikisini de düzeltti ama notu güncellemedi. Bugün `adjust-stock` kiracıyı URL `clinicId`'sinden çözüp yetkiyi onun üzerinden veriyor ve `findProductUnusableReason`'ı zorluyor; `record-product-usage` aynı kuralı kilit altında zorluyor, `BadRequestException` kalmamış, parti seçimi de ürünün kullanılabilir partileriyle sınırlanmış. Satır kapatıldı.                                                         |
| §22 / §25 · "POS gün sonu (EOD) toplamlarının defterle mutabakatı" | **Gerekçe eksik yazılmış.** Kayıt "EOD yanıtı hiç saklanmıyor, yani eşleştirilecek bir şey yok" diyordu — asıl engel daha derin: (a) **PAX `batchClose` hiç toplam döndürmüyor** (`success`/`responseCode`/`responseText`), yani beyan diye bir şey yok; (b) iyzico EOD toplamları `z.number()` (JS float) ve **birimi** (TRY mi kuruş mu) sağlayıcı dokümanı olmadan doğrulanamıyor. Birim yanlış varsayılırsa rapor **her gün** 100× sapma gösterir — hiç olmamasından kötüdür. Gerekçe §56'da keskinleştirildi. |
| §43 · "Çok partili tüketim (FEFO bölüştürme)"                      | **Erteleme doğru, dokunulmadı.** Bugünkü hâli fail-closed (`QuantityInsufficientException`) ve sebebi operatöre açık; yanlış maliyet üretmiyor, yalnız reddediyor. Tetikleyicisi operasyonel bir vaka ("stok var ama düşemiyorum") ve henüz oluşmadı.                                                                                                                                                                                                                                                              |

### 55.4 Uygulanan düzeltmeler ve testler

| #    | Bulgu                                               | Düzeltme                                                                       |
| ---- | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| P1-1 | Sıfır KDV'li ürün oluşturulamıyor / güncellenemiyor | iki `hasTax.orThrow()` kaldırıldı (0 yasal kümenin üyesi)                      |
| P1-2 | `vatRate` opsiyonel + handler `?? 0`                | DTO'da **zorunlu**; sessiz varsayılan kaldırıldı (191 indirimini eksiltiyordu) |

| Dosya                                     | Kilitlenen                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| `product.entity.spec.ts` (+3)             | %0 ile oluşturma, %0'a güncelleme, yasal olmayan oranın iki yolda da reddi |
| `adjust-stock.schema.spec.ts` (+2, 1 düz) | `vatRate` zorunluluğu; %0'ın kapıda kabulü                                 |

**Doğrulama:** `tsc --noEmit` api 0 / web 0; `jest` **219 suite / 1398 test** yeşil
(+5 test); turun dosyaları lint-temiz. **Migration yok** → bekleyen hâlâ **8**.

---

## 56. Bilinçli yapılmayanlar — ürün KDV kapısı turu

| Konu                                                                           | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **POS cihazı ↔ defter mutabakatı (EOD beyanı)** — §22/§25'in keskinleşmiş hâli | Dış para taşıyan sistemlerin hepsiyle mutabakat var (banka ekstresi ↔ 102, envanter ↔ 150, GRNI, parti sapması) — **POS terminali hariç**. Yapılmadı çünkü karşılaştırılacak **beyan** güvenilir biçimde elde edilemiyor: PAX `batchClose` yanıtı toplam **taşımıyor** (yalnız `success`/`responseCode`/`responseText`), iyzico EOD toplamları ise `z.number()` ve **birimi doğrulanamıyor** (sale `price` major birimde gidiyor ama EOD'un döndüğü birim dokümana bağlı). Birimi yanlış varsayan bir mutabakat her gün 100× sapma gösterir ve operatör raporu **öğrenip yoksayar** — hiç olmamasından kötü. Tasarım hazır (ekstre mutabakatının aynısı: beyanı sakla + o günün POS tahsilat toplamıyla karşılaştır, yönleri netleştirmeden). **Tetikleyici:** gerçek sağlayıcı dokümanı/sandbox ile birimin doğrulanması — PAX için ayrıca yanıt alanlarının ayrıştırılması. |
| **Gün sonu beyanının iş günü (`businessDate`) ataması**                        | Yukarıdaki mutabakat yazıldığında çözülmesi gerekecek: EOD gece yarısından sonra çalıştırılırsa beyan ertesi güne düşer. Cutoff saati bir klinik ayarı olurdu ve **bugün okuyanı yok** (kural 10). Doğru davranış beyanı `declaredAt`'in klinik-yerel gününe atamak ve uyuşmazlığı **raporda göstermek** (sessiz bırakmamak): eksik gün "beyanı yok", yeni gün "kaydı yok" olarak görünür. **Tetikleyici:** mutabakat raporu yazılırken birlikte.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **`VatRate.validate.hasTax`'ın kaldırılması**                                  | Guard yerinde duruyor, yalnız ürün kartından çıkarıldı. Sıfır oranın gerçekten geçersiz olduğu bir yer çıkarsa (ör. KDV beyanında 0 oranlı satır beklenmiyorsa) hazır. Bugün çağıranı kalmadı; **okunmayan guard** olmaması için bir sonraki turda çağıranı çıkmazsa kaldırılmalı. **Tetikleyici:** sıfır oranı reddetmesi gereken ilk yer — ya da bir sonraki hijyen turu.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Ürün kartının `apps/web` tarafı**                                            | `vatRate` zorunlu hâle geldi ama web'de ürün formu **yok** (grep: tüketici yok). Form yazıldığında oran alanı zorunlu ve `STATUTORY_VAT_RATES`'ten seçmeli olmalı — serbest sayı girişi kapıyı tekrar genişletir. **Tetikleyici:** envanter ekranları (Faz 3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

---

## 57. POS ters kaydının aktör damgası + erteleme listesinin ikinci taraması (2026-10-13, 9. tur)

Bu tur iki işten oluştu: (a) 17 erteleme tablosundaki **109 satırın tamamı**
programatik olarak toplandı ve tetikleyicileri geçmiş turlara işaret edenler tek
tek ölçüldü, (b) ölçümde çıkan **canlı boşluk** kapatıldı. Toplanan liste ayrıca
konu bazında tek dosyaya indirildi: **`10-kalan-isler.md`**.

### 57.1 Canlı boşluk (P1) — kart iptalini/iadesini kimin yaptığı hiçbir yerde durmuyordu

§19'daki erteleme notu şöyle diyordu: _"…personel kimliği POS işlem kaydında
duruyor."_ Ölçünce **cümlenin yanlış** olduğu çıktı:

- `pos_transactions` tablosunda aktör kolonu **hiç yoktu** (`createdBy`,
  `initiatedBy`, `userId` — hiçbiri).
- Dört ters-kayıt handler'ı (`pax-void`, `pax-refund`, `iyzico-terminal-void`,
  `iyzico-terminal-refund`) `ctx.actor`'ü **yalnız yetki kontrolü** için okuyup
  **atıyordu**.
- `PosTransactionListener` yalnız `logger.log/warn` basıyordu; `audit_logs`'a
  hiçbir şey yazmıyordu. `LogAction.POS_TRANSACTION_*` sabitleri (üç tane)
  codebase'de **hiç kullanılmıyordu**.

Yani "bu satışı kim iptal etti", "bu kartı kim çekti", "iadeyi kim yaptı"
soruları **ne kolondan ne audit log'dan** cevaplanabiliyordu. Tutar doğruydu —
bu bir bakiye hatası değil, **hesap verebilirlik** hatasıdır; chargeback/itiraz
incelemesinin tek dayanağı kaybolmuş durumdaydı.

CLAUDE.md finans kuralı 7 bunu açıkça şart koşuyor: _"storno, iade tavanı aşımı
gibi işlemler … **kalıcı damga** (kim/ne zaman: **event + kolon**) ister."_
Karşılaştırma turu da bunu doğruluyor — damga her yerde vardı, **POS tek
istisnaydı**:

| Yer                          | Damga                                                |
| ---------------------------- | ---------------------------------------------------- |
| Kasa oturumu                 | `opened_by` / `closed_by`                            |
| Fatura iptali                | `cancelled_by_id` (+ audit olayı)                    |
| İşlem satırı iptali          | `voided_by` (+ `TreatmentChargeVoidedEvent` → audit) |
| Yevmiye stornosu             | `JOURNAL_ENTRY_REVERSED` audit olayı                 |
| **POS satış / iptal / iade** | **yok**                                              |

### 57.2 Düzeltme — tek kolon iki soruyu birlikte cevaplıyor

`pos_transactions.initiated_by_id` (nullable TEXT, **migration**
`20261013140000_pos_transaction_initiated_by`). Ters kayıtlar **kendi satırları**
olduğu için tek kolon hem "satışı kim çekti" hem "iptali kim yaptı" sorusunu
cevaplar — orijinalin damgası devralınmaz (devralınsaydı iptali yapan kişi izde
hiç görünmezdi; bu, §51.3'teki `kind` **devralınır** kararının tam tersi, çünkü
orada nitelik aynı ekonomik olaya aitti, burada aktör farklı bir karara ait).

Üç tasarım kararı:

1. **Kolon nullable, prop ZORUNLU.** Mevcut satırların aktörü bilinemez ve
   uydurulamaz → DB nullable, varsayılan **yok** (`'SYSTEM'` damgası kartı fiilen
   çeken kişinin yerine geçtiği an izi yok eder — kural 10). Yeni kayıtta zorlama
   uygulama tarafındadır: `CreatePosTransactionProps.initiatedById` **required**,
   böylece derleyici 7 çağrı yerinin tamamını gezdirdi ve yeni bir POS akışı
   damgayı sessizce atlayamaz.
2. **Event + kolon birlikte.** Yeni `PosTransactionReversedEvent` yalnız
   **SUCCESS**'te ve yalnız `kind !== SALE` iken fırlatılır; `PosTransactionListener`
   onu `AuditLogService`'e yazar (`LogAction.POS_TRANSACTION_REVERSED`). Başarısız
   iptal denemesi iz bırakmaz (para geri gelmediyse "iptal edildi" yanlış izdir);
   satış da yazmaz (her çekim için denetim kaydı asıl olayları gürültüye boğar).
3. **`source` (WEB/MOBILE) bilinçli taşınmıyor.** Olay entity'den fırlatılıyor ve
   callback yolunda çağrı bağlamı bittikten sonra da fırlatılabiliyor → kanal
   güvenilir biçimde bilinemez. Aktör **kalıcı kolondan** okunduğu için
   rehidrasyon sonrası bile damga eksilmez; hesap verebilirlik için gereken bilgi
   her yolda tam.

### 57.3 Erteleme listesinin ikinci taraması — düşen 8 satır

109 satırın 4'ü zaten ✅ işaretliydi. Tetikleyicisi geçmiş bir tura işaret eden
kalemler ölçüldü; **8 satır düştü** (biri canlı hatayla, yedisi zaten kapanmış
olduğu hâlde açık görünerek):

| Satır                                  | Ölçüm                                    |
| -------------------------------------- | ---------------------------------------- |
| §19 · POS/webhook aktörü               | **Canlı boşluktu** → §57.1/§57.2         |
| §7 · Açık yuvarlama modu               | §53.6'da kapanmış (`Money.ROUNDING`)     |
| §7 · Bilanço `dateFrom`                | Yarısı §51.1'de kapanmış (tek `asOf`)    |
| §15 · Fatura iptali / storno           | §47'de kapanmış                          |
| §43 · Envanter değeri + 150 mutabakatı | §44'te kapanmış                          |
| §43 · Tüketimin SMM fişlemesi          | §44'te kapanmış                          |
| §40 · `adjust-stock` kapıları          | §41–§43'te kapanmış (§55'te işaretlendi) |
| §43 · `hasTax` çelişkisi               | §55'te düzeltildi                        |

Kapanmayan tek "geçmiş tetikleyici": **§40 · `ReceiveStockDto` para tipi**.
Ölçüm: şema kapısı `multipleOf(0.01)` / `multipleOf(0.001)` ile ölçeği zorluyor ve
`decimal.js` JS sayısını **string üzerinden** okuduğu için 15 anlamlı haneye kadar
kayıp yok → **P2 tutarsızlık** (diğer para kapıları string alıyor), veri kaybı
değil. Tetikleyicisi hijyen turuna taşındı.

### 57.4 Yöntem notu

Liste elle derlenmedi: `## N. Bilinçli yapılmayanlar` başlıklarının altındaki
tablo satırları script'le çıkarıldı, `Tetikleyici:` cümlesi ve `KAPANDI`/✅
işareti ayrıştırıldı. **Elle derlense bir kalem atlanırdı** — 109 satır 17
tabloda duruyor ve altısı başka bölümlerde tekrar ediyor. Tekrarların
birleştirilmiş hâli `10-kalan-isler.md` §1'deki **13 iş paketi**.

| Ölçüm          | Sonuç                                                        |
| -------------- | ------------------------------------------------------------ |
| `tsc --noEmit` | api **0**, web **0**                                         |
| Test           | **220 suite / 1410 test** yeşil (+1 suite, +12 test)         |
| Migration      | **1 yeni** (`pos_transaction_initiated_by`) → bekleyen **1** |

---

## 58. Bilinçli yapılmayanlar — POS aktör damgası turu

| Konu                                                      | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Satış (SALE) için denetim kaydı**                       | Damga kolonda var; audit olayı yalnız ters kayıtta fırlıyor. Her başarılı kart çekimi için `audit_logs` satırı üretmek, iptal/iade gibi **karar** niteliğindeki olayları gürültüye boğar (bir klinikte günde onlarca çekim, ayda tek bir iptal). Satışın izi `pos_transactions` satırının kendisidir. **Tetikleyici:** POS işlem listesi ekranı yazılırken "kim çekti" kolonu talep edilirse — o zaman okuma modeli damgayı taşır, audit log'a ikinci kopya yazılmaz.                              |
| **Olay `source`'unun (WEB/MOBILE) taşınması**             | Olay entity'den fırlatılıyor; callback yolunda çağrı bağlamı bitmiş olabiliyor. Taşımak için ya entity'ye kalıcı olmayan (geçici) bir alan koymak ya da 7 çağrı yerine opsiyonel bir prop eklemek gerekir — ikisi de "bazen dolu, bazen boş" bir alan üretir (kural 10). Aktör kimliği kalıcı kolondan okunduğu için hesap verebilirlik eksiksiz. **Tetikleyici:** kanal bazlı denetim raporu istenirse — o zaman doğru yer `ExecutionContext`'in olayla birlikte mühürlenmesidir, tek alan değil. |
| **Eski satırların damgasının geriye doldurulması**        | Kolon nullable ve varsayılansız bırakıldı: geçmiş işlemlerin aktörü **bilinemez**. `'SYSTEM'` ya da kliniğin ilk kullanıcısı yazmak, kaydı "damgalı" gösterip izi yok etmek olur (kural 11'in aynı mantığı: geçmişi geriye dönük yorumlayan düzeltme otomatik yapılmaz). **Tetikleyici:** yok — bu kalıcı bir karar.                                                                                                                                                                               |
| **Ayrı capability (POS iptal/iade yetkisi)**              | Kural 7'nin ikinci yarısı: damga kuruldu, ama iptal/iade hâlâ sıradan `finance` yetkisiyle yapılabiliyor. Bu, kasa farkı onayı (§25), indirim tavanı (§33), mal kabul (§40) ve sayım düzeltmesi (§43) ertelemeleriyle **aynı mekanizmadır** (capability + eşik + bekleyen onay) ve tek turda tasarlanmalı — parça parça eklemek beş farklı eşik semantiği üretir. **Tetikleyici:** rol matrisi turu (bkz. `10-kalan-isler.md` iş paketi 4).                                                        |
| **`pos_transactions` okuma ucunda damganın gösterilmesi** | İki POS okuma ucu var ve ikisi de **operasyonel tarama** (`stale-pending`, `unbridged`); projeksiyonlarına damga eklemek, kullanılmayan bir alan taşımak olurdu (kural 10 tersi: okunmayan alan süstür). Damga bugün adli iz (DB + audit log). **Tetikleyici:** POS işlem listesi ekranı (iş paketi 13).                                                                                                                                                                                           |

---

## 59. Finans dışındaki para yolları: `platform/subscription` (2026-10-13, 10. tur)

Bu tur denetim **yüzeyini** sorguladı: §2 tablosu `src/modules/finance/**` ile iki
supply modülünü kapsıyor, ama **kart çeken** her yol orada değil. Ölçüm:
`platform/subscription` (kayıtlı kartla otomatik çekim), `crm/health-tourism`
(iyzico TRY + Stripe EUR/USD ödeme linkleri, Duffel uçuş ödemesi) ve
`organization/project` / `supply/work-order` (tutar taşıyan ama posting'i olmayan
defterler) §2'de **hiç geçmiyordu** — tablodaki iki eşleşme alakasızdı.

En riskli olan **yinelenen çekim**: müşteri etkileşimi olmadan, zamanlanmış bir
işle, saklanmış kartla her ay para alıyor. Bu tur onu denetledi.

### 59.1 P0 — `external_id` tek kolon, iki rol; biri diğerini yok ediyordu

`subscriptions.external_id` iki ayrı iş yapıyordu:

| Yazan                      | Ne yazıyordu            | Rolü                                                                                                          |
| -------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `subscribe-to-plan`        | iyzico `conversationId` | **Callback korelasyon anahtarı** — `findByExternalIdForUpdate(conversationId)` aboneliği YALNIZ bununla bulur |
| `confirmPayment` / `renew` | `iyzicoPaymentId`       | Ödeme referansı                                                                                               |

İkincisi birincisini **eziyordu**. Sonuç zinciri:

1. İlk bildirim gelir → abonelik bulunur → `external_id` ödeme kimliğiyle ezilir.
2. Sağlayıcının **ikinci bildirimi** (iyzico aynı ödeme için callback **ve**
   webhook gönderir — kodun kendi yorumunda yazıyor) `conversationId` ile arar →
   **bulamaz** → handler `NotFoundException` fırlatır.
3. Sağlayıcı 404'ü başarısızlık sayıp yeniden dener; daha kötüsü o bildirimde
   gelen **`savedCard` kaybolur** → sonraki yenilemede kayıtlı kart yok →
   `PAST_DUE` → hizmet kesintisi ve tahsilat kaybı.

Kodun yorumu "kilitli okuma ile dönem iki kez başlatılmaz" diyordu; gerçek
mekanizma ise **anahtarın yok edilmesiydi** — yani koruma, kaydı kaybederek
çalışıyordu. Üstelik her yenileme ödeme kimliğini bir kez daha ezdiği için
**tahsilat geçmişi** de yok oluyordu.

**Düzeltme:** roller ayrıldı. `external_id` korelasyon anahtarı olarak **korunur**;
ödeme referansı yeni `provider_payment_id` kolonuna yazılır. Callback artık
yinelenen bildirimi **tanıyor** (`providerPaymentId === result.iyzicoPaymentId`):
dönemi ikinci kez başlatmıyor ama kartı yine kaydediyor — çünkü kartı taşıyan
bildirim ikincisi olabilir ve onu yutmak otomatik tahsilatı imkânsız kılar.

### 59.2 P0 — platformun kendi tahsilatının kaydı yoktu

Çekilen tutarın, tarihin ve ödeme kimliğinin kalıcı tek izi (a) bir audit log
satırı ve (b) yukarıdaki **ezilen** kolondu. Sonuçları:

- **İade edilemiyordu** — iade sağlayıcı ödeme kimliğini ister, o kayıp.
- **Sağlayıcıyla mutabakat yapılamıyordu** — "iyzico bu ay şu kadar yatırdı"
  karşılığı yerelde yok.
- **"Bu ay ne tahsil ettik" cevaplanamıyordu.**
- Ve en önemlisi: **dönem başına idempotency anahtarı yoktu.**

Son madde canlı bir mükerrer çekim yoluydu. Eski akış tahsilat çağrısını
**transaction'ın içinde**, abonelik satırı `FOR UPDATE` kilitliyken yapıyordu.
Bu **eşzamanlı** iki çalıştırmayı engelliyordu ama **sıralı** olanı değil: çekim
başarılı olup commit başarısız olursa (statement timeout, bağlantı kopması, pod
kill, outbox yazım hatası) `current_period_end` ilerlemiyor ve bir sonraki
zamanlanmış çalıştırma kartı **ikinci kez** çekiyordu — ilk çekimin hiçbir kaydı
olmadığı için de kimse fark etmiyordu.

**Düzeltme:** `subscription_charges` defteri + akışın yeniden kurulması.

**Akış artık parayı kaydının arkasından getiriyor** (_sahiplen → çek → yaz_):

| Faz            | Ne yapar                                               | Neden ayrı transaction                                                                                             |
| -------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 1 · Sahiplenme | Dönem için `PENDING` satır açılır ve **commit edilir** | `(subscription_id, period_start)` tekilliği ikinci çalıştırmanın aynı dönemi çekmesini DB düzeyinde imkânsız kılar |
| 2 · Tahsilat   | Sağlayıcı çağrısı — transaction ve kilit **dışında**   | Yavaş HTTP çağrısı bağlantıyı ve satırı tutmaz; geri alınamaz yan etki tx sınırının dışına çıkar                   |
| 3 · Sonuç      | Satır `SUCCEEDED`/`FAILED` olur, abonelik yenilenir    | Faz 3 düşerse satır `PENDING` kalır → **ikinci çekim yapılmaz**                                                    |

`PENDING` kalmış satırın anlamı **"başarısız" değil, "çekim yapıldı mı
bilinmiyor"**: otomatik yeniden denenmez, `CRITICAL` alarm üretir ve insan
mutabakatı ister. Bunun karşıtı da kurgulandı: çekim başarılı olup satır
yazılabildiyse ama abonelik güncellenemediyse, sonraki çalıştırma bunu
`SUCCEEDED` satırdan görüp dönemi **para çekmeden** ilerletir — defter satırı
kurtarmanın kaynağı olur.

`FAILED` satır aynı satır üzerinde yeniden denenir (`attempts` artar); yeni satır
açmak dönem başına tekilliği kırar ve mükerrer çekim kapısını yeniden açardı.

### 59.3 P1 — karışık para birimli kalemler sessizce toplanıyordu

`findRenewalCharge` aboneliğin kalemlerini topluyor ama para birimini
`items[0].currency`'den alıyordu: 100 TRY + 20 EUR = **120 TRY** olarak karttan
çekilirdi. Modül fiyatları plan para biriminden bağımsız tanımlanabildiği için bu
ulaşılabilir bir durum. Artık para birimi kümesi birden fazlaysa
`SubscriptionChargeCurrencyMismatchException` ile **durulur** — doğru çözüm (tek
para birimi zorlamak ya da para birimi başına ayrı tahsilat) bir ürün kararı.

### 59.4 P1 — sağlayıcının tahsil ettiği tutar hiç okunmuyordu

`PaymentResult` yalnız `success` + `iyzicoPaymentId` taşıyordu; iyzico'nun
`paidPrice`'ı hiçbir yerde okunmuyordu. Taksitli ödemede `paidPrice > price`
olabilir (komisyon) — yani **sağlayıcının çektiği tutar ile bizim beyanımızın
ayrışıp ayrışmadığı bilinmiyordu**. `paidPrice` uçtan uca bağlandı
(`RetrieveCheckoutFormResult` → `PaymentResult.paidAmount` →
`subscription_charges.paid_amount`) ve fark varsa `CRITICAL` alarm üretiliyor.

Kayıtlı kartla yenilemede sağlayıcıya `installments: 1` ve `paidPrice = price`
gönderildiği için orada karşılaştıracak bir fark yok; yenileme taksitlendirilirse
aynı okuma oraya da eklenmeli (§60).

| Ölçüm          | Sonuç                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `tsc --noEmit` | api **0**, web **0**                                                                                                                       |
| Test           | **221 suite / 1425 test** yeşil (+1 suite, +15 test)                                                                                       |
| Migration      | **1 yeni** (`subscription_charge_ledger`) → bekleyen **2**                                                                                 |
| Yetki          | yeni model → `MODULE_LABELS` + klinik sahibi demetine **okuma** yetkisi (ödeyen taraf kendi tahsilatını görür); `roles.spec` bunu zorluyor |

---

## 60. Bilinçli yapılmayanlar — abonelik tahsilatı turu

| Konu                                                        | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Abonelik tahsilatının muhasebeye fişlenmesi**             | Platform geliri artık **kayıtlı** ama deftere (yevmiye) girmiyor. Sağlık turizmi komisyonunda platform bir kiracı satırı olarak kurulmuştu (`isPlatform`); abonelik geliri de oraya fişlenebilir. Ama bu, platformun kendi mali tablosunu kiracı defteriyle aynı yerde tutma kararıdır ve KDV/belge tarafı da gerekir (abonelik faturası kesilmiyor). **Tetikleyici:** platformun kendi beyanı/faturası gündeme geldiğinde — o zaman olay tipi + posting kuralı + e-belge birlikte tasarlanır. |
| **İade (refund) akışı**                                     | Ön koşul bu turda kuruldu: `provider_payment_id` artık kalıcı, yani iade **teknik olarak mümkün** hâle geldi. Akışın kendisi (kısmî iade, dönem kısaltma, hak iptali) yazılmadı — iade tutarı ile hizmet süresinin ilişkisi bir ürün kararı. **Tetikleyici:** ilk abonelik iadesi talebi; `10-kalan-isler.md` iş paketi 3 ile birlikte.                                                                                                                                                        |
| **`findUnresolved` için zamanlanmış rapor**                 | Repo metodu var (PENDING kalmış satırlar) ama onu çağıran bir iş yok; bugün alarm **çekim anında** üretiliyor (bir sonraki yenileme denemesi `PENDING` görünce). Yani boşluk sessiz değil ama tespit bir sonraki döneme kadar gecikebilir. **Tetikleyici:** ilk gerçek `PENDING` vakası ya da fişlenmemiş olay süpürmesine (§34) bir kalem daha eklenirken aynı işte birlikte.                                                                                                                 |
| **Yenilemede `paidPrice` okunması**                         | Sağlayıcıya `installments: 1` ve `paidPrice = price` gönderiliyor → fark yapısal olarak sıfır. Okumak, her yenilemede karşılaştırılacak bir şey olmadan kod eklemek olurdu. **Tetikleyici:** yenilemenin taksitlendirilmesi (o an fark gerçek olur).                                                                                                                                                                                                                                           |
| **Geçmiş tahsilatların deftere geriye doldurulması**        | Hangi dönemde ne çekildiği **bilinmiyor** (tek iz ezilmiş kolon + audit log satırları). Audit log'dan türetmek, eksik/çelişkili bir defter üretip onu "kayıt" gibi göstermek olurdu. **Tetikleyici:** yok — kalıcı karar. Geçmiş için kaynak iyzico panelidir.                                                                                                                                                                                                                                 |
| **Abonelik tutarının `Money` olarak taşınması (uçtan uca)** | `RenewalChargeModel` `Decimal` + ham `currency` string taşıyor; handler `Money.fromTrusted` ile sarıyor. Kalem toplama repo'da yapıldığı için VO'yu repo'ya sokmak gerekir. Davranış doğru (tek para birimi artık zorlanıyor), değişiklik biçimsel. **Tetikleyici:** `10-kalan-isler.md` iş paketi 12 (hijyen turu).                                                                                                                                                                           |
| **`crm/health-tourism` ve diğer finans-dışı para yolları**  | Bu tur yalnız `platform/subscription`'ı denetledi. Kalanlar: ödeme linkleri (iyzico TRY + Stripe EUR/USD), Duffel uçuş ödemesi, `ProjectCost`, `work-order` maliyeti. Ödeme linki akışı daha dikkatli kurulmuş görünüyor (`BookingPayment` durum makinesi + çift-çekim yarışı bir commit'te kapatılmış) ama **denetlenmedi**. **Tetikleyici:** sıradaki tur — `10-kalan-isler.md`'ye iş paketi olarak eklendi.                                                                                 |

---

## 61. Sağlık turizmi ödeme linkleri: iki P0 aynı dalda, zıt yönlü (2026-10-13, 11. tur)

`10-kalan-isler.md` iş paketi 14'ün ilk yarısı: `crm/health-tourism/booking-payment`
(iyzico TRY + Stripe EUR/USD ödeme linkleri) ve `flight` (Duffel) denetlendi.

**Modül genel olarak olgun.** Ölçtüm ve beklediğim üç hatayı **bulamadım**:
akış `claim-tx → dış çağrı → finalize-tx` olarak bölünmüş (tam §59'da aboneliğe
kurduğum desen), `claimPayment` satırı kilitleyip `isPending`'i kontrol ediyor,
Stripe webhook'u ham gövde + `stripe-signature` ile doğruluyor, `fxRate` kayda
**donduruluyor**, `paidProviderRef` korelasyon anahtarından **ayrı** kolonda
(yani §59'un "tek kolon iki rol" hatası burada yok) ve HotelBeds book başarısız
olursa iade + CRITICAL alarm zinciri kurulmuş. Duffel uçuş ödemesi daha da
ileride: bayat claim'de **yerel duruma güvenmeyip sağlayıcıya soruyor**
(`getOrderState`) — idempotency'nin doğru yeri.

Hata, ödemeyi **sahiplenemeyen** dalda çıktı ve iki yönü vardı.

### 61.1 P0 — webhook tekrarı meşru ödemeyi iade ettiriyordu

Karar `isSettled` (PAID|BOOKED) üzerinden veriliyordu:

```ts
if (!claim.claimed) {
  if (claim.bp.validate.status.isSettled.value) {
    await this.refundCharge(provider, providerRef, claim.bp); // ← aynı referans!
  }
  return;
}
```

Stripe teslimatı **at-least-once**'tır; iyzico callback'i ise kullanıcı dönüş
sayfasını yenilediğinde tekrar çalışır (`handle-iyzico-callback` aynı komutu
dispatch ediyor). İkisi de **aynı `providerRef`** ile gelir. Kayıt zaten
PAID/BOOKED olduğu için `isSettled` tutuyor ve `refundCharge` **o referansı**
iade ediyordu — `refundCharge` gelen referansı `bp.paidProviderRef` ile
karşılaştırmıyor. Sonuç: **hizmet verilmiş, para geri ödenmiş, kayıt hâlâ
BOOKED** ve iadenin kayıtta hiçbir izi yok (durum değişmiyor).

### 61.2 P0 — terminal ama "settled" olmayan durumda gelen ödeme sessizce tutuluyordu

Aynı dalın diğer yarısı: `isSettled` yalnız PAID|BOOKED'i kapsıyor. Kayıt
FAILED, REFUNDED (ya da ileride EXPIRED) ise `claimed:false` → `isSettled` false
→ **ne iade, ne alarm, ne kayıt**. Para bizde kalıyor.

Bu ulaşılabilir ve yeni kod gerektirmiyor: **iyzico'nun expire API'si yok**
(`iyzico-payment-link.adapter.ts`: _"iyzico CheckoutForm'un explicit expire
API'si yok"_ — `expireLink()` **no-op**). Yani Stripe linki ödenip HotelBeds book
başarısız olup iade edildikten (REFUNDED) sonra bile **iyzico linki canlı
kalıyor** ve sonradan ödenebiliyor. O ödeme sessizce tutuluyordu.

### 61.3 Düzeltme — ayırt edici yerel durum değil, ödeme referansı

```ts
if (!claim.claimed) {
  await this.handleUnclaimedPayment({ bp: claim.bp, provider, providerRef });
  return;
}
```

İki olgu, iki davranış:

| Durum                                | Anlamı                             | Davranış                                     |
| ------------------------------------ | ---------------------------------- | -------------------------------------------- |
| `providerRef === bp.paidProviderRef` | **Aynı ödemenin** tekrar bildirimi | Idempotent **yok-sayma** — asla iade edilmez |
| `providerRef !== bp.paidProviderRef` | **İkinci bir çekim**               | Yerel durum ne olursa olsun **iade** + iz    |

**KURAL: sahiplenemediğimiz bir çekim bizim olmamalı; ama "sahiplenemedim"
tek başına "bu para fazladan geldi" demek değildir — ikisini ayıran şey ödeme
referansıdır, yerel durum değil.**

İz bırakma da eklendi: başarılı iade **WARNING** (çift çekim akışta bir sorunun
belirtisidir — ör. ödenmiş kaydın diğer linki hâlâ canlı), başarısız iade
**CRITICAL** (para bizde, otomatik telafi yok). İkisi de `providerRef` taşıyor,
yani alarm doğrudan eyleme dönüştürülebilir.

### 61.4 P1 — guard'ın testi vardı, çağıranı yoktu

Durum geçişleri (`markPaid`, `markBooked`, `markFailed`, `markExpired`,
`markRefunded`) **koşulsuzdu**; yorumlar "PENDING → PAID" diyordu ama zorlayan
yoktu. Koşullar `BookingPaymentRules` sınıfında duruyordu ve **üretimde tek bir
çağıranı yoktu** (`grep '\.rules('` → yalnız spec'ler).

Spec'in yorumu olayı itiraf ediyordu: _"Durum geçiş koruması artık entity
metodunda değil, rules() üzerinden uygulanıyor."_ Guard entity'den çıkarılmış,
**testler onunla birlikte taşınmış**, üretim kodu geride kalmış. Testler
`rules()`'u doğrudan çağırdığı için yeşil kalıyor ve korumanın var olduğu
izlenimini veriyordu.

**KURAL: bir guard'ı test ediyor olmak, onun çağrıldığını kanıtlamaz. Taşınan
koruma için testin de taşındığı yere değil, ÜRETİMDEKİ çağrı yerine bakılır.**

Pratik bedeli: ödenmiş kaydı `markExpired` ile "ödeme yapılmadı" hâline çekmek,
ya da ikinci bildirimle `paidProviderRef`'i ezip **ilk çekimin iade referansını
kaybetmek** mümkündü. Düzeltme: koşullar varlığın **içine** alındı
(`assertStatusIn` + `BookingPaymentInvalidTransitionException`, 409) ve ölü
`BookingPaymentRules` kaldırıldı — aynı kuralın iki evi olması kural 12'nin
ihlalidir. Spec'ler artık **zorlanan** davranışı doğruluyor.

### 61.5 Ölçüldü, el atılmadı

- **Duffel uçuş ödemesi**: claim durum makinesi + bayat claim'de sağlayıcıya
  sorma zinciri doğru kurulmuş; üstelik aynı `ConfirmBookingPaymentCommand`'dan
  geçtiği için §61.3 düzeltmesi uçuşları da kapsıyor.
- **`ProjectCost` / `work-order` maliyeti**: para alanları `Decimal(16,2)` /
  `Decimal(14,2)` — kuruş ölçeği kolon düzeyinde zorlanmış, depolama tarafında
  defekt yok. Eksik olan tek şey bu maliyetlerin deftere girmemesi, ki bu
  **belgelenmiş bir tasarım kararı** (etiketleme defteri).
- **Spec lint borcu**: iki spec dosyası `unbound-method`/`no-unsafe-*` uyarıları
  taşıyor (dosya genelinde 10+ kez, turdan önce de vardı). Eklediğim testler
  dosyanın mevcut deyimine uydu; yeni ihlal getirmedi. Dokunduğum **üretim**
  dosyaları lint-temiz.

| Ölçüm          | Sonuç                                          |
| -------------- | ---------------------------------------------- |
| `tsc --noEmit` | api **0**, web **0**                           |
| Test           | **221 suite / 1429 test** yeşil (+4 test)      |
| Migration      | **yok** (davranış düzeltmesi) → bekleyen **2** |

---

## 62. Bilinçli yapılmayanlar — ödeme linkleri turu

| Konu                                                            | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Süresi geçmiş ödeme linklerinin süpürülmesi (`markExpired`)** | `markExpired` metodunun **hiç çağıranı yok** → `EXPIRED` durumu bugün ulaşılamaz; PENDING kayıtlar süresiz duruyor. Stripe oturumu `expires_at` ile sağlayıcı tarafında kapanıyor ama **iyzico linki hiçbir yerde kapanmıyor** (expire API'si yok). Sonuç: HotelBeds `rateKey`'i ölmüşken ödenen link → zorunlu iade yolu. §61.3'ten sonra bu artık **sessiz para kaybı değil** (geç gelen ödeme iade ediliyor + alarm), yalnız gereksiz sağlayıcı masrafı ve müşteri sürtünmesi. **Tetikleyici:** ilk "linki geç ödedi" vakası ya da zamanlanmış işlerin (§5 kuralı) gözden geçirildiği tur — o zaman süpürme + `expireLink` best-effort birlikte eklenir. |
| **İkinci çekimin kalıcı kaydı (satır/kolon)**                   | İade edilen ikinci çekimin izi bugün **ops alarmı + sağlayıcı paneli**. Kalıcı bir kayıt (ör. `booking_payment_charges` satırı) §59'da aboneliğe yazdığım deftere benzer bir yapı ister; bu akışta ikinci çekim **istisnai** bir olay olduğu için alarm eyleme dönüştürülebilir bilgiyi (provider + ref + tutar) zaten taşıyor. **Tetikleyici:** çift çekim operasyonda tekrarlayan bir vaka hâline gelirse — o an sayılabilir/raporlanabilir bir kayıt gerekir.                                                                                                                                                                                            |
| **İade tutarının `number` olarak sağlayıcıya geçmesi**          | `refundCharge` `Decimal` → `.toNumber()` ile adaptöre geçiyor (adaptör sözleşmesi `amount: number`). Kuruş ölçeğinde 15 anlamlı hane sınırının çok altında olduğumuz için kayıp yok; tutarsızlık, `ReceiveStockDto` ile aynı sınıf. **Tetikleyici:** para tiplerinin uçtan uca string'e çekildiği hijyen turu (`10-kalan-isler.md` iş paketi 12).                                                                                                                                                                                                                                                                                                           |
| **Platform defterine yazımın `best-effort` kalması**            | Tahsilat platform defterine yazılıyor ama hata **rezervasyonu bozmuyor** (bilinçli: para alınmış, otel açılmış). Bu kural 4'ün kapsamında ve karşılığı var — fişlenmemiş olay süpürmesi (§34) bu kaydı da yakalar. **Tetikleyici:** yok (kabul edilmiş tasarım).                                                                                                                                                                                                                                                                                                                                                                                            |
| **`crm/health-tourism` hotel/transfer modüllerinin kendi turu** | Bu tur **ödeme** yolunu denetledi. `hotelbeds-booking` entity'si ve otel/transfer fiyatlandırması (net ↔ satış ↔ komisyon üçlüsü) ayrı bir yüzey. §61'de ödeme tarafının net/satış/komisyon alanlarını **taşıdığı** görüldü (`netAmount`, `saleAmount`, `fxRate`) ama fiyat **türetme** mantığı ölçülmedi. **Tetikleyici:** komisyon oranı değişikliği ya da ilk fiyat uyuşmazlığı şikâyeti.                                                                                                                                                                                                                                                                |

---

## 63. Tur 18 — otel/transfer/uçuş fiyat türetmesi (net ↔ satış ↔ komisyon)

`10-kalan-isler.md` iş paketi 14'ün ikinci yarısı ve §62'nin son satırı: **fiyat
türetme** mantığı. §61 ödeme *yolunu* denetlemişti; bu tur satış fiyatının nereden
geldiğini ve tedarikçi maliyetinin deftere nasıl ulaştığını ölçtü.

Yüzey üç üründe aynı: AI bir seçenek listesi sunar → seçilen seçeneğin **net
fiyatı** 15 dakikalık Redis token'ına yazılır → `InitiateBookingPayment` satış
fiyatını `net × (1 + komisyon%)` ile türetir ve iki ödeme linki üretir → ödeme
gelince niyet sağlayıcıya replay edilir.

### 63.1 P0 — satış fiyatı teklifden türetiliyor, sağlayıcının FİİLÎ fiyatı hiç karşılaştırılmıyordu

Teklif ile rezervasyon arasındaki pencere **sınırsızdı**: rate token'ı 15 dakika
yaşıyor ama `rateKey` ödeme kaydının `intent`'ine mühürlendiği için ödeme saatler
sonra geldiğinde o anahtar sağlayıcıya aynen gönderiliyor. iyzico linkinin expire
API'si de yok (§62) — link süresiz açık.

Sağlayıcılar rezervasyonu **o anki** fiyatla açar ve fiilî tutarı yanıtta
döndürür:

| Ürün     | Fiilî tutar yanıtta        | Kayda yazılan                               |
| -------- | -------------------------- | ------------------------------------------- |
| Otel     | `booking.totalNet`         | ✅ fiilî (`hotelbeds_bookings.total_net`)   |
| Transfer | `booking.totalAmount`      | ✅ fiilî                                    |
| Uçuş     | `order.total_amount`       | ❌ **atılıyor** — önbellekteki teklif yazılıyor |

Ama **defter** hiçbirini okumuyordu: `PLATFORM_BOOKING_SETTLED` olayı
`supplierAmount`'ı ödeme kaydının `netAmount`'ından, yani **teklifden** alıyordu:

```ts
const supplier = bp.netAmount.value;              // teklif
commission: sale.minus(supplier).toFixed(2),      // fark komisyona yazılıyor
```

Sonuç zinciri:

1. **320 (Satıcılar) sağlayıcının faturalayacağı tutarı göstermiyor.** Tedarikçi
   mutabakatı yapıldığında fark kalıcı olarak açık kalır.
2. **601 komisyon geliri şişik.** Fiyat arttıysa gerçekleşen komisyon daha az;
   defter eski komisyonu yazıyor.
3. **Zam komisyon oranını aşarsa satış maliyetin altına düşer** ve bu hiçbir
   yerde görünmez: fiş yine denk gelir (`sale − supplier` her zaman denkler),
   yalnız 601 **negatif alacak** taşır — yani hasılat ters işaretle yazılır.
4. Hiçbir alarm, hiçbir rapor bu farkı göstermiyordu.

**Düzeltme.** Fiilî maliyet kalıcı bir kolona damgalanır ve defter ondan yazılır:

- `booking_payments.supplier_amount` + `supplier_currency` (nullable, varsayılansız
  — 0 "bedava", `net_amount` kopyası "sapma yok" demek olurdu; ikisi de uydurma).
- Üç book command'i artık yalnız id değil **`{ bookingId, supplierAmount,
  supplierCurrency }`** döner (CLAUDE.md: 3. parti entegrasyon command'i anlık
  metadata taşıyabilir). Dönüş tipini değiştirmek derleyiciyi saga'daki tek
  tüketiciye götürdü — §57'nin "zorunlu alan seni bütün çağrı yerlerinde
  gezdirir" dersi.
- Damga `markBooked` ile **aynı transaction'da** atılır: ikisini ayırmak, araya
  düşen bir çökmede "rezervasyon açıldı, maliyeti bilinmiyor" satırı bırakırdı.
- Teşhis tek yerde, varlığın içinde (`BookingPayment.supplierCost`): defterin
  hangi tutarı yazacağını **ve** sapmanın türünü aynı nesne söyler. İki ayrı
  hesap, birinin fiilî tutarı yazıp diğerinin teklife bakması riskini üretirdi.

| Teşhis              | Defter        | Alarm                       |
| ------------------- | ------------- | --------------------------- |
| `NONE`              | fiilî         | yok                         |
| `DIFFERENT`         | **fiilî**     | WARNING                     |
| `exceedsSale`       | fiilî         | **CRITICAL** (maliyetin altında satış) |
| `CURRENCY_MISMATCH` | teklif        | **CRITICAL**                |
| `UNKNOWN`           | teklif        | **CRITICAL**                |

Eşik yok: bir kuruş fark da bir fiyat uyuşmazlığının ilk belirtisidir ve
`dedupeKey` tekrarları susturur.

Posting kuralı artık **negatif komisyonu** adıyla reddediyor
(`PlatformBookingBelowCostException`): denge kontrolü onu yakalamıyordu. Olay
postlanmamış kalır, fişlenmemiş olay süpürmesi (§34) + tahsilat tarafındaki
CRITICAL birlikte insana taşır. Zararın hangi hesapta tanınacağı (ör. 659)
bir **muhasebe kararıdır** — kural 11: otomatik onarım yok.

**KURAL: bir fiyattan türetilen ikinci fiyat, türetildiği fiyatın hâlâ geçerli
olduğunu kanıtlamaz. Tedarikçinin FİİLEN ücretlendirdiği tutar yanıtta geliyorsa
defter onu yazar; teklif yalnız sapmanın ölçülebilmesi için durur.**

### 63.2 P0 — fiyatı okunamayan seçenek "bedava" olarak satılabiliyordu

Transfer müsaitlik yanıtı eşleniyordu:

```ts
price: { totalAmount: raw.price?.totalAmount ?? 0, netAmount: raw.price?.netAmount ?? 0, … }
```

Bu sıfır doğrudan satış fiyatının girdisi (`netAmount: option.totalAmount`) ve
AI aramayı **artan fiyata sıralıyor** — yani fiyatı okunamayan seçenek listenin
**başına** geçip hastaya "en ucuz" olarak sunuluyordu. Satış = 0 × (1 + komisyon)
= 0: bedava transfer.

Otel tarafında aynı hata `?? 0` olmadığı için NaN üretiyor (`parseFloat(undefined)`)
ve sağlayıcı linki reddettiği için **gürültülü** patlıyordu; transfer sessizdi.

Düzeltme iki kapıda:

1. **Satışın türetildiği tek nokta**: `Money.create(net)` + pozitiflik →
   `BookingPaymentInvalidNetAmountException`. NaN/∞/negatif/sıfır buradan geçemez.
   Kapı burada çünkü üç ürünün üçü de aynı yerden satış fiyatı türetiyor.
2. **Liste**: fiyatı okunamayan seçenek müsaitlik listesine **girmez** (atlanan
   sayı loglanır). Teklif edilemeyen bir seçeneği listede tutmanın anlamı yok.

Ek olarak `?? '0'` varsayılanları sağlayıcı yanıtlarından kaldırıldı ve
transfer/uçuş varlıklarına otel varlığında **zaten var olan** pozitiflik kapısı
eklendi (`Money.validate.greaterThanZero`). Uçuşta bu kapı ayrıca gerekli: tutar
aynı zamanda **ödeme talimatıdır** (`pay-held-flight` Duffel'a bu kolondan ödeme
gönderir), sıfır tutarlı bir HELD kayıt sessizce ödenemez hâle gelir.

**KURAL: eksik fiyatın varsayılanı yoktur. `?? 0` bir fiyat alanında "bedava"
demektir ve satış fiyatı ondan türetiliyorsa bu kararı hasta görür.**

### 63.3 P1 — satış fiyatı ikili kayan noktayla hesaplanıyordu

```ts
const saleAmount = this.round2(input.netAmount * (1 + fee / 100));
private round2(v: number) { return Math.round(v * 100) / 100; }
```

İki sorun: (a) `Money.ROUNDING` + `Money.scale()` projedeki **tek yuvarlama
kapısıdır** (§53.6) ve bu el yazımı `round2` onun ikinci evi oluyordu (kural 12);
(b) çarpım ikili tabanda kuruş sınırının **altına** düşebiliyor.

Ölçülen örnek, hem de varsayılan komisyon oranıyla (Joi default %5):
`17,90 × 1,05 = 18,794999999999998` → `Math.round(1879,4999…)` = **18,79**.
Decimal + HALF_UP: 18,795 → **18,80**. Fark bir kuruş ve **her zaman platform
aleyhine** (çarpımın hatası aşağı yönlü). TRY tutarı da aynı kapıdan geçiyor.

Artık zincir `Money`: `net.applyPercentage(fee).round()` ve
`sale.multiply(fxRate).round()`.

### 63.4 P1 — geri alınamaz yan etkiden sonraki yerel hata sessizdi

§59'un kuralı "para kaydın arkasından gelir" idi. Burada tersi var: **rezervasyon
kayıttan önce** açılıyor (sağlayıcı önce çağrılıyor, sonra satır yazılıyor) —
payment-first saga'nın doğası bu. Kayıt yazılamazsa:

- Saga bunu "book başarısız" sayar → `markFailed` → **tahsilat iade edilir**.
- Ama sağlayıcıdaki rezervasyon **açık kalır**: oda tutulu, bilet kesilmiş ve
  ödenmiş, transfer satın alınmış.
- Tek iz bir `logger.error`'du. Alarm yalnız **iade de başarısız olursa**
  yayınlanıyordu; iade başarılıysa olay sessizce "iade edildi" olarak kapanıyordu.

Ulaşılabilir yollar hayalî değil: sağlayıcının döndürdüğü `status`/`currency`
bizim enum'larımızda olmak zorunda (`HotelbedsTransferBookingStatusSchema.parse`,
`Currency.create(...).orThrow()` — Currency yalnız TRY/USD/EUR/GBP taşıyor), tutar
pozitiflik kapısından geçmek zorunda, kiracı çözümü ve DB yazımı da patlayabilir.

Üç book handler'ı artık sağlayıcı çağrısından **sonrasını** sarıyor ve hata
yükselmeden önce CRITICAL yayınlıyor; alarm sağlayıcı referansını (`reference` /
`duffelOrderId`) taşıdığı için elle iptal doğrudan yapılabilir.

**KURAL: geri alınamaz bir yan etkiden sonra gelen yerel hata, hatanın kendisi
kadar önemli DEĞİL — asıl bilgi "sağlayıcıda bir şey açık kaldı"dır ve onu
taşıyan tek şey referanstır.**

### 63.5 Kendi düştüğüm tuzak — kural 9'un tam olduğu yer

Kolonu şemaya ekledim, entity'ye ekledim, `toPersistence`'a ekledim, 24 test
yazdım, **223 suite yeşil** — ve kolon DB'ye hiç yazılmıyordu. Çünkü
`BookingPaymentCommandRepository.update()` alanları **tek tek** yazıyor (`create`
alanlarına dokunmamak için bilinçli) ve yeni iki alan o listede yoktu.

Davranışı: `markBooked` sonrası `update()` → `new BookingPayment(raw)` ve `raw`
kolonu taşımıyor → `supplierCost.drift === 'UNKNOWN'` → **her rezervasyonda**
CRITICAL alarm + defter teklif tutarından yazılır. Yani düzeltmenin kendisi
sessizce çalışmaz hâle gelirdi. Handler testleri repo'yu mock'ladığı için hepsi
yeşil kalıyordu.

§9 bu durum için zaten bir reçete yazmıştı: *"para/kur taşıyan kolonlar için
mapping'i kilitleyen bir repository testi yazılır."* Yazıldı
(`booking-payment.command.repository.spec.ts`): biri fiilî maliyetin yazıldığını,
biri **entity'nin taşıdığı her değişken kolonun mapping'de bulunduğunu** (açık bir
`CREATE_ONLY_COLUMNS` kümesi dışında), biri de `create` alanlarına dokunulmadığını
doğruluyor. Kilit sınandı: mapping'den alanı tekrar çıkardığımda 3 testten 2'si
düştü.

**KURAL: alan listesini elle yazan bir `update` mapping'i, şemaya eklenen her
kolonda bir borç doğurur. O borcu derleyici görmez, testler mock'lar; görünür
kılan tek şey mapping'i `toPersistence()` anahtarlarıyla karşılaştıran bir
repository testidir.**

### 63.6 Ölçüldü, el atılmadı

- **Komisyon oranı**: `HEALTH_TOURISM_SERVICE_FEE_PERCENT` Joi'de
  `.min(0).max(100).default(5)` ile doğrulanıyor → sağlayıcıdaki
  NaN/negatif savunması **ulaşılamaz** (ölü kod, zararsız). Oran kayda
  damgalanmıyor ama gerek de yok: komisyon `satış − maliyet` olarak türetilebiliyor
  ve iki tutar da kalıcı.
- **Transfer `netAmount` vs `totalAmount`**: sağlayıcı ikisini de veriyor; kod
  satış tabanı olarak `totalAmount`'ı alıyor ve `netAmount`'ı **hiç okumuyor**.
  Hangisinin acente maliyeti olduğu sağlayıcı sözleşmesine bağlı bir **iş**
  sorusudur (otel tarafı `net` alıyor — asimetri). Tek taraflı değiştirmek
  fiyatlandırmayı değiştirmek olurdu → §64'e tetikleyiciyle yazıldı.
- **`hotelbeds_bookings.service_fee`**: ödeme-önce akışı bu alanı **hiç
  doldurmuyor** (`toHotelDto` taşımıyor) ve response DTO'su onu "kliniğin aldığı
  hizmet payı" diye sunuyor — oysa komisyon **platform** geliri. Ölü + yanıltıcı,
  ama davranış değiştirmiyor → §64 (hijyen).
- **`markBooked(bookingId, bookingId)`**: müşteriye giden "referans kodu" dahili
  UUID; sağlayıcının insan-okur referansı (HotelBeds `reference`) kayda
  taşınmıyor. Para değil UX → §64.
- **Manuel override rezervasyonları** (ödeme-önce saga'yı baypas eden uçlar)
  defterle hiç konuşmuyor: tedarikçi borcu da komisyon da yazılmıyor. Tanımı
  gereği "ödemesi kanal dışı tahsil edildi" → §64.

| Ölçüm          | Sonuç                                                           |
| -------------- | --------------------------------------------------------------- |
| `tsc --noEmit` | api **0**, web **0**                                            |
| Test           | **224 suite / 1456 test** yeşil (+3 suite, +27 test)            |
| Migration      | **1 yeni** (`booking_payment_supplier_amount`) → bekleyen **3** |

---

## 64. Bilinçli yapılmayanlar — fiyat türetme turu

| Konu                                                               | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sağlayıcıya `tolerance` gönderilmesi**                           | HotelBeds booking isteği bir `tolerance` alanı kabul ediyor ve adaptörün `CreateHotelbedsBookingParams`'ında **duruyor** ama hiçbir çağıran set etmiyor (kural 10 — okunmayan knob süs). Fiyat sapmasını sağlayıcı tarafında **reddetmek** en temiz önleme olurdu; ama alanın tam semantiği (yüzde mi tutar mı, aşımda hata mı yoksa eski fiyat mı) sağlayıcı dokümanıyla doğrulanmadan ayarlanamaz — yanlış değer her rezervasyonu reddedebilir. **Tetikleyici:** sağlayıcı dokümanı/sandbox ile doğrulama (§56 ile aynı aile: doğrulanmamış sağlayıcı semantiğine davranış bağlanmaz). |
| **Maliyetin altında satışta zararın hesaplanması**                 | Fiş yazılmıyor, olay postlanmamış kalıyor ve CRITICAL yayınlanıyor. Zararın 659'a mı, satış iskontosuna mı, yoksa komisyonun negatifine mi yazılacağı muhasebe kararıdır (kural 11). **Tetikleyici:** ilk maliyet-altı rezervasyon — o an hesap seçilip kurala eklenir.                                                                                                                                                                                                 |
| **Transfer satış tabanının `netAmount`'a çekilmesi**               | Sağlayıcı `totalAmount` + `netAmount` veriyor; kod `totalAmount`'ı maliyet kabul ediyor, otel tarafı `net` alıyor. Doğru olanı sağlayıcı sözleşmesine bağlı ve değiştirmek **fiyatı** değiştirir (satış ve komisyon birlikte kayar). **Tetikleyici:** ilk tedarikçi faturası mutabakatı — fatura hangi tutardan kesiliyorsa taban odur.                                                                                                                              |
| **`hotelbeds_bookings.service_fee` kolonunun kaldırılması**        | Ödeme-önce akışı doldurmuyor (her satırda NULL) ve DTO yorumu komisyonu "klinik payı" diye tanıtıyor — komisyon platform geliri. Kaldırmak migration + DTO değişikliği ister, davranış değiştirmez. **Tetikleyici:** hijyen turu (`10-kalan-isler.md` iş paketi 12).                                                                                                                                                                                                |
| **Müşteriye giden referans kodunun sağlayıcı referansı olması**    | `markBooked(bookingId, bookingId)` → `bookingReference` dahili UUID; HotelBeds'in insan-okur referansı kayda taşınmıyor ve onay mesajında o UUID görünüyor. Para etkisi yok (sağlayıcı referansı rezervasyon satırında duruyor), müşteri deneyimi sorunu. **Tetikleyici:** rezervasyon ekranı / mesaj şablonlarının gözden geçirilmesi.                                                                                                                              |
| **Manuel override rezervasyonlarının deftere girmesi**             | `manualOverride: true` ile açılan rezervasyonların tedarikçi borcu ve komisyonu defterde yok. Tanımı gereği ödeme kanal dışı tahsil edilmiştir, yani tahsilat tarafı da defterde değil — tek taraflı 320 yazmak dengesiz bir tablo üretirdi. **Tetikleyici:** kanal dışı tahsilatın (nakit/havale) kayda bağlanması.                                                                                                                                                 |
| **Fiyatı okunamayan OTEL seçeneğinin listeden atılması**           | Transferde yapıldı; otelde `?? 0` hiç yoktu, `parseFloat(undefined)` → NaN → satış kapısı reddediyor. Yani otel tarafında sessiz bir yol yok; filtre eklemek yalnız hata mesajını erkene çeker. **Tetikleyici:** yok (ölçülmüş denge).                                                                                                                                                                                                                                 |

---

## 65. Tur 19 — iade akışı: geri verilen para deftere hiç ulaşmıyordu

`10-kalan-isler.md` iş paketi 3. Önce iade yüzeyinin **ne kadarının kurulu
olduğu** ölçüldü: POS ters kaydı (kısmi iade dahil, kümülatif tavan + kilitli
okuma + aktör damgası — §57), sanal POS iadesi (iyzico `refund` + kilitli taze
okuma), taksit durum geçişi (`refundInstallment`, tahsil edilmemiş taksit iade
edilemez), cari defter düzeltmesi (kuyruk + CRITICAL alarm). Yani iade yolu
görünürde eksiksizdi.

### 65.1 P0 — iadenin çift taraflı defter karşılığı YOKTU

`FinancialEventType` enum'unda iade diye bir tip yoktu; `rules/` klasöründe iade
kuralı yoktu; `POSTABLE_FINANCIAL_EVENT_TYPES` listesinde iade yoktu. Üç
yoldan da doğrulandı:

| Yol                        | Ne yapıyordu                                 | Yevmiye |
| -------------------------- | -------------------------------------------- | ------- |
| Fiziksel POS iptal/iade    | ters kayıt satırı + taksit REFUNDED + cari   | **yok** |
| Sanal POS iadesi           | iyzico refund + taksit REFUNDED + cari       | **yok** |
| Taksit iadesi (`markRefunded`) | durum geçişi + `PaymentRefundedEvent`    | **yok** |

Muhasebe köprüsü (`PosAccountingBridgeService`) yalnız **satış** handler'larından
çağrılıyordu (`pax-sale`, `iyzico-terminal-sale`, `reconcile`); dört ters kayıt
handler'ının hiçbiri köprüye dokunmuyordu.

Sonuç: tahsilat `B 108 / A 120` yazıyor, iade **hiçbir şey** yazmıyordu →
**108'de hiç gelmeyecek bir para** (sağlayıcı hesabı iadeyi düşerek kapatır,
108 → 102 aktarımı hiçbir zaman mutabık olmaz) ve **120'de kapanmış görünen bir
borç** (hasta aslında yeniden borçlu). Mizan, bilanço ve cari-muhasebe
mutabakatı iade edilen parayı kalıcı olarak bizde sayıyordu. Alarm yok, rapor
yok: iade "başarıyla tamamlandı" diye kapanıyordu.

**Düzeltme — storno DEĞİL, yeni bir olay.** `PAYMENT_REFUNDED` tipi + aynasal
kural:

```
B 120 Alıcılar (party)   tutar
    A 100 | 102 | 108    tutar     (hangi enstrümandan geldiyse)
```

Tahsilat fişini ters kaydetmek (`reverse-journal-entry`) iki şeyi birlikte
bozardı: (1) para o gün gerçekten alınmıştı — tahsilatı tarihinden silmek o
günün kasa/banka bakiyesini yanlış yapar; (2) iade aylar sonra gelebilir ve
orijinal dönem **kapanmış** olabilir → storno dönem kapısına takılır ya da
kapanmış yılın mizanını değiştirir. Storno "bu kayıt hiç olmamalıydı" (belge
iptali, §47) demek içindir.

**KURAL: iade, tahsilatın storno'su değil kendi tarihi olan ayrı bir ekonomik
olaydır. Geri ödemeyi orijinal fişi ters kaydederek yazmak, kapanmış bir dönemi
yeniden yorumlamak demektir.**

Yön için üçüncü bir kapı açıldı (`PaymentDirection = 'INBOUND' | 'OUTBOUND' |
'REFUND'`): iade **geldiği enstrümandan** geri gider, yani hesap `INBOUND`
kümesinden çözülür. `OUTBOUND` kümesi bilinçli olarak kart taşımıyor (satıcıya
kartla ödeme yapılmaz) ve onu kullanmak **her kart iadesini** "eşlenmemiş
yöntem" diye reddederdi. Yönün ayrı bir adı var ki çağrı yerinde niyet görünsün.

### 65.2 P0 — askıda kalmış bir İADE, sonradan TAHSİLAT olarak işleniyordu

`reconcile-pos-transactions` taraması işlem **türüne kör**du. PAX iadesi timeout
verince kayıt bilerek PENDING bırakılıyor (`pax-refund`: _"PAX iade timeout —
PENDING kalıyor"_); tarama sonradan cihaza sorup onay alınca:

```ts
if (entity.paymentId) {
  await this.posPaymentSync.markPaid({ … });   // ← iade için de markPaid
}
await this.accountingBridge.recordBestEffort({ … });  // ← PAYMENT_RECEIVED
```

yani **iade taksiti "tahsil edildi" yapıyor ve deftere ikinci bir tahsilat
yazıyordu.** Para üye işyerinden çıkmışken kayıtlar bir tahsilat daha
gösteriyordu: iadenin kendisi hiç yazılmıyor, üstüne hayalet bir gelir ekleniyor.

Dal artık `entity.kind` üzerinden ayrışıyor (`markRefunded` + `REVERSAL`
köprüsü). Regresyon testi sınandı: dalı sabitleyince test düşüyor.

**KURAL: "sonradan sonuçlandırma" (reconcile/backfill) yolları, ileri yoldaki
her TÜRÜ taşımak zorundadır. İleri yolda iki tür varsa (satış/ters kayıt),
telafi yolunda tek tür varsayan kod, ikinci türü sessizce birinciye çevirir.**

### 65.3 Kural 4 — yutulan iade köprüsünün telafi yolu

Köprü best-effort (hata yutulur + CRITICAL) olduğu için kural 4 "eksik kalanlar"
sorgusu + backfill komutu şart kılıyor. İkisi de vardı ama **yalnız satışlar
için**: `findSuccessfulSales` `kind: SALE` ile süzüyordu, telafi komutu da her
satırı tahsilat olarak yazıyordu.

- Sorgu `findSuccessfulBridgeable` oldu (ad artık yalan söylemiyor), satırlar
  `kind` + `originalPosTransactionId` taşıyor.
- Telafi komutu yönü **satırdan** okuyor: hepsini tahsilat yazmak, iade edilen
  parayı deftere ikinci kez gelir gibi geçirirdi.
- Liste yönü de gösteriyor: eksik tahsilat geliri eksik, **eksik iade geliri
  fazla** gösterir — operasyon için zıt aciliyetler.

### 65.4 Hasta bağı ters kayıtta düşüyordu

Ters kayıt satırları `patientId` kolonunu **boş** açıyordu (satışta dolu). "Kim
iade edildi" sorusu ancak orijinale join atılarak cevaplanabiliyordu ve köprü
cariyi hastadan çözdüğü için iade köprüsünün dayanacağı bir alan yoktu. Artık
hasta bağı **orijinal satıştan devralınıyor** — istek gövdesinden değil: aksi
halde personel başka bir hastanın carisine iade yazabilirdi.

### 65.5 Ölçüldü, el atılmadı

- **Nakit tahsilat/iade:** `CashSessionClosedRule` SALE_COLLECTION/REFUND_PAYOUT
  hareketlerini bilerek postlamıyor, gerekçe _"Payment modülü nakit tahsilatı
  zaten 100 Kasa'ya işliyor"_. Ölçüm: bu önerme **bugün doğrulanamıyor** —
  `PAYMENT_RECEIVED` yalnız iki POS yolundan yazılıyor ve o iki hareket tipini
  üretime koyan **hiçbir akış yok** (yalnız enum'da duruyorlar). Yani canlı bir
  hata değil, **bekleyen bir varsayım**: nakit tahsilat akışı bağlandığı an
  birisi `PAYMENT_RECEIVED`/`PAYMENT_REFUNDED` yazmak zorunda, yoksa nakit de
  bu turda kapatılan boşluğun aynısına düşer → §66.
- **Rezervasyon iadesi platform defterini ters kaydetmiyor** (§66) — ayrı bir
  muhasebe kararı gerektiriyor (iptal bedeli tedarikçi borcunun ne kadarını
  geri getirir?).
- **Kısmi iade** artık **deftere doğru** düşüyor (fiş fiilen geri giden tutarı
  taşır) ama ödeme planı ve cari defter hâlâ taksit granülerliğinde (§19). Yani
  asimetri daraldı: eskiden üçü birlikte yanlıştı, şimdi defter doğru.

| Ölçüm          | Sonuç                                                                |
| -------------- | -------------------------------------------------------------------- |
| `tsc --noEmit` | api **0**, web **0**                                                 |
| Test           | **225 suite / 1472 test** yeşil (+1 suite, +16 test: iade kuralı 9, reconcile 2, pax-refund 2, gövde 3) |
| Migration      | **1 yeni** (`financial_event_payment_refunded`) → bekleyen **4**     |

---

## 66. Bilinçli yapılmayanlar — iade turu

| Konu                                                              | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~**Rezervasyon iadesinin platform defterini ters kaydetmesi**~~ **✅ §67** | `refund-booking-payment` kaydı REFUNDED yapıyor ve parayı geri veriyor ama `PLATFORM_BOOKING_SETTLED` fişi (108/601/320) **yerinde kalıyor**: komisyon geliri ve tedarikçi borcu iade edilmiş bir rezervasyon için duruyor. Tam aynasını yazmak yanlış olur — iptal bedeli (HotelBeds cancellation fee) tedarikçi borcunun bir kısmını **kalıcı** kılar, yani 320'nin ne kadarının geri döndüğü sağlayıcı yanıtından okunmalı. Bu bir muhasebe kararı + yeni bir sözleşme alanı demek. **Tetikleyici: sıradaki tur** (bu boşluk bu turda kapatılanın aynısı, bir katman yukarıda). |
| **Nakit tahsilat/iadenin ekonomik olayı**                         | `SALE_COLLECTION`/`REFUND_PAYOUT` hareketlerini üreten akış **yok**; kasa kuralı da onları bilerek postlamıyor. Bugün boşluk **ulaşılamaz**, ama akış bağlandığında (taksit nakit tahsil edilince kasa hareketi + olay) `PAYMENT_RECEIVED`/`PAYMENT_REFUNDED` yazılmak zorunda. **Tetikleyici:** nakit tahsilatın ödeme planına bağlanması.                                                                                                                                                             |
| **Kısmi iadenin ödeme planına ve cari deftere yansıması**          | Defter artık fiilî tutarı yazıyor; plan ve cari hâlâ taksit granülerliğinde (§19/§22). Taksitte kümülatif `refundedAmount` + tavan + kısmi cari kaydı birlikte tasarlanmalı. **Tetikleyici:** operasyonda kısmi iade talebi — aynı §19 maddesi.                                                                                                                                                                                                                                                       |
| **İade sonrası sağlayıcı ↔ yerel durum mutabakatı**               | Sanal POS iadesinde köprü **aynı transaction'da** (hata yutulmuyor): defter yazılamazsa iade işaretlemesi de geri sarılır, yani yerel durum ile defter birlikte eski hâlinde kalır — ama sağlayıcıda para gitmiş olabilir. Doğru çözüm, ödeme tarafındaki `getOrderState` deseni (bkz. Duffel, §61.5): iade öncesi/sonrası sağlayıcıya sorup yerel duruma karar vermek. **Tetikleyici:** ilk "iade edildi mi edilmedi mi" vakası.                                                                     |
| **İadenin iptale (storno) bağlanması**                            | Değişmedi (§47.6): iptal belgeyi hükümsüz kılar, parayı geri vermez. İkisini tek komutta birleştirmek "iptal ettim" diyen operatöre farkında olmadan para çıkışı yaptırırdı. Artık iade tarafı deftere **yazıldığı** için bağlama zemini hazır: iptal, iade **önerisi** üretebilir. **Tetikleyici:** hasta-yüzü iade ekranı.                                                                                                                                                                         |
| **Ayrı capability (iade yetkisi)**                                | İade hâlâ sıradan `finance` yetkisiyle yapılıyor; damga (§57) ve defter (bu tur) kuruldu, kalan yarı yetki ayrımı. İş paketi 4'ün parçası — kasa farkı onayı, indirim tavanı, storno ile **aynı mekanizma** (capability + eşik + bekleyen onay), parça parça eklenmemeli.                                                                                                                                                                                                                             |

---

## 67. Rezervasyon iadesi: platform defterinin ters kaydı (tur 20)

§66'nın tek "**tetikleyici: sıradaki tur**" satırı. Beklenen iş, §65'te POS/sanal
POS için yapılanın bir katman yukarısıydı: iade, platform defterinde de kendi
fişini almalı. Ölçüm sırasında bu boşluğun **altında** ikinci bir P0 çıktı — ileri
yolun fişi hiç postlanamıyordu.

### 67.1 P0 — iade platform defterini ters kaydetmiyordu

Tahsilatta (§63'ten sonra) yazılan fiş:

```
B 108 Diğer Hazır Değerler   120,00
    A 601 Yurtdışı Satışlar       20,00   (platform komisyonu)
    A 320 Satıcılar              100,00   (HotelBeds'e borç)
```

`refund-booking-payment` kaydı REFUNDED yapıyor, parayı sağlayıcıdan geri
veriyor — ve **defterde hiçbir şeye dokunmuyordu**. Kalıcı sonuç:

| Hesap   | Defterin dediği                   | Gerçek                                |
| ------- | --------------------------------- | ------------------------------------- |
| **108** | sağlayıcıda 120 TL yolda          | para müşteriye geri gitti, bakiye yok |
| **601** | 20 TL komisyon geliri kazanıldı   | rezervasyon iptal, gelir yok          |
| **320** | HotelBeds'e 100 TL borç           | rezervasyon iptal, borç (cezası hariç) yok |

Üçü birlikte mizanı, bilançoyu ve gelir tablosunu şişiriyordu; ne alarm ne rapor
vardı — iade "başarıyla tamamlandı" diye kapanıyordu.

Yazılan fiş (`PLATFORM_BOOKING_REFUNDED` + `PlatformBookingRefundedRule`):

```
B 610 Satıştan İadeler (-)     20,00   (geri alınan komisyon)
B 320 Satıcılar                70,00   (serbest kalan tedarikçi borcu)
B 689 Diğer Gider ve Zararlar  30,00   (sağlayıcının alıkoyduğu ceza)
    A 108 Diğer Hazır Değerler    120,00   (müşteriye geri giden para)
```

Üç karar ve gerekçeleri:

- **Storno değil, yeni fiş.** §65'in kuralı burada da geçerli: para o gün
  gerçekten alınmıştı (tahsilatı tarihinden silmek o günün 108 bakiyesini yanlış
  yapar) ve iade aylar sonra gelebilir → kapanmış dönemi yeniden yorumlar.
- **601 değil 610.** Komisyonu 601'in borcuna yazmak, iade sonraki döneme
  düştüğünde o dönemin **brüt hasılatını eksiye** çekerdi. 610 bu iş için var ve
  `IncomeStatementCalculator` 61x'i "satış indirimleri" bölümüne alıyor → net
  satış doğru hesaplanıyor. Hesap şablonda **zaten vardı**, hiç kullanılmıyordu.
- **Ceza 689'da.** Müşteriye tam iade yapıldığı için cezanın karşılığında bir
  hizmet yok: hasılatla ilişkilendirilemez, satışların maliyeti de değil.
  Şablonda hazır olan tek uygun hesap 689. 659'a (Diğer **Olağan** Gider ve
  Zararlar) taşımak tek satır ama şablona yeni hesap eklemek mevcut kiracılarda
  o hesabın **olmaması** demek → sapma kararı (kural 11), bu turda yapılmadı.

### 67.2 P0 — tahsilat fişi hiç postlanamıyordu (320 carisiz)

İade satırını yazarken fark edildi: `320 Satıcılar` hesabı şablonda
`requiresParty: true` taşıyor ve `post-financial-event` her satırda bunu
zorluyor (`PartyRequiredForAccountException`). `PlatformBookingSettledRule` ise
320 satırını **carisiz** üretiyordu. Yani sağlık turizmi komisyon defteri
kurulduğundan beri (2026-08-08) ileri fiş de **hiç yazılamazdı**: olay defterine
düşer, postlama adımında patlar, olay sonsuza dek fişsiz kalırdı.

Neden sessiz kaldı: `requiresParty` **satırın** değil hesabın özelliği ve kontrol
posting handler'ında — kuralın birim testi kuralı izole çağırdığı için yeşil
kalıyordu. §61'in kuralının aynadaki hâli: _bir kuralı test etmek, ürettiği fişin
**postlanabildiğini** kanıtlamaz._

Ölçüm (canlı DB, salt okuma): `financial_events` **0 satır**, `booking_payments`
**0 satır**, `journal_entries` **0 satır**, `accounts` **0 satır**. Yani kusur
henüz veri bozmamış — ilk gerçek rezervasyonda kesin. Geriye dönük onarım
gerekmiyor, düzeltme yalnız ileriye dönük.

Düzeltme: iki gövde de `supplierPartyId` taşıyor (**zorunlu**, `z.uuid` ile yazma
kapısında), cari olay yazılmadan önce `EnsurePartyCommand` ile garanti ediliyor
(`originType: EXTERNAL`, `originId: HOTELBEDS | DUFFEL`, `role: SUPPLIER`).
Tedarikçi **tahsilat kanalından bağımsız**: parayı iyzico ya da Stripe tahsil
eder, borç rezervasyonu açan sağlayıcıya aittir. Eşleme
`satisfies Record<BookingPaymentTypeValue, …>` ile kuruldu → dördüncü bir
rezervasyon tipi eklenirse tedarikçisi **derleme zamanında** sorulur.

### 67.3 P1 — üç sağlayıcının iptal ekonomisi atılıyordu

İptal yanıtında sağlayıcının alıkoyduğu tutar geliyor ve **hiçbiri okunmuyordu**:

| Sağlayıcı             | Yanıtta gelen                       | Eski durum                                  |
| --------------------- | ----------------------------------- | ------------------------------------------- |
| Transfer (HotelBeds)  | `cancellationAmount`                | `?? 0` ile "ceza yok"a çevrilip atılıyordu  |
| Uçuş (Duffel)         | `refund_amount` + `refund_currency` | sonuç tipi üretiliyor, **hiç tüketilmiyor** |
| Otel (HotelBeds)      | yanıt gövdesi                       | `Promise<void>` — gövde hiç parse edilmiyor |

§63'ün kuralı bir katman yukarıda: _tedarikçinin fiilen ücretlendirdiği tutar
yanıtta geliyorsa defter onu yazar._ Üçü de artık iptal komutunun yanıtında
taşınıyor (`{reference, retained}`) ve iade komutuna **zorunlu alan** olarak
giriyor — opsiyonel bırakmak, üç araçtan birinde unutulduğunda derleyicinin
susması demekti (§57'nin `initiatedById` kararının aynısı).

Uçuşta çevrim ters: Duffel **iade edeceği** tutarı bildirir →
`alıkoyulan = sipariş tutarı − iade`. Para birimi uyuşmazsa ya da iade sipariş
tutarını aşarsa çıkarma yapılmaz, sonuç "bilinmiyor" olur.

**Otelde ceza bilinçli olarak OKUNMUYOR.** İptal yanıtındaki
`totalNet`/`pendingAmount` alanlarının iptal sonrası semantiği (kalan ceza mı,
orijinal tutar mı) canlı/sandbox yanıtına karşı doğrulanmadı. Yanlış yorumun
bedeli asimetrik: orijinal tutarı ceza sanmak **her iptalde maliyetin tamamını
zarar yazıp tedarikçi borcunu hiç düşürmemek** demekti. Doğrulanmamış bir alanın
anlamı uydurulmadı → §68'de tetikleyicisiyle duruyor.

### 67.4 "Bilinmiyor" ile "sıfır" aynı şey değil

Tek kural, tek yerde (`toSupplierRetainedCost`): tutar gelmediyse, sayı değilse,
negatifse ya da para birimi tanınmıyorsa sonuç `null`'dır. `0` döndürmek defterde
_"sağlayıcı ceza almadı, tedarikçi borcunun tamamı serbest kaldı"_ **beyanı**
olurdu ve bu beyanın dayanağı yok. `0.00` ise meşru bir cevaptır (ücretsiz
iptal) ve alarm üretmez.

Tuzak ölçüldü: `Currency.create(null)` boş girdiyi **TRY** sayıyor (varsayılan).
Kapı para birimi kontrolünü tutarın önüne almasaydı, para birimsiz bir ceza
sessizce TRY'ye yazılırdı.

Ceza bilinmiyorken ters kayıt **yine yazılıyor**, cezasız varsayımıyla ve WARNING
ile: yazmamak 108'i (giden para), 601'i (kazanılmamış komisyon) ve 320'yi (artık
olmayan borç) **birlikte** yanlış bırakırdı; cezasız varsayım yalnız 320'yi eksik
bırakıyor. Üç hesap yerine bir hesap — ve varsayımın bedeli sesli.

### 67.5 Yazılamayacak olay yazılmaz

İki hâlde ters kayıt gövdesi **hiç üretilmiyor** (CRITICAL + olay yok):
komisyon negatifse (maliyetin altında satış → ileri fiş de hiç yazılmamıştı,
olmayan fişi ters kaydetmek 108'i eksiye düşürürdü) ve ceza tedarikçi maliyetini
aşıyorsa (320 negatife düşerdi). Gerekçe olay defterinin kendi doğasında: gövde
append-only, **düzeltilemez** — postlanamayacak bir olay yazmak her süpürmede
aynı hatayla patlayan ölümsüz bir kayıt bırakır.

Aynı mantığın devamı: sağlayıcı iade çağrısı **başarısız olursa** ters kayıt
yazılmıyor. Paranın geri gittiği doğrulanamamışken "iade edildi" fişi atmak
yanlış beyan olurdu; atmamak 108/601/320'yi eski hâlinde bırakıyor. İkisi de
yanlış, ama ikincisi **bilinen** bir eksiklik → CRITICAL ile insana gidiyor.

### 67.6 İki küçük bulgu

- **İadenin kendi tarihi hiçbir yerde durmuyordu.** `markRefunded` yalnız durum
  değiştiriyordu; §65 "iade kendi tarihi olan ayrı bir ekonomik olaydır" dediği
  hâlde o tarih ödeme kaydında yoktu. `refunded_at` kolonu eklendi (kural 7'nin
  "event + kolon"unun kolon yarısı; olay tarafı artık `PLATFORM_BOOKING_REFUNDED`).
- **İade nedeni `failure_reason`'ın üzerine yazılıyordu.** FAILED → REFUNDED
  yolunda — yani her iki olgunun da değerli olduğu tek yolda — "book neden
  başarısız oldu" izi iade metniyle siliniyordu. `refund_reason` ayrı kolon.

### 67.7 Köprü tek yerde: iki yön bir servis

§65'in kuralı (_"sonradan sonuçlandırma yolları ileri yoldaki her türü taşımak
zorundadır"_) bu turda baştan uygulandı: ileri (`SETTLED`) ve geri (`REFUNDED`)
yön **aynı** `BookingPlatformLedgerService`'ten geçiyor
(`kind: 'SETTLED' | 'REFUNDED'`). Ayrı yerlere koymak, POS köprüsünde ölçülen
hatayı tekrar üretmenin en kısa yolu olurdu: platform defteri hedefi ve tedarikçi
carisi çözümlemesini biri kazanır, diğeri kaybeder.

### 67.8 Kilit yine işini yaptı

§63'te yazdığım `booking-payment.command.repository.spec.ts` mapping kilidi, dört
yeni kolonu (`supplier_retained_*`, `refunded_at`, `refund_reason`) mapping'e
eklemeden önce **adıyla** düşürdü. Kural 9'un tuzağı bu turda tekrarlanmadı —
çünkü geçen tur reçeteyi yazmıştım.

| Ölçüm          | Sonuç                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit` | api **0**, web **0**                                                                                       |
| Test           | **228 suite / 1518 test** yeşil (+3 suite, +46 test: ters kayıt kuralı 11, köprü servisi 7, iptal cezası çevrimi 7, entity 9, iade handler 5, uçuş iptali 6, gövde kapısı 3) |
| Migration      | **1 yeni** (`booking_payment_refund_ledger`: enum değeri + 4 kolon) → bekleyen **5**                       |
| Canlı veri     | 0 olay / 0 fiş / 0 rezervasyon ödemesi → §67.2 geriye dönük onarım gerektirmiyor                           |

---

## 68. Bilinçli yapılmayanlar — rezervasyon iadesi turu

| Konu                                                           | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Otel iptal cezasının okunması**                              | HotelBeds iptal yanıtındaki `totalNet`/`pendingAmount`'ın iptal sonrası semantiği doğrulanmadı; orijinal tutarı ceza sanmak maliyetin tamamını zarara yazardı (§67.3). Bugün her otel iptalinde ceza "bilinmiyor" → cezasız ters kayıt + WARNING. **Tetikleyici:** sandbox'ta ücretli bir iptal yapılıp yanıt gövdesi doğrulanınca — değişiklik tek satır (`cancelBooking` gövdeyi parse edip `retained` doldurur, `toSupplierRetainedCost` zaten hazır).                                                                                                                                                      |
| ~~**Platform defteri için "eksik kalanlar" sorgusu + backfill**~~ **✅ §69** | Köprü iki yönde de best-effort (gerekçe §67.7) ve kural 4 yutulan kritik iş için alarmın yanında **telafi yolu** istiyor; POS'ta bu çift var (`find-unbridged-pos-transactions` + `backfill-pos-accounting-events`), rezervasyon tarafında **hiçbir yönde yok** (ileri yönde de yoktu, bu tur simetrik hâle geldi). Ölçülen engel: mevcut `FindExistingFinancialEventRefsQuery` düz `string[]` (yalnız `sourceRefId`) döndürüyor, rezervasyonda ise **tek `bp.id` iki olaya** karşılık geliyor (settled + refunded) → "köprülenmiş mi" sorusu bu sorguyla ayırt edilemez. Karar hazır: dedupeKey varlığına bakan ayrı bir sorgu (anahtarlar yön başına ayrı). **Tetikleyici: sıradaki tur.** |
| **İptal cezasının satış fiyatından mahsubu**                   | Müşteriye hâlâ **tam** satış tutarı iade ediliyor; ceza platformun zararı. Bu bir **fiyat politikası** kararı (hasta-yüzü sözleşme metni + iptal koşulu ekranı), para güvenliği kusuru değil — ve artık bedeli defterde 689'da **ölçülebilir**. **Tetikleyici:** iptal politikasının ürün kararı olarak verilmesi.                                                                                                                                                                                                                                                                                             |
| **İade kuru ile tahsilat kurunun farkı (108 kalıntısı)**       | iyzico tahsilatı TRY çekiyor, fiş `saleCurrency`'de yazılıp posting anında çevriliyor (Model A). İade de TRY gidiyor ama **o günün** kuruyla; ters kayıt yine satış para biriminden yazıldığı için 108'de kur farkı kadar kalıntı kalır (646/656'ya girmesi gerekirdi). §50'nin yabancı para kalemiyle **aynı** mekanizma; tek tek kapatılmamalı. **Tetikleyici:** kambiyo farkı turu.                                                                                                                                                                                                                       |
| **659 vs 689 (iptal cezasının hesabı)**                        | 689 şablonda hazır olduğu için seçildi; 659 "olağan" olduğu için aracılık işinde kavramsal olarak daha doğru ama şablona yeni hesap eklemek mevcut kiracılarda o hesabın olmaması demek → hesap planı sapma raporu (kural 11) ile birlikte ele alınmalı. **Tetikleyici:** şablon sapma turu.                                                                                                                                                                                                                                                                                                                 |
| **İkinci tahsilatın (çift çekim) deftere girmemesi**           | Ölçüldü: `handleUnclaimedPayment` ikinci çekimi iade ediyor ve alarm basıyor ama **iki yönde de olay yazmıyor**. Bakiye etkisi sıfır (para geldi, gitti) → mizan doğru; ama 108'in sağlayıcı ekstresiyle **satır bazlı** mutabakatı iki eşleşmeyen hareket görür. Daha keskin hâli: iade **başarısız** olursa (CRITICAL dalı) para bizdedir ve defterde hiç görünmez — tutar belli, borç kaydı yok. Doğru çözüm iki olay (tahsilat + iade) ya da bir emanet hesabı (379); ikisi de 108 ↔ sağlayıcı ekstresi mutabakatıyla birlikte tasarlanmalı. **Tetikleyici:** 108 → 102 aktarım/mutabakat turu. |
| **Rezervasyon iptalinin kendi yetkisi**                        | Değişmedi (§66): iade sıradan `finance` yetkisiyle yapılıyor, hasta kendi rezervasyonunu AI üzerinden iptal edebiliyor (sahiplik kontrolü var). Yetki ayrımı iş paketi 4'ün parçası, parça parça eklenmemeli.                                                                                                                                                                                                                                                                                                                                                                                                 |

---

## 69. Platform defterinin telafi yolu (tur 21)

§68'in "**tetikleyici: sıradaki tur**" satırı: rezervasyon köprüsü iki yönde de
best-effort yazıyor ama CLAUDE.md finans kuralı 4 yutulan her kritik iş için
**yeniden deneme ya da backfill + "eksik kalanlar" sorgusu** istiyor. POS'ta bu
çift vardı (`find-unbridged-pos-transactions` + `backfill-pos-accounting-events`),
rezervasyon tarafında **hiçbir yönde** yoktu — §67 geri yönü eklerken boşluk
simetrik hâle gelmişti, bu tur ikisini birden kapatıyor.

### 69.1 Ölçülen engel: tek kaynak kaydı, iki olay

§68'de not edilen engel doğrulandı: mevcut `FindExistingFinancialEventRefsQuery`
düz `string[]` (yalnız `sourceRefId`) döndürüyor. POS'ta bu yeterliydi çünkü
ters kayıt **kendi satırıdır** ve kendi id'siyle köprülenir (§65 kararı). Rezervasyonda
ise tahsilat ve iade **aynı** `bookingPaymentId`'yi kaynak gösterir → referansa
bakan sorgu iki yönü ayırt edemez ve tahsilatı yazılmış bir rezervasyonun
**eksik iade fişini "köprülenmiş" sayardı**. Sessiz sonuç: 108 giden parayı,
601 kazanılmamış komisyonu, 320 artık olmayan borcu göstermeye devam eder ve
eksiklik hiçbir listede görünmez.

Çözüm `dedupeKey` varlığına bakan ayrı bir sorgu
(`FindExistingFinancialEventDedupeKeysQuery`): anahtarlar yön başına ayrı
olduğu için soru doğru cevaplanıyor. Mevcut referans sorgusu **genişletilmedi**
— POS/fatura onu `sourceRefId` semantiğiyle kullanıyor ve tipini değiştirmek
üç çağıranı aynı anda yeniden yorumlamak demekti.

`clinicId` süzgeci bu sorguda **güvenlik içindir**, performans değil: anahtar
global tekil olduğu için kiracı kapsamı olmadan "bu anahtar var mı" sorusu
başka bir kiracının defteri hakkında bilgi sızdırırdı.

### 69.2 Yetki: defter platformun, rezervasyon kliniğin

Hem rapor hem telafi, yetkiyi **platform kiracısı** üzerinden değerlendiriyor
(`canAccessClinicFinances(platformClinicId)`), rezervasyonun kliniği üzerinden
değil. Gerekçe §63/§67 ile aynı: klinik bu işleme finansal olarak taraf
değildir ve komisyon marjı kliniğin verisi değildir. `filter.clinicId` yalnız
**daraltmadır**.

### 69.3 Aday kuralı: hangi kayıt hangi fişi borçlu?

| Kayıt | Borçlu olduğu fiş(ler) |
| --- | --- |
| Rezervasyonu açılmış (`bookingReference` dolu) | `SETTLED` |
| Açılmış **ve** iade edilmiş (`refundedAt` dolu) | `SETTLED` **+** `REFUNDED` |
| Rezervasyonu hiç açılmamış (PAID → FAILED → REFUNDED) | **hiçbiri** |

Üçüncü satır kritik: `markBooked` hiç çalışmadıysa tedarikçi borcu hiç
doğmamıştır ve o parayla ilgili tek gerçek, tahsilatın iade edildiğidir.
Aday kuralı repo'nun `where` cümlesinde yaşıyor — derleyiciye ve handler
testlerine görünmez — bu yüzden bir **kilit testi** yazıldı: süzgeç düşerse
telafi turu hiç doğmamış bir borcu deftere yazardı. Kilit sınandı (süzgeç
kaldırılınca iki test kırmızı).

İkinci satır §65/§67'nin kuralının tekrarıdır: iade edilmiş bir kayıtta **iki
fiş de** beklenir, çünkü tahsilat o gün gerçekten olmuştu ve iade onun
storno'su değildir.

Pencere `paidAt` **veya** `refundedAt`'e uygulanıyor: tek tarihe bakmak, geçen
dönem tahsil edilip bu dönem iade edilen bir rezervasyonun eksik fişini
görünmez yapardı.

### 69.4 Köprü ikiye ayrıldı: `record` / `recordBestEffort`

POS köprüsünün deseni uygulandı. İleri/geri akışlar `recordBestEffort`
kullanıyor (para hareket etmişken muhasebe hatası işlemi geri almamalı); telafi
komutu `record` kullanıyor çünkü **hangi hareketin neden yazılamadığını satır
satır** bildirmek zorunda.

Bu ayrım bir ayrımı daha zorunlu kıldı: "**yazılamadı**" ile "**yazılamaz**"
aynı şey değil. İkincisi (§67.5'teki iki hâl — negatif komisyon, maliyeti aşan
ceza) yeniden denemeyle çözülmez, bir muhasebe kararı bekler. Artık adıyla
fırlatılıyor (`BookingLedgerNotPostableException`) ve telafi yanıtında gerekçe
metni taşınıyor; operatör "tekrar dene" ile "karar ver"i ayırt edebiliyor.
Alarm metni de tek yerde toplandı: `recordBestEffort` bu istisnayı tanıyıp
sebebini yazıyor, genel metni değil.

### 69.5 Telafi turunun kuralları

- **Her hareket kendi başına** köprülenir: biri patlarsa tur durmaz, kalanlar
  yazılır, başarısızlar gerekçesiyle döner.
- **Yön satırdan okunur** (§65'in dersi): hepsini "tahsilat" olarak yazmak,
  iade edilen parayı deftere ikinci kez gelir gibi geçirirdi.
- Kayıt **Command Repo'dan** yüklenir: okunan veri bir yazma kararını besliyor
  (fişin tutarları), Query Repo'nun replica'dan dönme ihtimali bayat tutarla
  fiş yazmak demekti.
- **Tahsilat kanalı (`paidProvider`) boşsa fiş uydurulmaz** — o alan fiş
  açıklamasını besliyor; varsayılan atamak "hangi kanaldan tahsil edildi"
  sorusuna uydurma cevap yazmaktır. Satır gerekçesiyle başarısız döner.
- Mükerrer yazma riski yok: liste zaten yazılmış olanları dışlıyor **ve** her
  olay `dedupeKey` ile yazılıyor — birbirinden bağımsız iki emniyet.

### 69.6 Uçlar

Telafi yolu çağrılamıyorsa yoktur (kural 10'un aynı mantığı: okunmayan bayrak
süstür). İkisi de HTTP'ye açıldı:

| Uç | Yetki |
| --- | --- |
| `GET /health-tourism/booking-payments/unbridged?from&to[&clinicId]` | `bookingpayment:read` + platform defteri erişimi |
| `POST /health-tourism/booking-payments/backfill-ledger` | `bookingpayment:create` + platform defteri erişimi |

Pencere **zorunlu**: "hepsini dene" demek operatörün hangi dönemi onayladığını
belirsiz bırakır; rapor da bir mutabakat aracıdır ve dönem bazında çalışır.

| Ölçüm          | Sonuç                                                                                  |
| -------------- | -------------------------------------------------------------------------------------- |
| `tsc --noEmit` | api **0**, web **0**                                                                   |
| Test           | **231 suite / 1540 test** yeşil (+3 suite, +22 test: sorgu 8, telafi 8, aday kilidi 4, köprü 2) |
| Migration      | yeni yok → bekleyen **5**                                                              |

---

## 70. Bilinçli yapılmayanlar — telafi yolu turu

| Konu | Gerekçe |
| --- | --- |
| **Telafi turunun zamanlanmış işe bağlanması** | Bugün elle tetikleniyor (uç + operatör). POS tarafı da öyle; ikisi de aynı kararı bekliyor: "eksik fiş" raporu bir **alarm** mı yoksa **otomatik onarım** mı? Otomatik onarım, muhasebe kararı bekleyen kalemleri (negatif komisyon, maliyeti aşan ceza) her turda yeniden deneyip alarm gürültüsü üretir. **Tetikleyici:** zamanlanmış finans işlerinin (§5 kuralı) gözden geçirildiği tur — POS ve rezervasyon birlikte. |
| **Fişlenmemiş olay süpürmesiyle tek rapor** | İki ayrı boşluk iki ayrı listede: olay **hiç yazılmamış** (bu tur) ve olay yazılmış ama **fişe dönmemiş** (§34 süpürmesi). Operatör için ikisi tek soru ("defterde ne eksik?") ama kaynakları ve çözümleri farklı. Birleştirmek ancak ortak bir "defter sağlığı" ekranıyla anlamlı. **Tetikleyici:** finans mutabakat ekranının tasarlandığı tur. |
| **`FindExistingFinancialEventRefsQuery`'nin dedupeKey'e taşınması** | İki sorgu artık yan yana duruyor (referans + anahtar). Referansa bakan sorgunun POS/fatura çağıranları için anahtar semantiği **daha doğru** olurdu (kaynak kayıt başına birden çok olay ihtimali her modülde var), ama üç çağıranı aynı anda yeniden yorumlamak bu turun işi değil. **Tetikleyici:** üçüncü bir modül aynı engele düştüğünde. |
| **Telafi yetkisinin ayrılması** | Platform defterini onarmak `bookingpayment:create` ile yapılıyor; yüksek etkili finansal işlem ayrı yetki ister (kural 7). İş paketi 4'ün parçası — storno, dönem açma, iade tavanı ile **aynı mekanizma**, parça parça eklenmemeli. |
| **Telafi turunun kendi damgası** | Kim, ne zaman, kaç fiş yazdı: yanıt dönüyor ama kalıcı iz yok (audit log yazılmıyor). POS telafisinde de yok. Kural 7'nin "event + kolon"u burada **olay** tarafını istiyor. **Tetikleyici:** iş paketi 4 (damga ve yetki aynı turda). |
| **Ham erteleme listesinin "durum" sütununun güvenilirliği** | `11-eksik-kalanlar.md` bu turda üretildi (`pnpm finans:eksik`, 151 kalem) ama durum sütunu **yalnız kaynak tabloda işaretlenmiş** kapanışları görüyor: bir kalem kapandığında bunu kendi §-tablosuna yazmak bir **alışkanlık** meselesi ve geçmiş turlarda düzenli yapılmamış (bugün 10 kapalı görünüyor, gerçek sayı daha yüksek). Otomatik eşleştirme denenmedi: başlık metinlerinden "kapandı mı" çıkarmak yanlış pozitif üretir ve yanlış kapatılan bir kalem, listenin hiç olmamasından kötüdür (§55). **Tetikleyici:** erteleme listesinin kendi denetim turu (§55/§57'nin üçüncüsü) — o turda her açık kalem tek tek ölçülür ve kapananlar kaynakta işaretlenir. |

---

## 71. Yabancı para: fişin para birimi, kilitli kur ve yayın olmayan gün (tur 22)

**Kapsam.** Kontrol listesinin "para birimi her satırda açık mı (fonksiyonel +
orijinal)?" ve "kur anı" maddeleri bugüne dek kendi turunu almamıştı. Son dört
tur (§61–§69) rezervasyon/ödeme para yolunu açtı ve **orada yabancı para var**:
HotelBeds EUR fiyatlıyor, Stripe EUR/USD çekiyor, Duffel kendi cinsinden
fiyatlıyor. Defterin fonksiyonel parası ise TRY (Model A). Bu tur o kesişimi
denetledi.

**Ölçüm (canlı, salt-okunur).** `journal_lines` 0 satır, `booking_payments` 0
satır, `invoices`/`payments` 0 satır, `clinic_finance_settings` **0 satır**
(yani fonksiyonel para her klinikte belgelenmiş varsayılan TRY). Bulguların
hepsi **gizli** (latent): geçmiş veri düzeltme kararı gerektirmiyor, düzeltme
ileri yönlü.

### 71.1 P0 — 108 hesabı, hastanın hiç ödemediği bir tutarı gösteriyordu

Satış fiyatı sağlayıcı teklifinden türetilir ve **EUR** olabilir. `initiate`
akışı iki ödeme linki üretir:

- **Stripe** → satış cinsinden (`saleAmount`, ör. 120 EUR),
- **iyzico** → **TRY** (`tryAmount = saleAmount × fxRate`, kur link üretilirken
  alınır ve kayda `fx_rate` olarak **kilitlenir**).

Hasta iyzico linkini öderse platforma giren para 4200 TRY'dir. Ama defter
köprüsü olayı **her zaman satış cinsinden** yazıyordu (`currency:
bp.saleCurrency`, `saleAmount: 120.00`). Posting handler yabancı gövdeyi
görünce kuru **dışarıdan yeniden türetiyor** (TCMB, olay tarihi) ve satırları o
kurla çeviriyordu. Sonuç:

```
Fiilen giren:   4200,00 TRY   (iyzico, kilitli kur 35,00 ile çekildi)
Deftere giren:  120,00 EUR × TCMB(olay günü) = ör. 4260,00 TRY
```

108 Diğer Hazır Değerler, gelmemiş 60 TRY'yi gösteriyor; fark sessizce
**komisyona** biniyor (601 şişiyor) ve 108'in sağlayıcı ekstresiyle mutabakatı
**hiçbir zaman** tutmuyor. Hata sessiz: fiş kendi içinde dengeli olduğu için
Σborç = Σalacak kontrolü de, dönem kapısı da, cari kuralı da uyarmıyor.

**Düzeltme — gövde, paranın fiilen hareket ettiği cinsten yazılır.**
`BookingPayment` üç yeni okuma noktası kazandı:

| Üye | Ne yapar |
| --- | --- |
| `amountChargedBy(provider)` | O kanalın hastadan **fiilen çektiği** tutar (iyzico → `tryAmount` TRY, Stripe → `saleAmount` satış cinsinden) |
| `receivedAmount` | Sahiplenilmiş kanalın çektiği tutar; kanal yoksa **varsayılmaz**, adıyla hata |
| `settledLedgerAmounts` / `refundedLedgerAmounts` | Fişin sayıları, **fiş para biriminde** + orijinal temel (kur, orijinal cins, orijinal tutarlar) |

Kur **kayıttaki kilitli kurdur**, dışarıdan yeniden türetilen değil: hastaya o
kurla TRY çekilmişti. Böylece 108 kuruşu kuruşuna fiilen giren parayı taşıyor
ve posting ikinci bir kur kaynağına hiç başvurmuyor (`getRate` çağrılmıyor —
testle kilitli).

Stripe yolunda davranış **değişmedi**: para satış cinsinden girdiği için gövde
de satış cinsinden yazılır ve çevrimi posting yapar (olay tarihli TCMB kuru).
İki kur kaynağı birbirinin alanına girmiyor.

**`amountChargedBy` neden parametreli:** çift-çekimde (iki link de ödenirse)
iade edilen kanal, kaydın **sahiplenilmiş** kanalı değildir. `receivedAmount`
o soruyu yanıtlayamaz; ayrımı tek yerde tutmak için ikisi birlikte duruyor.
Bu ayrım daha önce **üç yerde** ayrı ayrı yazılıydı (tahsilat onayının
çift-çekim iadesi, iptal iadesi, defter köprüsü) — biri değişip diğeri kalsa
sağlayıcıya yanlış tutar gider ya da defter gelmeyen parayı yazar.

### 71.2 P0 — `tryAmount`, satış para birimiyle etiketlenmiş bir `Money`'ydi

```ts
this._tryAmount = Money.fromTrusted(data.tryAmount, currency.value); // currency = EUR!
```

`tryAmount` adı gibi TRY'dir (iyzico o tutarı TRY çeker) ama `Money` **EUR**
etiketi taşıyordu: 4200 TRY değerinde bir "EUR". Bugün üretimde yanlış sonuç
vermiyordu çünkü iki çağıran da yalnız `.value.toNumber()` okuyordu — ama
`Money`'nin para birimi guard'ı bu noktadan sonra **koruma değil tuzak**: iki
"EUR" sorunsuz toplanır, biri aslında TRY'dir ve hiçbir kontrol uyarmaz.
71.1'in düzeltmesi bu tutarı fiş satırına taşıdığı için etiket artık
**yük taşıyor**.

**Düzeltme + yeni kapı.** Etiket TRY'ye çevrildi; ayrıca `Money`'ye
**`convert(rate, to)`** eklendi:

```ts
public convert(rate: number | Decimal, to: CurrencyType): Money
```

Gerekçe, `multiply`'ın bilerek para birimini **koruması**: birim fiyat × adet
aynı cinstendir. Kurla `multiply` edip etiketi bırakmak tam yukarıdaki tuzağı
üretir. Çevrim artık adını söyleyen tek bir kapıdan geçiyor; yuvarlama orada
yapılıyor (çevrilmiş tutar daima bir **satır tutarıdır**) ve sıfır/negatif/NaN
kur `InvalidFxRateException` ile reddediliyor — "kur yoksa 1 kabul et" dengeyi
bozmadığı için hiçbir kontrol tarafından yakalanmaz.

### 71.3 Komisyon **artık** olmak zorunda — yoksa fiş dengesiz kalır

Tahsilat fişinin denge koşulu `commission + supplier = sale`. Üç tutarı ayrı
ayrı çevirmek bu eşitliği kuruş düzeyinde bozar:

```
kur 2,5    maliyet 1,01 EUR → 2,525 → 2,53
           komisyon 1,01 EUR → 2,525 → 2,53      toplam 5,06
           satış    2,02 EUR → 5,05              ✗ 1 kuruş dengesiz
```

Dengesiz gövde posting tarafından reddedilir ve olay defteri append-only
olduğu için **sonsuza dek fişsiz** kalır (telafi turu her seferinde aynı
hatayla patlar). Bu yüzden çevrim yalnız **tedarikçi payına** uygulanıyor,
komisyon `sale − supplier` olarak türetiliyor: eşitlik tanım gereği sağlanır.
İade tarafında aynı kural dört büyüklük için geçerli — çevrim `posted` ve
`retainedLoss`'a uygulanıyor, komisyon `refundAmount − posted` artığı.

### 71.4 320 satırının EUR borcu: satır-seviyesi yabancı para temeli

71.1'den sonra fiş TRY cinsinden yazılıyor. Ama 320 satırı sağlayıcıya
**EUR** borçtur — HotelBeds'e EUR ödenecek. TRY tutarını tek başına yazmak
tedarikçi mutabakatını kendi cinsinden imkânsız kılar.

`DraftJournalLine` bu yüzden kendi yabancı para temelini taşıyabiliyor
(`originalDebit`/`originalCredit`/`originalCurrency`/`fxRate`) ve posting
handler onu satıra geçiriyor. Hangi satırlar taşır:

| Fiş | Taşıyan satırlar | Taşımayan |
| --- | --- | --- |
| Tahsilat | 320 (tedarikçi borcu, EUR) | 108 (fiilen giren TRY), 601 (TRY artık) |
| İade | 320 (düşen borç), 689 (ceza) | 108 (giden TRY), 610 (TRY artık) |

**Çifte temel yasak.** Fiş-seviyesi çevrim (gövde yabancı parada → posting
olay tarihli kurla çevirir) ile satır-seviyesi temel (gövde fonksiyonel
parada → kuralın kilitli kuru) aynı satırda buluşursa `original*` kolonlarını
iki ayrı kaynak yazar ve hangi kurun geçerli olduğu belirsizleşir. **Yanlış
kurla saklanmış bir orijinal tutar, hiç saklanmamış olmasından kötüdür** →
`ConflictingFxBasisException`. Bugün kurgu gereği karşılaşılmaz (kilitli kurlu
kural gövdesini fonksiyonel parada yazar); kontrol, ikisinin bir gün aynı
kuralda buluşmasını sessiz bırakmamak için duruyor.

**Gövde temeli yarım gelemez.** Yazma-anı şeması `originalCurrency + fxRate +
orijinal tutarlar` üçlüsünü (iadede dörtlüsünü) "ya birlikte ya hiç" olarak
zorluyor: gövde append-only, kur yazılıp orijinal tutar atlanırsa 320'nin EUR
karşılığı bir daha kurtarılamaz. Kur ölçeği de kapıda: `Decimal(12,6)`,
işaretsiz, sıfırdan büyük.

### 71.5 P1 — TCMB'nin yayın yapmadığı gün, kur **hiç** çözülemiyordu

TCMB hafta sonu ve resmî tatillerde kur yayınlamaz: o güne ait dosya yoktur
(404). Eski sürüm tek güne bakıyordu → statik env sağlayıcıya düşüyordu →
**o da yapılandırılmamış**:

| Dosya | `FX_EUR_TRY` |
| --- | --- |
| `envs/.env.example` | boş (şablon) |
| `envs/.env.development` | **`none`** → `Number('none')` = NaN → hata |
| `envs/.env.production` | **anahtar hiç yok** |

Sonuç: **cumartesi gerçekleşen her yabancı para olayı fişlenemiyordu.** Üstelik
bu, sağlık turizminde en yoğun günlerden biri. Alarm basılıyor (köprü
best-effort) ama telafi turu da aynı hatayla her seferinde patlıyor — kural
4'ün istediği "yeniden deneme" burada işe yaramıyor, çünkü sorun geçici değil.

**Düzeltme.** Yayın olmayan gün için **en çok yedi gün geriye yürünüp son
yayınlanan kur** kullanılıyor. Bu hem pratik hem mevzuata uygun yol: o gün
için yayınlanmış kur yoksa son yayınlanan kur esas alınır. Üç ayrıntı:

1. **Sınır var (7 gün).** Sınırsız geriye yürümek, erişim/yapılandırma sorununu
   aylar öncesinin kuruyla sessizce fişletirdi; kur eskidikçe tutar sapar ve
   kimse fark etmez. Sınır aşılırsa hata yükselir (fallback → alarm).
2. **Geriye yürüme yalnız yayın yokluğunda.** Dosya indirilebildiği hâlde para
   birimi bültende yoksa (desteklenmeyen birim) geriye yürümek sorunu çözmez:
   sekiz ağ çağrısı yapıp aynı yere varır → anında hata.
3. **`today.xml` ilk denemede.** TCMB günlük dosyayı öğleden sonra yayınlar; o
   saate kadar bugünün dosyası da yoktur ve dünün kuruna düşmek gerekir.

### 71.6 Posting handler'ın hiç birim testi yoktu

`post-financial-event.handler.ts` defterin **tek** yazma kapısıdır: dönem
kapısı, cari kuralı, döviz çevrimi, yuvarlama artığının Kambiyo'ya yazılması,
denge kontrolü, numara tahsisi. Bu turda keşfedildi ki dosyanın hiç `.spec`i
yok — çevrim davranışı yalnız `FxConversion`'ın **saf** testiyle kanıtlanıyordu:
kuru kimin çözdüğü, hangi tarihi geçtiği, artığın nereye yazıldığı, artık
tavanının çalıştığı ve carisiz satırın fişi durdurduğu testsizdi.

Altı testlik bir spec yazıldı ve **kırmızıya düşürülerek doğrulandı** (satır
temeli geçişi ile çifte temel reddi kaldırıldığında ilgili iki test düşüyor):

| Test | Kilitlediği davranış |
| --- | --- |
| Fiş-seviyesi çevrim | Kur **olay tarihiyle** çözülür (anlık kur değil), satırlar fonksiyonel paraya düşer, `original*` dolar |
| Yuvarlama artığı | Artık 656/646 Kambiyo'ya yazılır, denge korunur |
| Artık **tavanı** | Fark satır sayısı × 1 kuruşu aşarsa "kur farkı" diye defterlenmez → `UnbalancedJournalEntryException` |
| Satır-seviyesi temel | Gövde fonksiyonel parada olsa bile `original*` korunur ve posting kur **çözmez** |
| Çifte temel | `ConflictingFxBasisException` |
| Carisiz 320 | Fiş hiç yazılmaz (kuralın birim testi bunu kanıtlayamaz — koşul satır döngüsünde) |

### 71.7 Ölçüldü, el atılmadı

| Bulgu | Neden bu turda değil |
| --- | --- |
| **Fatura ↔ tahsilat arasındaki realize kur farkı** | EUR fatura, fişlendiği günün kuruyla 120'ye borç yazılır; tahsilat başka gün başka kurla 120'yi alacaklar → TRY cinsinden **kapanmayan bir kalıntı** kalır ve bu kalıntı gerçekte bir kambiyo kâr/zararıdır (646/656). Bugün hiçbir kural bunu tanımıyor. Doğru çözüm cari bazında orijinal-cins bakiye takibi ister (hangi fatura, hangi kurla kapandı) — kendi turunu hak eden bir tasarım. **Ölçüm: 0 fatura, 0 tahsilat** → gizli. |
| **Dönem sonu kur değerlemesi** | Yabancı 320/120 bakiyeleri dönem sonunda değerlenmiyor (VUK gereği değerlenmeli). İş paketi 1'in (dönem sonu fiş takımı) parçası olmalı: açılış fişi, GRNI, maliyet aktarımı ile **aynı** komuta bağlı. |
| **`original*` kolonlarını okuyan rapor yok** | Kolonlar yazılıyor (ve storno'da doğru terslenip taşınıyor) ama hiçbir sorgu okumuyor: yabancı para alt defteri / 320'nin EUR mutabakatı raporu yok. Kural 10'un "okunmayan kolon" uyarısı burada **veri** için geçerli değil (izlenebilirlik kaydı), ama raporu olmadan kullanılamaz. |
| **Sağlayıcı kesintisi (108 → 102 + 653)** | 108'e **brüt** yazılıyor; Stripe/iyzico kesintisi ve paranın bankaya geçişi defterde hiç yok. Tasarım dokümanlarında akış tanımlı (`00-mimari.md` §125, `03-onmuhasebe.md` §45) ve 653 hesap planı şablonunda hazır, ama kodda karşılığı yok. §58'deki çift-çekim kalemi de aynı tura bağlı. |
| **Fonksiyonel paranın TRY dışına çıkması** | `clinic_finance_settings` **0 satır** → her klinikte TRY. TCMB adapter'ı TRY olmayan hedefe TRY üzerinden triangüle ediyor ve bu bölme **kayan noktada** yapılıyor. Fonksiyonel para gerçekten değişene kadar ölçülemez bir yol. |
| **Kurun hangi günün bülteninden geldiği fişte durmuyor** | Satır `fxRate`'i taşıyor ama **tarihini** taşımıyor; geriye yürünen günlerde kur istenen günden farklı bir güne aittir. Log'da var, defterde yok. **Tetikleyici:** kur değerlemesi / vergi incelemesi raporu. |

---

## 72. Bilinçli yapılmayanlar — yabancı para turu

| Konu | Gerekçe |
| --- | --- |
| **Realize kur farkının tanınması (646/656)** | §71.7'nin ilk satırı: fatura ile tahsilat arasındaki kur farkı hiçbir hesapta tanınmıyor ve 120'de kapanmayan kalıntı bırakıyor. Çözüm cari bazında orijinal-cins bakiye takibi ister. **Tetikleyici:** ilk yabancı para faturası ya da yabancı cari bakiyesi. |
| **Dönem sonu kur değerlemesi** | İş paketi 1 ile **aynı** komutta tasarlanmalı (açılış fişi + GRNI + maliyet aktarımı). Ayrı eklenirse yıl sonu fişleri iki yerden üretilir. |
| **Yabancı para alt defteri raporu** | `original*` kolonları dolu ama okunmuyor: 320'nin EUR bakiyesini gösteren bir rapor yok. **Tetikleyici:** ilk sağlayıcı mutabakatı (HotelBeds ekstresi). |
| **Sağlayıcı kesintisi + 108 → 102 aktarımı** | 108 brüt duruyor; kesinti (653) ve valör defterde yok. §58'in çift-çekim kalemi de buraya bağlı. **Tetikleyici:** ilk sağlayıcı hesap kapaması (payout) mutabakatı. |
| **`FX_*` env değerlerinin yapılandırılması** | Geliştirmede `none`, üretimde anahtar **hiç yok**. TCMB geriye yürümesi bu yolu artık son çare yaptı ama fallback hâlâ çalışamaz durumda — kur sağlayıcısı tamamen erişilemezse yabancı para fişi yine yazılamaz. **Operasyon kalemi** (koddan bağımsız). |
| **Kur tarihinin fiş satırında saklanması** | Satır `fxRate` taşıyor, kurun **hangi günün bülteninden** geldiğini taşımıyor. Kolon eklemek migration ister ve kur değerlemesi turuyla birlikte tasarlanmalı (o tur zaten aynı kolonlara dokunacak). |
| **Fonksiyonel paranın TRY dışı olması** | Triangülasyon kayan noktada bölüyor; `clinic_finance_settings` 0 satır olduğu için bugün ölçülemez. **Tetikleyici:** ilk TRY-olmayan fonksiyonel paralı klinik. |
| **Çift-çekim iadesinin kendi tutarıyla deftere girmesi** | `amountChargedBy` artık doğru tutarı veriyor ama çift-çekimin iki hareketi (gelen + iade) hâlâ deftere yazılmıyor (§58'de ölçülmüştü). Aynı tura bağlı: 108 ↔ sağlayıcı ekstresi satır mutabakatı. |
| **Dört spec dosyasındaki `unbound-method` lint borcu** | `confirm`/`initiate`/`refund` booking-payment ve `get-vat-declaration` spec'lerinde `expect(obj.method)` kalıbı duruyor (bu turda dokunulmadı; TCMB spec'inde 9 hata sıfırlandı). İş paketi 12 (hijyen). |

---

## 73. Webhook güvenliği: bildirim hangi kayda ait? (tur 23)

**Kapsam.** Kontrol listesinin "webhook/callback tekrarı ve sıra karışması
güvenli mi" satırı §61'de tekrar/sıra tarafından denetlenmişti; bu tur
bildirimin **kimliğini** denetledi: para getiren dört `@Public` uç
(Stripe webhook, iyzico rezervasyon callback'i, iyzico abonelik callback'i,
fiziksel POS callback'i).

**Ölçüm.** Dördü de `@Public` + `Throttle(SENSITIVE_ENDPOINT)`. İmza/doğrulama
durumu:

| Uç | Doğrulama | Sonuç |
| --- | --- | --- |
| Stripe webhook | `stripe-signature` + ham gövde, **fail-closed** (`STRIPE_WEBHOOK_SECRET` yoksa hata) | ✅ sağlam |
| Fiziksel POS callback | HMAC-SHA256 + ham gövde, fail-closed (§20) | ✅ (sağlayıcı adapter'ı `Null…` → yol bugün ölü) |
| **iyzico rezervasyon callback'i** | yok | **P0** |
| **iyzico abonelik callback'i** | yok | **P0** |

### 73.1 İki P0 — başka bir ödemenin token'ı, ödenmemiş bir kaydı "ödendi" yapıyordu

iyzico ödeme formu tamamlandığında tarayıcı üzerinden `{ token, conversationId }`
POST eder. Akışın yapısı şu:

- ödemenin **sonucu** `retrieveCheckoutForm(token)` ile iyzico'dan okunur →
  **güvenilir** (token gerçek bir ödemeye ait olmak zorunda),
- güncellenecek **kayıt** ise gövdedeki `conversationId` ile bulunur →
  **güvenilmez** (çağıranın yazdığı değer).

İkisi birbirine **bağlanmıyordu**. Saldırı tek adım: kendi 10 TL'lik ödemesinin
token'ını al, gövdeye pahalı bir rezervasyonun kimliğini yaz, uca POST et.
Handler token'ı iyzico'ya sorar ("başarılı"), sonra gövdedeki kimliğin kaydını
`ConfirmBookingPaymentCommand`'a verir → **rezervasyon HotelBeds'te açılır**.
Abonelik tarafında aynı adım aboneliği `ACTIVE` yapar ve fatura dönemini
başlatır.

Hiçbir tutar kontrolü bunu yakalamaz: deftere yazılan tutar **yerel kayıttan**
okunuyor, yani sistem kendi kendine tutarlı görünür. Fark yalnız sağlayıcı
ekstresinde ortaya çıkar — ve o mutabakat henüz yok (§72, iş paketi 16).

Daha kötüsü: **üç akış aynı sağlayıcı hesabını** kullanıyor (sanal POS taksiti,
rezervasyon, abonelik). Yani bir akışta alınan token diğerinin kaydını
ilerletmeye de yeter; token'lar akışlar arasında taşınabilir.

### 73.2 Aynı hatanın düzeltilmiş kopyası zaten vardı

Bu bulgunun en öğretici tarafı: **kontrol üçüncü callback'te vardı.** Sanal POS
taksit callback'i (`handle-payment-callback.handler.ts`) tam bu saldırıyı
kapatan bir kontrol taşıyor ve yorumu da saldırıyı adıyla anlatıyor:

> *Token ↔ konuşma bağı: … İkisi bağlanmadığı için BAŞKA bir ödemeye ait geçerli
> bir token, bekleyen bir işlemi "başarılı" yapmaya yetiyordu (uç @Public).*

Düzeltme bir **çağrı yerine** konmuş, bir **kurala** dönüştürülmemişti; sonraki
iki callback (rezervasyon §61, abonelik §59 turlarında yazıldı) korumasız doğdu.
Bu, CLAUDE.md finans kuralı 10'un aynı mantığı: *bir varlığın değişmez kuralı
tek bir çağrı yerine konursa, aynı varlığı çözen diğer N−1 yol korumasız kalır.*

**KURAL: Bir güvenlik kontrolü ikinci kez gerekiyorsa, o artık bir kuraldır —
kopyalanmaz, ortak bir yere taşınır.** Kopyalamak üç kopya ve üç ayrı bakım
yolu demektir; kopyalardan birine yapılan düzeltme diğerlerine geçmez
(tam olarak bu turun bulgusu).

### 73.3 Düzeltme: iki bağımsız kanıt, tek kural

`checkIyzicoCallbackBinding` saf bir fonksiyon olarak kuruldu ve **üç callback**
onu çağırıyor. İki bağımsız kanıt tanımlı:

| Kanıt | Nasıl | Gücü |
| --- | --- | --- |
| **Yerel token** | Kayıt ödeme formunu açarken token'ı sakladıysa gövdedekiyle karşılaştırılır | Kesin — sağlayıcının davranışına bağlı değil |
| **Sağlayıcı yankısı** | iyzico yanıtında `conversationId`'i yankılar; gövdedekiyle karşılaştırılır | Kesin ama alanın gelmesine bağlı |

Kural: **biri yeterli, biri çelişirse ret, hiçbiri yoksa ret** (fail-closed).
Çelişkinin kanıtı ezmesi bilinçli — saldırgan iki alandan birini kontrol
ediyor olabilir, "diğer kanıt tuttu" demek o yüzden yeterli değil.

Kanıt durumu akışa göre değişiyor ve bu **ölçülmüş** bir farktır:

| Akış | Yerel token | Yankı |
| --- | --- | --- |
| Sanal POS taksiti | ✅ `iyzico_transactions.token` | ✅ |
| Rezervasyon | ✅ `booking_payments.iyzico_token` | ✅ |
| Abonelik | ❌ **saklanmıyor** (`subscribe-to-plan` yalnız `externalId`'i yazıyor) | ✅ |

Abonelikte tek kanıt sağlayıcının yankısı. Token kolonu eklemek migration
isterdi ve yankı zaten kesin bir kanıt — ama bu, o akışın sağlayıcı davranışına
bağımlı tek kanıtla durduğu anlamına geliyor (§74'te kalem).

### 73.4 Rule 9 yine: kanıt sağlayıcı yanıtında geliyordu, mapping'de düşüyordu

`RetrieveCheckoutFormResult` üç alanı atıyordu: `conversationId`, `price`,
`currency`. iyzipay yanıtı üçünü de taşıyor. Yani **bağın doğrulanabilir tarafı
ve tutar kanıtı ağ üzerinden gelip adapter'da çöpe gidiyordu.** Kural 9'un
klasik hâli ("mapping'de alan düşmesi sessiz veri kaybıdır") — ama burada düşen
şey bir tutar değil, callback'in **kimlik kanıtıydı**.

Alanlar tipte `| undefined` olarak **zorunlu** bırakıldı (opsiyonel değil):
derleyici böylece her mock'u ve her tüketiciyi tek tek gezdirdi.

### 73.5 Tutar kapısı: sepet tutarı kaydın beklediği tutar mı?

Rezervasyon callback'inde bağ kanıtlandıktan sonra ikinci bir kapı daha var:
iyzico'nun bildirdiği **sepet** tutarı (`price` — tahsil edilen `paidPrice`
değil; taksitte komisyonla büyür) kaydın beklediği tutarla karşılaştırılıyor
(§71'in `amountChargedBy(IYZICO)` okuması: iyzico TRY çeker).

Bağ zaten kanıtlandığı için bu teorik olarak tutmak zorunda; yine de yazıldı
çünkü tutmadığı an **neyin** bozulduğunu söyler: ödeme formu bayat bir tutarla
açılmış ya da kayıt link üretildikten sonra değişmiş. Doğrulanmazsa defter
yerel tutarı yazar ve fark yalnız sağlayıcı ekstresinde görünür.

Üç ayrıntı:

1. Karşılaştırma **Decimal** üzerinden: iyzico tutarı `number` da döndürebiliyor
   (`4200` vs `4200.00`) → string karşılaştırması meşru ödemeleri reddederdi.
2. Para birimi de karşılaştırılıyor: tutar eşit, cins farklı olabilir.
3. Alan **gelmezse** ödeme durdurulmuyor, uyarı yazılıyor: bağ kanıtlanmışken
   reddetmek meşru tahsilatları durdurur.

### 73.6 İki küçük sağlamlaştırma

- **Kimlik biçimi kapıda:** `conversationId` doğrudan sorguya veriliyordu; UUID
  olmayan bir değer Postgres cast hatasına (500) dönüşür ve saldırganın
  ürettiği gürültü gerçek bir arızadan ayırt edilemez hâle gelir. Artık biçim
  önce sınanıyor, sorguya hiç gidilmiyor.
- **Alarm:** reddedilen her bildirim CRITICAL basıyor. Sebep iki yönlü: ya
  saldırı denemesi ya sağlayıcı davranış değişikliği (yankı gelmiyor) — ikinci
  hâlde **her** ödeme reddedilir, yani alarm olmazsa tahsilatların durduğu fark
  edilmez. Kayıt bulunamaması da artık sessiz değil.
- Üç ayrı exception yerine **tek** `IyzicoCallbackRejectedException`
  (`IYZICO.CALLBACK_REJECTED`, 403) + tipli ret nedeni. Gerekçe 73.2 ile aynı:
  üç kopya, birinde yapılan düzeltmenin diğerlerine geçmemesi demektir.

### 73.7 Ölçüldü, el atılmadı

| Bulgu | Neden bu turda değil |
| --- | --- |
| **Stripe tarafında tutar kapısı yok** | Gerek yok: imza **tüm gövdeyi** doğruluyor, `metadata.bookingPaymentId` dahil → bağ uçtan uca kimliklendirilmiş. Bir tutar kontrolü orada yalnız **kendi** bayat linkimizi yakalar; o da `ConfirmBookingPaymentCommand`'a ait bir kapı olurdu (iki webhook handler'ına kopyalanmaz — 73.2). |
| **Fiziksel POS: gövde ↔ yol parametresi bağı** | İmza gövdeyi doğruluyor ama güncellenecek kayıt **yol parametresinden** (`:externalRef`) geliyor. HMAC tasarım gereği tekrar-oynatılabilir (nonce/zaman damgası yok): yakalanmış geçerli bir gövde **başka** bir ref'in yoluna POST edilirse o işlem sonuçlanır. Bugün sömürülemez — `PHYSICAL_POS_PROVIDER` = `NullPhysicalPosProvider`, `parseCallback` hata fırlatıyor. **Gerçek adapter yazıldığında `parseCallback` gövdenin kendi referansını yol parametresiyle karşılaştırmak zorunda.** |
| **Abonelikte yerel token kanıtı** | `subscribe-to-plan` token'ı saklamıyor → tek kanıt sağlayıcı yankısı. Kolon + migration işi; yankı kesin bir kanıt olduğu için acil değil ama o akış sağlayıcı davranışına bağımlı tek kanıtla duruyor. |
| **Abonelikte tutar kapısı** | Beklenen tutar `PENDING` tahsilat satırında (`findRenewalCharge`) ve o satır bugün **onaydan sonra** okunuyor. Önce okumak kilit sırasını değiştirir; ayrıca deneme aboneliğinde satır hiç yok (karşılaştırılacak tutar yok). Kendi kararını hak ediyor. |
| **`paidPrice` ↔ beklenen tutar mutabakatı** | Tahsil edilen tutar iki akışta da saklanıyor (§59) ama **karşılaştıran** bir rapor yok. Taksitte `paidPrice > price` meşru olduğu için bu bir eşitlik kontrolü değil, mutabakat kalemi → iş paketi 16 (sağlayıcı hesap kapaması). |
| **`StubBillingAdapter.handlePaymentResult` koşulsuz `{success:true}` dönüyor** | Hiçbir modülde bağlı değil (`IyzicoBillingAdapter` sağlanıyor); yalnız testler için duruyor. Ama bir gün env'e bağlı bir seçim yapılırsa bu adapter **ödemesiz aktivasyon** demektir. |

---

## 74. Bilinçli yapılmayanlar — webhook güvenliği turu

| Konu | Gerekçe |
| --- | --- |
| **Fiziksel POS callback'inde gövde ↔ yol bağı** | Bugün yol ölü (`NullPhysicalPosProvider` fırlatıyor). Gerçek adapter yazıldığında `parseCallback` gövdedeki referansı yol parametresiyle karşılaştırmak zorunda; ayrıca HMAC'e **zaman damgası/nonce** eklenmezse tekrar-oynatma açık kalır. **Tetikleyici:** ilk gerçek fiziksel POS adapter'ı. |
| **Abonelik callback'inde yerel token kanıtı** | Token saklanmıyor → tek kanıt sağlayıcı yankısı. Kolon + migration ister. **Tetikleyici:** abonelik ödeme akışının bir sonraki turu (tutar kapısıyla birlikte). |
| **Abonelikte sepet tutarı kapısı** | Beklenen tutar `PENDING` tahsilat satırında ve bugün onaydan sonra okunuyor; önce okumak kilit sırasını değiştirir, deneme aboneliğinde satır yok. **Tetikleyici:** yukarıdaki kalemle aynı tur. |
| **`paidPrice` ↔ `price` mutabakat raporu** | Eşitlik kontrolü değil (taksitte meşru fark var) → sağlayıcı ekstresiyle karşılaştıran rapor. İş paketi 16. |
| **`StubBillingAdapter`'ın koşulsuz başarı dönmesi** | Bağlı değil; ama env'e bağlı bir adapter seçimi eklenirse ödemesiz aktivasyon kapısı olur. Ya kaldırılmalı ya da yalnız test dosyalarından erişilebilir hâle getirilmeli. **Tetikleyici:** adapter seçimi env'e bağlanırsa. |
| **Callback uçlarının tekrar-oynatma penceresi** | iyzico bağı artık kanıtlanıyor ama *aynı* kaydın *aynı* token'ıyla gelen tekrar, idempotency kontrollerine dayanıyor (durum makinesi + `providerRef` karşılaştırması). Zaman damgası tabanlı bir pencere yok; iyzico imza göndermiyor (gövdedeki `signature` alanı okunmuyor). **Tetikleyici:** iyzico imza doğrulama dokümanı netleşirse. |
| **`@Public` para uçlarının tek listede izlenmesi** | Bu tur dört ucu elle taradı. Beşincisi eklendiğinde aynı taramayı kimse yapmayacak: "para hareket ettiren `@Public` uç" listesi ve her biri için doğrulama biçimi bir yerde durmalı. **Tetikleyici:** beşinci para ucu. |

---

## 75. Hassas veri: credential'ın durmaması gereken yerler (tur 24)

**Kapsam.** Kontrol listesinin "hassas veri log/exception meta'sına sızıyor mu"
satırı. Üç sınır tarandı: **log** (HTTP gövdesi + dış servise giden alarm),
**saklama** (sağlayıcı ham yanıtı blob'ları) ve **HTTP yanıtı** (serileştirme
DTO'ları).

**Ölçüm (canlı, salt-okunur).** `iyzico_transactions` 0, `pos_transactions` 0,
`invoices` 0, `subscription_payment_methods` 0 satır → hepsi gizli, geçmiş veri
temizleme kararı gerekmiyor.

### 75.1 Önce iyi haber: ölçülmüş ve güvenli olanlar

Bunları kayda geçiyorum ki ileride yeniden açılmasın:

| Konu | Ölçüm |
| --- | --- |
| **Kart numarası / CVV** | Sistemde **hiç yok**. Sağlayıcılardan yalnız `maskedCardNumber` / `lastFourDigits` / `binNumber` geliyor; hiçbir uç ham kart kabul etmiyor → PAN açısından PCI kapsamı dışındayız |
| **TC kimlik numarası** | Sağlayıcıya `11111111111` **yer tutucusu** gönderiliyor; gerçek kimlik numarası hiç dışarı çıkmıyor |
| **CRITICAL alarm gövdeleri** | Slack/Betterstack'e giden `context` alanları yalnız **kimlik** taşıyor (id, olay adı, neden) — hasta adı/telefon/e-posta yok |
| **Domain exception `meta`'ları** | Frontend'e dönen `meta` payload'larında PII yok, yalnız id'ler |
| **Sağlayıcı yanıtlarının log'lanması** | Hiçbir ödeme yolunda `JSON.stringify(result)` yok |
| **Kart saklama tablosu** | `SubscriptionPaymentMethod`'un **query repo'su yok**: token'lar yalnız command tarafından okunuyor, hiçbir okuma yolu onları dışarı açmıyor |
| **Mesajlaşma servisi** | Kanal credential'ları şifreli saklanıyor ve credential sorgularının yanıt dosyaları "controller'a ASLA açılmaz" diye belgeli; ayrı bir "gizlisiz" görünüm tipi var |

### 75.2 P0 — çekim yapmaya yeten kart token'ı bir tanı blob'unda duruyordu

`iyzico_transactions.raw_response` kolonuna sağlayıcı yanıtı **olduğu gibi**
yazılıyordu. O yanıt `cardToken` + `cardUserKey` taşıyor ve bu ikisi birlikte
**non-3DS çekim yapmaya yeten** bir kimlik bilgisidir — abonelik yenilemesi
(`chargeWithSavedCard`) tam olarak bu ikisini kullanıyor.

Sonuç: kontrollü saklama yerinin (kart saklama tablosu, okuma yolu olmayan)
yanında **ikinci ve denetlenmeyen** bir kopya oluşuyordu. O kopyayı kimse
döndürmez, kimse arayıp bulamaz, saklama süresi yoktur. Üstüne, yanıt DTO'su
blob'u **yönetim/admin grubuna serileştiriyordu** → token tarayıcıya kadar
gidiyordu.

**Düzeltme — maskeleme yazma sınırında.** `redactSensitive` (ortak kural) blob'u
maskeliyor ve bu **entity'nin içinde** yapılıyor:

| Aggregate | Kapı |
| --- | --- |
| `IyzicoTransaction` | mevcut tek `_applyRawResponse` (üç geçişi birlikte kapsıyor) |
| `PosTransaction` | üç geçişte tekrarlanan atama **tek** private metoda indirildi |
| `Invoice` | e-belge sonucu atama noktası |

**KURAL: serileştirme sınırında maskelemek tek bir okuyucuyu korur; yazma
sınırında maskelemek her okuyucuyu korur** — DB'ye bakan operatör, yedek,
ileride eklenecek rapor. DTO'yu süzmek bu yüzden yeterli değildi.

Maskeleme **kopya üretir, mutasyon yapmaz**: aynı nesneden kart token'ları
(`extractSavedCard`) hâlâ okunuyor; mutasyon kayıtlı kart saklamayı bozardı.
Tanı değeri korunuyor — `maskedCardNumber`, `lastFourDigits`, `binNumber`,
durum ve tutarlar maskelenmez, çünkü blob sağlayıcı itirazlarında tek adli izdir.

### 75.3 P0 — HTTP yanıtlarında altı credential alanı; biri canlı bir uçta

DTO'lar elle taranınca **dört** dosyada **altı** credential alanı çıktı:

| Alan | Durum |
| --- | --- |
| `ussPassword` (klinik resmî kurum ayarları) | **CANLI**: `@Serialize` ile bağlı bir `GET` ucunda, okuma modelinde ve DTO'da düz metin |
| `iyzicoToken` (rezervasyon ödemesi) | DTO'da bildirilmiş; §73'teki callback bağının **yerel kanıtı** |
| `token` (sanal POS işlemi) | DTO'da bildirilmiş; aynı kanıt |
| `accessToken` (Meta reklam hesabı) | DTO'da bildirilmiş; reklam hesabının tam yetkili anahtarı |
| `clientSecret`, `password` (fiziksel POS terminal config) | DTO'da bildirilmiş, **hiçbir tüketicisi yok** |

İki ayrı sorun var ve ikisi de aynı yanılgıdan besleniyor:

1. **Grup kısıtı yanlış yere konmuş bir güvencedir.** `@Expose({ groups: [ADMIN] })`
   ile "korunan" bir şifre, o gruba giren aktör için **hâlâ düz metin bir
   şifredir**; tarayıcıya, ara belleklere ve istemci log'larına gider.
2. **Serileştirme interceptor'ı FAIL-OPEN.** `@Serialize` yoksa DTO hiç
   uygulanmaz ve ham veri gider. Yani bir alanı DTO'da gruplamak, o alanın
   korunduğunu **kanıtlamaz** — korunup korunmadığı controller'da yazan başka
   bir satıra bağlıdır.

**Düzeltme.** Credential alanları yanıt yüzeyinden **tamamen** kaldırıldı:
`ussPassword` → `ussPasswordConfigured: boolean` (okuma modeli + DTO birlikte —
ekranın ihtiyacı "ayar tamam mı", şifrenin değeri değil); `iyzicoToken`,
`token`, `accessToken` kaldırıldı (geçerlilik `tokenExpiresAt` ile görünür);
tüketicisi olmayan terminal config DTO'su **silindi** — tek işlevi, kliniğin POS
şifresinin serileştirilebilir olduğunu ilan etmekti.

Token'ların kaldırılmasının ikinci bir gerekçesi var: §73'te callback bağının
**yerel kanıtı** o token oldu. Kanıtı okunabilir kılmak kontrolün değerini
düşürür.

### 75.4 Kuralı elle tutulan bir listeye bağlamadım: tarama testi

Altı alanı elle buldum; yedincisini kimse bulmayacak. Bu yüzden `src/common/security/
response-dto-credentials.spec.ts` bütün `*-response.dto.ts` dosyalarını tarıyor
ve `@Expose` edilmiş bir alan **credential adı** taşıyorsa testi kırmızıya
düşürüyor. Liste ayrıca tutulmuyor: tarama, log ve blob maskelemesi için zaten
var olan **tek** kuralı (`isCredentialKey`) yeniden kullanıyor (kural 12).

Testin kendisi de iki yönden korunuyor:

- **Taramanın çalıştığı** ayrıca iddia ediliyor (en az 30 dosya, 200 alan):
  tarama sessizce boş dönerse test yeşil kalır ve güvence kaybolur.
- **Kuralın ayırt ettiği** iddia ediliyor: `iban`, `maskedCardNumber`,
  `iyzicoSubMerchantKey`, `dedupeKey`, `tokenExpiresAt` **serbest**. Fazla
  hassas bir kural ekranın çalışması için gereken alanları yasaklayıp taramayı
  kullanılamaz hâle getirirdi.

Bu ayrım kural dosyasında iki adlandırılmış kümeye dönüştü: **credential**
(hiçbir yerde görünmez) ve **kişisel veri** (log'a yazılmaz ama kendi ekranında
gösterilebilir — bir banka hesabı kartı IBAN'ı göstermek zorundadır). Tek
dosya, iki amaç, kopya liste yok.

### 75.5 Gövde log'u: koruması olan ama koruduğu şey olmayan sanitizer

`LoggingInterceptor` HTTP gövdelerini maskeliyordu ama listesi **yalnız en üst
seviyeye** bakıyordu: `{ paymentCard: { cardToken } }` gibi iç içe gelen
credential'ları hiç görmüyordu. Ayrıca kendi listesini taşıyordu (blob
maskelemesiyle ayrışmaya açık).

Daha ilginç olan: o satır `logger.debug` ile yazılıyor ve `winstonConfig`'de
**seviye hiç ayarlanmamış** → winston varsayılanı `info` → gövde log'u bugün
**hiçbir transport'a ulaşmıyor** (konsol, dosya, Betterstack). Yani sanitizer
bugün bir şeyi korumuyor; seviyeyi bir olay incelemesi için `debug`'a çeken
kişinin karşılaşacağı davranışı doğru kılıyor.

**Koruma kalitesinin, ona ihtiyaç duyulan güne kadar görünmez kalması tam olarak
sorunun kendisi.** Artık ortak kurala bağlı ve derinlemesine çalışıyor.

### 75.6 Ölçüldü, el atılmadı

| Bulgu | Neden bu turda değil |
| --- | --- |
| **Blob'un tamamen daraltılması** | Credential'lar maskelendi ama blob hâlâ alıcı PII'si (e-posta, telefon, adres) taşıyor. KVKK veri minimizasyonu açısından doğrusu "tanı için gereken alt küme"yi saklamak; ama blob sağlayıcı itirazlarında tek adli iz olduğu için neyin gerekli olduğu bir **operasyon kararı**. |
| **`raw_response` saklama süresi** | Hiçbir blob için saklama/temizleme politikası yok. Dönemsel silme, mutabakat penceresiyle birlikte kararlaştırılmalı (iş paketi 16). |
| **Kart saklama token'larının şifreli saklanması** | `subscription_payment_methods.card_token` düz metin. Mesajlaşma servisi kanal credential'larını şifreli saklıyor — aynı yaklaşım burada da uygulanabilir; anahtar yönetimi kararı gerektiriyor. |
| **Serileştirme kapsamının tamamlanması** | Tarama DTO'ların **içeriğini** kilitliyor ama `@Serialize`'ın **uygulandığını** kilitlemiyor; interceptor fail-open olduğu için bir uçta dekoratör eksikse ham model gider. Bu `project_serialization_rollout`'un bilinen açık işi (Faz 1'de 28 uç kapsandı). |
| **Dosya log'larının saklama süresi** | `logs/application-%DATE%.log` 14 gün tutuluyor ve URL + kullanıcı id'si içeriyor (gövde yok). KVKK açısından makul ama belgelenmiş bir politika yok. |
| **e-Nabız `raw_response`** | Sağlık verisi blob'u (finans dışı). Aynı maskeleme kapısı oraya da uygulanabilir ama özel nitelikli veri kararı bu denetimin kapsamı dışında. |

---

## 76. Bilinçli yapılmayanlar — hassas veri turu

| Konu | Gerekçe |
| --- | --- |
| **Sağlayıcı blob'unun tanı alt kümesine indirilmesi** | Credential maskelendi; kalan alıcı PII'si için "neyin adli iz olarak gerekli olduğu" bir operasyon kararı. **Tetikleyici:** ilk sağlayıcı itirazı / mutabakat turu. |
| **`raw_response` saklama süresi ve temizleme işi** | Politika yok; dönemsel silme mutabakat penceresiyle birlikte kararlaştırılmalı (iş paketi 16). |
| **Kart saklama token'larının şifrelenmesi** | `card_token`/`card_user_key` düz metin. Mesajlaşma servisindeki şifreli saklama deseni uygulanabilir ama anahtar yönetimi (rotasyon, KMS) kararı gerekiyor. |
| **`@Serialize` kapsamının tamamlanması** | Tarama DTO içeriğini kilitliyor, dekoratörün **varlığını** kilitlemiyor; interceptor fail-open. Doğru çözüm ya kapsamı tamamlamak ya interceptor'ı fail-closed yapmak — ikincisi tüm uçları aynı anda etkiler. **Tetikleyici:** serileştirme yayılımının Faz 2'si. |
| **e-Nabız blob'una maskeleme** | Aynı kapı uygulanabilir; özel nitelikli sağlık verisi kararı bu denetimin kapsamı dışında. |
| **Log saklama politikasının belgelenmesi** | 14 günlük dosya rotasyonu + Betterstack. KVKK açısından makul ama yazılı politika yok. **Tetikleyici:** KVKK uyum dokümantasyonu. |

---

## 77. Outbox teslimi: "işlendi" damgası neyi kanıtlıyordu? (tur 25)

**Kapsam.** Kontrol listesinin "Event ve teslim" bloğu: *kritik event `outboxRun()`
ile atomik mühürleniyor mu, tüketici idempotent mi, kalıcı hatada retry var mı yoksa
hata yutuluyor mu, teslim edilemeyen kayıt için görünürlük (alarm + sorgu) var mı*.
Kapsam **mühürleme değil teslimdir**: `outboxRun()` tarafı altı turda doğrulandı
(55 çağrı yeri), bu tur kaydın oradan **dinleyiciye** nasıl gittiğine baktı.

Denetlenen dosyalar: `prisma/outbox/*` (processor + repository + modül),
`prisma/transaction/transaction.manager.ts`, `@nestjs/event-emitter`'ın dinleyici
kaydı (`event-subscribers.loader.js`), `eventemitter2@6.4.9` (`_on` + `emitAsync`),
57 dinleyici dosyası ve karşılaştırma için çekirdekteki `MongoOutboxRelay`.

**Ölçüm (canlı, salt-okunur).** `"Outbox"` tablosu **0 satır** (geliştirme DB'sinde
bu akışlar hiç koşmamış) ve tabloda `Outbox_pkey` dışında **hiç indeks yok** —
yoklama sorgusu her 5 saniyede `WHERE "processedAt" IS NULL` ile tam tarama yapıyor,
tablo ise yalnız büyüyor (işlenmiş kayıt silinmiyor).

### 77.1 P0 — kayıt, dinleyici **başlamadan** "işlendi" oluyordu

`OutboxProcessor` kaydı şöyle kapatıyordu: `await emitAsync(type, payload)` →
`update({ processedAt })`. Yani "teslim edildi" damgası, `emitAsync`'in çözülmesine
dayanıyordu. Ölçüm, bu dayanağın yanlış olduğunu gösterdi:

| Kayıt şekli | `await emitAsync` döndüğünde dinleyici | Hata çağırana ulaşır mı |
| --- | --- | --- |
| `@OnEvent(X, { async: true })` — kod tabanındaki 74 dinleyicinin hepsi | **henüz başlamamıştır** | **hayır** |
| `@OnEvent(X)` (seçeneksiz) | bitmiştir | hayır |
| `@OnDomainEvent(X)` (yeni kapı) | bitmiştir | **evet** |

**Neden.** `eventemitter2`, `async: true` ile kaydedilen dinleyiciyi sarar ve
promise'e çevirip çevirmeyeceğine şuna bakarak karar verir:
`promisify = listener.constructor.name === 'AsyncFunction'`
(`eventemitter2/lib/eventemitter2.js:761`). NestJS'in kaydettiği şey ise dinleyicinin
kendisi değil, onu try/catch'e saran bir **arrow wrapper**'dır
(`event-subscribers.loader.js:73`) ve onun `constructor.name`'i `'Function'`. Tanıma
bu yüzden **her zaman** başarısız olur: dinleyici `_setImmediate` ile kuyruğa atılır,
dönüş değeri atılır ve `emitAsync`'in `Promise.all`'una bir `Timeout` nesnesi girer.

Ölçüm (`/tmp` probe'u + kalıcı test): `async: true` ile `await emitAsync` sonrası
dinleyici sayacı **0**, 20 ms sonra 1. `promisify: true` ile `await` sonrası **1**.

**Bedeli.** Outbox'ın tek varlık sebebi "kritik event mutlaka teslim edilsin"dir.
Damga teslimi değil **kuyruğa atmayı** kanıtladığı için, araya düşen bir yeniden
başlatma / dağıtım / çökme işi **kalıcı olarak** kaybettirir ve kayıt `processedAt`
ile kapandığı için kimse bakmaz. Kapsam: 55 `outboxRun()` çağrı yerinin ürettiği her
şey — fiş üretimi, stok hareketi + SMM köprüsü, kasa kapanış köprüsü, abonelik
tahsilat defteri, iade fişi, rezervasyon defteri.

Aynı yanılgı `TransactionManager.emitAfterCommit`'in `try/catch`'ini de **ölü kod**
yapıyordu: beklenmeyen bir promise'in hatası o catch'e hiç düşmez.

### 77.2 P0 — "yutmuyorum, outbox yeniden denesin" diyen tek dinleyici de yutuluyordu

İkinci yarı: aynı loader her dinleyiciyi try/catch'e sarıyor ve
`options?.suppressErrors ?? true` (`event-subscribers.loader.js:100`) — varsayılan
**yutmak**. Çıplak `@OnEvent` ile yazılmış bir dinleyicinin fırlattığı hata yalnız
framework log'una düşer.

Bunun en keskin kanıtı kod tabanının kendi içinde: `StockQuantityChangedListener`
(§41/§44 turlarında yazıldı) şu yorumu taşıyor —

> Hata bilinçli olarak yutulmaz; outbox kaydı "işlendi" işaretlenmesin ve yeniden
> denensin diye yukarı fırlatılır (CLAUDE.md finans kuralı 4).

Yani "retry'ı telafi yolu seçen" **tek** dinleyici, işinin sessizce kaybolduğu
dinleyiciydi: `throw error` framework'te duruyordu, kayıt kapanıyordu ve bu
dinleyicinin — tasarım gereği — **alarmı da yok**. Sonuç: stok hareketi satırı hiç
yazılmaz (parti ↔ hareket mutabakatı bozulur) ve tüketim/zayi maliyeti ile sayım
fazlası geliri deftere hiç girmez. Hiçbir uyarı çıkmaz.

**Düzeltme — tek kapı.** `@OnDomainEvent` (`packages/nest-kernel/.../decorators/`):

```ts
export const OnDomainEvent = (event: OnEventType): MethodDecorator =>
  OnEvent(event, { async: true, promisify: true, suppressErrors: false });
```

Kapı **hiç seçenek almaz**: üç bayrak da sözleşmenin parçası, çağrı yerinde
yeniden açılabilen bir tercih değil (bkz. kural 10/12 — bir kabul kümesi tek
sabitte yaşar). 57 dinleyici dosyası (56 api + 1 messaging) bu kapıya taşındı.

**İki bayrak ancak birlikte güvenli.** Sırf `suppressErrors: false` vermek
felaket olurdu: dinleyici hâlâ `setImmediate` ile koptuğu için fırlatılan hata
**unhandled rejection** olur ve Node sürecini düşürür. Ölçüldü — `promisify`
olmadan yazılan ilk sürümde test süreci çöktü. `promisify` hatayı `emitAsync`'in
promise'ine bağlar, `suppressErrors: false` onun oraya ulaşmasını sağlar.

**Hatayı kimin yutacağına çağıran karar verir, framework varsayılanı değil.**
Beklenmeyen (fire-and-forget) yayın yolları yeni `emitDetached()` yardımcısına
taşındı — hatayı çağrı yerinde yakalar, loglar ve isteyene `onError` verir:

| Çağrı yeri | Neden beklemez |
| --- | --- |
| `CriticalFailurePublisher` | uyarı gönderimi, uyarıya sebep olan akışı ikinci kez düşürmemeli |
| `ThrottleMonitorGuard` | istek zaten 429 ile kapanıyor |
| `ClinicEventPublisher.requestClinicSoftDelete` | tx yok (catch yolu) |
| `UserCommandRepository` toplu durum/silme | tx yok (bulk yolu) |
| İki politika değerlendirici (yetki reddi denetimi) | çağıran zaten 403 fırlatıyor |

### 77.3 P1 — teslim sahiplenilmiyordu: aynı event iki kez

Eski hâl `findMany({ where: { processedAt: null }, take: 100 })` ile okuyordu;
hiçbir kilit, hiçbir sahiplenme yok. İki API örneği — ya da teslim 5 saniyeyi
aştığında üst üste binen iki tur — aynı kayıtları okuyup **aynı event'i iki kez**
yayınlıyordu. Hata artık yukarı fırladığı için yeniden teslim de gerçek bir
olasılık; sahiplenme bu yüzden düzeltmenin ön koşuludur.

**Düzeltme.** Tek UPDATE ile sahiplenme (`claimPending`):

```sql
UPDATE "Outbox" SET "claimedAt" = CURRENT_TIMESTAMP, "attempts" = "attempts" + 1
 WHERE "id" IN (SELECT "id" FROM "Outbox"
                 WHERE "processedAt" IS NULL AND "failedAt" IS NULL
                   AND ("claimedAt" IS NULL OR "claimedAt" < $1)
                 ORDER BY "seq" ASC LIMIT $2
                 FOR UPDATE SKIP LOCKED)
RETURNING "id", "type", "payload", "attempts";
```

`attempts` **sahiplenme anında** artar, hatada değil: süreç teslim ortasında çökse
bile deneme sayılır — yoksa süreci düşüren bir kayıt (poison pill) sonsuz döngü kurar.

### 77.4 P1 — kalıcı hatada sonsuz tekrar: ölü mektup yoktu

Hata yukarı fırlamaya başlayınca eski tasarımın ikinci boşluğu açılıyor: kayıt
`processedAt` boş kaldığı için **her 5 saniyede** yeniden yayınlanır. Aynı event'in
başarılı diğer dinleyicileri de her turda tekrar tetiklenir (e-posta, bildirim,
sağlayıcı çağrısı). Eski kodun yorumu bunu zaten biliyordu ("kalıcı bir hatada
sonsuza kadar takılı kalır ve kimse görmez") ama tek çözümü dedupe'lu bir alarmdı.

**Düzeltme.** Deneme sınırı + ölü mektup + görünürlük:

| Parça | Değer / yer |
| --- | --- |
| Deneme sınırı | `OUTBOX_MAX_ATTEMPTS = 10` (tek sabit; `OutboxRepository.isExhausted`) |
| Denemeler arası bekleme | kiralama süresi `OUTBOX_CLAIM_LEASE_MS = 60_000` (hatada `claimedAt` **bilerek** bırakılır) |
| Ölü mektup | `failedAt` damgası → kayıt artık sahiplenilmez, **silinmez** |
| Uyarı | deneme sürüyorsa `WARNING`, hak tükendiyse `CRITICAL` (dedupe kayıt bazlı) |
| Sorgu | `pnpm outbox:dead-letters` — bekleyen/ölü/işlenmiş sayısı + ölü mektup tablosu + yeniden deneme SQL'i |

Yeniden deneme **otomatik değildir**: sebebi giderilmeden tekrar denemek aynı
hatayı üretir, bu yüzden `failedAt`/`attempts` sıfırlaması bir operasyon kararıdır
ve script yalnız okur.

### 77.5 P1 — dinleyicisi olmayan event sessizce düşüyordu

`emitAsync` kayıtlı dinleyici yoksa hiçbir şey yapmaz ve `Promise.all([])` çözülür →
eski kod kaydı "işlendi" sayardı. Event adı değişmiş ya da modülün aboneliği hiç
kurulmamış olabilir (bu kod tabanında yaşandı: `posting-event.module.ts`'in yorumu
"`@OnEvent` aboneliği hiç kurulmuyordu: olaylar kaydediliyor, fiş hiç atılmıyordu"
diyor). Artık `listenerCount(type) === 0` bir **hata** gibi işlenir: kayıt kapatılmaz,
sebebi `lastError`'a yazılır, sınırda ölü mektuba düşer.

### 77.6 P2 — `createdAt` aynı transaction'daki event'leri sıralayamaz

Ölçüm (canlı, salt-okunur): tek transaction içinde iki `CURRENT_TIMESTAMP` okuması
**birebir aynı** (`…:49.698Z` / `…:49.698Z`), `clock_timestamp()` ise 55 ms ilerlemiş.
Postgres'te `now()` transaction başlangıç anıdır — yani bir `outboxRun()` ile
mühürlenen bütün event'ler **aynı** `createdAt` damgasını taşır ve
`ORDER BY "createdAt"` onları kendi aralarında sıralamaz.

**Düzeltme.** `seq BIGSERIAL UNIQUE` kolonu; sahiplenme ve listeleme `seq` ile
sıralanır. Bu kolon projenin "ID elle üretilir" kuralının istisnası değil, kapsamı
dışındadır: bir kimlik değil **teslim sırası** taşır ve uygulamadan güvenle
atanamaz (atamak için ayrı bir sayaç ve onu koruyan bir kilit gerekirdi).

### 77.7 P2 — yoklama indekssiz, tablo yalnız büyüyor

Ölçülen tek indeks `Outbox_pkey`'di; yoklama her 5 saniyede
`processedAt IS NULL` ile tarama yapıyordu ve işlenmiş kayıtlar hiç silinmiyor.
`@@index([processedAt, failedAt, seq])` eklendi. Saklama/temizleme işi **bilinçli
olarak yapılmadı** (§78): otomatik yıkıcı temizlik bu projede varsayılan değil.

### 77.8 Çekişen tur: teslim gerçekleşince kırılan sıra (messaging)

Teslim gerçek olunca `apps/messaging` entegrasyon testi kırmızıya düştü ve altında
**canlı bir sıra hatası** çıktı. Gelen mesaj akışı AI bağlam penceresini
(`aiMemoryCache.append`) **commit'ten sonra**, `outboxRun()` bloğunun dışında
tazeliyordu; event ise o commit'te mühürlenip relay hemen dürtülüyor. Doğruluk,
"dinleyici handler'dan sonra çalışır" varsayımına bağlıydı — ki bu varsayım yalnız
teslim sahte olduğu için tutuyordu.

Ölçülen sonuç: ikinci AI turunun penceresi
`[user "Merhaba", assistant "…", user "Merhaba"]` — yeni soru pencerede yok, önceki
kullanıcı turu **tekrarlanmış**. Yani AI, hastanın yeni mesajını görmeden yanıt
üretiyordu.

**Düzeltme.** Append transaction'ın **içine**, en sona alındı: event mühürlenmeden
önce pencere tazelenir. Rollback penceresi yalnız commit hatasıdır; pencere TTL'li
ve otoritatif değil (soğuksa okuma DB'den ısıtır).

**KURAL: doğruluk zamanlamaya bırakılamaz.** Bir işin sırası "şu dinleyici sonra
çalışır" varsayımıyla tutuyorsa, teslim sahteliğini kaybettiği gün sıra bozulur.
Sıra gerekiyorsa aynı transaction'a alınır.

### 77.9 Sağlamlaştırma zaten vardı — para taşımayan tarafta

Çekirdekteki `MongoOutboxRelay` (messaging) atomik sahiplenme, `attempts` sayacı,
`MAX_ATTEMPTS` poison-pill koruması, hatada sahiplenmeyi bırakma ve üst üste binen
tarama koruması taşıyor. Postgres tarafındaki `OutboxProcessor` — **her finansal
event'in geçtiği yer** — bunların hiçbirini taşımıyordu.

§73'ün dersi birebir tekrarlandı: *bir kontrol ikinci kez gerekiyorsa o bir kuraldır;
kopyalanmaz, taşınır.* Bu turda hem eksik yarı tamamlandı (Postgres işçisi) hem iki
tarafın ortak yarısı tek kapıya alındı (`@OnDomainEvent`, `emitDetached`) — ve
ikisinin de çalıştığı **taramayla** korunuyor.

### 77.10 Uygulanan düzeltmeler — özet

| # | Düzeltme | Yer |
| --- | --- | --- |
| 1 | `@OnDomainEvent` kapısı (`async` + `promisify` + `suppressErrors: false`) | `nest-kernel/.../decorators/on-domain-event.decorator.ts` |
| 2 | 57 dinleyici dosyası kapıya taşındı; çıplak `@OnEvent` **taramayla** yasak | `event-listener-gate.spec.ts` |
| 3 | `emitDetached()` — beklemeyen yayın yolları için tek yardımcı (+6 çağrı yeri) | `nest-kernel/.../utils/emit-detached.ts` |
| 4 | Atomik sahiplenme (`FOR UPDATE SKIP LOCKED`), kiralama, `attempts` | `outbox.repository.ts` |
| 5 | Ölü mektup + `WARNING`/`CRITICAL` uyarı ayrımı + dinleyicisiz event kontrolü | `outbox.processor.ts` |
| 6 | `seq` (teslim sırası), `lastError`, `failedAt`, `claimedAt` + yoklama indeksi | `outbox.prisma` + migration |
| 7 | Ölü mektup sorgusu (salt okuma) | `scripts/outbox-dead-letters.cjs`, `pnpm outbox:dead-letters` |
| 8 | In-memory kanal beklemez ama **görünür**: `emitDetached` + WARNING alarm | `transaction.manager.ts` (+ Mongo eşi) |
| 9 | AI bağlam penceresi tazelemesi transaction'ın içine alındı | `receive-inbound-message.handler.ts` |
| 10 | `DateTimeManager.subtractMilliseconds` (kiralama kesimi için) | `nest-kernel/.../date-time.manager.ts` |

**Testler.** `event-delivery-contract.spec.ts` (4 — framework varsayılanını kayda
geçirir + kapının garantisini doğrular), `event-listener-gate.spec.ts` (3 — tarama),
`outbox.processor.spec.ts` (7), `outbox.repository.spec.ts` (9),
`transaction.manager.spec.ts` (+2: WARNING uyarısı, çağıranı bekletmeme),
`critical-failure.publisher.spec.ts` (+1: unhandled rejection bırakmaz).
Kırmızı doğrulaması: `promisify` kaldırılınca süreç çöküyor, `suppressErrors`
geri açılınca 1 test kırmızı, bir dinleyici çıplak `@OnEvent`'e döndürülünce tarama
kırmızı.

**Migration.** `20261014100000_outbox_delivery_guarantee` — hepsi ekleme
(`seq`/`attempts`/`lastError`/`failedAt`/`claimedAt` + 2 indeks), mevcut satırlar
varsayılanlarla dolar, veri çakışması yok. **Uygulanmadı** (kullanıcı uygular).

## 78. Bilinçli yapılmayanlar — outbox teslim turu

| Konu | Neden şimdi değil | Tetikleyici |
| --- | --- | --- |
| **Ölü mektup yeniden deneme komutu** (uçtan/CLI'dan `attempts` sıfırlama) | Şimdilik sorgu (script) + belgeli SQL var. Yeniden deneme bir operasyon kararıdır; sebebi giderilmeden otomatik tekrar aynı hatayı üretir. Ayrıca yüksek etkili işlem → ayrı capability ister (iş paketi 4) | İlk gerçek ölü mektup |
| **Outbox saklama / temizleme işi** | İşlenmiş kayıt hiç silinmiyor; tablo yalnız büyüyor. Yoklama artık indeksli, acil değil. Otomatik yıkıcı temizlik bu projede varsayılan değil — saklama süresi (denetim izi!) bir karar | Tablo hacmi veya denetim saklama süresi kararı |
| **Backlog yaşı alarmı** (en yaşlı bekleyen kayıt > eşik) | İşçi tamamen duruyorsa kontrolü yapacak olan da durur: bu alarm **dışarıdan** ölçülmeli (Bull Board / healthcheck / harici zamanlayıcı) | Operasyon izleme turu |
| **Payload sözleşmesi: outbox düz JSON taşır** | `payload` event **nesnesinin kendisidir**; outbox'tan geçince metodlar kaybolur, `Date` → ISO string, `Decimal` → string olur. Ölçüldü: metot çağıran tek dinleyici (`critical-failure.listener`) outbox'tan geçmiyor, tutar okuyan ikisi savunmacı (`new Decimal(...)`, `.toString()`). Yine de in-memory ile outbox **farklı şekil** teslim ediyor | Payload'ı düz veriye indirgeme (şema + sözleşme testi) |
| **Dinleyici başına teslim kaydı** | At-least-once'ın bedeli: iki dinleyicili bir event'te biri patlarsa kayıt yeniden teslim edilir ve **başarılı** dinleyici de tekrar çalışır. Bugün dört event'in iki dinleyicisi var ve hiçbiri fırlatmıyor (hepsi kendi içinde yutup alarm üretiyor) → fiilî risk yok | Fırlatan ikinci bir dinleyici eklenmesi |
| **In-memory kanalda bitiş sırası** | Event'ler sırayla **başlatılır** (`emitDetached` döngüsü) ama beklenmediği için bitişleri karışabilir. Kritik sıra gerektiren iş bu kanalda değil outbox'ta yürür | Sıra gerektiren kritik olmayan bir akış |
| **`attempts` ayrımı** | Sayaç sahiplenmede arttığı için "sahiplendi ama hiç yayınlanamadı" (çökme) ile "yayınlandı, patladı" aynı sayaçta görünür; ayrımı yalnız `lastError`'ın dolu olup olmaması verir | Ölü mektup analizinde ihtiyaç duyulursa |

---

## 79. Önbellekten okunan para kararı: teklifin sahibi yoktu (tur 26)

**Kapsam.** Kontrol listesinin **önbellek tutarlılığı**, **dağıtık kilit** ve
**rezervasyon/hold** satırları: Redis'ten okunan bir değerin para ya da yetki
kararını beslediği her yer. Denetlenen yüzeyler: sağlık turizminin üç teklif
önbelleği (otel/transfer/uçuş), transfer müsaitlik önbelleği, randevu slot kilidi,
abonelik entitlement önbelleği + `ModuleEntitlementGuard`, klinik önbellekleri
(kiracı kapsamı dahil), aktör bağlamı (auth) önbelleği ve AI araç çalıştırıcısının
hata yüzeyi.

### 79.1 Önce ölçülmüş ve güvenli olanlar

| Konu | Ölçüm |
| --- | --- |
| **Randevu slot kilidi** | Olgun: bırakma ve tazeleme **Lua** ile sahip kontrollü (`get == ARGV[1]`), tazelemede nil-check, cluster için `{providerId}` hash tag, dönüş tipi `acquired \| locked` olarak tipli. Dokunulmadı |
| **Entitlement kapısı** | Read-through: önbellek boşsa karar **DB'den** verilir; Redis patlarsa hata yukarı gider → istek **reddedilir** (fail-closed). Anahtar org+klinik kapsamlı, bust `scan`+`unlink`, TTL 6 dk |
| **Klinik önbellekleri** | Hepsi klinik kapsamlı anahtar (`clinic:*:<clinicId>`), TTL 30 dk, güncellemede açık `del`. Kiracı kapsamı (`clinic:organization-id`) da buradan okunur ve `TenantScopeResolver` gelen değeri **doğrular**, kısa devre yapmaz (bkz. CLAUDE.md) |
| **Aktör bağlamı önbelleği** | TTL 5 dk; kullanıcı güncelleme/silme olaylarında bust ediliyor. Rol yetkileri yalnız seed ile değişiyor (role modülünde **komut yok**) → çalışma zamanında yetki geri alma yolu yok, dolayısıyla bayat yetki penceresi de yok |
| **Transfer müsaitlik önbelleği** | Anahtar `sha256(filter)` — **kiracı taşımıyor** ve bu **meşru**: HotelBeds kimlikleri platform-global env (`HOTELBEDS_TRANSFER_API_KEY`), hizmet bedeli de platform-global (`HEALTH_TOURISM_SERVICE_FEE_PERCENT`), yani sonuç kiracıya bağlı değil. **Koşul kayda geçiyor:** kimlikler klinik başına taşınırsa (`ClinicHealthTourismConfig`) bu önbellek anlaşmalı fiyat sızıntısına dönüşür ve anahtarı kiracı kapsamına alınmalıdır |
| **Uçuş teklifi TTL'i** | Sağlayıcının kendi `expiresAt`'inden türetiliyor (alt 30 sn, üst 10 dk) — üç önbellekten tek "sağlayıcının geçerlilik süresine saygı duyan" olan |

### 79.2 P0 — teklif bir para kararıdır; sahibi yoktu

`search_hotels` / `search_transfers` / `search_flights` bulduğu seçenekleri Redis'e
yazıyor: `optionId → { rateKey \| offerId, net, currency, tarihler, pax }`.
`book_*` bu kaydı okuyup üç şeyi ondan üretiyor:

1. hastanın ödeyeceği tutarın temeli (`netAmount` → iki ödeme linki),
2. sağlayıcıya gidecek **rezervasyon talimatı** (`rateKey` / `offerId`),
3. platform defterine yazılacak tedarikçi maliyeti (§63).

Okuma tarafında **hiçbir kontrol yoktu**: anahtar global (`hotel:rate-option:<optionId>`),
sorgu bağlam (`ctx`) taşımıyordu, handler anahtarda ne varsa onu döndürüyordu.
İki ayrı yoldan istismar edilebilir:

- **AI yolu:** `optionId` modelin seçtiği bir **argüman**. Başka bir görüşmeden
  taşınan (ya da uydurulup canlı bir kayda çarpan) bir kimlik, o teklifi bu
  görüşmenin ödemesine çevirir.
- **HTTP yolu (daha keskin):** `book-flight` / `hold-flight` komutları
  `data.optionId`'yi **istek gövdesinden** alıyor. `data.clinicId` bir satır
  yukarıda policy ile doğrulanıyor ama teklifin hangi kliniğe ait olduğu
  sorulmuyordu → A kliniğinin personeli, B kliniğinin teklifiyle (B'nin
  `offerId`'si, B'nin fiyatı) **A'nın defterine** bilet kesebilirdi.

Bu kontrol kod tabanında zaten vardı — ama yalnız **DB'den** okunan kayıtlar için:
`AiToolSupport.loadOwnedAppointment` → `detail.patientId !== context.patientId`
olduğunda `null` döner. Eksik olan, önbellekten okunan teklifti.

**Düzeltme — üç parça, tek kapı.**

| Parça | Ne yapar |
| --- | --- |
| Kayıt sahibini taşır | Üç teklif sözleşmesi `owner: QuoteOptionOwner` (`clinicId` + `conversationId`) alanı kazandı |
| Anahtar kiracı kapsamlı | `hotel:rate-option:<clinicId>:<optionId>` (transfer/uçuş aynı). Anahtarın kiracısı **kaydın sahibinden** türetilir → anahtar ile içerik **ayrışamaz** |
| Okuma sahipliği doğrular | `QuoteOptionOwnershipService.assertOwned(...)` — üç dikeyin **tek** kapısı (`crm/health-tourism/shared/domain/quote-option`) |

Kapının sözleşmesi CLAUDE.md'nin domain-servis istisnasına uyar: yalnız `assert*`,
veri döndürmez, yazma yapmaz. İddia semantiği:

- görüşme bağlamı olan çağıran (AI aracı) `conversationId` taşır → **birebir** eşleşmeli;
- görüşme bağlamı olmayan çağıran (personelin HTTP ucu, kliniği policy ile
  doğrulanmış) `null` taşır → yalnız kiracı eşleşmesi aranır.

Yani **iddia daralabilir ama genişleyemez**; klinik her zaman eşleşir. Kayıt sahip
bilgisi taşımıyorsa (kuraldan önce yazılmış kayıtlar) teklif **reddedilir** —
fail-closed'ın bedeli en fazla bir yeniden arama, TTL ≤ 15 dk.

Uyarı seviyesi sebebe göre: **kiracı uyuşmazlığı CRITICAL** (başka kiracının
teklifiyle rezervasyon denemesi bir güvenlik olayıdır), görüşme uyuşmazlığı ve
sahipsiz kayıt WARNING. Ret mesajı **hasta için güvenli** (kimlik taşımaz, çünkü
AI onu yanıtına alıyor); ayrıntı uyarı kanalına gider.

> **KURAL: önbellek anahtarı bir adrestir, yetki değil.** Para ya da yetki kararı
> taşıyan bir kaydın sahibi **kaydın içinde** yazılı olmalı ve okuma anında
> doğrulanmalı. "Anahtarı bilmek" yetki sayıldığı anda, anahtar ne kadar rastgele
> olursa olsun yetki tahmin edilebilir/ödünç alınabilir bir şeye dönüşür.

### 79.3 P1 — 8 haneli optionId: çarpışma başka hastanın teklifini EZER

Üç arama aracı da kimliği `` `ht_${randomUUID().slice(0, 8)}` `` ile üretiyordu:
**32 bit**, global anahtar uzayı, 15 dakika ömür. Arama başına 6 seçenek yazılıyor;
aynı pencerede ~60 bin canlı teklifte bir çarpışma olasılığı (`n²/2·2³²`) **%42**,
~6 binde ~%0,4. Çarpışma sessizdir ve **üzerine yazar**:

> Hasta `ht_abc12345` ile 100 EUR'luk odayı görür ve onun üzerinden öder; o anahtar
> başka bir aramanın 250 EUR'luk odasıyla ezilmişse sistem **o odayı** rezerve eder.
> Defter 250 EUR tedarikçi maliyeti yazar, satış 100 EUR'dan türetilmiştir — zarar
> + yanlış oda.

Kısaltma hiçbir şey kazandırmıyordu: kimliği insan yazmıyor, model araç çıktısından
birebir kopyalıyor. **Tam UUID**'ye geçildi; kiracı kapsamlı anahtarla birlikte
çarpışma artık yalnız tek klinik içinde ve ihmal edilebilir olasılıkta.

### 79.4 P2 — hata metni hastaya kopyalanıyordu

`AiToolExecutor` her aracı try/catch'e sarıyor ve sonucu şöyle döndürüyordu:
`Bu işlem şu anda gerçekleştirilemedi: ${err.message}`. Araç sonucu **hastaya**
gider (AI onu yanıtına alır), dolayısıyla bir DB/sağlayıcı/kütüphane hatasının
metni — tablo adı, bağlantı dizgesi, sağlayıcı yanıtı — hasta kanalına
kopyalanıyordu.

Düzeltme: yalnız **`DomainException`** mesajı aktarılır (o mesaj kullanıcı için
yazılmıştır ve tiplidir); diğer her şey "Teknik bir sorun oluştu…" olur, gerçek
sebep log'da durur. §75'in kuralının uzantısı: hassas veri yalnız log ve HTTP
yanıtından değil, **hata metninden** de sızar.

### 79.5 Uygulanan düzeltmeler — özet

| # | Düzeltme | Yer |
| --- | --- | --- |
| 1 | `QuoteOptionOwner` / `QuoteOptionClaim` sözleşmeleri + saf sahiplik kuralı | `health-tourism/shared/domain/quote-option/` |
| 2 | `QuoteOptionOwnershipService` (uyarı + tipli ret) + yaprak modül | aynı klasör; üç `query.module.ts` import eder |
| 3 | Üç önbellek anahtarı **kiracı kapsamına** alındı; anahtarın kiracısı kaydın sahibinden türetilir | `hotel/transfer/flight …/infrastructure/cache/` |
| 4 | Üç okuma kapısı (`get-*-option` / `get-flight-offer` handler'ları) sahipliği doğruluyor | ilgili `queries/` klasörleri |
| 5 | Üç arama aracı sahibi yazıyor; **tam UUID** kimlik | `search-hotels/transfers/flights.tool.ts` |
| 6 | Üç rezervasyon aracı + iki personel komutu iddiasını geçiriyor | `book-*.tool.ts`, `book-flight`/`hold-flight` handler'ları |
| 7 | Araç hata metni hasta kanalına kopyalanmıyor | `ai-tool-executor.service.ts` |

**Testler.** `quote-option-ownership.rule.spec.ts` (7), `quote-option-ownership.service.spec.ts` (4),
`quote-option-gates.spec.ts` (**3 dikey × 5** — üç okuma kapısının aynı davrandığını
tablo bazlı doğrular: kiracı kapsamlı okuma, kayıt yoksa `null` + uyarı yok, başka
kiracı → ret, sahipsiz kayıt → ret, uyuşuyorsa döner), `ai-tool-executor.hotel.spec.ts`
(+2: başka kiracının / başka görüşmenin optionId'siyle ödeme **başlatılamaz**; fake
önbellek artık **gerçek** handler + gerçek kuralı çalıştırıyor),
`flight-cache.service.spec.ts` (+2 anahtar kapsamı), `ai-tool-dispatch.spec.ts`
(teknik hata metni hastaya gitmez / domain hatası gider).
Kırmızı doğrulaması: bir handler'dan `assertOwned` kaldırılınca kapı testlerinin
ikisi kırmızı; `optionId` kısaltması geri konulunca uçuş aracı testi kırmızı.

**Migration yok** — değişen şey Redis anahtar biçimi. Dağıtım notu: dağıtım anında
uçuşta olan teklifler (≤15 dk) yeni anahtarla bulunamaz; hastaya "tekrar arama
yapın" denir, para hareketi yok.

## 80. Bilinçli yapılmayanlar — önbellek/teklif turu

| Konu | Neden şimdi değil | Tetikleyici |
| --- | --- | --- |
| **Teklif tek kullanımlık değil** | Aynı `optionId` ile `book_*` iki kez çağrılırsa **iki ayrı** `BookingPayment` (ve iki link çifti) doğar; hasta ikisini de öderse sağlayıcıda iki rezervasyon açılır. §61'in çift-çekim koruması *aynı* ödeme kaydını korur, iki ayrı kaydı değil. Doğru çözüm teklif bazlı idempotency anahtarı + DB kısıtı → ödeme aggregate'ine dokunur | Ödeme-önce akışın idempotency turu |
| **Transfer müsaitlik önbelleğinin kiracı kapsamı** | Bugün **meşru**: kimlikler ve hizmet bedeli platform-global (§79.1). Şimdi kapsamlamak, kazanç olmadan isabet oranını düşürürdü | HotelBeds kimliklerinin klinik başına taşınması |
| **Teklif önbelleğinin DB yedeği** | Teklif kaybolunca tek telafi yeniden arama. Kalıcılaştırmak (tablo + TTL) sağlayıcı fiyatının bayatlığını gizler; §63 zaten fiilî tedarikçi tutarını defterin kaynağı yaptı | Teklif geçmişi/raporu ihtiyacı |
| **`conversationId` yerine hasta/lead bağı** | Sahiplik görüşmeye bağlı; aynı hastanın ikinci görüşmesindeki teklifi kullanmak reddedilir. Bugün doğru olan bu (görüşme = AI bağlamı), ama kanal değişiminde (WhatsApp → panel) hasta bazlı bağ daha doğru olabilir | Panelden rezervasyon tamamlama akışı |
| **Dağıtık kilidin ikinci kullanım yeri** | Slot kilidi olgun (§79.1) ama **yalnız randevuda**. Ödeme/rezervasyon tarafında kilit yok; oradaki eşzamanlılık DB kısıtı ve claim ile çözülüyor (§59, §61) — kilit eklemek ikinci bir doğruluk kaynağı yaratırdı | Kilit gerektiren yeni bir sıcak satır |
| **Aktör önbelleğinde yetki geri alma** | Rol yetkileri yalnız seed ile değişiyor; çalışma zamanı komutu **yok** (§79.1). Komut eklendiği gün 5 dakikalık bayat yetki penceresi gerçek olur ve bust gerekir | Rol/yetki yönetim ucu |

## 81. Değişmezler nerede duruyor: uygulamada mı, veritabanında mı? (tur 27)

**Kapsam.** Kontrol listesinin **finansal değişmezler**, **negatif bakiye
önleme**, **veri bütünlüğü / şema evrimi** ve **gözlemlenebilirlik** satırları.
Denetlenen yüzeyler: şemadaki **95 para kolonunun** hassasiyet/ölçek haritası,
48 `onDelete: Cascade` ilişkisi ve finansal modellerde hard-delete taraması,
idempotency anahtarlarının DB kısıtları, yevmiye satırının tutar kapısı, kasa
çekmecesi (giriş/çıkış dengesi), ve "yazılabilen ama hiç okunmayan" ayar
kolonları.

Turun sorusu tek cümle: **uygulamanın doğru kabul ettiği şey, veritabanında da
doğru mu?** Yazma anı kontrolü yalnız o kapıdan geçen satır için çalışır —
kapı yokken yazılmış satırlar için hiç çalışmamıştır, kapıyı atlayan bir yol
(raw SQL, veri taşıma betiği, ileride yazılacak bir `updateMany`) için de
çalışmaz.

### 81.1 Önce ölçülmüş ve güvenli olanlar

| Konu | Ölçüm |
| --- | --- |
| **Finansal tabloda hard delete** | **Yok.** `journalEntry`, `journalLine`, `financialEvent`, `payment`, `posTransaction`, `invoice`, `purchaseInvoice`, `cashMovement`, `cashSession`, `accountingPeriod`, `treatmentCharge`, `stockMovement` modellerinde tek bir `.delete(` / `.deleteMany(` çağrısı yok (tarama yapıldı). Defter yalnız storno ile düzeltiliyor (kural 8) |
| **Defterin FK koruması** | `JournalEntry → Clinic` ve `→ AccountingPeriod` ilişkilerinde `onDelete` **yazılmamış** → zorunlu ilişkinin varsayılanı `Restrict`: fişi olan klinik ya da dönem silinemez. `JournalLine → JournalEntry` `Cascade` ve bu **doğru** — satır fişin parçasıdır, fişten bağımsız yaşamaz |
| **Idempotency anahtarları** | Hepsinin DB kısıtı **var**: `FinancialEvent.dedupeKey @unique`, `JournalEntry.eventId @unique`, `@@unique([clinicId, periodId, entryNo])`, `@@unique([subscriptionId, periodStart])`, `@@unique([clinicId, supplierId, invoiceNumber])` + kısmî unique index'ler (aktif fatura, kasa başına tek açık oturum, satış başına tek canlı iptal). "Kod idempotent sanıyor ama kısıt yok" vakası **bulunamadı** |
| **Fatura numarası** | `invoiceNumber @unique` **global**, ama numarayı **entegratör** veriyor (GİB serisi, kesen mükellefe özgü); yerel üretim yok → kiracılar arası çakışma yolu yok |
| **Para kolonu haritası** | 95 kolon: para ölçeği her yerde **2**, kur **6**, miktar **3**, oran **2**. Para hattında **daralan** bir adım yok (fatura `12,2` → yevmiye `14,2`: genişliyor). `health-tourism.fxRate (12,6)` ↔ `journal_lines.fx_rate (18,6)`: ölçek aynı, hassasiyet geniş tarafa akıyor |
| **Çevrim yuvarlaması** | Satır-başı `Money.scale` + artık `FxConversion.roundingBalance` ile kambiyo satırına yazılıyor; artık sınırı "satır sayısı × 1 kuruş" (§71) — bu turda bozulmadığı doğrulandı |

### 81.2 P0 — kasadan, içinde olmayan para çıkarılabiliyordu

`record-cash-movement` kasa oturumunu `FOR UPDATE` ile kilitliyor, oturumun
**açık** olduğunu doğruluyor, yetkiyi `FinancePolicy` ile kontrol ediyor, tutarın
pozitif ve kuruş ölçeğinde olduğunu entity'de zorluyor — ve **çekmecede o para
var mı diye hiç sormuyordu.** Çıkış türlerinin dördü (`REFUND_PAYOUT`,
`EXPENSE`, `CASH_OUT`, `BANK_DEPOSIT`) sınırsızdı.

Fiziken imkânsız olan durum kayda girdiğinde **iki uydurma iz** bırakıyor.
1.200 ₺'lik çekmeceden 50.000 ₺ "bankaya yatırma" kaydedilsin:

1. **Hiç yatırılmamış para bankaya borç yazılır.** Kapanış köprüsü
   `bankDepositTotal`'ı olduğu gibi fişler: `B 102 Bankalar / A 100 Kasa`
   50.000 ₺.
2. **Hiç kazanılmamış gelir yazılır.** Kapanışta `beklenen = açılış + girişler −
   çıkışlar` = −48.800 ₺; sayım (gerçek para) 1.200 ₺ → `fark = sayım −
   beklenen` = **+50.000 ₺** ve kural pozitif farkı "sayım fazlası" diye
   fişler: `B 100 Kasa / A 679 Diğer Olağandışı Gelir`.

İkisi de **kendi içinde dengeli** fiş üretir; Σborç = Σalacak kontrolü sessiz
kalır, mizan tutar, 100 Kasa borç bakiyesine geri döner. Yani hata yalnız
"kasada eksi para" olarak değil, **gelir tablosunda uydurma gelir** ve
**bilançoda olmayan banka mevcudu** olarak görünür. Aynı boşluk çift harcamanın
da kapısıdır: iki iade ödemesi aynı nakitten iki kez çıkabilir.

**Düzeltme.** Kural çekmecenin sahibine, yani oturum aggregate'ine kondu:

| Parça | Ne yapar |
| --- | --- |
| `CashSession.availableCash(totals)` | Çekmecedeki nakit = `openingFloat + Σgiriş − Σçıkış`. Kapanıştaki `expectedAmount` **artık aynı metottan** hesaplanıyor: iki ayrı formül yazılsaydı biri düzeltildiğinde kapı ile kapanış beklentisi ayrışır ve kasa yine eksiye düşebilirdi |
| `CashSession.assertCanWithdraw(input)` | Çıkış > çekmece ise `InsufficientCashInDrawerException` (409) — `meta` çekmecedeki ve istenen tutarı taşır (`@shared/modules/cash-register/interfaces`), personel hatayı okuyup düzeltebilir |
| `record-cash-movement.handler` | Yön hareketin **kendi** türetmesinden okunur (`movement.direction`; IN/OUT eşlemesinin ikinci kopyası handler'a yazılmadı). Toplamlar oturum satırı **kilitliyken** ve aynı transaction içinde Command Repo'dan okunur — kilitsiz okuma iki eşzamanlı çıkışın aynı parayı iki kez harcamasına izin verirdi |
| `close-cash-session.handler` | Beklenen tutar negatifse **CRITICAL** uyarı basar (kapanış bloke edilmez: kasanın kapanabilmesi gerekir) ve uyarı, uydurma "fazla"yı fişleyecek köprüden **önce** çıkar. Kapı kurulduktan sonra bu yalnız eski verinin izidir |

Giriş hareketinde toplam **hiç okunmaz**: kapı yalnız çıkışa aittir, gereksiz
sorgu eklemez.

### 81.3 P1 — defterin kendi kapısı kuruş ölçeğini zorlamıyordu

`JournalEntryLineAmount` satır tutarının negatif olmadığını, borç/alacak XOR'unu
ve en az birinin sıfırdan büyük olduğunu doğruluyordu — **ölçeği** değil. Kolon
`Decimal(14,2)`: üçüncü basamak taşıyan bir tutar hata vermez, **sessizce
yuvarlanır**.

Kritik olan şu sıralama: denge kontrolü (`JournalLines.validateBalance`,
`post-financial-event`'teki toplamlar) **yuvarlamadan önce**, ham `Decimal`'ler
üzerinde yapılıyor. Yani uygulama `Σborç = Σalacak` görür, veritabanı **bir
kuruş şaşmış** fiş saklar:

```
komisyon  10.005  +  tedarikçi  89.995  =  satış 100.00   ← denge kontrolü geçer
          10.01   +             90.00   =        100.01   ← saklanan hâli dengesiz
```

Fark fişin **içinde** kaldığı için mizan yine dengeli görünür — klasik sessiz
sınıf.

Bugün bu boşluğu üç ayrı üst kapı kapatıyor: olay gövdesi şemasının `amount`
regex'i (≤2 hane), posting kurallarının `toFixed(2)`'si ve çevrimin
`Money.scale`'i. **Hiçbiri yevmiyenin kendi kuralı değil.** §73'ün kuralı burada
da geçerli: bir kontrol ikinci kez gerekiyorsa o bir kuraldır — kopyalanmaz,
taşınır. Ölçünün tanımı tek yere alındı (`Money.isKurusScaled` — yüklem, hata
fırlatmaz) ve üç yerden zorlanıyor:

| Yer | Hata |
| --- | --- |
| `JournalEntryLineAmount.create` (borç/alacak) | `InvalidJournalLineAmountException` |
| `JournalLine.create` (`originalDebit`/`originalCredit`) | aynı hata — izlenebilirlik kolonu saklanan değerden saparsa `original × fxRate ≈ debit` mutabakatı hiç tutmaz |
| `CashSession` / `CashMovement` | kendi `CashInvalidPrecisionException`'ı (ölçü tek yerde, hatanın kimliği kendi yerinde) |

### 81.4 P1 — saklanan defterin değişmezlerini kimse sormuyordu

Yazma anı kontrolü geçmişi kapsamaz ve uygulamayı atlayan yolu kapsamaz. Buna
karşılık sistemde **tek bir** değişmez sorgusu yoktu: dengesiz bir fiş mizanda
görünmez (fark fişin içinde kalır), eksi kasa kapanışta "fazla" gibi görünür.
Sessiz kalan hatanın bir sorgusu olmak zorundadır.

**(a) Tarama — `pnpm finans:degismezler`** (`scripts/finance-invariants.cjs`,
salt okuma, aykırılık varsa çıkış kodu 1). Yedi kontrol:

| Kontrol | Neden sessiz |
| --- | --- |
| Dengesiz fiş (Σborç ≠ Σalacak) | Fark fişin içinde kalır; mizan dengeli görünür |
| İki satırdan az satırlı fiş | Karşı hesap hiç yazılmamış demektir |
| Satır tutarı ihlali (negatif / iki yanı dolu / sıfır) | Negatif borç "ters alacak" gibi davranır; mizanı doğru, hesabın karakterini yanlış gösterir |
| Geçersiz kur / negatif orijinal tutar | Sıfır kur çevrilmiş satırı sessizce sıfırlar, fiş yine denk görünür |
| Fiş ↔ dönem klinik uyuşmazlığı | Fiş başka kiracının dönemine düşmüşse o dönem kapandığında kilitlenmez |
| Eksi kasa (beklenen < 0) | §81.2'nin izi: uydurma "fazla" → 679 |
| Açık oturumda eksi çekmece | Kapanış beklenmeden görülür |

Otomatik onarım **yok**: dengesiz bir fişi "düzeltmek" muhasebe kararıdır
(kural 8 — POSTED fiş yerinde kalır, düzeltme storno ile). Mevcut veritabanında
tarama çalıştırıldı: **yedi kontrolün hepsi temiz.**

**(b) Kısıtlar DB'ye yazıldı** — migration `20261015100000_financial_invariant_checks`:
`journal_lines` için borç/alacak ≥ 0, XOR, en az biri > 0, orijinal tutar ≥ 0,
kur > 0; `cash_movements.amount > 0`; `cash_sessions.opening_float >= 0`.

Hepsi **`NOT VALID`**: kısıt yeni ve güncellenen satırlar için hemen geçerli
olur, mevcut satırlar taranmaz. Gerekçe iki yanlı — (a) üretimde tam tablo
taraması uzun bir `ACCESS EXCLUSIVE` kilidi demektir, (b) kapı yokken yazılmış
aykırı bir satır varsa migration patlar ve **dağıtımı durdurur**; oysa o satır
bir veri sorunudur, şema sorunu değil. Tarama temiz çıktığında kısıtlar
`ALTER TABLE … VALIDATE CONSTRAINT …` ile tam güvenceye alınır (adım §82'de).

Fiş başına denge **CHECK ile ifade edilemez** (birden çok satırı ilgilendirir);
oraya tetikleyici yazmak yerine uygulama kapısı + tarama seçildi (§82).

### 81.5 Ölçüm — yazılabilen ama hiç okunmayan ayar kolonları

`clinic_finance_settings` üç kolon taşıyor ve ikisini **hiçbir karar okumuyor**:

| Kolon | Durum |
| --- | --- |
| `maxDiscountPercent` | **Okunuyor** — `add-treatment-charge` ve `update-charge-discount` tavanı entity'ye geçiriyor, aşımı yalnız kliniği yöneten aktör onaylıyor |
| `allowNegativeBalance` + `maxNegativeBalanceAmount` | **Hiç okunmuyor.** Entity yazma anında doğruluyor (negatif olamaz), yanıt DTO'su arayüze serileştiriyor; "hasta borçlu kalabilir mi / tavanı ne" kararını veren tek satır kod yok |
| `defaultVatRate` | Yalnız yanıt DTO'sunda; KDV oranının gerçek kaynağı `tax_parameters` + `VatRate` VO'su |

Kural 10'un ikinci yarısı: *okunmayan bir bayrak kolonu güvence değil süstür —
ya çözüm noktasında zorlanır ya kaldırılır.* Üçü de bir **ürün kararı** istiyor
(hangi bakiye: fişlenmiş satırlar mı, kesilmiş faturalar mı? tavanı kim
aşabilir? oran çakışmasında hangisi kazanır?) ve ikisi kiracılar arası
davranış değiştirir. Bu yüzden bu turda **kod değişmedi**; kalem iş paketi
**21** olarak açıldı ve karar alternatifleri yazıldı (§82).

### 81.6 Doğrulama

| | |
| --- | --- |
| `tsc --noEmit` | api **0** |
| Yeni/değişen test | `cash-session.entity.spec.ts` (+5 çekmece kapısı), **yeni** `record-cash-movement.handler.spec.ts` (6), **yeni** `close-cash-session.handler.spec.ts` (2), **yeni** `journal-entry-line-amount.spec.ts` (7) |
| Kırmızı doğrulaması | Kuruş yüklemi etkisizleştirilince satır-tutarı testlerinin **3'ü** kırmızı; kapı geri konunca 7/7 yeşil |
| Tarama | `pnpm finans:degismezler` canlı veritabanında çalıştırıldı — 7 kontrol, aykırılık yok |
| Migration | **1 yeni** (`financial_invariant_checks`, hepsi `NOT VALID` → mevcut veriye dokunmaz) |

## 82. Bilinçli yapılmayanlar — değişmezler turu

| Konu | Neden şimdi değil | Tetikleyici |
| --- | --- | --- |
| **Hasta borç tavanı** (`allowNegativeBalance`, `maxNegativeBalanceAmount`) | Zorlamak için "bakiye"nin tanımı gerekiyor (fişlenmiş `treatment_charge` satırları mı, kesilmiş faturalar mı, tahsilat farkı mı), okuma **modüller arası** (charge ↔ payment) ve yazma kararını beslediği için kilitli olmak zorunda; ayrıca tavanı kimin aşabileceği `maxDiscountPercent`'teki gibi bir onay yolu ister. Alternatif yol kolonları **kaldırmak** — o da yıkıcı bir migration ve arayüz sözleşmesi değişikliği. İkisi de ürün kararı | Hasta cari ekstresi / bakiye okuma modeli yazıldığında (iş paketi 21) |
| **`NOT VALID` → `VALIDATE CONSTRAINT`** | Doğrulama tam tablo taraması + uzun kilit demek; üretimde taramanın temiz çıktığı görülmeden yapılmaz. Geliştirme veritabanı temiz, üretim verisi **ölçülmedi** | Migration uygulandıktan sonra `pnpm finans:degismezler` üretimde temiz çıktığında |
| **Fiş başına denge DB'de** | Tek satırlık `CHECK` ile ifade edilemez; `DEFERRABLE` kısıt ya da tetikleyici gerekir. Tetikleyici defterin yazma yoluna görünmez bir mantık ekler (hata mesajı uygulamanın tipli hatası olmaz) — bugün uygulama kapısı + tarama yeterli | Uygulamayı atlayan bir yazma yolu doğarsa (veri taşıma betiği, raw SQL toplu düzeltme) |
| **Taramanın zamanlanmış işe bağlanması** | Bugün elle çalıştırılan bir komut. Zamanlanmış hâli (`@Cron` + CRITICAL) fişlenmemiş olay süpürmesinin yanına girer; o işin kendi penceresi/ayarı var, ikisini birlikte tasarlamak gerekir | Dönem sonu fiş takımı turu (zaten zamanlanmış işleri elden geçirecek) |
| **`toFixed(2)`'nin para üreten çağrı yerleri** | Ölçüldü: para üreten her çağrının çıktısı olay gövdesi regex'inden (≤2 hane) ya da kolon ölçeğinden geçiyor, bugün sapma üretmiyor. Tek risk `Decimal.rounding` global ayarının değişmesi — `Money.scale` bundan bağımsız, `toFixed` değil. Süpürme mekanik ama geniş (yanıt DTO'larındaki kullanımlar **meşru**: string serileştirme) | Yuvarlama modunun değişmesi gerekirse ya da `Money.scale` dışında bir mod ihtiyacı doğarsa |
| **`invoicePrefix` ayarı** | Yerel fatura numarası üretimi yok (numarayı entegratör veriyor); kolon bir niyet izi. Kaldırmak ya da kullanmak e-belge adapter'ı turuna ait | Gerçek e-belge adapter'ı (iş paketi 1) |
| **`ProjectCost` satırının silinebilmesi** | Para taşıyan tek silinebilir satır (`projectCost.delete`). Bugün **posting yok** — proje maliyeti bir etiketleme defteri; silme iz bırakmıyor ama defteri bozmuyor | `ProjectCost` deftere bağlanırsa (o anda silme yerine storno gerekir) |

## 83. Uyarı kime gidiyor? Alarmın kendi güvencesi (tur 28)

**Kapsam.** Kontrol listesinin **gözlemlenebilirlik / alarm** satırı. Bu tur
öncekilerin **bağımlılığını** denetliyor: §23'ten bu yana onlarca kalem "yutulan
hata için CRITICAL uyarı çıkar" diye kapatıldı (bugün **41 `publish` çağrı
yeri**). O cümle ancak uyarı bir insana ulaşıyorsa bir güvencedir.

Denetlenen zincir: `CriticalFailurePublisher` → `emitDetached` → `CriticalFailureListener`
→ `OPS_ALERT_PORT` (Slack / log adaptörü) → kanal; ayrıca denetim izinin (audit
log) yazma yolu, dinleyicilerin DI grafiğine kaydı ve sürecin ölümü.

### 83.1 Önce ölçülmüş ve güvenli olanlar

| Konu | Ölçüm |
| --- | --- |
| **Slack adaptörü** | Olgun: asla fırlatmaz (uyarı gönderirken çağıranı ikinci kez düşürmez), kanal erişilemezse **log adaptörüne düşer**, aynı `dedupeKey` 10 dk bastırılır ama kalıcı susturulmaz, Redis hatası **geçirme** yönünde çözülür (kopya uyarı gürültü, kayıp uyarı arıza), timeout 4 sn, bağlam alanı 8 ile sınırlı |
| **Severity yönlendirmesi** | `CRITICAL` için ayrı kanal tanımlıysa oraya, yoksa varsayılan kanala; log adaptöründe CRITICAL → `logger.error`, WARNING → `logger.warn` |
| **Dinleyici** | `@OnDomainEvent` ile kayıtlı (beklenen + hatası çağırana ulaşan kapı) ve kanal hatasını **bilerek** yutuyor: uyarı kanalının hatası yeni bir uyarı doğurmaz |
| **Özyineleme yok** | Uyarı yolu audit log yazmıyor, audit log yolu uyarı basıyor → tek yönlü; sonsuz döngü imkânsız |
| **`dedupeKey` kapsamı** | 41 çağrı yerinin **hiçbiri** `dedupeKey: null` geçmiyor; süpürme işleri klinik başına anahtar üretiyor (fırtına klinik sayısıyla sınırlı) |

### 83.2 P1 — alarm kanalı hiçbir ortamda bağlı değil; `.env.example`'da bile yazılı değildi

`opsAlertPortFactory`, `SLACK_OPS_WEBHOOK_URL` (ya da `…_CRITICAL`) tanımlıysa
Slack adaptörünü, değilse log adaptörünü seçiyor. Ölçüm: **iki değişken de
`envs/.env.development`, `envs/.env.production` ve `envs/.env.example`'ın
hiçbirinde yok.** Yani:

- her ortamda log adaptörü seçiliyor → 41 uyarının tamamı **bir log satırı**,
- `.env.example`'da yazılı olmadığı için kurulumu yapan kişi kanalın var
  olduğunu bile göremiyor; eksik bir şey olduğunu fark etmesinin yolu yok,
- seçim **sessiz** yapılıyordu: ne açılışta ne çalışma anında hiçbir iz.

§75'teki `POS_CALLBACK_SECRET` kalemiyle aynı sınıf ama bir fark var: orada kapı
**fail-closed** (anahtar yoksa uç 503). Uyarıda fail-closed diye bir şey yok —
"uyarı gönderemiyorsan çalışmayı durdur" denemez. O yüzden tek çare **görünür**
olmak:

| Parça | Ne yapar |
| --- | --- |
| `.env.example` | İki değişken, ne işe yaradıkları, tanımsızken ne olduğu ve Slack'te nereden alındığıyla belgelendi |
| `opsAlertPortFactory` | Seçimi açılışta duyuruyor: Slack ise `log`, kanal yoksa **geliştirmede `warn`, üretimde `error`** — üretimde eksik kanalın fark edilmesi şansa bırakılamaz |
| Testler | Dört dal da sabitlendi (webhook var / yalnız CRITICAL var / yok + geliştirme / yok + üretim) |

Joi şemasına **zorunlu olarak eklenmedi** (ikisi de `optional()` kalıyor):
zorunlu yapılsaydı Slack kullanmayan hiçbir kurulum açılmazdı — `POS_CALLBACK_SECRET`
için verilen kararın aynısı.

### 83.3 P1 — denetim izinin yazma yolu hatayı herkes adına yutuyordu

`AuditLogService.record()` tek bir `try/catch` ile **her** depolama hatasını
yutuyor, `logger.error` basıyor ve normal dönüyordu. İki ayrı sonucu vardı.

**(a) İz kaybı sessizdi.** Denetim izi, yüksek etkili işlemlerin kalıcı
damgasıdır (kural 7): storno kim attı, kilitli dönemi kim açtı, kart iadesini
kim başlattı. Mongo düştüğünde ya da yazma reddedildiğinde işlem tamamlanıyor,
iz **kalıcı olarak** kayboluyor ve ne uyarı ne rapor ne yeniden deneme vardı.
55 çağrı yerinin **27'si `security()`** — yani yetkisiz erişim denemelerinin
kaydı da bu yoldan geçiyor: "deneme loglandı" ifadesi doğru değildi.

**(b) Çağıranların `catch` blokları hiç tetiklenemiyordu.** 20'den fazla
dinleyici `await this.auditLogService.info(...)` çağrısını `try/catch` ile
sarıp "audit yazımı para hareketini geri almaz; yalnız iz kaybını raporlar"
yorumunu yazmıştı. `record()` hiç fırlatmadığı için bu blokların hiçbiri
çalışamazdı: niyet koda yazılmış ama **etkisiz**. §77'nin kuralı burada da
geçerli — *hatayı kimin yutacağına çağıran karar verir, altyapı herkes adına
karar vermez.*

**Düzeltme.** `record()` artık (1) operasyonel uyarı basıyor —
`SECURITY`/`CRITICAL`/`ERROR` kaybı **CRITICAL**, bilgi kaydı WARNING; `dedupeKey`
eylem bazlı (`audit-log-write-failed:<type>:<action>`) olduğu için depolama
tamamen düştüğünde eylem başına tek mesaj gider — ve (2) `AuditLogWriteFailedException`
fırlatıyor. Davranış bugün değişmiyor (dinleyiciler yakalayıp log'luyor, ana
işlem geri alınmıyor) ama karar artık gerçekten onların ve **outbox'tan beslenen
bir dinleyici yeniden denenebilir**. `try/catch`'i olmayan tek yer
(`organizations-soft-deleted.listener.ts`, iki çağrı) bilerek öyle bırakıldı:
hata kanalına ulaşır, kanal kararını verir.

### 83.4 P1 — grafikten düşen bir dinleyici her şeyi sessizce iptal eder

`app.module.spec.ts` her `@CommandHandler`/`@QueryHandler`'ın DI grafiğinde
kayıtlı olduğunu doğruluyordu — commit `99472fe5`'in 304 provider'ı kayıtsız
bıraktığı olaydan sonra yazılmıştı (bkz. `documents/di-wiring-gap.md`).
**Dinleyiciler bu ağın dışındaydı** ve aradaki fark kritik:

- kaydolmayan bir **handler**, uç çağrıldığında `QueryHandlerNotFoundException`
  ile patlar — gürültülü,
- kaydolmayan bir **dinleyici** hiç patlamaz: `emitAsync` sıfır dinleyiciye
  yayın yapar, boş dizi döner, akış devam eder. Yani grafikten düşmüş bir
  dinleyici bağlı olduğu güvenceyi (muhasebe köprüsü, audit log, **kritik hata
  uyarısı**, stok defteri) **sessizce** iptal eder.

Ölçüm: bugün 56 dinleyici dosyasının hepsi kayıtlı. Ama bunu koruyan bir şey
yoktu → `app.module.spec.ts`'e dördüncü test eklendi: kaynak ağacında
`EVENT_LISTENER_METADATA` taşıyan her sınıf grafikte kayıtlı olmak zorunda.
Kırmızı doğrulandı (`CriticalFailureListener` providers'tan çıkarıldığında test
sınıfın adını vererek kırmızıya düşüyor).

Buna ek olarak alarmın **son durağı** da sessiz kalmıyor:
`CriticalFailurePublisher` yayından önce `listenerCount` kontrol ediyor; sıfırsa
uyarının içeriğini (özet + hata + bağlam) `logger.error` ile basıyor. Grafik
testi önleyici, bu kontrol telafi edici.

### 83.5 P2 — sürecin ölümü kimseye haber verilmiyordu

Yakalanmayan bir promise reddi ya da exception Node'u düşürür (bu projede
ölçülmüştü: §77'de `emitDetached` tam bu yüzden yazıldı). Düştüğü anda uçuşta
olan istekler yarıda kalır — finans tarafında bu "para alındı, defter
yazılmadı" ya da "sağlayıcıda rezervasyon açık, kaydı yok" demektir. Platform
süreci yeniden başlatıyor ve **hiç kimseye haber verilmiyordu**: `process.on`
kancası hiçbir yerde yoktu, tek iz kimsenin izlemediği bir stdout satırıydı.

`installProcessFailureAlarms` (main.ts'te bağlı) iki olayı da CRITICAL uyarıya
çeviriyor ve **süreci yine kapatıyor**: durumu bozulmuş bir süreci ayakta tutmak
daha kötüsüdür (para hareketine devam eder). Kapanmadan önce uyarının ağa
çıkması için 500 ms pencere bırakılıyor; ikinci ölüm olayı kanalı meşgul etmiyor;
yığın izi **log'a** gidiyor, kanala yalnız hata adı ve pid (kanal dışına ayrıntı
sızmaz — §75).

Aynı başlığın en sessiz hâli **açılış hatası**: o anda ne konteyner ne uyarı
kanalı vardır, `bootstrap()` yakalanmayan bir promise olarak bırakılmışsa hata
Node'un genel mesajına karışır ve yeniden başlatma döngüsünde sebebi kaybolur.
`bootstrap().catch(...)` artık hatayı adıyla log'luyor ve sıfırdan farklı çıkış
kodu garanti ediyor.

### 83.6 Doğrulama

| | |
| --- | --- |
| `tsc --noEmit` | api **0** |
| Yeni/değişen test | **yeni** `audit-log.service.spec.ts` (5), **yeni** `process-failure-alarms.spec.ts` (5), `critical-failure.publisher.spec.ts` (+1 dinleyicisiz yol), `notification-event.module.spec.ts` (+2 eksik kanal duyurusu), `app.module.spec.ts` (+1 dinleyici kaydı) |
| Kırmızı doğrulaması | `CriticalFailureListener` providers'tan çıkarıldığında grafik testi kırmızı (sınıf adını vererek) |
| Migration | **yok** |
| Operasyon işi | `SLACK_OPS_WEBHOOK_URL` üretim/geliştirme ortamında **hâlâ tanımsız** — artık `.env.example`'da belgeli ve açılışta duyuruluyor; değerini koymak operasyon kararı |

## 84. Bilinçli yapılmayanlar — alarm turu

| Konu | Neden şimdi değil | Tetikleyici |
| --- | --- | --- |
| **İz kaybının kalıcı telafisi** (audit log) | Kural 4'ün tam reçetesi "retry **veya** backfill + eksik kalanlar sorgusu" diyor. Uyarı + çağırana ulaşan hata bugün ilkini mümkün kılıyor (outbox'tan beslenen dinleyici yeniden denenir) ama in-memory kanaldan gelen izin kalıcı bir kuyruğu yok. Doğru çözüm audit yazımını outbox'a almak; bu, audit'in Mongo'da yaşamasıyla ilgili daha büyük bir karar | Denetim izinin ilişkisel tarafa taşınması ya da audit için ayrı bir kuyruk kararı |
| **Uyarı fırtınası sınırı** (operasyon başına üst sınır) | Bugün tek savunma `dedupeKey` + 10 dk pencere. Süpürme işleri klinik başına anahtar ürettiği için fırtına klinik sayısıyla sınırlı (ölçüldü: iki klinik). Operasyon başına global bir sayaç, gerçek bir fırtına görülmeden ayarlanamaz — yanlış eşik uyarıyı susturur | Kanal bağlandıktan sonra ilk gerçek olay dalgası |
| **Uyarıların bir panoda toplanması** (alert geçmişi) | Slack kanalı geçmiş tutar ama sorgulanamaz; "bu klinikte son 30 günde kaç köprü hatası" sorusunun cevabı yok. Uyarıları kalıcı bir tabloya yazmak (ve oradan raporlamak) ayrı bir modül kararı — bugünkü ihtiyaç **haberdar olmak**, trend değil | Kanal bağlandıktan ve uyarı hacmi görüldükten sonra |
| **Sağlık kontrolü ucunun uyarıya bağlanması** | `/health` var ama düşen bir bağımlılık (Mongo/Redis/NATS) uyarı üretmiyor; bugünkü uyarılar **iş akışı** hatalarından doğuyor. Altyapı sağlığı izlemenin (uptime servisi) işi; iki kanalı birleştirmek önce izleme kararı ister | Altyapı izleme kurulumu |
| **Yığın izinin kanala taşınması** | Bilerek yok: `OpsAlertInput.errorMessage` sözleşmesi "yığın izi taşınmaz" diyor (§75 — hassas veri hata metninden de sızar). Kanal adres verir, ayrıntı log'da kalır | — |

## 85. 108 hiç kapanmıyordu: sağlayıcı hesap kapaması (tur 29)

**Kapsam.** Kontrol listesinin **settlement / mutabakat** satırı. Bu tur bir
denetim değil, **eksik bir akışın kurulması**: kodda bir hata aramadım, defterde
kapanmayan bir hesap buldum.

### 85.1 Bulgu — üç yanlış, hepsi dengeli mizan üretiyor

Kartla tahsil edilen para üye işyeri hesabına anında geçmez: sağlayıcı (iyzico,
banka POS) tutarı biriktirir, komisyonunu keser ve valör günü net tutarı bankaya
aktarır. Defter bunu doğru modelliyordu — `payment-received.rule` POS tahsilatını
`B 108 Diğer Hazır Değerler / A 120 Alıcılar` yazıyor, yani "para sağlayıcıda
yolda" diyor. Fakat **108'i kapatan hiçbir akış yoktu**: ne olay tipi, ne posting
kuralı, ne komut. `653 Komisyon Giderleri (POS/Banka)` hesabı şablonda duruyor ve
hiç kullanılmıyordu — yer açılmış, akış hiç yazılmamış (kuralın yorumunda da
yazılıydı: *"POS komisyon/valör ayrıştırması sonraki fazda"*).

Sonuç, her kart işleminde birlikte yaşayan üç hata:

| # | Hata | Nerede görünür |
| --- | --- | --- |
| 1 | **108 sonsuza kadar şişer** — tahsil edilen her kuruş orada kalır | Bilanço: var olmayan bir hazır değer |
| 2 | **Para 102 Bankalar'a hiç girmez** | Banka ekstresine gelen payout **hiçbir fişle eşleşemez** → §49'un mutabakatında kalıcı `UNMATCHED` |
| 3 | **Sağlayıcı komisyonu hiç gider yazılmaz** | Gelir tablosu: kâr, komisyon kadar **fazla** görünür (her kart işleminde) |

Üçü de dengeli bir mizan üretir: `Σborç = Σalacak` tutar, dengesiz fiş taraması
(§81.4) temiz çıkar, hiçbir kontrol uyarmaz. Klasik sessiz sınıf — ama bu kez
eksik olan bir kontrol değil, **bir ekonomik olayın kendisi**.

### 85.2 Kurulan akış

Kayıt **sağlayıcının payout raporundan** girilir: bugün ne iyzico ne banka POS
için settlement API'si bağlı (banka ekstresi importu da elle — §23). Bu yüzden
`reference` sağlayıcının kendi payout referansıdır ve idempotency anahtarının
yarısıdır.

| Parça | Ne |
| --- | --- |
| `ProviderSettlement` (yeni aggregate, `finance/bank`) | Payout kaydı: sağlayıcı, referans, tarih, brüt/komisyon/net, banka hesabı, köprü izi. Tek iç değişmezi **brüt = net + komisyon** (birebir, tolerans yok) |
| `PROVIDER_SETTLEMENT_RECEIVED` (yeni olay tipi) | Gövde şeması üç tutarı ve eşitliği **yazma anında** zorlar — gövde append-only olduğu için ret, kaynağın tutarı hâlâ düzeltebildiği yerde verilir (§53 gerekçesi) |
| `ProviderSettlementReceivedRule` | `B 102 net + B 653 komisyon / A 108 brüt`. Komisyon sıfırsa 653 satırı **yazılmaz** (sıfır tutarlı satır geçersiz — §81.4) |
| `FUNDS_IN_TRANSIT_GATE` (yeni domain servisi, posting) | 108 bakiyesinden fazlası kapatılamaz: `assertCanSettle` bakiyeyi **kilit altında** okur ve aşımı reddeder |
| `RecordProviderSettlementCommand` (banka modülü) | Kapılar sırayla: yetki (kendi capability'si) → banka hesabının kiracısı → dönem kapısı (payout tarihi) → 108 bakiyesi → kayıt + olay, hepsi **tek `outboxRun`** içinde |
| `provider_settlements` tablosu | `@@unique([clinicId, provider, reference])` + iki `CHECK` (tutarlar pozitif, brüt = net + komisyon) |

**Neden 108 kapısı, §81'in kasa kapısının aynısı.** Fazlası kapatılırsa hesap
**alacak bakiyesine** düşer; bir hazır değer hesabı için bu imkânsızdır ve
karşılığında 102'ye hiç gelmemiş para girer. Fiş kendi içinde dengeli olduğu için
hata yine sessizdir → kontrol kaydın **önüne** konur, kapanış hesabına değil.

Kilidin biçimi yeni bir primitif gerektirdi: *"108'in bakiyesi"* on binlerce fiş
satırının toplamıdır, `FOR UPDATE` ile kilitlenecek bir satırı yoktur (hepsini
kilitlemek fiş yazan her akışı bloklardı). `BaseRepository.lockConcept` bir
**isme** danışma kilidi tutar (`pg_advisory_xact_lock`): transaction sonunda
kendiliğinden bırakılır, hiçbir satırı bloklamaz, yalnız aynı anahtarı isteyen
diğer akışı serileştirir. Okuma ve kilit **tek metotta**
(`lockAndGetAccountBalance`) — CLAUDE.md'nin `lockAndGet*` kuralı: bölünürse
çağrı sırası derleyiciye görünmez olur ve bakiye kararı sessizce kilitsiz veriyle
verilir.

**Hesap planı kurulmamış şubede kapı geçirir** (uyarı basarak): korunacak bir 108
bakiyesi yoktur ve `PeriodGateService` ile aynı tercih — muhasebesi kurulmamış bir
şubede operasyonel kaydı reddetmek kaydın kendisini imkânsız kılar; fişlenemeyen
olay zaten süpürme uyarısıyla görünür kalır (kural 4).

**Komisyonun KDV'si ayrıştırılmadı.** 653'e brüt yazılıyor; indirilecek KDV
sağlayıcının **faturasından** doğar (ayrı belge, ayrı olay). Faturası gelmeden KDV
indirmek, brüt gider yazmaktan daha yanlıştır (§86).

### 85.3 Doğrulama

| | |
| --- | --- |
| `tsc --noEmit` | api **0** |
| Yeni test | `provider-settlement.entity.spec.ts` (10), `provider-settlement-received.rule.spec.ts` (5), `funds-in-transit.gate.spec.ts` (6), `record-provider-settlement.handler.spec.ts` (10) |
| Kapı sırası | Handler testi sırayı birebir doğruluyor: `periodGate → fundsGate → create → financialEvent → update`, hepsi `outboxRun` derinliğinde |
| Yetki matrisi | Yeni model → `providersettlement` yetki ailesi otomatik doğdu; etiketi ve rol demeti (**TREASURY**) eklendi, `roles.spec` yeşil |
| Tarama | `pnpm finans:degismezler`'e **eksi 108** kontrolü eklendi (canlı DB'de temiz) |
| Migration | **1 yeni** (`provider_settlement`: tablo + enum değeri + 2 CHECK) → bekleyen **8** |

## 86. Bilinçli yapılmayanlar — hesap kapaması turu

| Konu | Neden şimdi değil | Tetikleyici |
| --- | --- | --- |
| **Komisyonun KDV'si (191)** | İndirilecek KDV sağlayıcının faturasından doğar; payout raporu fatura değildir. Oranı tahmin edip 191'e yazmak, faturası gelmeden KDV indirmek olur — brüt 653 daha az yanlıştır | Sağlayıcı komisyon faturalarının sisteme girmesi (alış faturası akışı zaten var: §13) |
| **108'in sağlayıcı bazında alt hesaplanması (108.01/108.02)** | Bugün tek 108: iyzico'nun bekleyen tutarı ile banka POS'unun bekleyen tutarı aynı bakiyede. Kapı toplam bakiyeye baktığı için A sağlayıcısının payout'u B'nin bekleyen tutarını kapatabilir. Alt hesap şablon değişikliği + mevcut fişlerin yeniden sınıflanması demek (geçmişi yorumlayan bir karar — kural 11) | İkinci sağlayıcı canlıya alındığında ya da ilk sağlayıcı-bazlı mutabakat ihtiyacında |
| **Bekleyen tahsilatların FIFO yaşlandırma raporu** | 108'in kebir dökümü (`accountLedger`) operatörün bugünkü görüşü; "hangi tahsilat kaç gündür bekliyor" FIFO eşleştirmesi ayrı bir okuma modeli ister. Değer, kanal bağlı olmadan ölçülemez (valör süreleri sağlayıcıya göre 1–30 gün) | İlk gerçek payout kayıtlarından sonra (yaşlandırma eşiği gerçek valör süreleriyle ayarlanır) |
| **Banka ekstresi satırı ↔ hesap kapaması otomatik eşleşmesi** | Oto-eşleştirme (§24) tutar+yön birebir çalışıyor; payout net tutarla gelir ve artık 102'de karşılığı var, yani **eşleşebilir** hâle geldi. Otomatik "bu satır şu payout" bağını kurmak ise ekstre satırına `settlementId` eklemek demek — ayrı bir mutabakat turu | İlk gerçek ekstre + payout çifti |
| **Sağlayıcı payout API'si** | Ne iyzico ne banka POS için settlement API adaptörü var; POS EOD turu (§56) aynı sebeple bloke. Elle giriş, raporun kendisi sağlayıcıdan geldiği için doğru veri kaynağıdır | Sağlayıcı dokümanı/sandbox (iş paketi 5 ile birlikte) |
| **Platform defterinin 108'i** | Sağlık turizmi tahsilatı platform defterine `B 108` yazıyor (§63) ve onun da kapanışı yok — Stripe/iyzico platform hesabına ödüyor. Aynı aggregate'i platform kiracısıyla kullanmak mümkün ama damgalanan kayıt farklı (`BookingPayment`), kesinti yapısı farklı (Stripe sabit+oran) | Platform payout mutabakatı (iş paketi 16 — artık bu turun altyapısı üzerine kurulabilir) |

## 87. Kart itirazı (chargeback): para geri gidiyor, defter tahsilatı göstermeye devam ediyor (tur 30)

**Kapsam.** `12-durum-devri.md` §10'daki "hiç denetlenmemiş" listesinin ilk satırı.
§85 gibi bu tur da bir **eksik akışın kurulması**: kodda yanlış çalışan bir
kural aramadım, hiç yazılmamış bir ekonomik olay buldum. Üstüne ölçüm sırasında
ikinci, daha tehlikeli bir delik çıktı: **çift iade** (87.1 #3). Kapsam kararı
(kullanıcı, 2026-10-19): yalnız **klinik defteri** — fiziksel POS (PAX, iyzico
terminal) + sanal POS (iyzico). Platform tarafı (Stripe `charge.dispute.*`,
rezervasyon, abonelik) ertelendi (§88).

### 87.1 Bulgu — üç yanlış, hepsi dengeli mizan üretiyor

Kart sahibi bankasına itiraz ettiğinde sağlayıcı parayı üye işyerinden geri
keser (bekleyen bakiyeden ya da doğrudan bankadan); sonuç haftalar sonra belli
olur. Kodda bu olayın **şema alanı, ucu ve akışı yoktu** (kelime yalnız bir spec
yorumunda geçiyordu).

| # | Hata | Nerede görünür |
| --- | --- | --- |
| 1 | **Tahsilat defterde kalır** — `B 108 / A 120` yazılmıştı, sağlayıcı parayı geri aldı ama hiçbir fiş yok | Bilanço: 108'de olmayan para; 120'de kapanmış görünen borç |
| 2 | **Payout'taki itiraz kesintisi 108'de takılır** — §85'in tek eşitliği brüt = net + komisyon; kesinti yazılacak yer yok | 108 sonsuza şişer, banka ekstresi eşleşmez |
| 3 | **Çift iade** — dört POS ters kayıt handler'ı ve sanal POS `refund-payment` / `cancel-payment` kümülatif tavanı **yalnız iadelerden** hesaplıyordu (`findLiveReversalSummary` yalnız REFUND/VOID sayar). İtiraz edilmiş satış ayrıca iade edilebiliyordu | Kart sahibine para **iki kez** gider (bir kez sağlayıcı kesintisi, bir kez bizim iademiz) |

Üçü de dengeli mizan üretir: `Σborç = Σalacak` tutar, hiçbir kontrol uyarmaz.
Üçüncüsü ayrıca **kasa/banka** tarafında gerçek para kaybıdır.

### 87.2 Kurulan akış

Kayıt **sağlayıcının itiraz bildiriminden elle** girilir (ne iyzico ne banka POS
için itiraz API'si var; `caseReference` sağlayıcının vaka numarası ve
idempotency anahtarının yarısı).

| Aşama | Fiş | Tarih |
| --- | --- | --- |
| **Açıldı** (`CARD_CHARGEBACK_OPENED`) | `B 127 tutar / A 108\|102 tutar` (+ ücret > 0 ise `B 653 ücret / A 108\|102 ücret`) | paranın kesildiği gün |
| **Kazanıldı** (`CARD_CHARGEBACK_WON`) | `B 108\|102 tutar / A 127 tutar` | sonucun belli olduğu gün |
| **Kaybedildi** (`CARD_CHARGEBACK_LOST`) | `B 120 (hasta) tutar / A 127 tutar` | sonucun belli olduğu gün |

| Parça | Ne |
| --- | --- |
| `CardChargeback` (yeni aggregate, `finance/bank`) | Tek yönlü durum makinesi `OPEN → WON \| LOST`; çözüm **tek seferlik**. Tutar pozitif, ücret ≥ 0, ikisi kuruş ölçeğinde, çözüm tarihi açılıştan önce olamaz |
| 3 olay tipi + 3 posting kuralı | `POSTABLE_FINANCIAL_EVENT_TYPES`'a ve `PostingRuleRegistry`'ye kayıtlı (açılışta kapsam karşılaştırılır); gövde şemaları yazma anında (ücret kuruş, LOST'ta `partyId` zorunlu) |
| `OpenCardChargebackCommand` | Kapı sırası: yetki → kaynak olguları (kilitsiz) → **tx:** kaynak kilidi → defterde var mı → kümülatif tavan → banka hesabı → dönem → 108 → cari → kayıt → olay → damga. Hepsi `outboxRun` |
| `ResolveCardChargebackCommand` | İtiraz satırı `FOR UPDATE`; durum geçişi yan etkilerden ÖNCE (ikinci çözüm hiçbir şey yazmaz); LOST'ta plan yansıması |
| `CHARGED_BACK` (yeni `InstallmentStatus` + `LedgerStatus`) + **telafi taksidi** | Kaybedilen itirazda taksit iade **değil** `CHARGED_BACK` olur; aynı tutarda `PENDING` telafi taksidi (`recoversInstallmentId`, DB'de `@unique`) hasta borcunun geçerliliğini taşır |
| 4 kilitli domain servisi (yaprak modüller) | `POS_CARD_COLLECTION_SERVICE`, `PAYMENT_COLLECTION_SERVICE` (`lockAndGet*`: kilit + okuma tek metotta), `FINANCIAL_EVENT_PRESENCE_GUARD`, `CARD_CHARGEBACK_EXPOSURE_GUARD` |
| **6 iade/iptal handler'ına tavan kapısı** | `pax-refund`, `pax-void`, `iyzico-terminal-refund`, `iyzico-terminal-void`, `refund-payment`, `cancel-payment` — `iade/iptal + aktif itirazlar + istenen ≤ tahsilat` |
| `card_chargebacks` tablosu | `@@unique([clinicId, provider, caseReference])` + 5 `CHECK` (tutar pozitif, ücret ≥ 0, `status = OPEN ⇔ resolved_at IS NULL`, `resolved_at ≥ opened_at`, `WON ⇔ resolved_funds_channel IS NOT NULL`, ONLINE'da `installment_id = source_id`) |
| Uçlar (`/api/v1/bank/…`) | `POST card-chargebacks` (`cardchargeback:create`) açılış; `POST card-chargebacks/:chargebackId/resolve` (`cardchargeback:update`) sonuç; `GET card-chargebacks?clinicId&status` (`cardchargeback:read`, `@Serialize` + `CardChargebackResponseDto`: kimlikler/köprü izleri yönetime kapalı). Yetki ailesi TREASURY demetinde |

**Payout ile ilişki (iki sıra da aynı sonucu verir).** 108'de 10.000 TL tahsilat
bekliyor; 1.000 TL'lik itiraz açılıyor, ücreti 25 TL; işlem komisyonu 185 TL.
Sağlayıcı bankaya 8.790 TL yatırıyor.

| | Sıra A: önce itiraz | Sıra B: önce payout |
| --- | --- | --- |
| 1. adım | itiraz açılır → 108: 10.000 − 1.025 = **8.975** | payout (brüt **8.975** = net 8.790 + komisyon 185) → 108: 1.025 kalır |
| 2. adım | payout (brüt **8.975** = net 8.790 + komisyon 185) → 108: **0** | itiraz açılır (kapı: 1.025 ≤ 1.025 ✓) → 108: **0** |

Payout kaydının brütü **"108'den kapanan tutar"**dır (tahsilat − itiraz kesintisi
− itiraz ücreti), sağlayıcının raporundaki brüt değil. Banka kanalında (para
doğrudan bankadan çekildiyse) açılış fişi 102'ye alacak yazar ve mevcut ekstre
oto-eşleştirmesi (§24) çıkış satırını yakalar.

### 87.3 Kararlar ve gerekçe (kullanıcı kararları, 2026-10-19)

| Karar | Gerekçe |
| --- | --- |
| **İtiraz süresince para 127 ara hesabında** (üç olay), doğrudan 120'de değil | Sonuç haftalar sonra belli olur ve üye işyeri delil sunabilir. Hastayı hemen borçlu yazmak kazanılabilecek bir itirazda haksızdır; hiç düzeltmemek parayı hâlâ elimizde saymaktır. 127 "para bizim değil ama henüz kaybedilmedi"yi açık bir hesapta tutar. **127 şablonda zaten vardı ve hiç kullanılmıyordu** → şablon değişmedi (kural 11 tetiklenmedi) |
| **Kaybedilen itiraz = yeni `CHARGED_BACK` durumu**, `REFUNDED` değil | İade bizim kararımızla geri verilen paradır ve hasta borcunu kapatır; ters ibraz geri **alınan** paradır, borç yerinde durur. İkisini aynı duruma koymak raporlarda iade ile itirazı ayırt edilemez kılar |
| **Telafi taksidi** | `CHARGED_BACK` taksit iptal edilmiş gibi aktif kümenin dışında; yerine aynı tutarda `PENDING` taksit. Σ aktif taksit = toplam tutar korunur, AR yaşlandırmada borç görünür, ödeme tahsil edilince kendi cari kaydıyla gelire geri girer |
| **Plan yansıması hata fırlatmaz** | Sağlayıcı parayı çoktan geri aldı, defter geri sarılamaz. Plana yansımayan (kısmi tutar, plansız çekim) itiraz için sonuç kayda yazılır (`planSyncStatus`) ve elle eşleştirme gerekenlerde CRITICAL uyarı çıkar — **tx bittikten sonra** (yayıncı transaction'a katılmaz, geri sarılan işlem için alarm çalmasın) |
| **Ücret 653'e** | Sağlayıcının kestiği bir hizmet ücreti; settlement komisyonuyla aynı hesap |
| **Yalnız klinik defteri** | Platform 108'inin henüz settlement'ı yok; orada kurulursa 108 yine kapanmaz (iş paketi 16) |

### 87.4 Tuzaklar (ölçülen ve düştüğüm)

| Tuzak | Ne oldu / ne yapıldı |
| --- | --- |
| **Kural 9 — `PaymentCommandRepository.update()` yeni taksidi hiç yazmazdı** | `update()` taksit listesini yalnız `UPDATE` ediyordu ("taksitler `create()`'te açılır"). Telafi taksidi ilk kez **mevcut bir plana yeni satır** ekliyor: `UPDATE` satır olmadığı için sessizce hiçbir şey yazmaz → hasta borcu defterde (`B 120`) var, planda yok. Çözüm: entity eklenen taksitleri izler (`newInstallmentIds`, repo `flushEvents` ile temizler), repo bunları INSERT eder, mapping **tek fonksiyonda** (`toInstallmentCreateData`). Kilit testi **kasıtlı bozularak kırmızı görüldü** (iki test düştü), sonra geri alındı |
| **Çalıştırılamayan kontrol "temiz" sayılıyordu** | `finance-invariants.cjs` bir kontrol patlayınca (tablo yok) uyarı basıp **atlıyor** ve sonda "Tüm değişmezler sağlam. `VALIDATE CONSTRAINT` yapılabilir" yazıyordu. Migration uygulanmadan çalıştırıldığında 4 yeni kontrol sessizce atlanıp "sağlam" denirdi (kural 15: kanıtlanmamış güvence güvence değildir). Artık çalışmayan kontrol **sonucu eksik** yapar ve çıkış kodu **2** verir |
| **Yeni enum değeri aynı migration'da kullanılmaz** | Postgres, aynı transaction'da `ADD VALUE` ile eklenen değeri kabul etmez. Migration'daki CHECK'ler yalnız aynı migration'da **yaratılan** enum'ların değerlerine bakar (o durumda kullanım serbest) |
| **Kilit sırası** | Açılışta kaynak satır kilidi → 108 danışma kilidi. İade/iptal yalnız satış satırını kilitler, tavan kapısı itirazları kilitsiz okur → ters sıra yok, kilitlenme olmaz. Çözümde yalnız itiraz satırı → ödeme satırı |
| **`appointmentembedding` etiketi eksikti** | `prisma generate` istemciyi tazeleyince `roles.spec` "etiketi olmayan yetki modülü" diye kırmızıya düştü (şemada committed bir pgvector modeli, etiketi yok). Etiket eklendi — bu turun işi değil, test ağının yakaladığı önceden var olan boşluk |
| **Dev DB'de `appointment_embeddings` tablosu yok** | `prisma migrate diff` bunu da üretti; bu turun migration'ına **alınmadı** (ayrı sapma). Kullanıcı `migrate:dev` çalıştırınca Prisma onu da oluşturacak |

### 87.5 Doğrulama

| | |
| --- | --- |
| `tsc --noEmit` | api **1 hata** — ilgisiz: `schedule-appointment.handler.spec.ts` kullanıcının `find-patient-by-id → get-patient-by-id` yeniden adlandırmasını izlemiyor (turdan önce de vardı). messaging **0**. `messaging` testleri: 42/43 suite, 256 test yeşil; kırmızı tek suite de ilgisiz (`packages/nest-kernel/src/http/setup-app.ts` kullanıcının WIP'inde `@nestjs/swagger` import ediyor, paket kurulu değil) |
| `pnpm test` | **262/263 suite, 1883 test yeşil** (tur öncesi 1739). Kırmızı tek suite yukarıdaki ilgisiz import. Yeni/genişletilen: posting kuralları + kapsam kilitleri (18), `CardChargeback` entity (18), açılış handler'ı (28: kapı sırası, transaction derinliği, tavan, kaynak olguları, 108 kapısı, defter kanıtı), çözüm handler'ı (19: kilit, WON/LOST, plan yansıması üç sonuç, uyarının geri sarılmada çıkmaması), `ChargeBackInstallmentHandler` (13), `Payment` entity ters ibraz (14), repo mapping kilidi (+4), cari defter durum eşlemesi/geçişleri (+10), tavan kapısı (6), POS/ödeme kilitli okuma servisleri (6+5), olay kanıt kapısı (4), POS özet sorgusu (3), 4 POS ters kayıt spec'i (+8) |
| Mapping kilidi | `toInstallmentCreateData`'dan `recoversInstallmentId` çıkarılınca **2 test kırmızı** (INSERT içeriği + şema kolon kümesi), geri alınca yeşil |
| Kapı sırası (açılış) | `olgular → kaynak kilidi → defterde var mı → tavan → dönem → 108 → cari → kayıt → olay → damga`; hepsi `outboxRun` derinliğinde, olgular derinlik 0 |
| Kapı sırası (çözüm) | `kilit → dönem → plan yansıması → olay → damga`; ikinci çözümde dönem kapısı bile çağrılmaz |
| Yetki matrisi | Yeni model → `cardchargeback` ailesi otomatik doğdu; etiketi + TREASURY demeti eklendi, `roles.spec` yeşil |
| Tarama | `pnpm finans:degismezler`'e **5 kontrol** eklendi (`eksi-127`, `itiraz-127-mutabakat`, `itiraz-tavan-asimi-pos`, `itiraz-tavan-asimi-online`, `itiraz-plan-uyumsuz`) → toplam **13**. Canlı DB'de migration uygulanmadığı için 4'ü **çalıştırılamadı** ve çıktı artık "sağlam" demiyor (çıkış kodu 2). Migration sonrası yeniden çalıştırılmalı |
| Migration | **1 yeni, uygulanmadı:** `20261019120000_card_chargeback` (4 enum + 5 enum değeri + `card_chargebacks` + `payment_installments.recovers_installment_id`, hepsi ek-yönlü). `migrate status` bu turdan önce **87/87 up to date** — §57…§85'in 8 migration'ı da uygulanmış. **Yerel bir Postgres olmadığı için SQL bir veritabanında denenmedi**; Prisma'nın ürettiği DDL ile birebir kıyaslandı, CHECK'ler elle yazıldı |
| ESLint | Yeni dosyaların hepsinde temiz; değişen mevcut dosyalarda yalnız dosyanın önceden var olan biçim borcu kaldı (pax-refund/pax-void handler'larında blok girintisi, `posting.exceptions.ts` başlığı) |

## 88. Bilinçli yapılmayanlar — kart itirazı turu

| Konu | Neden şimdi değil | Tetikleyici |
| --- | --- | --- |
| **Platform tarafı** (Stripe `charge.dispute.*`, `BookingPayment`, `SubscriptionCharge`) | Platform 108'inin settlement'ı yok (iş paketi 16); orada itiraz kurulursa 108 yine kapanmaz. Stripe webhook'u yalnız `checkout.session.completed` işliyor | Platform payout mutabakatı (iş paketi 16) |
| **Kısmi itirazın plana yansıması** | Taksit bölünmez (§19 granülerliği): 500 TL'lik taksite 200 TL itiraz `NO_MATCHING_INSTALLMENT` olur (plana dokunulmaz, CRITICAL). Defter doğru (127/120 tutar bazlı), yalnız ödeme planı elle eşleşir | İlk kısmi itiraz ya da taksit bölme akışı |
| **Değersiz alacak / telafi taksidinin silinmesi** (128/129/654 ya da 689) | Hasta borcunu silmek bir **muhasebe kararıdır**. Telafi taksidi bu yüzden **iptal edilemez** (`RecoveryInstallmentNotCancellableException`): iptal edilirse 120 açık kalır, plan "borç yok" der | İlk tahsil edilemeyen telafi / yıl sonu şüpheli alacak turu |
| **WON'da ücret iadesi** | Sağlayıcılar çoğunlukla kazanılan itirazda da ücreti tutar; iade ediliyorsa ayrı ekonomik olay | İlk sağlayıcı sözleşmesi netleştiğinde |
| **Kazanılandan sonra ikinci tur / pre-arbitration** | Çözüm tek seferlik; kazanılanı kaybedilene çevirmek ayrı bir olay (itirazın yeniden açılması) | İlk gerçek ikinci tur |
| **Sanal iade yolunda PENDING işareti ve satır kilidi** | `refund-payment` / `cancel-payment` taksit satırını kilitlemiyor ve SDK çağrısı sürerken işaret yok; tavan kapısı SDK'dan **önce** çalışıyor ama SDK uçuştayken kaydedilen bir itiraz yakalanmaz (fiziksel POS'ta bu pencere yok: PENDING satır tavana sayılıyor) | Sanal POS iadesi PENDING-önce akışa alındığında |
| **Döviz cinsinden itiraz** | v1 yalnız TRY (`ChargebackCurrencyNotSupportedException`); yabancı para itirazı kur farkı üretir (§72) | İlk yabancı para kart tahsilatı |
| **Sağlayıcı itiraz API'si / webhook'u** | Bugün elle giriş (bildirim sağlayıcıdan gelir, kaynak doğru) | Sağlayıcı dokümanı/sandbox (iş paketi 5 ile birlikte) |
| **Delil iş akışı** | Yalnız `evidenceDueAt` saklanır; delil sunma bu kaydın işi değil | Operasyon talebi |
| **Hastasız POS satışlarının deftere hiç girmemesi** | Mevcut boşluk (köprü hastaya bağlı); itiraz bu satışlarda `ChargebackSourcePatientRequiredException` ile **açıkça** reddedilir, sessizce geçmez | Hastasız kart çekiminin deftere alınması kararı |
| **127'nin alt hesaplanması** | v1'de 127 yalnız bu akışa ayrılı; başka kullanım doğarsa alt hesap bir **şablon kararıdır** (kural 11) | 127'ye ikinci bir kullanım |
| **Frontend kayıt ekranı** | Backend uçları hazır; ekran iş paketi 13 | Faz 3 |
| **Plan yansıması için "eksik kalanlar" sorgusu** | `planSyncStatus` `NO_MATCHING_INSTALLMENT` olan itirazlar `GET card-chargebacks` listesinde görünür ve CRITICAL uyarı çıkar; ayrıca `pnpm finans:degismezler`'de `itiraz-plan-uyumsuz` (SYNCED ama taksit tutmuyor) taranır. Elle eşleştirmeyi yapan komut (taksidi seçip CHARGED_BACK yapan) yok | İlk `NO_MATCHING_INSTALLMENT` itirazı |

**Devredilen kural (CLAUDE.md kural 17).** *Parayı kart sahibine geri götüren her
yol — iade, iptal, ters ibraz — AYNI kümülatif tavanı paylaşır ve aynı kaynak
satırını kilitler.* Bir yolun tavanı diğerini bilmiyorsa para iki kez geri gider;
iki kontrol tek başına doğru olduğundan hata hiçbir yerde görünmez.

## 89. Platform defteri: iade sonucu okunmuyordu, dönem hiç açılmıyordu (tur 31)

**Kapsam.** Devrin §0.3 önerisi "platform 108 kapanışı + Stripe itirazı"ydı. Kullanıcı kararları
(2026-10-20): **Stripe canlıya alınmayacak** (platform sanal POS'u yalnız iyzico/TRY); tur ikiye bölündü
(tur 31 = doğruluk zemini + iade kaydı + çift çekim; tur 32 = platform iyzico itirazı). Kodda ölçüm
önerilen turun zeminini çürük buldu: payout ya da itiraz kurmadan önce dört canlı hata kapatıldı.

### 89.1 Bulgu — dört hata, üçü dengeli mizan üretiyor

| # | Hata | Yer | Sonuç |
| --- | --- | --- | --- |
| P0-1 | iyzico rezervasyon iadesinin **sonucu hiç okunmuyordu**. iyzico iş hatasında fırlatmaz (`status:'failure'`) | `iyzico-payment-link.adapter.ts` `refund` | Handler "iade tamamlandı" yazar, ters fişi (`A 108`) atar; para dönmemiştir. Confirm handler'ın iki iade dalı (başarısız rezervasyon, çift çekim) aynı adaptörü kullanıyordu. Klinik tarafı aynı durumu `IyzicoResultGuard` ile yakalıyordu |
| P0-2 | **Platform kiracısına muhasebe dönemi hiç açılmıyordu.** Yıllık iş kapsamı `findLedgerScopes()` = "zaten dönemi olan kiracılar" | `ensure-ledger-periods.handler.ts` | Her platform fişi `NoAccountingPeriodForDateException` (kural 5). Kapsamı mevcut kayıttan türetmek, kaydı hiç olmayanı sonsuza dek dışarıda bırakır |
| P0-3 | **Backfill, doğrulanmamış iadeye ters kayıt yazıyordu.** `refundedAt != null` ⇒ "ters fiş borçlu" | `find-unbridged-…handler.ts` | `refundedAt` rezervasyon satırında "iade TALEP edildi" demekti ve sağlayıcı reddetse de doluydu; handler'ın bilerek yazmadığı fişi backfill yazıyordu |
| P1 | İade kaynak satırında tutar / durum / sağlayıcı iade ref'i yoktu; çift çekimde **hiç satır, kilit, dedupe yoktu**; Stripe iadesi idempotency key'siz, dönen Refund atılıyordu | `refund-booking-payment`, `confirm-booking-payment` | Kural 17 tavanı uçuştaki iadeyi göremez; tekrar gelen webhook ikinci iade çağrısı yapar; çift çekim deftere hiç girmez → payout 108'i kapatamaz |

Olay defterinin dedupe'u **sahiplenme olarak kullanılamaz** (`resolveExisting` mevcut kimliği sessizce
döner, "zaten vardı" bilgisini vermez; okuma-sonra-yazma kilitsiz). Sahiplenme iade satırının unique'idir.

### 89.2 Kurulan akış

| Parça | Ne |
| --- | --- |
| `BookingPaymentRefund` (yeni aggregate, tablo `booking_payment_refunds`) | Bir tahsilatın müşteriye geri götürülmesi. `@@unique([provider, chargeProviderRef])`: aynı tahsilat iki kez iade edilemez. Üç tür: `CANCELLATION`, `BOOKING_FAILED`, `UNCLAIMED_CHARGE` (çift çekim) |
| Üç durumlu sağlayıcı sonucu | `PENDING → CONFIRMED \| FAILED \| UNCONFIRMED`. Adaptör ham SDK sonucunu değil tipli sonucu döner (`SUCCEEDED \| REJECTED \| UNKNOWN`); taşıma hatası `UNKNOWN`. **`UNCONFIRMED` asla otomatik yeniden denenmez** (zaman aşımı sağlayıcıda başarı olabilir → çift iade) |
| `BookingPaymentRefundExecutor` | Claim tx'i (çağıran) → sağlayıcı çağrısı (tx dışı, `idempotencyKey = ${id}:${attempt}` → iyzico `conversationId`) → settle tx'i (bp kilidi → iade kilidi → `PENDING && girişim eşleşiyor`; çakışmada geçiş yapılmaz + CRITICAL). Fırlatmaz |
| 336 yolu (çift çekim + başarısız rezervasyon) | `PLATFORM_RETURNABLE_CHARGE_RECEIVED` (`B 108 / A 336`, çağrıdan **önce**) ve `…_REFUNDED` (`B 336 / A 108`, yalnız CONFIRMED). Köprü kapanışta önce açılışı dener (dedupe) → 336 açılmadan kapanmaz (kural 16). Yalnız iyzico/TRY; Stripe bu yola girmez |
| Elle karar | `POST booking-payments/refunds/:id/resolve` (`CONFIRMED` → ters kayıt iadenin gerçekleştiği güne; `NOT_REFUNDED` → `FAILED`; ters fiş zaten yazılıysa ret), `POST …/retry` (yalnız `FAILED`), `GET …/refunds/unresolved` (kural 4 "eksik kalanlar"). Ayrı yetki ailesi `bookingpaymentrefund`, `PLATFORM_CAPABILITY_MODULES`'te, **hiçbir rol demetinde yok** (yalnız ADMIN; `bookingpayment:update` klinik sahibi/resepsiyonda da var) |
| Platform dönemi | `PlatformTenantModule` (yaprak) + `EnsureLedgerPeriodsHandler` kapsamı = dönemi olanlar ∪ platform; açılışta bir kerelik iş (aylık cron'a 31 gün bekletilmez) |
| Stripe açık kapısı | `STRIPE_PAYMENT_LINKS_ENABLED` (yalnız `'true'` açar, varsayılan kapalı); açılışta duyurulur, üretimde `error`; webhook/iade/expire yolları kapalıyken de çalışır |
| `find-unbridged` / backfill | Tahsilat `booking_payments`'tan, iade yönü **iade satırından** türer; doğrulanmamış iade için ters fiş borçlu değildir. Dört tür: `SETTLED / REFUNDED / RETURNABLE_RECEIVED / RETURNABLE_REFUNDED` |
| `finans:degismezler` | 13 → **20** kontrol (+`donemsiz-defter`, `rezervasyon-iade-tutar-ihlali`, `rezervasyon-iade-durum-uyumsuz`, `iade-askida`, `rezervasyon-askida`, `eksi-336`, `336-mutabakat`) |

Payout için **üretim kodu değişmedi**: platform kliniği `RecordProviderSettlement` + `CreateBankAccount` ile
ADMIN tarafından kullanılabilir (`isSystem()` değerlendirmeyi atlar). Bu yan etkiye dayanan davranış
`finance.policy.spec.ts` ile sabitlendi (ADMIN geçer, klinik sahibi/muhasebeci/resepsiyon reddedilir).

### 89.3 Kararlar ve gerekçe (kullanıcı, 2026-10-20)

| Karar | Gerekçe |
| --- | --- |
| Stripe açık bayrakla kapatıldı, kod yerinde | Anahtarın yokluğu kapı değildir: biri `STRIPE_SECRET_KEY`'i koyduğu an para kapanış akışı olmadan 108'e girer (kural 16) |
| Çift çekim `336 Diğer Çeşitli Borçlar` | Şablonda var, hiç kullanılmıyordu → şablon değişmedi (kural 11 tetiklenmedi). Gelir değil müşteriye borç |
| Başarısız rezervasyon tahsilatı da 336'dan | Bugün hiç iz bırakmıyordu; iadesi tamamlanmazsa para payout'ta görünür ama 108'de yok → `FUNDS_IN_TRANSIT_GATE` payout'u bozar |
| Doğrulanmamış iade elle onay komutuyla kapanır | iyzico sorgu API'sinin anlamı sandbox'ta doğrulanmadan davranış bağlanmaz (§56/§64 ile aynı aile) |
| Platform itirazı `CardChargeback` genişletilerek (tur 32), LOST → `659.01` | Tek tablo/tek tavan/tek 127 taraması. `689` başlığa çevrilemez: bekçi alt hesaplı hesabı fişe kapatır ve 689'a üç kural yazıyor |

### 89.4 Tuzaklar

| Tuzak | Ne yapıldı |
| --- | --- |
| **Eski REFUNDED satırları** | Migration bunları `origin=LEGACY, status=UNCONFIRMED` iade satırına çevirir ("talep edildi, sonucu doğrulanmadı"): geçmişi yorumlamaz, `booking_payments`'a ve mevcut ters fişlere dokunmaz. Operatör iyzico panelinden doğrular. Yazılmış ters fişi olan legacy satıra `NOT_REFUNDED` denemesi `ReversalAlreadyRecorded` ile reddedilir (storno muhasebe kararı) |
| **Yeni dönem işi eski ters olayları açığa çıkarır** | P0-2 düzelince süpürme, daha önce postlanamayan `PLATFORM_BOOKING_REFUNDED` olaylarını fişler; o olaylar sonucu okunmayan kodla yazılmıştı. Dağıtım sonrası legacy satırlar iyzico panelinden hemen doğrulanmalı |
| **Kilit sırası** | Her yerde önce `booking_payments`, sonra iade satırı. Bp kimliği için kilitsiz ön okuma gerekir; karar ona dayanmaz (kilitli yeniden okuma) |
| **Kapı sırası testi** | Resolve: çözülemeyen satır için dönem kapısı bile çağrılmaz (`assertResolvable` önce) |
| `TSCommandBus` yanıtı | `RefundBookingPaymentCommand` artık `{ refundId, status }` döner; AI aracı yalnız `CONFIRMED`/`SKIPPED`'i "iade edildi" diye sunar |

### 89.5 Doğrulama

| | |
| --- | --- |
| Kırmızı kanıtlar | iyzico durum kontrolü kaldırılınca failure testi düştü; platform birleşimi kaldırılınca 2 test düştü; iade `update` mapping'inden `providerRefundRef` çıkarılınca 2 test düştü; eski `refundedAt` kuralı geri konunca 5 test düştü |
| Yeni testler | adaptörler (11), dönem işi + producer (5), iade entity (21), repo mapping/süzgeç (10), 336 kuralları/şema/guard, köprü (+7), executor (8), refund/confirm/resolve/retry/liste/unbridged/backfill handler'ları, Stripe kapısı (6+2), `finance.policy.spec` (5), roles.spec (+2) |
| Migration | **1 yeni, uygulanmadı:** `20261020120000_booking_payment_refunds` (4 enum, 2 `FinancialEventType` değeri, tablo + 7 CHECK, legacy `INSERT…SELECT`). DDL `prisma migrate diff --from-empty` ile üretildi, CHECK'ler ve INSERT elle |
| Tarama | `donemsiz-defter` canlı DB'de **1 aykırı** yakaladı; yeni tabloya bakan 4 kontrol migration'a kadar çalıştırılamaz (exit 2) |

## 90. Bilinçli yapılmayanlar — platform iade turu

| Konu | Neden şimdi değil | Tetikleyici |
| --- | --- | --- |
| **Stripe payout / itiraz / kur farkı** | Stripe canlıya alınmayacak; 108 Stripe satışları satış günü kuruyla TRY tutuyor, payout başka günün kuruyla gelir → realize kur farkı (646/656) tanınmıyor | Stripe canlıya alınması |
| **Platform iyzico itirazı** (`CardChargeback` + `BOOKING_PAYMENT`) | Tur 32: hasta/cari kolonları nullable (platform müşterisi), TRY kapısı, kaynak dağıtımının tam kaplamalı eşlemeye çevrilmesi, `659` başlık + `659.01` (ek-yönlü şablon, kural 11 sapma raporu), `lockAndGet` booking-collection servisi | Sıradaki tur |
| **Rezervasyon için kümülatif tavan kapısı** | Bugün iade tek (tam) ve tek kaynaklı; itiraz gelince `PENDING/UNCONFIRMED/CONFIRMED` iade + aktif itiraz + istenen ≤ tahsilat (`countsTowardsReturned` hazır) ve **her** iade claim'inde çağrılmalı (kural 17) | Tur 32 |
| **Kısmi iade** (iptal cezasının iadeden düşülmesi) | Fiyat politikası kararı | Ceza mahsubu kararı |
| `resolve` için step-up doğrulama | Rol matrisi turu | İş paketi 4 |
| Sağlayıcı iade-durumu API'siyle otomatik doğrulama | Semantik sandbox'ta doğrulanmadı | iyzico sandbox |
| Backfill fişlerinin backfill günüyle tarihlenmesi (SETTLED) | `occurredAt` varsayılanı "şimdi"; yalnız iade yönü artık gerçek tarihle yazılıyor | Geriye dönük tahsilat telafisi |
| Payout'tan sonra iade edilince 108'in geçici eksiye düşmesi | iyzico iadeyi sonraki payout'tan netler; `eksi-108` kısa süre uyarabilir | İlk gerçek platform payout'u |
| Platform vergi parametresi | Yalnız `issue-invoice` okuyor, platform kuralları okumuyor | Platform kendi faturasını kesince |
| 336'nın alt hesaplanması | v1'de yalnız bu akışa ayrılı (127 gibi) | 336'ya ikinci kullanım |
| `SubscriptionCharge` | Hiç deftere girmiyor (olay tipi, 108 yok), yalnız iyzico; kapanacak 108'i yok | Platform kendi beyanı/faturası |

**Devredilen kural (CLAUDE.md kural 18).** *Sağlayıcı çağrısının sonucu üç durumludur (oldu / olmadı /
bilinmiyor); adaptör ham SDK sonucunu değil tipli sonucu döner; "bilinmiyor" yalnız elle doğrulamayla kapanır
ve otomatik yeniden denenmez; idempotent olay dedupe'u sahiplenme değildir.*
