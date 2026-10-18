-- Rezervasyon iadesinin platform defterine yazılabilmesi için gereken iki parça.

-- 1) İade, tahsilatın storno'su değil kendi tarihi olan ayrı bir ekonomik olaydır
--    (bkz. PAYMENT_REFUNDED gerekçesi). Bu yüzden ayrı bir olay tipi alır.
--    Değer aynı migration içinde KULLANILMAZ: Postgres yeni enum değerini onu
--    ekleyen transaction'da kullanmayı reddeder.
ALTER TYPE "FinancialEventType" ADD VALUE IF NOT EXISTS 'PLATFORM_BOOKING_REFUNDED';

-- 2) İptal ekonomisi. Dördü de nullable ve VARSAYILANSIZ:
--    - supplier_retained_amount'a 0 yazmak "sağlayıcı ceza almadı" demek olurdu;
--      bu bilinmediğinde uydurulamaz (tedarikçi borcu eksik düşer, zarar hiç
--      tanınmaz). Bilinmeyen hâl alarmla duyurulur.
--    - refunded_at geçmiş iadeler için uydurulamaz: updated_at'i kopyalamak
--      iadenin tarihini son dokunulma tarihine eşitlerdi.
ALTER TABLE "booking_payments"
  ADD COLUMN "supplier_retained_amount"   DECIMAL(12,2),
  ADD COLUMN "supplier_retained_currency" "Currency",
  ADD COLUMN "refunded_at"                TIMESTAMP(3),
  ADD COLUMN "refund_reason"              TEXT;
