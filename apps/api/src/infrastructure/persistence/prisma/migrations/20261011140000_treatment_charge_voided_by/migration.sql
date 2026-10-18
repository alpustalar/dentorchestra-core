-- İptali yapan personelin kalıcı damgası.
--
-- `voided_at` + `void_reason` vardı ama "kim iptal etti" hiçbir yerde
-- tutulmuyordu: işlem satırı faturanın ticari dayanağı olduğu için, bir satırın
-- faturadan çıkarılmasının sorumlusu kayıtta durmak zorunda (CLAUDE.md finans
-- kuralı 7 — yüksek etkili işlem kalıcı damga ister).
--
-- Kolon nullable ve backfill YOK: geçmiş iptallerin aktörü bilinmiyor ve
-- uydurulamaz. Boş değer "bu iptal, damga eklenmeden önce yapıldı" demektir.
ALTER TABLE "treatment_charges" ADD COLUMN "voided_by_id" TEXT;
