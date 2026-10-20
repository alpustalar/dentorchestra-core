-- Rezervasyon iade kaydı (BookingPaymentRefund) + 336 "iade edilecek tahsilat" olayları.
--
-- Bulgular (tur 31, ölçüldü):
--   * iyzico iade sonucu okunmuyordu → iade reddedilse bile ters fiş (A 108) atılıyordu.
--   * İade kaynak satırında tutar / durum / sağlayıcı iade referansı yoktu; çift çekimde hiç
--     satır yoktu → tekrar gelen webhook ikinci iade çağrısı yapabiliyordu.
--
-- Ek-yönlü migration: yeni tablo, yeni enum'lar, iki enum değeri ve eski REFUNDED
-- satırlarının iade kaydı olarak İŞARETLENMESİ. `booking_payments` satırlarına ve mevcut
-- finansal olaylara dokunulmaz.
--
-- NOT: `ADD VALUE` ile eklenen enum değerleri bu migration İÇİNDE kullanılmıyor — Postgres
-- aynı transaction'da, önceden var olan bir enum'a eklenen değeri kabul etmez.

-- ============================================================
-- Enum'lar
-- ============================================================

CREATE TYPE "BookingPaymentRefundKind" AS ENUM ('CANCELLATION', 'BOOKING_FAILED', 'UNCLAIMED_CHARGE');
CREATE TYPE "BookingPaymentRefundStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'UNCONFIRMED');
CREATE TYPE "BookingPaymentRefundOrigin" AS ENUM ('LIVE', 'LEGACY');
CREATE TYPE "BookingPaymentRefundResolution" AS ENUM ('CONFIRMED', 'NOT_REFUNDED');

ALTER TYPE "FinancialEventType" ADD VALUE IF NOT EXISTS 'PLATFORM_RETURNABLE_CHARGE_RECEIVED';
ALTER TYPE "FinancialEventType" ADD VALUE IF NOT EXISTS 'PLATFORM_RETURNABLE_CHARGE_REFUNDED';

-- ============================================================
-- booking_payment_refunds
-- ============================================================

CREATE TABLE "booking_payment_refunds" (
    "id" TEXT NOT NULL,
    "booking_payment_id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "BookingPaymentRefundKind" NOT NULL,
    "origin" "BookingPaymentRefundOrigin" NOT NULL DEFAULT 'LIVE',
    "provider" "BookingPaymentProvider" NOT NULL,
    "charge_provider_ref" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "status" "BookingPaymentRefundStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT,
    "failure_reason" TEXT,
    "requested_at" TIMESTAMP(3),
    "requested_by_id" TEXT,
    "provider_refund_ref" TEXT,
    "refunded_at" TIMESTAMP(3),
    "resolution" "BookingPaymentRefundResolution",
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_payment_refunds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "booking_payment_refunds_status_requested_at_idx" ON "booking_payment_refunds"("status", "requested_at");
CREATE INDEX "booking_payment_refunds_booking_payment_id_idx" ON "booking_payment_refunds"("booking_payment_id");
CREATE INDEX "booking_payment_refunds_clinic_id_status_idx" ON "booking_payment_refunds"("clinic_id", "status");
CREATE UNIQUE INDEX "booking_payment_refunds_provider_charge_provider_ref_key" ON "booking_payment_refunds"("provider", "charge_provider_ref");

ALTER TABLE "booking_payment_refunds" ADD CONSTRAINT "booking_payment_refunds_booking_payment_id_fkey" FOREIGN KEY ("booking_payment_id") REFERENCES "booking_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tablo yeni olduğu için CHECK'ler doğrudan doğrulanır (NOT VALID gerekmez).
ALTER TABLE "booking_payment_refunds"
  ADD CONSTRAINT "booking_payment_refunds_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "booking_payment_refunds_attempt_positive" CHECK ("attempt_count" >= 1),
  -- İade yalnız sağlayıcı onaylayınca (ya da operatör doğrulayınca) "yapıldı" sayılır.
  ADD CONSTRAINT "booking_payment_refunds_confirmed_has_refunded_at"
    CHECK (("status" = 'CONFIRMED') = ("refunded_at" IS NOT NULL)),
  ADD CONSTRAINT "booking_payment_refunds_failed_has_reason"
    CHECK ("status" <> 'FAILED' OR "failure_reason" IS NOT NULL),
  -- Elle karar damgası (kural 7): üçü birlikte dolu ya da birlikte boş.
  ADD CONSTRAINT "booking_payment_refunds_resolution_stamp"
    CHECK (("resolution" IS NULL) = ("resolved_at" IS NULL)
       AND ("resolved_at" IS NULL) = ("resolved_by_id" IS NULL)),
  ADD CONSTRAINT "booking_payment_refunds_live_has_requested_at"
    CHECK ("origin" = 'LEGACY' OR "requested_at" IS NOT NULL),
  -- iyzico yalnız TRY çeker/iade eder.
  ADD CONSTRAINT "booking_payment_refunds_iyzico_is_try"
    CHECK ("provider" <> 'IYZICO' OR "currency" = 'TRY');

-- ============================================================
-- Eski REFUNDED satırları
-- ============================================================
--
-- Bu satırlar iade kaydı olmadan REFUNDED yapılmıştı; sağlayıcı çağrısının sonucu hiçbir
-- yerde doğrulanmadı (iyzico sonucu okunmuyordu). Geçmişi YORUMLAMIYORUZ: "iade talep
-- edildi, sonucu doğrulanmadı" olarak işaretliyoruz. Operatör iyzico panelinden doğrulayıp
-- elle karar verir; mevcut ters fişler yerinde kalır.
--   kind: bookingReference doluysa rezervasyon açılmıştı → CANCELLATION, değilse BOOKING_FAILED
--   requested_at: refunded_at (bilinmeyebilir; updated_at'tan UYDURULMAZ)
INSERT INTO "booking_payment_refunds" (
  "id", "booking_payment_id", "clinic_id", "organization_id",
  "kind", "origin", "provider", "charge_provider_ref", "amount", "currency",
  "status", "attempt_count", "reason", "requested_at", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text, bp."id", bp."clinic_id", bp."organization_id",
  CASE WHEN bp."booking_reference" IS NOT NULL
       THEN 'CANCELLATION'::"BookingPaymentRefundKind"
       ELSE 'BOOKING_FAILED'::"BookingPaymentRefundKind" END,
  'LEGACY', bp."paid_provider", bp."paid_provider_ref",
  CASE WHEN bp."paid_provider" = 'IYZICO' THEN bp."try_amount" ELSE bp."sale_amount" END,
  CASE WHEN bp."paid_provider" = 'IYZICO' THEN 'TRY'::"Currency" ELSE bp."sale_currency" END,
  'UNCONFIRMED', 1, bp."refund_reason", bp."refunded_at", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "booking_payments" bp
WHERE bp."status" = 'REFUNDED'
  AND bp."paid_provider" IS NOT NULL
  AND bp."paid_provider_ref" IS NOT NULL;
