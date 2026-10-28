# Messaging Mikroservis Ayrımı — Mimari Plan

**Durum:** **AYRIM TAMAMLANDI ✅ (2026-08-08)** — Faz 0/1/2 · Cutover · Faz 3.1–3.6. Messaging ayrı bir servis (`apps/messaging`, :8081, kendi MongoDB'si, NATS ile core'a bağlı). Giriş yönlendirmesi ters vekille çözüldü (`infra/caddy/Caddyfile`); kalan iş elle yapılacak iki ayar: `PUBLIC_BASE_URL` ve Meta panelindeki geri-çağrı adresleri (3.6 sonu).
**Karar tarihi:** 2026-08-07
**Kapsam:** `apps/api/src/modules/messaging/` (263 dosya, 3 alt-context, 40 spec)

---

## 1. Verilen kararlar

| Konu               | Karar                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| Dağıtım            | **Kademeli** — önce aynı process'te "mikroservise hazır", sonra ayrı app |
| AI araçları        | **Core'da kalır**, messaging uzaktan (RPC) çağırır                      |
| Veritabanı         | **Hepsi Mongo'ya** — conversation + message + 4 kanal/AI config          |
| Transport (Faz 3)  | **NATS** (`@nestjs/microservices`)                                       |

---

## 2. Mevcut durum tespiti

### 2.1 Alt-context'ler

```
messaging/
  conversation/    # Conversation + Message çekirdeği, webhook controller'ları, teslim kuyruğu
  channel-config/  # Klinik başına WhatsApp / Telegram / Instagram kanal config'i + Graph API istemcileri
  ai-agent/        # AI persona config'i, sohbet portu (Anthropic/Gemini), araç registry'si, yanıt kuyruğu
```

### 2.2 Zaten kurulu olan altyapı

`InfrastructureModule` global olarak Redis (ioredis), BullMQ ve Mongoose sağlıyor.
Mongo bugün yalnızca `platform/audit-log` tarafından kullanılıyor — messaging için
yeni bir altyapı bileşeni gerekmiyor.

Kuyruklar hâlihazırda ayrık ve limiter'lı:

| Kuyruk                 | Job                            | Limiter        |
| ---------------------- | ------------------------------ | -------------- |
| `messaging-queue`      | `messaging-send-message`       | 80 / 1000 ms   |
| `messaging-ai-queue`   | `messaging-ai-generate-reply`  | 10 / 1000 ms   |

### 2.3 Ayrımı zorlaştıran asıl bağımlılık: AI araçları

15 AI aracı messaging'in **dışında**, kendi domain modüllerinde yaşıyor:

| Modül                       | Araç sayısı |
| --------------------------- | ----------- |
| `clinical/appointment`      | 6           |
| `clinical/provider`         | 3           |
| `clinical/treatment-package`| 2           |
| `crm/health-tourism/hotel`  | 4           |
| `crm/health-tourism/transfer`| 4          |
| `crm/lead`                  | 1           |

`AiToolRegistry` bunları `DiscoveryService` ile **aynı process içinde** tarıyor
(`@AiTool()` metadata'sı) ve `AiToolExecutor` in-process CommandBus/QueryBus ile
çalıştırıyor. Süreç ayrıldığında kırılan tek mekanizma budur.

**Karar:** araçlar core'da kalır. Core, tek bir "tool gateway" sözleşmesi açar:

```
definitions()                      → AiToolDefinition[]
execute(name, args, toolContext)   → AiToolResult
```

Messaging bu sözleşmeyi bir **port** arkasından tüketir. Faz 1'de port'un
implementasyonu in-process (mevcut registry/executor), Faz 3'te NATS istemcisi olur.
Yeni araç eklemek core'da kalır; messaging hiç değişmez.

### 2.4 Messaging → core çağrıları (bus üzerinden, port'a alınacak)

| Çağrı                                  | Kullanım yeri                          |
| -------------------------------------- | -------------------------------------- |
| `FindPatientByContactQuery`            | inbound mesajda hasta eşleme           |
| `CreateLeadCommand`                    | reklam (CTWA) referral'lı yeni yazışma |
| `GetClinicTimezoneQuery`               | AI araç saat çevirimi                  |
| `GetClinicHealthTourismConfigQuery`    | sağlık turizmi araçları                |
| `GetAppointmentDetailQuery`            | randevu sahiplik doğrulaması           |
| `GetHotelBookingsQuery` / `GetTransferBookingsQuery` | rezervasyon araçları     |
| `InitiateBookingPaymentCommand` / `RefundBookingPaymentCommand` | ödeme akışı  |

Bunların çoğu zaten `AiToolSupport` içinde toplanmış durumda — tool gateway port'u
devreye girince otomatik olarak core tarafında kalırlar. Port'a alınması gereken
gerçek kalan: `FindPatientByContactQuery` + `CreateLeadCommand` (inbound akışı).

### 2.5 Veri sahipliği

| Tablo                     | Bugün                              | Hedef                        |
| ------------------------- | ---------------------------------- | ---------------------------- |
| `conversations`           | Postgres, scalar `clinicId`        | Mongo                        |
| `messages`                | Postgres, `conversationId` FK      | Mongo (gömülü değil, ayrı)   |
| `clinic_whatsapp_channels`| Postgres, **Clinic FK**            | Mongo, `clinicId` düz string |
| `clinic_telegram_channels`| Postgres, **Clinic FK**            | Mongo, `clinicId` düz string |
| `clinic_instagram_channels`| Postgres, **Clinic FK**           | Mongo, `clinicId` düz string |
| `clinic_ai_agent_configs` | Postgres, **Clinic FK**            | Mongo, `clinicId` düz string |

`Clinic` modelindeki 4 back-relation (`whatsappChannel`, `aiAgentConfig`,
`telegramChannels`, `instagramChannel`) kaldırılacak; `messaging.prisma` tamamen
silinecek. Klinik silindiğinde cascade artık DB değil, event ile yürüyecek.

---

## 3. Fazlar

### Faz 0 — Redis sağlamlaştırma ✅ TAMAM

Bu üç madde bugünkü monolitte de değer üretir ve ayrımda aynen taşınır.
Doğrulama: `tsc` 0 hata, `jest` 125 suite / 637 test yeşil (messaging 40 suite / 217 test).

**0.1 Webhook dedup kilidi.** Meta aynı webhook'u tekrar iletebiliyor. Bugünkü
koruma `findByExternalId` ön-kontrolü + `@@unique(externalId)` kısıtı; eşzamanlı iki
teslimde ikisi de ön-kontrolü geçip biri unique ihlaliyle patlıyor. Redis `SET NX EX`
kilidi üç kanal için ortak noktada (`ReceiveInboundMessageHandler`) uygulanır:
başarıda kilit **bırakılmaz** (TTL boyunca dedup işareti olarak kalır), hata halinde
bırakılır (Meta retry'ı işleyebilsin). DB unique kısıtı son güvence olarak durur.

**0.2 AI bağlam penceresi cache'i.** Bugün her AI turunda son 20 mesaj DB'den
okunuyor. Redis'te konuşma başına bir liste tutulur (`LPUSH` + `LTRIM`); her mesaj
yazımında (inbound + outbound) eklenir. Cache boşsa (soğuk) DB'den yüklenip ısıtılır
— read-through. Ayrımdan sonra bu cache messaging servisinin kendi Redis'inde kalır.

**0.3 Klinik-başı rate limit + konuşma-başı sıralı teslim.** Bugünkü limiter
worker-geneli; WhatsApp limiti ise numara başına. Redis sliding-window sayacı ile
klinik başına limit uygulanır, aşımda job ertelenir. Ayrıca konuşma başına bir
mutex ile aynı anda tek gönderim garanti edilir (mesaj sırası korunur).

### Faz 1 — Anti-corruption port katmanı ✅ TAMAM

Doğrulama: `tsc` 0 hata, `jest` 126 suite / 644 test yeşil.

**1.1 AI araç sahipliği ters çevrildi.** Araçlar core'da yaşarken `AiToolSupport`/
`AiToolRegistry` messaging'in *infrastructure*'ındaydı — 15 core aracı messaging'den
import ediyordu (modül-grubu seviyesinde döngüsel bağımlılık). Üç parçaya ayrıldı:

| Ne                                                                     | Nereye                          | Neden                                             |
| ---------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------- |
| `AiToolDefinition/Call/Result/Context`, `IAiToolExecutor`, `@AiTool()`  | `@common/ai-tools`              | **Nötr sınır** — iki taraf da buradan alır        |
| `AiToolRegistry`, `AiToolExecutor`, `AiToolSupport`, `HandoffToHumanTool` | `modules/platform/ai-tools`   | Araçlar core'un domain'ine ait → gateway de core'da |
| `AI_TOOL_EXECUTOR` bağlaması                                            | `AiToolsModule` (platform)      | Tüketici somut sınıfı görmez, yalnız token'ı      |

Sohbet adapter'ları zaten `@Inject(AI_TOOL_EXECUTOR)` kullanıyordu; tek değişiklik
bağlamanın port sahibine geçmesi. Faz 3'te aynı token bir NATS istemcisine bağlanır ve
adapter'larda tek satır değişmez.

**1.2 Kontak çözümü port arkasına alındı.** `ReceiveInboundMessageHandler` doğrudan
`FindPatientByContactQuery` + `CreateLeadCommand` + `CreateLeadDto` biliyordu.
Yerine `IContactResolverPort` (`conversation/domain/ports/`) + `LocalContactResolverAdapter`
(`infrastructure/adapters/contact/`) geldi. Kanal-farkındalı telefon seçimi (WhatsApp'ta
`contactPhone`, Telegram/Instagram'da yalnız `matchPhone`) ve best-effort hata yutma
handler'dan adapter'a taşındı — kendi spec'inde sınanıyor.

**Sonuç — sınır ölçümü**

| Yön                          | Öncesi | Sonrası | Kalan                                                     |
| ---------------------------- | ------ | ------- | --------------------------------------------------------- |
| core → messaging (dosya)     | 26     | **1**   | `confirm-booking-payment.handler.ts`                       |
| messaging → core (import)    | ~20    | **4**   | 3'ü `ContactResolverModule` içinde + `AiToolsModule`      |
| messaging → auth guard       | 5      | 5       | controller'lar — Faz 3'te paylaşılan auth'a taşınır       |

**Bilinçli olarak port'a alınmayan tek edge:** `confirm-booking-payment.handler.ts` →
`SendBookingConfirmationCommand`. Fire-and-forget bildirimdir, zaten tek bir private
metotta (`notifyCustomer`) izole ve hatası yutuluyor. Faz 3'te doğru şekli bir port
değil, core'un yayımladığı bir **domain event**'e messaging'in NATS üzerinden abone
olmasıdır — şimdi port yazmak, sonra geri alınacak iş olurdu.

### Faz 2 — MongoDB'ye taşıma ✅ TAMAM (2.1–2.4)

Kararlar: **tek-düğüm replica set + Mongo transaction + Mongo outbox**, **tek seferde kesme**.

#### ⚠️ Neden mekanik bir repository değişimi değildi

Messaging, uygulamadaki en yoğun eşzamanlılık korumasına sahip modül: 7 handler
`SELECT … FOR UPDATE` kullanıyordu ve `receive-inbound-message` event'i domain yazmasıyla
aynı Postgres transaction'ında mühürlüyordu. Mongo'da:

| Postgres mekanizması | Mongo karşılığı |
| --- | --- |
| `SELECT … FOR UPDATE` | Transaction içinde `findOneAndUpdate` ile `lockVersion` artırma → ikinci yazan write-conflict alır, `withTransaction` işi taze okumayla baştan çalıştırır |
| `TransactionManager.outboxRun()` (Postgres Outbox) | `MongoTransactionManager.outboxRun()` — domain yazması + `messaging_outbox` **aynı session'da** |
| `@@unique(externalId)` (çoklu NULL serbest) | `partialFilterExpression: { externalId: { $type: 'string' } }` — Mongo'nun normal unique indeksi çoklu null'ı reddederdi |
| `paginate` helper | `mongoPaginate` — aynı `{ items, total }` sözleşmesi, regex-kaçışlı arama |

**Kilit açık tutuldu, örtük bırakılmadı:** "nasılsa sonra `update()` çağıracağız, çakışma
orada yakalanır" varsayımı, okuyup *koşullu* yazmayan bir akış eklendiği anda sessizce
korumasız kalırdı. `lockDocument()` kilit niyetini gerçek bir yazmayla taşır.

#### 2.1–2.3 ✅ Tamam

- 6 Mongoose şeması + indeksler (`_id` = uygulama UUID'si; ObjectId kullanılmaz)
- 12 repository — **domain interface'leri değişmedi**, handler'lar ve spec'ler dokunulmadı
- `MongoTransactionManager` (session ALS + outbox + transient-hata retry) + `MongoBaseRepository` + `mongoPaginate`
- Açılışta replica-set guard'ı: replica set yoksa uygulama **anlaşılır bir hatayla durur**
  (yoksa sorun ilk gelen mesajda anlamsız bir sürücü hatası olarak çıkardı)
- Idempotent Postgres→Mongo taşıma script'i (`pnpm migrate:messaging-mongo`)
- Doğrulama: `tsc` 0 hata, 126 suite / 644 test yeşil

#### 2.4 ✅ Tamam — sözleşmeler shared'a taşındı, Prisma temizlendi

`messaging.prisma` yalnız tabloları tanımlamıyordu; `zod-prisma-types` ondan messaging'in
**tüm tip sözleşmelerini** üretiyordu. Şema silinince bu tipler de kalkacağı için önce
sözleşmeler elle yazılmış shared şemalara taşındı:

- `packages/shared/modules/messaging/schemas/enums/` — 8 enum
- `packages/shared/modules/messaging/schemas/models/` — 6 model

**Tüketici tarafında churn'ü sıfıra indiren detay:** Prisma'nın ürettiği enum'lar hem değer
(`MessageChannel.WHATSAPP`) hem tip (`channel: MessageChannel`) konumunda kullanılıyordu.
Shared modül aynı adı ikisi için de sağlar (`export const X = XSchema.enum` +
`export type X = XType`), böylece import yolu dışında hiçbir çağrı yeri değişmedi.

`JsonValueSchema` bilinçli olarak dışa açılmaz — `@shared` barrel'ında generated-zod'un
aynı adlı export'u var, ikinci kez açmak belirsizlik hatası üretirdi.

Sonuç: messaging'de **hiçbir Prisma izi kalmadı** (`@prisma/client`, `PrismaService`,
`prisma.` = 0 eşleşme). `messaging.prisma` silindi, `Clinic`'teki 4 back-relation kaldırıldı.

**Migration hazır ama UYGULANMADI:**
`migrations/20260808004611_messaging_moved_to_mongodb/migration.sql` — 5 FK + 6 tablo +
8 enum düşürür, başka hiçbir şeye dokunmaz. Veri Mongo'ya taşınıp doğrulanmadan
uygulanırsa yazışma geçmişi geri dönüşsüz kaybolur.

#### (arşiv) 2.4'ün gizli bağımlılığı

`messaging.prisma` yalnız tabloları tanımlamıyor; `zod-prisma-types` ondan **messaging'in
tüm tip sözleşmelerini** üretiyor (`Conversation`, `Message`, `MessageChannelSchema`,
`ConversationStatusSchema`, …). Şemayı silmek bu tipleri de siler → messaging'de **78 import
noktası** kırılır. Silmeden önce sözleşmeler elle yazılmış shared şemalara taşınmalı.

**Sıra (bu haliyle uygulanmalı):**

1. `packages/shared/modules/messaging/schemas/` altına 6 model + 8 enum şeması yazılır
   (generated dosyalar birebir port edilir; adlar korunur)
2. Messaging'in `@prisma/client` (37) ve `@shared/generated-zod` (13) import'ları
   yeni yola çevrilir
3. `messaging.prisma` silinir + `Clinic`'teki 4 back-relation kaldırılır
4. `pnpm prisma:generate` → generated messaging dosyaları kalkar, isim çakışması olmaz
5. `packages/shared/modules/index.ts`'e messaging eklenir (`@shared` barrel'ı çalışmaya devam eder)
6. `tsc` + test
7. Migration üretilir (**tabloları DROP eder — yalnız taşıma doğrulandıktan sonra**)

---

## 5. Cutover — ✅ TAMAMLANDI (2026-08-08, geliştirme ortamı)

Sıra korunarak uygulandı; her adım doğrulandı:

| # | Adım | Sonuç |
| --- | --- | --- |
| 1 | `mongod.conf`'a `replication.replSetName: rs0` + `rs.initiate({host:'127.0.0.1:27017'})` | `setName=rs0`, primary; çok-dokümanlı transaction probe'u geçti |
| 2 | `MESSAGING_MONGODB_URI` eklendi (3 env dosyası + docker-compose) | `core-crm-messaging?replicaSet=rs0` |
| 3 | `pnpm migrate:messaging-mongo` | 6 tablonun tamamı **0 satır** — taşınacak veri yoktu |
| 4 | `prisma migrate deploy` | 5 FK + 6 tablo + 8 enum düştü; `public`'te messaging izi yok |
| 5 | Uygulama açılışı | `Nest application successfully started`; 7 koleksiyon + indeksler kuruldu |
| 6 | `jest` | 126 suite / 644 test yeşil, `tsc` 0 hata |

### Messaging kendi veritabanında

Messaging, audit-log'un `MONGODB_URI`'sini **paylaşmaz**; `MESSAGING_MONGODB_URI` ile
ayrı bir Mongoose bağlantısı (`MESSAGING_MONGO_CONNECTION`) üzerinden `core-crm-messaging`
veritabanına yazar. Gerekçe Faz 3'tür: messaging ayrı sürece çıktığında bu URI olduğu gibi
yeni servise taşınır ve **veri yeniden taşınmaz**. Aynı veritabanında kalsaydı ayrılma
anında audit ile messaging koleksiyonlarını ayıklamak gerekirdi.

Bağlantı adı `src/infrastructure/persistence/mongo/mongo.connection.ts`'te tanımlıdır;
6 `forFeature` + 12 repo + `MongoTransactionManager` bu ada bağlıdır.

### Replica set neden zorunlu

`MongoTransactionManager.onApplicationBootstrap` replica set değilse **açılışta durur**.
Guard olmasaydı uygulama sorunsuz açılır, sorun ilk gelen mesajda anlaşılmaz bir sürücü
hatası olarak patlardı. `docker-compose.yml`'de mongo `--replSet rs0` ile başlar ve
healthcheck'in kendisi `rs.initiate()` eder — api servisi ancak rs ayağa kalkınca başlar.

### Faz 3 — Süreç ayrımı

**3.1 Ortak çekirdek ✅ (2026-08-08)** — `packages/nest-kernel` oluşturuldu, 62 dosya taşındı.

> **Plan düzeltmesi:** Bu doküman önce "ortak çekirdek `packages/shared`'a" diyordu; bu
> yanlıştı. `packages/shared`'ı `apps/web` tüketiyor ve CLAUDE.md orada NestJS paketlerini
> yasaklıyor — oysa çekirdeğin göbeği (`TSCommandBus`, decorator'lar, Mongo katmanı)
> `@nestjs/*`'a bağlı. Bu yüzden ayrı bir backend paketi açıldı.

Taşımayı mümkün kılan iki ön düzeltme (ikisi de aynı kalıp — barrel fazlasını çekiyordu):

| Sorun | Çözüm | Etki |
| --- | --- | --- |
| `base-event.interface` → `prisma/transaction` barrel'ı → PrismaService zinciri | Doğrudan `als-storage`'dan import | Event mekanizması Prisma'dan koptu |
| `TransactionContext.tx: Prisma.TransactionClient` | `tx?: unknown`; daraltma `BaseRepository.db`'de | Çekirdek Postgres'i sürüklemiyor |
| messaging → `domain/constants/events` barrel'ı → 30 modülün event adı | Doğrudan `messaging.constant` | Kapanış 97→62 dosya |

Sonuç: çekirdek **bağımlılık-kapalı** (`modules/` altına 0 sızıntı). `apps/api` tarafında
tek bir import satırı değişmedi — tsconfig/jest alias'ları dizi hedefi alıyor
(önce app'in kendi `src`'i, sonra çekirdek). Doğrulama: `tsc` 0, 126 suite / 644 test,
uygulama açılışı + `dist/packages/nest-kernel` üretimi.

**3.2 Paketler Prisma'dan koparıldı ✅ (2026-08-08)** — engel çözüldü.

Sorun: `@dentorchestra/shared`'ın `generated-zod` çıktısı `@prisma/client`'ı import ediyordu,
ama üretilmiş client npm paketinde değil `apps/api/generated/prisma` içinde yaşıyor. Yani
shared'ı tüketen hiçbir paket app'lerden bağımsız derlenemiyordu.

Karar: **Prisma şeması yerinde kaldı; üretilen zod çıktısı kendi tiplerini kullanıyor.**
`clean-generated-zod.cjs` (`prisma generate` sonrası zaten çalışan script) genişletildi.

Kullanımın tamamı tipti — tek runtime kullanımı `z.instanceof(Prisma.Decimal, …)` idi ve
**o da baştan hatalıydı**: Prisma decimal.js'i kendi runtime'ına gömdüğü için
`Prisma.Decimal` ile decimal.js'in `Decimal`'i farklı sınıflar (ölçüldü: `instanceof`
her iki yönde de `false`). Yani şemalar domain'in ürettiği Decimal değerlerini reddederdi.
Yerine yapısal kontrol geldi (`decimalSchema(message)`, `packages/shared/common/decimal`) —
ikisini de kabul eder ve generator'ın alan/model mesajını korur.

| | Sonuç |
| --- | --- |
| 44 üretilmiş dosya | Prisma'sız (40 model + 4 input şeması) |
| Boru hattı | `prisma generate` → `zod:clean` → 0 Prisma import'u (baştan sona doğrulandı) |
| Guard | Dönüşüm eşleşmezse script **sesli patlar** — jenerator çıktısı değişirse sessizce geri gelmesin |
| `pnpm --filter @dentorchestra/nest-kernel typecheck` | ✅ 0 hata, `apps/api`'ye erişmeden |
| Regresyon | `apps/api` tsc 0 · 644 test · `apps/web` tsc 0 |

**3.3 Auth ✅ (2026-08-08)** — messaging artık `@modules/identity/auth`'tan hiçbir şey
import etmiyor (5 controller `TokenAuthGuard`'a geçti).

Karar: **token çekirdekte doğrulanır, ek ağ turu yok.** Ama yetki bilgisi Firebase custom
claim'lerine gömülmedi — mimaride zaten `ActorContext`'i Firebase uid'sine göre tutan bir
**Redis cache** vardı (`auth:actor-cache:*`, TTL 5 dk) ve rol değişiminde geçersizleniyor
(`clean-auth-cache-on-user-updated.listener.ts`). Claim'e gömmek aynı hızı verirdi ama iki
bedelle: claim'leri her rol değişiminde Firebase'e yazma sorumluluğu, ve rol değişikliğinin
kullanıcı token'ını yenileyene kadar (saatlerce) yansımaması. Redis yolu ikisinden de kaçınır.

Çekirdekteki akış (`ActorAuthenticator`) — sıra kasıtlı:

1. **Blocklist** (`auth:token-blocklist:*`) — çıkış yapılmış token'ın imzası hâlâ geçerlidir;
   doğrulamadan sonra bakılsaydı geçersiz kılınmış token kabul edilirdi.
2. İmza doğrulama → `TOKEN_VERIFIER` portu (çekirdek `firebase-admin` bilmez)
3. Redis'ten `ActorContext` — **normal yol burada biter**
4. Cache-miss → `ACTOR_CONTEXT_RESOLVER` portu: api'de kullanıcı/rol tabloları,
   messaging'de (3.5) NATS. Guard ikisini de bilmez, bu yüzden aynı sınıf iki süreçte çalışır.

Redis anahtarları tek kaynakta (`auth/auth-cache.keys.ts`): bu anahtarlar süreç sınırını
aşıyor — api yazıyor, messaging okuyacak. Kopyala-yapıştır ile "aynı" tutulsalardı ayrışma
hiçbir yerde hata vermez, yalnız her istek cache-miss'e düşerdi.

api'nin kendi `AuthGuard`'ı 65 dosyada kullanıldığı için imzası korundu; içerdeki mantık
aynı çekirdek servisine devredildi (kopya yok). 6 kalıcı test:
`packages/nest-kernel/src/auth/actor-authenticator.service.spec.ts`.

**3.4 `apps/messaging` iskeleti ✅ (2026-08-08)** — servis ayakta: kendi
`main.ts`/`tsconfig`/`package.json`'ı, kendi Mongo veritabanı, kendi env sözleşmesi.
Doğrulandı: `pnpm --filter @dentorchestra/messaging typecheck` 0 hata; `nest start` →
`Nest application successfully started`, port **8081** dinliyor (api 8080).

**Alias'lar tek hedef — kasıtlı fark.** `apps/api`'de `@common/*` önce kendi `src`'ine,
bulamazsa çekirdeğe düşer (62 dosya taşınırken import satırlarının değişmemesi için).
`apps/messaging`'de böyle bir yedek **yok**. Korkuluğun çalıştığı ölçüldü — api'ye
uzanmayı deneyen geçici bir dosya derleme hatası verdi:

```
Cannot find module '@modules/identity/auth/auth/auth.service'
Cannot find module '@src/infrastructure/persistence/prisma/prisma.service'
```

Yani messaging api'ye sessizce bağlanamaz; bağlanmaya çalışırsa derleme durur.

**Env zorunlulukları app'e özgü.** `ENV` sabiti ortak kayıt defteridir (çekirdekte), ama
messaging'in Joi şeması yalnız kendi ihtiyaçlarını ister — Iyzico/HotelBeds/SMTP istenseydi
messaging onlarsız açılamazdı. `PUBLIC_BASE_URL` bilerek opsiyonel: yerelde açık HTTPS
adresi yoktur (`none`) ve Telegram webhook kaydı zaten yapılamaz; katı olsaydı yerelde
çalışamayacak bir özellik yüzünden servis hiç açılmazdı.

`docker-compose.yml`'e **NATS** servisi eklendi (`nats:2-alpine`, healthcheck'li).

**3.5 NATS transport + modüllerin taşınması ✅ (2026-08-08)** — **ayrım tamamlandı.**

266 dosya `apps/api/src/modules/messaging` → `apps/messaging/src/modules`'a taşındı.
Import'lar elden geçirilmedi; yalnız `@modules/messaging/` → `@modules/` öneki düştü ve
messaging'in tsconfig'inde `@modules/*` kendi `src/modules`'una bağlandı.

Dışarıdan kopan referans **yalnız 4 taneydi** (2'si app kaydı) — Faz 1'de port sınırlarını
çekmenin karşılığı bu.

| Sınır | Önce | Sonra |
| --- | --- | --- |
| AI araçları (15) | in-process `AiToolsModule` | `NatsAiToolExecutor` → `core.ai-tool.*` |
| Kontak (hasta/lead) | `LocalContactResolverAdapter` | `NatsContactResolverAdapter` → `core.contact.*` |
| `ActorContext` cache-miss | DB (aynı süreç) | `NatsActorContextResolver` → `core.auth.resolve-actor` |
| Rezervasyon onayı | `SendBookingConfirmationCommand` (komut) | `messaging.booking.confirmed` (**olay**) |

Son satır bir tasarım kararıdır: core artık "şu yazışmaya mesaj gönder" diye emretmiyor,
"rezervasyon onaylandı" diye duyuruyor. Kanaldan nasıl bildirileceği (AI dili / 24s
penceresi / HSM şablonu) messaging'in kararı.

NATS konuları tek kaynakta (`transport/nats-subjects.ts`) — auth Redis anahtarlarıyla
aynı gerekçe: iki tarafta ayrı yazılsalar bir harflik fark derleme hatası vermez, istek
sessizce kimseye ulaşmaz.

**Uçtan uca doğrulandı** (NATS container + iki servis birlikte açık):

```
api       : Nest microservice successfully started · 15 AI aracı keşfedildi · :8099
messaging : NatsAiToolExecutor  15 AI aracı core'dan alındı.  · :8081 · 32 route
```

Testler: api 90 suite / 442 test · messaging 38 suite / 215 test · üç ardışık yeşil koşu.
`tsc` üçü de 0 (api, messaging, nest-kernel standalone).

Taşıma sırasında ortaya çıkan üç DI kopukluğu (hepsi "messaging gidince kimse import
etmiyor" kalıbı): `AiToolsModule` (artık `CoreTransportModule` import ediyor),
`TSCqrsModule` ve `CryptoModule` (messaging'in app.module'üne eklendi; `crypto.module.ts`
servisiyle birlikte çekirdeğe taşındı).

**3.6 Giriş yönlendirmesi — ters vekil (reverse proxy).** Karar: trafiği vekil
yönlendirir; sağlayıcıdaki webhook adresleri **değiştirilmez**. Belirleyici olan, adres
değiştirmenin maliyetinin sağlayıcıya göre değişmesi: WhatsApp ve Instagram için tek bir
panel alanı, ama **Telegram için klinik başına** — adres `setWebhook` ile bot bot kaydedilir
(`connect-clinic-telegram-bot-channel.handler.ts`), yani her klinik için Telegram API'sine
tekrar gitmek gerekirdi. Vekilde ise public URL hiç değişmez: kayıtlar olduğu gibi kalır,
geri dönüş tek satırlık yapılandırma değişikliğidir ve servis ikiye bölünmüş olduğu bilgisi
dışarı sızmaz.

**Kod tarafında iki eksik çıktı — ikisi de kapatıldı.**

*(a) Rotalar `messaging` öneki olmadan yayınlanıyordu.* Ayrımdan önce api'de
`RouterModule.register(APP_ROUTES)` içinde `{ path: 'messaging', module: MessagingModule }`
vardı ama **hiçbir zaman uygulanmamıştı**: `RouterModule` yolu modül sınıfının
metadata'sına yazar ve yalnız o modülün `controllers`'ına uygular; `MessagingModule` ise
sadece alt modül import ediyor, kendi controller'ı yok. Yani kayıt sessizce etkisizdi ve
rotalar `/api/v1/whatsapp/webhook` olarak yayınlanıyordu — oysa `buildWebhookUrl`
Telegram'a `/api/v1/messaging/telegram/bot/:clinicId` kaydediyordu. İkisi hiç eşleşmiyordu.
Önek artık `children:` ile veriliyor ve gerçekten uygulanıyor (boot çıktısıyla doğrulandı:
32 rotanın tamamı `/messaging` altında).

*(b) messaging `SetupApp`'i çağırmıyordu.* Ayrı app iskeleti kurulurken `main.ts`'e
taşınmamıştı; sürümleme öneki (`api/v1`), doğrulama pipe'ları, hata filtresi ve
`trust proxy` yoktu. Yani DTO doğrulaması hiç çalışmıyor, `DomainException` 500'e düşüyor,
vekil arkasında istemci IP'si görünmüyordu. Ortak açılış ayarı çekirdeğe alındı
(`packages/nest-kernel/src/http/setup-app.ts`) ve iki servis de onu çağırıyor — kopyalanmış
olsaydı yine sessizce ayrışırlardı. Hata filtresinin Prisma dalı api'ye özgü olduğu için
`BaseExceptionFilter` çekirdekte, api onu `mapPlatformException` ile genişletiyor
(çekirdek Faz 3.2'de Prisma'dan koparılmıştı; messaging'in Prisma'sı yok).

**Yapılandırma:** `infra/caddy/Caddyfile` (öneri — TLS'i kendi yönetir) ve
`infra/nginx/core-crm.conf`. Tek kural bütün messaging yüzeyini karşılar:

```
/api/v1/messaging/*  → messaging:8081
diğer her şey        → api:8080
```

docker-compose'a `proxy` profili altında eklendi (`docker compose --profile proxy up`);
yerel geliştirmede servislere doğrudan gidildiği için varsayılanda kapalı.

**Kalan elle iş:** `PUBLIC_BASE_URL` public alan adı olmalı (servisin kendi portu değil) —
Telegram webhook'u bundan türetiliyor; ve Meta panelinde WhatsApp + Instagram geri-çağrı
adreslerine `/messaging` segmenti eklenmeli (tek seferlik, klinik başına değil).

---

## 4. Faz 0 — uygulanan yapı

```
messaging/conversation/domain/interfaces/
  messaging-cache.service.interface.ts   # token + sözleşme (dedup, kota, teslim mutex'i)
messaging/conversation/infrastructure/cache/
  messaging-cache.service.ts             # ioredis + Lua
  messaging-cache.module.ts

messaging/ai-agent/domain/interfaces/
  ai-memory-cache.service.interface.ts   # token + sözleşme (bağlam penceresi)
messaging/ai-agent/infrastructure/cache/
  ai-memory-cache.service.ts             # ioredis + Lua
  ai-memory-cache.module.ts
```

**Redis anahtarları** (hepsi cluster hash tag'li):

| Anahtar                                              | Yapı        | TTL    |
| ---------------------------------------------------- | ----------- | ------ |
| `messaging:inbound:v1:<channel>:{externalId}`         | string      | 15 dk  |
| `messaging:send-quota:v1:{clinicId}`                  | sorted set  | 1 sn   |
| `messaging:delivery-lock:v1:{conversationId}`         | string      | 60 sn  |
| `messaging:ai-memory:v1:{conversationId}:window`      | list        | 24 sa  |
| `messaging:ai-memory:v1:{conversationId}:warm`        | string      | 24 sa  |

**Kritik tasarım notları**

1. **Dedup kilidi başarıda bırakılmaz.** Kilit, TTL boyunca dedup işareti olarak kalır;
   yalnız işleme *patlarsa* bırakılır (Meta'nın yeniden teslimi işlenebilsin). Kalıcı
   garanti hâlâ `@@unique(externalId)`; Redis yalnız yarış penceresini kapatır.
2. **Kota zaman damgası Redis'in kendi saatinden** (`TIME`) okunur — çok worker'lı
   kurulumda saat kayması kotayı bozmasın diye.
3. **`ai-memory.append` soğuk pencerede no-op'tur.** Aksi halde TTL'i dolmuş bir
   yazışmada tek mesajlık sahte bir geçmiş oluşur ve model önceki turları unuturdu.
   Ayırt etme `:warm` işaret anahtarıyla yapılır (boş liste ≠ ısıtılmamış).
4. **Cache otoritatif değil.** Tüm Redis hataları yutulur, akış DB'ye düşer — AI yanıtı
   ve mesaj teslimi Redis'e bağımlı hale getirilmez.
5. **Kota/mutex reddi job'u ERTELER** (`moveToDelayed` + `DelayedError`), hata saymaz —
   deneme hakkı (`attempts`) tüketilmez.
6. **Şablon mesajı da pencereye yazılır** (`message.body` = şablon adı). Cache, DB'den
   yeniden kurulacak pencerenin birebir aynısını taşımalı; yoksa AI'ın gördüğü geçmiş
   cache'in sıcak/soğuk olmasına göre değişirdi.

**Davranış değişikliği:** AI bağlam penceresi 20 ham mesajdan **10 sohbet turuna** indi
(`AI_MEMORY_WINDOW_SIZE`). Soğuk yükleme DB'den 40 ham mesaj çeker
(`AI_MEMORY_FETCH_LIMIT`) — metinsiz mesajlar elenip ardışık aynı-rol turlar
birleştikten sonra pencere tam dolsun diye.
