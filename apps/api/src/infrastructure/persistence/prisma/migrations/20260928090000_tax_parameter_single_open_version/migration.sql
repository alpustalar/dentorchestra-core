-- Vergi parametresi: aynı (clinic_id, key) için EN FAZLA BİR açık sürüm.
--
-- Neden gerekli: yeni oran açılırken mevcut açık sürüm `FOR UPDATE` ile kilitlenip
-- kapatılıyor. Ancak (a) ilk sürüm henüz yokken kilitlenecek satır da yoktur, ve
-- (b) iki istek kilidi sırayla alsa bile ikincisi satırı kapalı görüp yeni sürümü
-- yine açabiliyordu. Sonuç: aynı anahtar için iki `valid_to IS NULL` satırı ve
-- "hangi oran yürürlükte" sorusunun belirsizleşmesi — yani faturada kullanılan KDV
-- oranının eşzamanlılığa göre değişmesi.
--
-- Kısmî unique index Prisma şemasında tanımlanamadığı için ham SQL ile kurulur.

-- 1) ÖN KOŞUL — mevcut mükerrer açık sürümleri tespit et.
--    Index oluşturma bu satırlar varsa hata verir. Teşhis sorgusu:
--
--      SELECT clinic_id, key, COUNT(*) AS open_versions,
--             array_agg(id ORDER BY valid_from DESC, created_at DESC) AS ids
--      FROM tax_parameters
--      WHERE valid_to IS NULL
--      GROUP BY clinic_id, key
--      HAVING COUNT(*) > 1;
--
--    Düzeltme (muhasebe kararı): her grupta YALNIZ bir satır açık kalmalı. En son
--    yürürlüğe gireni açık bırakıp diğerlerini onun `valid_from`'unda kapatmak
--    normal davranıştır:
--
--      WITH ranked AS (
--        SELECT id, clinic_id, key, valid_from,
--               ROW_NUMBER() OVER (PARTITION BY clinic_id, key
--                                  ORDER BY valid_from DESC, created_at DESC) AS rn,
--               MAX(valid_from) OVER (PARTITION BY clinic_id, key) AS newest_from
--        FROM tax_parameters
--        WHERE valid_to IS NULL
--      )
--      UPDATE tax_parameters t
--      SET valid_to = r.newest_from, updated_at = NOW()
--      FROM ranked r
--      WHERE t.id = r.id AND r.rn > 1;
--
--    NOT: `valid_from` değerleri eşitse (aynı anda açılmış iki satır) hangisinin
--    doğru oran olduğuna bakılmalıdır — otomatik seçim yapılmamalıdır.

-- 2) Kısıt.
CREATE UNIQUE INDEX "tax_parameters_open_version_key"
  ON "tax_parameters" ("clinic_id", "key")
  WHERE "valid_to" IS NULL;
