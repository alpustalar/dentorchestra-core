-- Belge iptali (storno) akışı: satış ve alış faturası için kalıcı iptal damgası
-- + "iptal edilmemiş fatura" tekilliği.
--
-- NEDEN:
-- 1. `InvoiceStatus.CANCELLED` / `PurchaseInvoiceStatus.CANCELLED` enum'da vardı ama
--    hiçbir kod yolu oraya götürmüyordu: hatalı kesilmiş fatura ne iptal edilebiliyor
--    ne de düzeltilebiliyordu (append-only gövde + `assertAppointmentNotInvoiced`).
-- 2. İptal yüksek etkili bir finansal işlemdir (defterde storno üretir) → kim, ne
--    zaman, neden sorularını yanıtlayan kalıcı damga zorunlu (CLAUDE.md finans kuralı 7).
-- 3. `appointment_id` / `payment_id` TAM unique olduğu için iptalden sonra aynı
--    randevu/tahsilat için DOĞRU fatura bir daha kesilemiyordu. Tekillik yalnız
--    **iptal edilmemiş** faturalar arasında anlamlıdır → kısmî unique index.
--    (Kod tarafındaki kabul kümesi: `ACTIVE_INVOICE_STATUSES` — tek kaynak,
--    CLAUDE.md finans kuralı 12.)

-- 1) Satış faturası iptal damgası
ALTER TABLE "invoices"
  ADD COLUMN "cancelled_at" TIMESTAMP(3),
  ADD COLUMN "cancelled_by_id" TEXT,
  ADD COLUMN "cancel_reason" TEXT;

-- 2) Alış faturası iptal damgası
ALTER TABLE "purchase_invoices"
  ADD COLUMN "cancelled_at" TIMESTAMP(3),
  ADD COLUMN "cancelled_by_id" TEXT,
  ADD COLUMN "cancel_reason" TEXT;

-- 3) Tam unique → kısmî unique (yalnız iptal edilmemiş faturalar arasında).
--    Prisma kısmî index'i şemada ifade edemez; bu yüzden model tarafındaki
--    `@unique` kaldırıldı ve kısıt burada elle kurulur.
DROP INDEX IF EXISTS "invoices_appointment_id_key";
DROP INDEX IF EXISTS "invoices_payment_id_key";

CREATE UNIQUE INDEX "invoices_appointment_id_active_key"
  ON "invoices" ("appointment_id")
  WHERE "appointment_id" IS NOT NULL AND "status" <> 'CANCELLED';

CREATE UNIQUE INDEX "invoices_payment_id_active_key"
  ON "invoices" ("payment_id")
  WHERE "payment_id" IS NOT NULL AND "status" <> 'CANCELLED';

-- Arama indeksi: unique kısıt artık kısmî olduğu için iptal edilmiş faturaları da
-- kapsayan bir `payment_id` aramasına (fatura geçmişi) ayrı index gerekir.
-- `appointment_id` zaten `invoices_appointment_id_idx` ile indeksliydi.
CREATE INDEX "invoices_payment_id_idx" ON "invoices" ("payment_id");
