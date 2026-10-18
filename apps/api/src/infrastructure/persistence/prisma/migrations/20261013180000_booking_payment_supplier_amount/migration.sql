-- Sağlayıcının rezervasyonu açarken FİİLEN ücretlendirdiği maliyet.
--
-- `net_amount` TEKLİF anındaki fiyattır: satış fiyatı ondan türetilir ve ödeme
-- linki saatlerce açık kalabilir. Sağlayıcı rezervasyonu yeni fiyatla açarsa
-- aradaki fark bugüne kadar komisyonu sessizce yiyordu ve defterde 320
-- (tedarikçi borcu) sağlayıcının faturalayacağı tutarı göstermiyordu.
--
-- Nullable ve varsayılansız: eski satırlarda ve ödeme-öncesi akışı baypas eden
-- manuel rezervasyonlarda fiilî maliyet BİLİNMİYOR. 0 yazmak "bedava" demek,
-- net_amount'u kopyalamak "sapma yok" demek olurdu — ikisi de uydurma.
ALTER TABLE "booking_payments" ADD COLUMN "supplier_amount" DECIMAL(12,2);
ALTER TABLE "booking_payments" ADD COLUMN "supplier_currency" "Currency";
