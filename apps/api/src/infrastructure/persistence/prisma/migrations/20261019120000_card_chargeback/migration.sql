-- Kart itirazı (chargeback / ters ibraz).
--
-- Kart sahibinin itirazında sağlayıcı parayı geri keser, ama defter tahsilatı
-- göstermeye devam ediyordu (108'de olmayan para, 120'de kapanmış görünen borç).
-- İtiraz süresince para 127 ara hesabında bekler:
--   açıldı     B 127 / A 108|102     (+ ücret: B 653 / A 108|102)
--   kazanıldı  B 108|102 / A 127
--   kaybedildi B 120 / A 127         (+ taksit CHARGED_BACK, telafi taksidi açılır)
--
-- Ek-yönlü migration: yeni tablo, yeni enum'lar, enum değerleri ve bir nullable
-- kolon. Mevcut veriye dokunmaz.
--
-- NOT: `ADD VALUE` ile eklenen enum değerleri bu migration İÇİNDE kullanılmıyor —
-- Postgres aynı transaction'da, önceden var olan bir enum'a eklenen değeri kabul
-- etmez. Aşağıdaki CHECK'ler yalnız bu migration'da YARATILAN enum'ların
-- değerlerine bakar (o durumda kullanım serbest).

-- ============================================================
-- Enum'lar
-- ============================================================

CREATE TYPE "CardChargebackStatus" AS ENUM ('OPEN', 'WON', 'LOST');
CREATE TYPE "CardChargebackSource" AS ENUM ('POS_TRANSACTION', 'ONLINE_PAYMENT');
CREATE TYPE "ChargebackFundsChannel" AS ENUM ('FUNDS_IN_TRANSIT', 'BANK');
CREATE TYPE "CardChargebackPlanSync" AS ENUM ('SYNCED', 'NOT_LINKED', 'NO_MATCHING_INSTALLMENT');

-- `IF NOT EXISTS`: enum değeri eklemek geri alınamaz; migration yeniden
-- oynatılırsa (shadow DB, kısmi uygulama) ikinci çalıştırma patlamasın.
ALTER TYPE "FinancialEventType" ADD VALUE IF NOT EXISTS 'CARD_CHARGEBACK_OPENED';
ALTER TYPE "FinancialEventType" ADD VALUE IF NOT EXISTS 'CARD_CHARGEBACK_WON';
ALTER TYPE "FinancialEventType" ADD VALUE IF NOT EXISTS 'CARD_CHARGEBACK_LOST';

-- Kaybedilen itiraz REFUNDED değildir: iade bizim kararımızla geri verilen para,
-- ters ibraz ise geri ALINAN paradır; hasta borcu hâlâ geçerlidir.
ALTER TYPE "InstallmentStatus" ADD VALUE IF NOT EXISTS 'CHARGED_BACK';
ALTER TYPE "LedgerStatus" ADD VALUE IF NOT EXISTS 'CHARGED_BACK';

-- ============================================================
-- card_chargebacks
-- ============================================================

CREATE TABLE "card_chargebacks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "provider" "SettlementProvider" NOT NULL,
    "case_reference" TEXT NOT NULL,
    "source_type" "CardChargebackSource" NOT NULL,
    "source_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "installment_id" TEXT,
    "patient_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "fee_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'TRY',
    "status" "CardChargebackStatus" NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMP(3) NOT NULL,
    "opened_funds_channel" "ChargebackFundsChannel" NOT NULL,
    "opened_bank_account_id" TEXT,
    "evidence_due_at" TIMESTAMP(3),
    "note" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_funds_channel" "ChargebackFundsChannel",
    "resolved_bank_account_id" TEXT,
    "resolution_note" TEXT,
    "opened_event_id" TEXT,
    "resolved_event_id" TEXT,
    "plan_sync_status" "CardChargebackPlanSync",
    "recovery_installment_id" TEXT,
    "recorded_by_id" TEXT NOT NULL,
    "resolved_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_chargebacks_pkey" PRIMARY KEY ("id")
);

-- Aynı vaka iki kez girilirse 127 iki kez dolar ve 108 iki kez düşer; mizan yine
-- dengeli göründüğü için hata hiçbir kontrole yakalanmaz. Nihai güvence DB'de.
CREATE UNIQUE INDEX "card_chargebacks_clinic_id_provider_case_reference_key"
  ON "card_chargebacks"("clinic_id", "provider", "case_reference");

CREATE INDEX "card_chargebacks_clinic_id_status_idx"
  ON "card_chargebacks"("clinic_id", "status");

-- Kaynak başına aktif itiraz toplamı (iade tavanı) bu indeksten okunur.
CREATE INDEX "card_chargebacks_source_type_source_id_idx"
  ON "card_chargebacks"("source_type", "source_id");

-- Tutar değişmezleri (CLAUDE.md finans kuralı 14: değişmez saklanan veride de
-- doğru olmalı). `NOT VALID` gerekmez — tablo yeni, aykırı satır olamaz.
ALTER TABLE "card_chargebacks"
  ADD CONSTRAINT "card_chargebacks_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "card_chargebacks"
  ADD CONSTRAINT "card_chargebacks_fee_non_negative" CHECK ("fee_amount" >= 0);

-- Durum ↔ çözüm tarihi: OPEN iken çözüm tarihi yok, çözülmüşken var. İkisinden
-- biri sapsa kayıt ya "hiç kapanmayan açık itiraz" ya da "tarihsiz kapanış" olur.
ALTER TABLE "card_chargebacks"
  ADD CONSTRAINT "card_chargebacks_resolution_consistent"
  CHECK (("status" = 'OPEN') = ("resolved_at" IS NULL));

ALTER TABLE "card_chargebacks"
  ADD CONSTRAINT "card_chargebacks_resolved_after_opened"
  CHECK ("resolved_at" IS NULL OR "resolved_at" >= "opened_at");

-- Para yalnız KAZANILAN itirazda bir yere geri döner; açıkta ya da kaybedilmişte
-- "geri dönüş kanalı" yazılmış bir kayıt olmamalı.
ALTER TABLE "card_chargebacks"
  ADD CONSTRAINT "card_chargebacks_won_has_return_channel"
  CHECK (("status" = 'WON') = ("resolved_funds_channel" IS NOT NULL));

-- Sanal POS kaynağında kaynak kimliği taksit kimliğidir: iki kolonun ayrışması
-- iade tavanının yanlış taksite bakması demek. `IS NOT NULL` açık yazıldı: CHECK
-- yalnız FALSE'u reddeder, `NULL = 'x'` ise NULL döner ve sessizce geçerdi.
ALTER TABLE "card_chargebacks"
  ADD CONSTRAINT "card_chargebacks_online_source_is_installment"
  CHECK (
    "source_type" <> 'ONLINE_PAYMENT'
    OR ("installment_id" IS NOT NULL AND "installment_id" = "source_id")
  );

-- ============================================================
-- payment_installments — telafi taksidi bağı
-- ============================================================

-- Kaybedilen itirazda hasta borcu geçerliliğini korur: aynı tutarda yeni bir
-- taksit açılır ve geri alınan taksidi gösterir. `UNIQUE`: bir taksidin tek
-- telafisi olabilir — aynı itirazın yeniden işlenmesi ikinci bir alacak doğurmasın.
ALTER TABLE "payment_installments" ADD COLUMN "recovers_installment_id" TEXT;

CREATE UNIQUE INDEX "payment_installments_recovers_installment_id_key"
  ON "payment_installments"("recovers_installment_id");

ALTER TABLE "payment_installments"
  ADD CONSTRAINT "payment_installments_recovers_installment_id_fkey"
  FOREIGN KEY ("recovers_installment_id") REFERENCES "payment_installments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
