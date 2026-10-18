-- Muhasebe dönemi: yevmiye numarası sayacı + denetim damgaları
-- ve yevmiye numarasının dönem içinde tekilliği.
--
-- NEDEN (para güvenliği denetimi, documents/finans/09-guvence-denetimi.md §3.2):
--   1. Numara `MAX(entry_no)+1` ile kilitsiz üretiliyordu → iki eşzamanlı fiş aynı
--      numarayı alabiliyordu (VUK/e-Defter: numara boşluksuz VE tekil olmalı).
--      Artık numara `last_entry_no` sayacından, fişin yazıldığı transaction içinde
--      `UPDATE ... RETURNING` ile alınır; satır kilidi tahsisi serileştirir.
--   2. Aynı satır kilidi dönem kapanışıyla da çakışır → kapanmış/kilitli döneme fiş
--      sızması (TOCTOU) kapanır.
--   3. Mali yılı kimin kapattığı, kilidi kimin açtığı hiçbir yerde kayıtlı değildi.

-- 1) Sayaç + denetim damgaları
ALTER TABLE "accounting_periods"
    ADD COLUMN "last_entry_no"   BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN "locked_at"       TIMESTAMP(3),
    ADD COLUMN "locked_by_id"    TEXT,
    ADD COLUMN "reopened_at"     TIMESTAMP(3),
    ADD COLUMN "reopened_by_id"  TEXT,
    ADD COLUMN "closed_at"       TIMESTAMP(3),
    ADD COLUMN "closed_by_id"    TEXT;

-- 2) Sayacı mevcut fişlerden devral.
--    ZORUNLU: atlanırsa sayaç 0'dan başlar, ilk tahsisler mevcut numaralarla
--    çakışır ve (3)'teki kısıt yüzünden fiş yazımı hata verir.
UPDATE "accounting_periods" p
SET "last_entry_no" = COALESCE(
        (SELECT MAX(j."entry_no")
         FROM "journal_entries" j
         WHERE j."period_id" = p."id"
           AND j."entry_no" IS NOT NULL), 0);

-- 3) Yevmiye numarası dönem içinde tekil (emniyet kemeri; NULL'lar çakışmaz →
--    numarasız DRAFT fişler kısıttan etkilenmez).
--    ⚠️ Mevcut veride mükerrer numara varsa bu adım hata verir. Uygulamadan önce:
--      SELECT clinic_id, period_id, entry_no, COUNT(*)
--        FROM journal_entries WHERE entry_no IS NOT NULL
--       GROUP BY 1,2,3 HAVING COUNT(*) > 1;
--    Çıkan satırlar elle düzeltilmelidir (mükerrer numara zaten eski hatanın izidir).
CREATE UNIQUE INDEX "journal_entries_clinic_id_period_id_entry_no_key"
    ON "journal_entries" ("clinic_id", "period_id", "entry_no");
