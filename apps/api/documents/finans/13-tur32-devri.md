# Finans — Tur 32 Kısa Devir (HANDOVER)

**Tarih:** 2026-10-20 · **Dal:** `main` · **Kapsam:** platform iyzico kart itirazı (§91).
Ayrıntı: `09-guvence-denetimi.md` §91, genel devir: `12-durum-devri.md` §0.

## 1. Tur 32 özeti ve değişiklikler

**Amaç:** Platform rezervasyon tahsilatına (iyzico/TRY) karşı kart itirazı akışı + iade yollarında itiraz tavanı (kural 17).

**Mimari kararlar**
- `CardChargeback` genişletildi: yeni kaynak `BOOKING_PAYMENT` (sourceId = rezervasyon ödemesi id'si). Ayrı tablo yok.
- Kayıp hesabı: `659` başlığı (postlanamaz) + `659.01 Platform İtiraz ve Chargeback Zararları`. `689` kullanılmadı (postlanabilir hesabın altına alt hesap açılamaz). Eklenme ek-yönlü; platform defterine açılışta eklendi.
- Kayıp fişi `B 659.01 / A 127`. Tedarikçi borcu (320) ve rezervasyon kararı bu fişin dışında (muhasebe/ürün kararı).
- İtiraz yalnız **platform kliniğine**, **iyzico/TRY** ve ileri fişi (`PLATFORM_BOOKING_SETTLED`) yazılmış tahsilata açılabilir. Stripe itirazı yok.

**DB / entity zorlamaları**
- `patient_id` ve `party_id` nullable. `CHECK card_chargebacks_patient_party_by_source`:
  - `BOOKING_PAYMENT` ⇒ hasta, cari, ödeme planı, taksit **yok** ∧ IYZICO ∧ TRY.
  - Diğer kaynaklar ⇒ hasta **ve** cari zorunlu.
- CHECK `source_type::text` ile yazıldı (`ADD VALUE` aynı tx'te literal olarak kullanılamaz).
- Entity `open()` aynı kuralı `ChargebackSourceActorsInvalidException` ile DB'den önce reddeder.

**Platform zararı kuralı**
- `CARD_CHARGEBACK_LOST` gövdesi iki katı varyant: hasta (`partyId`) ya da platform (`platformLoss: true`).
- Platform zararı cari yokluğundan **türetilmez**; ikisi birden ya da hiçbiri reddedilir.
- Plan yansıması platformda `NOT_LINKED`.

**Tavan kapısı (kural 17)**
- `BookingPaymentCollectionService.lockAndGetReversibleAmount`: bp satırını `FOR UPDATE` kilitler, iyzico doğrular, `tahsilat − iade satırı` döner (`FAILED` iade sayılmaz).
- `CARD_CHARGEBACK_EXPOSURE_GUARD` üç iade claim'inde bp kilidi altında çağrılır: iptal, başarısız rezervasyon, yeniden deneme (`UNCLAIMED_CHARGE` hariç).
- İptal/retry'da ret claim'i geri sarar. Başarısız rezervasyonda `FAILED` korunur, iade açılmaz, CRITICAL basılır.
- Taramalar 20 → 23: `itiraz-tavan-asimi-booking`, `itiraz-booking-kaynak-uyumsuz`, `itiraz-659-mutabakat`.

**Tur 31'den düzeltilen hata:** açılış dönem işi CQRS handler kaydından önce çalışıp düşüyordu; `removeOnFail:false` + sabit `jobId` işi sonraki açılışlarda da engelliyordu. Şimdi 30 sn gecikme, 3 deneme, `removeOnFail:true`.

## 2. Mevcut durum ve kanıtlar

- `pnpm test`: 278/279 suite, **2059** test yeşil. Kırmızı tek suite ilgisiz (`schedule-appointment.handler.spec.ts`).
- Kırmızı kanıt: üç koruma bozulunca 7 test düştü; geri alınınca ilgili paket **150/150** yeşil.
- `tsc`: yalnız aynı ilgisiz hata.
- `app.module.spec` 4/4; gerçek uygulama açılışında **DI hatası yok**; platform defterinde `659` / `659.01` oluştu.
- `pnpm finans:degismezler`: **23/23 temiz** (dev DB). DB CHECK sekiz gerçek INSERT senaryosuyla sınandı.
- Yerel DB: 90/90 migration uygulandı, seed çalıştı, sekiz `NOT VALID` kısıt doğrulandı.
- Tur 32 migration: `20261021120000_booking_payment_chargeback`.

## 3. Sizde kalanlar / manuel adımlar

- **Commit:** Tur 30+31 `ca4b5075`, refactor `68898279`. **Tur 32 commit'siz**; yalnız istenirse atılır. İlk commit tek başına derlenmeyebilir (iç içe dosyalar, doğrulanmadı).
- **Üretimde sırayla:**
  1. `prisma migrate deploy` (üç migration: tur 30/31/32).
  2. Uygulamayı aç (dönem işi platform dönemini açar; `659`/`659.01` eklenir).
  3. Seed (`bookingpaymentrefund`, `cardchargeback` aileleri).
  4. `pnpm finans:degismezler` → 23/23.
  5. Temizse sekiz `NOT VALID` kısıt için `VALIDATE CONSTRAINT`.
- **Eski REFUNDED satırları (üretim):** `GET /health-tourism/booking-payments/refunds/unresolved` ile listele → her satırı iyzico panelinde `idempotencyKey` / `chargeProviderRef` ile doğrula → `POST …/refunds/:id/resolve`. Kodla yapılamaz; dev DB'de hiç satır yok.
- Tanımsız env: `SLACK_OPS_WEBHOOK_URL`, `POS_CALLBACK_SECRET`.

## 4. Tur 33 başlangıç hedefi

**Dönem sonu / yıl sonu fiş takımı** (`10-kalan-isler.md` #1, tek turda tasarlanmalı):
- GRNI tahakkuku **159 / 326**.
- Açılış fişi **590 → 570**.
- Maliyet aktarımı **740 → 622 / 620**.

Altyapı hazır: `JournalEntryKind.CLOSING` var, `OPENING` aynı süzgeçle eklenir. Okunacaklar: `10-kalan-isler.md` #1; `09` §5, §7, §46, §50, §52; `04-muhasebe-defterler.md` §5. Önce `12-durum-devri.md` §0.1 ölçümlerini yeniden al.
