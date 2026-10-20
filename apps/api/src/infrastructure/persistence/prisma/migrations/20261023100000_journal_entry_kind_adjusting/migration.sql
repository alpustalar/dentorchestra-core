-- Yıl sonu GRNI tahakkuku için fiş niteliği (tur 33, Faz A).
--
-- `ADJUSTING`: dönem sonu düzeltme (mal geldi, fatura gelmedi tahakkuku ve ertesi yılın
-- 1 Ocak'taki ters kaydı). EKONOMİKTİR — gelir tablosu sayar; `CLOSING`'in tersi.
-- ADD VALUE aynı transaction'da KULLANILAMAZ: bu migration değeri kullanan bir CHECK/backfill
-- içermez; `329` hesabına yalnız ADJUSTING yazılması kuralı veritabanı CHECK'i olarak değil
-- `pnpm finans:degismezler` taraması olarak durur (çok tablolu bir ilişki: fiş türü ↔ satırın hesabı).
ALTER TYPE "JournalEntryKind" ADD VALUE 'ADJUSTING';
