-- Mal kabul günlüğü (tur 33, B2).
--
-- `purchase_order_items.quantity_received` kümülatif bir sayaçtır ve TARİH taşımaz. "31 Aralık
-- itibarıyla faturası gelmemiş mal" (GRNI tahakkuku) sorusunun cevabı kabulün zamanına bağlıdır ve
-- sonradan geri üretilemez: sayaç bugünkü toplamı verir, 31 Aralık'ı vermez. Bu yüzden her kabul
-- kendi kaydını bırakır — ve günlük 1 Ocak'tan ÖNCE canlıda olmalıdır: 1 Ocak'tan sonraki kabuller
-- günlüksüz yapılırsa 2026 tahakkuku tahmine kalır.
--
-- Bu migration yalnız EKLER; mevcut tabloya dokunmaz. Geçmiş kabuller sayaçtan TÜRETİLİR
-- (`LEGACY_BACKFILL`): tarih bilinmediği için `received_at` siparişin son güncelleme anıdır —
-- yaklaşık bir tarihtir ve yıl sonu önizlemesinde ayrıca işaretlenir. Sonda, günlük toplamı ile
-- sayaç eşitliği doğrulanır; eşit değilse migration geri alınır.

-- CreateEnum
CREATE TYPE "PurchaseOrderReceiptSource" AS ENUM ('GOODS_RECEIPT', 'LEGACY_BACKFILL');

-- CreateTable
CREATE TABLE "purchase_order_receipts" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "received_by_id" TEXT,
    "source" "PurchaseOrderReceiptSource" NOT NULL DEFAULT 'GOODS_RECEIPT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_receipt_lines" (
    "id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "purchase_order_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_order_receipts_clinic_id_received_at_idx" ON "purchase_order_receipts"("clinic_id", "received_at");

-- CreateIndex
CREATE INDEX "purchase_order_receipts_order_id_idx" ON "purchase_order_receipts"("order_id");

-- CreateIndex
CREATE INDEX "purchase_order_receipt_lines_receipt_id_idx" ON "purchase_order_receipt_lines"("receipt_id");

-- CreateIndex
CREATE INDEX "purchase_order_receipt_lines_item_id_idx" ON "purchase_order_receipt_lines"("item_id");

-- AddForeignKey
ALTER TABLE "purchase_order_receipts" ADD CONSTRAINT "purchase_order_receipts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_receipt_lines" ADD CONSTRAINT "purchase_order_receipt_lines_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "purchase_order_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_receipt_lines" ADD CONSTRAINT "purchase_order_receipt_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "purchase_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Satır değişmezleri veritabanında da durur (uygulama kapısı atlanırsa): miktar pozitif, fiyat eksi değil.
-- Tablolar yeni ve boş olduğu için doğrudan doğrulanır (NOT VALID gerekmez); aşağıdaki backfill de
-- bu kısıtlardan geçer.
ALTER TABLE "purchase_order_receipt_lines"
  ADD CONSTRAINT "purchase_order_receipt_lines_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "purchase_order_receipt_lines_unit_price_non_negative" CHECK ("unit_price" >= 0);

-- Backfill 1/2 — kabulü olan her sipariş için tek türetilmiş başlık.
INSERT INTO "purchase_order_receipts" (
  "id", "order_id", "clinic_id", "organization_id", "received_at", "received_by_id", "source", "created_at"
)
SELECT
  gen_random_uuid()::text, po."id", po."clinic_id", po."organization_id",
  po."updated_at", NULL, 'LEGACY_BACKFILL', CURRENT_TIMESTAMP
FROM "purchase_orders" po
WHERE EXISTS (
  SELECT 1 FROM "purchase_order_items" i
  WHERE i."order_id" = po."id" AND i."quantity_received" > 0
);

-- Backfill 2/2 — kalem başına sayaç kadar satır (fiyat: kalemin bugünkü birim fiyatı).
INSERT INTO "purchase_order_receipt_lines" ("id", "receipt_id", "item_id", "quantity", "unit_price")
SELECT gen_random_uuid()::text, r."id", i."id", i."quantity_received", i."unit_price"
FROM "purchase_order_items" i
JOIN "purchase_order_receipts" r
  ON r."order_id" = i."order_id" AND r."source" = 'LEGACY_BACKFILL'
WHERE i."quantity_received" > 0;

-- Kendi sonucunu doğrula: her kalemde günlük toplamı sayaca eşit olmalı.
DO $$
DECLARE
  drift integer;
BEGIN
  SELECT count(*) INTO drift
  FROM "purchase_order_items" i
  WHERE i."quantity_received" <> COALESCE(
    (SELECT sum(l."quantity") FROM "purchase_order_receipt_lines" l WHERE l."item_id" = i."id"),
    0
  );

  IF drift > 0 THEN
    RAISE EXCEPTION 'mal kabul günlüğü sayaçla uyuşmuyor: % kalem', drift;
  END IF;
END $$;
