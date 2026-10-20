-- Platform rezervasyon tahsilatı için kart itirazı (tur 32).
--
-- Platform sanal POS'u (iyzico/TRY) rezervasyon parasını tahsil eder; kart sahibi itiraz
-- ederse sağlayıcı parayı keser. Kayıt mevcut `card_chargebacks` tablosunu paylaşır:
-- 127 ara hesabı, durum makinesi ve tavan kapısı aynıdır. Fark yalnız kaynak (`bookingPaymentId`)
-- ve kaybın hesabıdır: platformun alacağı olacak bir hasta borcu yoktur, kayıp 659.01'e gider.

-- 1) Yeni kaynak türü. ADD VALUE aynı transaction'da KULLANILAMAZ: aşağıdaki CHECK'ler
--    enum literal'i yerine `::text` karşılaştırması yapar.
ALTER TYPE "CardChargebackSource" ADD VALUE 'BOOKING_PAYMENT';

-- 2) Hasta ve cari artık boş olabilir (yalnız BOOKING_PAYMENT'ta).
ALTER TABLE "card_chargebacks" ALTER COLUMN "patient_id" DROP NOT NULL;
ALTER TABLE "card_chargebacks" ALTER COLUMN "party_id" DROP NOT NULL;

-- 3) Boşluk keyfi değil: kaynağa bağlıdır. Tablo küçük ve mevcut satırların hepsi dolu olduğu için
--    doğrudan doğrulanarak eklenir (NOT VALID gerekmez). `IS NULL`/`IS NOT NULL` açık yazıldı:
--    CHECK yalnız FALSE'u reddeder, NULL sessizce geçerdi.
ALTER TABLE "card_chargebacks"
  ADD CONSTRAINT "card_chargebacks_patient_party_by_source"
  CHECK (
    (
      "source_type"::text = 'BOOKING_PAYMENT'
      AND "patient_id" IS NULL
      AND "party_id" IS NULL
      AND "payment_id" IS NULL
      AND "installment_id" IS NULL
      AND "provider"::text = 'IYZICO'
      AND "currency"::text = 'TRY'
    )
    OR (
      "source_type"::text <> 'BOOKING_PAYMENT'
      AND "patient_id" IS NOT NULL
      AND "party_id" IS NOT NULL
    )
  );

-- 4) Kaynak başına aktif itiraz toplamı (tavan kapısı) bu indeksi zaten kullanır
--    (`source_type`, `source_id`); ek indeks gerekmez.
