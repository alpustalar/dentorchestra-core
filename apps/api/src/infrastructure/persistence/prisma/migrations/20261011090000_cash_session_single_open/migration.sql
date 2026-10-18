-- Kasa başına en fazla BİR açık oturum — DB tarafındaki son savunma.
--
-- Açılış akışı kasayı `FOR UPDATE` kilitleyip "açık oturum var mı?" kontrolünü
-- yaptıktan sonra yazıyor; bu kısıt, ileride eklenecek ikinci bir açılış yolu
-- (veya kilit atlanması) durumunda çift açık oturumu imkânsız kılar. Çift açık
-- oturum sessiz bir para hatasıdır: aynı kasadaki nakit iki ayrı beklenen
-- tutara bölünür, ikisinin de sayım farkı anlamsız çıkar.
--
-- Kolon YALNIZ açık oturumda doludur (kapanışta NULL'a çekilir); Postgres'te
-- NULL'lar birbiriyle çakışmadığı için tekil index kısmî index gibi davranır.
ALTER TABLE "cash_sessions" ADD COLUMN "active_register_id" TEXT;

-- Mevcut AÇIK oturumlar için kilidi doldur. Aynı kasada birden fazla açık
-- oturum varsa bu UPDATE sorun çıkarmaz; aşağıdaki index oluşturma HATA VERİR.
-- O durumda hangi oturumun geçerli olduğu bir MUHASEBE KARARIDIR (hangi sayım
-- gerçek kasayı temsil ediyor?) — teşhis sorgusu:
--
--   SELECT cash_register_id, COUNT(*) AS open_sessions,
--          ARRAY_AGG(id ORDER BY opened_at) AS session_ids
--   FROM cash_sessions
--   WHERE status = 'OPEN'
--   GROUP BY cash_register_id
--   HAVING COUNT(*) > 1;
--
-- Fazla oturumlar kapatılmadan (veya iptal edilmeden) index kurulmamalıdır;
-- otomatik silme/kapatma YAPILMAZ.
UPDATE "cash_sessions"
SET "active_register_id" = "cash_register_id"
WHERE "status" = 'OPEN';

CREATE UNIQUE INDEX "cash_sessions_active_register_id_key"
  ON "cash_sessions"("active_register_id");
