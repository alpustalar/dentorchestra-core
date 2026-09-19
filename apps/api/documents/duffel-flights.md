# Duffel Uçuş Entegrasyonu

**Modül:** `apps/api/src/modules/crm/health-tourism/flight/`
**Durum:** ✅ Backend tamam (2026-08-25) — Duffel hesabı bağlanmayı bekliyor.

---

## Neden Duffel, neyi kapsıyor

Sağlık turizminde hasta bugüne kadar uçuşunu kendi buluyor, sisteme yalnız uçuş kodunu
söylüyordu (`book_transfer` aracının `flightCode` alanı). Duffel ile uçuş da platformun
sattığı bir kalem oldu: otel ve transferde olduğu gibi komisyon **platform geliri** olarak
muhasebeleşiyor.

**Duffel'ın API ile sattığı iki ürün var: Flights ve Stays (otel). Yer transferi ürünü yok.**
Bu yüzden dağılım:

| Kalem | Sağlayıcı |
| --- | --- |
| Uçuş | **Duffel** |
| Otel | HotelBeds (değişmedi) |
| Transfer | HotelBeds (Duffel'da karşılığı yok) |

Duffel Stays bilinçli olarak kapsam dışı bırakıldı — çalışan HotelBeds otel akışını
sökmemek için.

---

## SDK ve kimlik

- Paket: `@duffel/api@^4.28.0` (Node ≥20 ister; repo v23).
- Env: **`DUFFEL_ACCESS_TOKEN`** — test/canlı ayrımı token'ın kendisindedir
  (`duffel_test_…` / `duffel_live_…`).
- Joi'de **bilinçli olarak opsiyonel** (`pattern(/^duffel_(test|live)_/)`): token yoksa
  yalnız uçuş uçları devre dışı kalır, uygulamanın tamamı ayağa kalkmayı sürdürür.
  Eksikliği `DuffelApiService` ilk çağrıda `DuffelCredentialsMissingException` (503) ile
  bildirir — `StripeClientFactory`'nin tembel doğrulama deseni.

> HotelBeds adapter'ları ham `fetch` kullanır çünkü HotelBeds'in SDK'sı yok. Duffel'da
> resmî SDK var ve repo Stripe/iyzico için de resmî SDK kullanıyor.

---

## Hibrit ödeme akışı (asıl tasarım kararı)

Duffel dokümantasyonu *"You should charge the customer yourself before creating the order"*
diyor; sipariş Duffel Balance'tan ödeniyor. Bu, mevcut ödeme-önce saga'ya birebir oturuyor.
Uçuşa özgü sorun şu: **uçuş teklifleri otel fiyatlarından çok daha hızlı bayatlar.** Hasta
ödeme linkine tıklayana kadar teklif düşerse para alınmış ama uçuş kalmamış olur.

Çözüm iki yollu:

```
                      ┌─ requiresInstantPayment === false ─┐
                      │                                     │
 search_flights       │   HOLD yolu                         │
   ↓ (fl_ optionId)   │   1. HoldFlightCommand → Duffel      │
 book_flight ─────────┤      pay_later siparişi (koltuk      │
                      │      tutulur, HELD kaydı açılır)     │
                      │   2. ödeme linkleri üretilir          │
                      │   3. ödeme onayı → PayHeldFlight →    │
                      │      Duffel payments.create → CONFIRMED
                      │
                      └─ requiresInstantPayment === true ──┐
                          INSTANT yolu                      │
                          1. teklif cache'te bekler          │
                          2. ödeme linkleri üretilir         │
                          3. ödeme onayı → BookFlight →      │
                             ödemeli sipariş → CONFIRMED
```

Hold denemesi başarısız olursa akış **durmaz**, INSTANT yola düşülür (koltuk tutulamamış
olur ama hasta yine de ödeme linkini alır) — `BookFlightTool.buildIntent()`.

`FlightBookingIntent` bu yüzden kendi içinde `mode: 'HOLD' | 'INSTANT'` ile ayrışır.

---

## ⚠️ Saga'daki sessiz hata tuzağı (kalıcı koruma)

`confirm-booking-payment.handler.ts` içindeki `book()` ve `buildSummary()`, ayrıca
`initiate-booking-payment.handler.ts` içindeki `buildDescription()` **ikili `if/else`**
idi (`intent.type === HOTEL ? … : …`).

Birleşime `FLIGHT` eklendiğinde uçuşlar **sessizce transfer dalına düşerdi** ve TypeScript
uyarmazdı: `else` kalan üyelere daraltıyor, `as BookTransferDto` cast'i de şekil
uyuşmazlığını yutuyordu. Üç nokta da **`switch` + `assertNever(intent)`**'e çevrildi
(`packages/nest-kernel/src/common/utils/assert-never.ts`) — kapsanmayan her yeni tür artık
**derleme hatası**.

Regresyon testi: `confirm-booking-payment.handler.spec.ts` → `FLIGHT intent dispatch`
(HOLD → `PayHeldFlightCommand`, INSTANT → `BookFlightCommand`, ikisinde de
`BookTransferCommand`'in çağrılmadığı açıkça doğrulanır).

---

## Modül haritası

```
flight/
  domain/
    contracts/duffel-flight-booking/   FlightOffer, FlightOfferToken, Props
    entities/duffel-flight-booking.entity.ts   HELD → CONFIRMED → CANCELLED / FAILED
    events/flight-booking.events.ts    created / confirmed / cancelled
    exceptions/duffel-flight.exceptions.ts
    interfaces/duffel-api.interface.ts      DUFFEL_API_SERVICE portu
    interfaces/flight-cache.service.interface.ts  FLIGHT_CACHE_SERVICE
    repositories/duffel-flight-booking/     command (+findByIdForUpdate) / query
  application/
    commands/  hold-flight, pay-held-flight, book-flight,
               cancel-flight-booking, cache-flight-offer
    queries/   search-flight-offers, get-flight-offer,
               get-flight-bookings, get-flight-booking-by-id
    ai-tools/  search_flights, book_flight, get_flight_bookings, cancel_flight_booking
  infrastructure/
    adapters/duffel/duffel-api.service.ts   anti-corruption: Duffel → domain
    cache/flight-cache.service.ts           teklif token'ı, dinamik TTL
    persistence/prisma/repositories/
  presentation/http/dto/                    alan-bazlı serileştirme
```

### Entity durum makinesi

Otel entity'sindeki bilinen kusur tekrarlanmadı: `HotelbedsBooking` `PENDING` doğuyor ve
hiçbir zaman `CONFIRMED`'a terfi etmiyor; "gerçekten onaylandı mı" bilgisi yalnız
`BookingPayment.status`'ta duruyor. Uçuşta bilet kesimi kaydın kendisinde izleniyor:

- `HOLD` modunda kayıt `HELD` doğar, `confirm()` ile `CONFIRMED` olur.
- `INSTANT` modunda kayıt doğrudan `CONFIRMED` doğar (sipariş zaten ödenmiş açılır).
- `confirm()` yalnız `HELD` kayıtta çalışır → Duffel'da çift ödeme engellenir.
- `cancel()` idempotenttir → çift iptal/çift iade engellenir.

---

## Kritik detaylar

**Para birimi kapısı.** `Currency` enum'u `TRY/USD/EUR/GBP` ile sınırlı; Duffel başka
para biriminde teklif dönebilir. Adapter bu teklifleri **eler** (sessizce yanlış kolona
yazmaz) ve hepsi elenirse uyarı loglar.

**Cache TTL sabit değil.** Otel 15 dk sabit kullanıyor. Uçuşta TTL teklifin kendi
`expiresAt`'inden hesaplanır; alt sınır 30 sn, üst sınır 10 dk.

**Opak kimlik LLM'e verilmez.** Duffel `offer_id` asla modele gösterilmez; kısa
`fl_xxxxxxxx` optionId üretilip `offer_id` Redis'e mühürlenir (otel `rateKey` kuralının
aynısı). Redis'e erişim yalnız `CacheFlightOfferCommand` / `GetFlightOfferQuery` üzerinden.

**Dış çağrılar kilit dışında.** `payOrder` ve `cancelOrder` satır kilidi alındıktan sonra,
kilit kapsamı DIŞINDA yapılır — saniyeler süren bir dış istek satırı kilitli tutmaz.

**Yolcu verisi.** Havayolu bileti ad/soyad/doğum tarihi olmadan kesilemez; bu yüzden
uçuş, otel/transferdeki tek "holder"dan farklı olarak her koltuk için kimlik ister.
`passengers` alanı response DTO'sunda `DATA_OWNER/INTERNAL/MANAGEMENT/ADMIN` grubuna
kapatıldı. PNR (`bookingReference`) de aynı grupta — PNR ile havayolu sitesinden
rezervasyona erişilebilir.

**Muhasebe bedava geldi.** `PlatformBookingSettledEventPayload.bookingType` düz `string`;
`platform-booking-settled.rule.ts` (B 108 / A 601 komisyon / A 320 tedarikçi) **değişmeden**
uçuşu da işliyor.

---

## Uçlar

| Uç | Yetki | Not |
| --- | --- | --- |
| `GET health-tourism/flights/search` | `DUFFELFLIGHTBOOKING.read` | |
| `GET health-tourism/flights/bookings` | `DUFFELFLIGHTBOOKING.read` | serileştirme gruplu |
| `GET health-tourism/flights/bookings/:id` | `DUFFELFLIGHTBOOKING.read` | |
| `POST health-tourism/flights/bookings` | `DUFFELFLIGHTBOOKING.create` | **`manualOverride` zorunlu** — saga'yı baypas eder |
| `DELETE health-tourism/flights/bookings/:id` | `DUFFELFLIGHTBOOKING.delete` | |

Normal akış AI/hasta tarafında ödeme linkidir; `POST` yalnız ödemenin kanal dışı
(havale/nakit) tahsil edildiği manuel durum içindir.

---

## Test modunda doğrulama

Duffel ücretsiz test hesabı verir; test modunda **bakiye sınırsızdır**.

```bash
# envs/.env.development
DUFFEL_ACCESS_TOKEN=duffel_test_...
```

1. `GET health-tourism/flights/search?origin=LHR&destination=…` → Duffel Airways sahte
   teklifleri döner (test modunda gerçek havayolu envanteri gelmez).
2. `book_flight` → ödeme linki üretilir; hold'a uygun teklifte Duffel'da `pay_later`
   siparişi açılır ve `holdExpiresAt` dolar.
3. Ödeme onayı (Stripe test webhook'u veya doğrudan `ConfirmBookingPaymentCommand`) →
   `payments.create` çağrılır, kayıt `CONFIRMED`, PNR dolar.
4. `PLATFORM_BOOKING_SETTLED` fişi düşer (108/601/320), `dedupeKey` ile tekrarlanmaz.
5. İptal → Duffel siparişi iptal edilir, kayıt `CANCELLED`, iade tetiklenir.

---

## Bilinçli olarak yapılmayanlar

- **Duffel Stays** — otel HotelBeds'te kalıyor.
- **Uçuş durum takibi / webhook** — rötar-iptal bildirimleri sonraki tur. Duffel
  `airline_initiated_changes` ve webhook desteği veriyor; hazır olduğunda
  `platform/notification` listener'ına bağlanabilir.
- **Duffel Balance mutabakatı** — sipariş Duffel bakiyesinden ödeniyor, hastanın parası
  iyzico/Stripe'a geliyor: **iki ayrı kova**. Canlıya geçmeden önce bakiye besleme ve
  mutabakat kurgusu gerekir; test modunda sorun değil.
- **Hold süresi dolunca aktif iptal** — Duffel `payment_required_by` sonunda koltuğu kendi
  bırakıyor. Erken serbest bırakma için (work-order'daki gibi) BullMQ taraması sonraki tur.
- **Bilet değişikliği (order change)** — v1'de yok.
- **Kabin/koltuk seçimi, bagaj ek hizmetleri** — v1'de yok.
