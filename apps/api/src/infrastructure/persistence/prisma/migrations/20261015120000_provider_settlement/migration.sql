-- Sağlayıcı hesap kapaması (settlement): 108 Diğer Hazır Değerler → 102 Bankalar + 653 Komisyon.
--
-- Ek-yönlü migration: yeni tablo + yeni enum değeri. Mevcut veriye dokunmaz.
-- `PROVIDER_SETTLEMENT_RECEIVED` olay tipi olmadan posting kuralı kayıt edilemez
-- (kural kapsamı açılışta `POSTABLE_FINANCIAL_EVENT_TYPES` ile karşılaştırılıyor).

CREATE TYPE "SettlementProvider" AS ENUM ('IYZICO', 'IYZICO_TERMINAL', 'PAX_BANK', 'STRIPE', 'OTHER');

ALTER TYPE "FinancialEventType" ADD VALUE 'PROVIDER_SETTLEMENT_RECEIVED';

CREATE TABLE "provider_settlements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "provider" "SettlementProvider" NOT NULL,
    "reference" TEXT NOT NULL,
    "payout_date" TIMESTAMP(3) NOT NULL,
    "gross_amount" DECIMAL(14,2) NOT NULL,
    "commission_amount" DECIMAL(14,2) NOT NULL,
    "net_amount" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'TRY',
    "bank_account_id" TEXT,
    "note" TEXT,
    "accounting_event_id" TEXT,
    "posted_to_accounting_at" TIMESTAMP(3),
    "recorded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_settlements_pkey" PRIMARY KEY ("id")
);

-- Aynı payout iki kez girilirse 108 iki kez kapanır ve bakiye eksiye düşer:
-- idempotency anahtarı DB'de durur (uygulama kapısı tek başına yarışı kapatmaz).
CREATE UNIQUE INDEX "provider_settlements_clinic_id_provider_reference_key"
  ON "provider_settlements"("clinic_id", "provider", "reference");

CREATE INDEX "provider_settlements_clinic_id_payout_date_idx"
  ON "provider_settlements"("clinic_id", "payout_date");

-- Tutar değişmezleri (§81 ile aynı gerekçe: değişmez saklanan veride de doğru
-- olmalı). `NOT VALID` gerekmez — tablo yeni, aykırı satır olamaz.
ALTER TABLE "provider_settlements"
  ADD CONSTRAINT "provider_settlements_amounts_positive"
  CHECK ("gross_amount" > 0 AND "net_amount" > 0 AND "commission_amount" >= 0);

ALTER TABLE "provider_settlements"
  ADD CONSTRAINT "provider_settlements_gross_equals_net_plus_commission"
  CHECK ("gross_amount" = "net_amount" + "commission_amount");
