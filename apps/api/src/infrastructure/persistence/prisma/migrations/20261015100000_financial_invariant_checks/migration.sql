-- Finansal değişmezleri veritabanına yazar.
--
-- Bu kısıtların hepsi bugün uygulama katmanında (Value Object'lerde) zorlanıyor.
-- Buraya da yazılmalarının sebebi, uygulamanın atlanabilmesidir: elle açılan bir
-- psql oturumu, bir veri taşıma betiği, ileride yazılacak bir `updateMany` ya da
-- raw SQL yolu VO'dan geçmez. Defterin değişmezi, defteri yazan koda değil
-- defterin kendisine bağlı olmalıdır.
--
-- Hepsi `NOT VALID`: kısıt **yeni ve güncellenen** satırlar için hemen geçerli olur,
-- ama mevcut satırlar taranmaz. Gerekçe iki yanlı:
--   (a) üretimde tam tablo taraması uzun bir ACCESS EXCLUSIVE kilidi demektir,
--   (b) kapı yokken yazılmış aykırı bir satır varsa migration patlar ve dağıtımı
--       durdurur — oysa o satır bir veri sorunudur, şema sorunu değil.
-- Mevcut veri `pnpm finans:degismezler` ile taranır; temizse kısıtlar
--   ALTER TABLE journal_lines VALIDATE CONSTRAINT journal_lines_debit_non_negative;
-- şeklinde (her biri için) doğrulanıp tam güvenceye alınır.

-- ============================================================
-- journal_lines — çift taraflı kaydın satır değişmezleri
-- ============================================================

-- Negatif tutar yasak: yön borç/alacak kolonuyla ifade edilir. Negatif bir borç,
-- "ters yönlü alacak" olarak davranır ve mizanı doğru gösterirken hesabın
-- karakterini bozar.
ALTER TABLE "journal_lines"
  ADD CONSTRAINT "journal_lines_debit_non_negative" CHECK ("debit" >= 0) NOT VALID;
ALTER TABLE "journal_lines"
  ADD CONSTRAINT "journal_lines_credit_non_negative" CHECK ("credit" >= 0) NOT VALID;

-- Bir satır ya borçtur ya alacak (XOR). İkisi birden dolu olduğunda satır kendi
-- içinde "netleşir": fiş dengeli görünür ama kebirde iki hesap birden şişer.
ALTER TABLE "journal_lines"
  ADD CONSTRAINT "journal_lines_debit_credit_exclusive"
  CHECK (NOT ("debit" > 0 AND "credit" > 0)) NOT VALID;

-- Sıfır tutarlı satır bilgi taşımaz ama fiş satır sayısını doldurur: "en az iki
-- satır" kuralını sahte biçimde sağlar.
ALTER TABLE "journal_lines"
  ADD CONSTRAINT "journal_lines_amount_positive"
  CHECK ("debit" > 0 OR "credit" > 0) NOT VALID;

-- Yabancı para izlenebilirliği: orijinal tutar da negatif olamaz, kur pozitif olmalı.
-- Sıfır/negatif kur çevrilmiş satırı sessizce sıfırlar ya da ters çevirir.
ALTER TABLE "journal_lines"
  ADD CONSTRAINT "journal_lines_original_non_negative"
  CHECK (("original_debit" IS NULL OR "original_debit" >= 0)
     AND ("original_credit" IS NULL OR "original_credit" >= 0)) NOT VALID;
ALTER TABLE "journal_lines"
  ADD CONSTRAINT "journal_lines_fx_rate_positive"
  CHECK ("fx_rate" IS NULL OR "fx_rate" > 0) NOT VALID;

-- ============================================================
-- cash_movements / cash_sessions — kasa değişmezleri
-- ============================================================

-- Hareket tutarı her zaman pozitif; yön `direction` kolonundadır (şema yorumu).
-- Negatif tutar + OUT yönü, çekmeceye para GİRİŞİ olarak toplanır.
ALTER TABLE "cash_movements"
  ADD CONSTRAINT "cash_movements_amount_positive" CHECK ("amount" > 0) NOT VALID;

-- Açılış nakdi negatif olamaz (oturum zaten borçla açılamaz).
ALTER TABLE "cash_sessions"
  ADD CONSTRAINT "cash_sessions_opening_float_non_negative"
  CHECK ("opening_float" >= 0) NOT VALID;
