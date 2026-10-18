-- Ürün stok kodu / barkodu: benzersizlik **klinik kapsamında** ve yalnız
-- silinmemiş kayıtlar için.
--
-- Neden gerekli: `stock_code` ve `barcode` global unique idi.
--  (a) Çok kiracılı kurguda A kliniğinin kullandığı "ELD-001" kodunu B kliniği
--      bir daha asla kullanamıyordu; üstelik hata mesajı başka bir kiracıda o
--      kodun var olduğunu sızdırıyordu.
--  (b) Ürün silme soft-delete (`deleted_at`) olduğu için silinen ürün kodu
--      sonsuza dek rezerve tutuyordu: aynı kodla yeni kart açılamıyordu.
--
-- Kısmî (partial) unique index Prisma şemasında tanımlanamadığı için ham SQL ile
-- kurulur; şema tarafında alanlardaki `@unique` kaldırıldı.

-- 1) ÖN KOŞUL — yeni kısıt, aynı klinikte mükerrer kod/barkod varsa hata verir.
--    (Global unique kaldırıldığı için bu ancak eski veride kod farklı kliniklerde
--    aynıysa değil, AYNI klinikte tekrarlıyorsa olur — pratikte beklenmez.)
--    Teşhis:
--
--      SELECT clinic_id, stock_code, COUNT(*)
--      FROM products WHERE deleted_at IS NULL
--      GROUP BY clinic_id, stock_code HAVING COUNT(*) > 1;
--
--      SELECT clinic_id, barcode, COUNT(*)
--      FROM products WHERE deleted_at IS NULL AND barcode IS NOT NULL
--      GROUP BY clinic_id, barcode HAVING COUNT(*) > 1;
--
--    Düzeltme bir katalog kararıdır (hangi kart doğru kodu taşıyacak):
--    otomatik yapılmaz.

-- 2) Eski global kısıtlar.
DROP INDEX IF EXISTS "products_stock_code_key";
DROP INDEX IF EXISTS "products_barcode_key";

-- 3) Klinik kapsamlı, silinmemiş kayıtlar için kısıtlar.
CREATE UNIQUE INDEX "products_clinic_stock_code_key"
  ON "products" ("clinic_id", "stock_code")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "products_clinic_barcode_key"
  ON "products" ("clinic_id", "barcode")
  WHERE "deleted_at" IS NULL AND "barcode" IS NOT NULL;
