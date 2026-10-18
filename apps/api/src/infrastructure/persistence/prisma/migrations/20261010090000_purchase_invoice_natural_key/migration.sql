-- Alış faturası doğal anahtarı: (klinik, tedarikçi, belge no).
--
-- Mükerrer alış faturası defterde gideri (770/150), 320 Satıcılar borcunu ve
-- indirilecek KDV'yi (191) İKİ KEZ yazar. Uygulama tarafındaki "zaten var mı"
-- kontrolü kontrol-ile-yazma arasındaki yarışı kapatmaz; bu kısıt kapatır.
--
-- `invoice_number` NULL olan satırlar kısıt dışındadır (Postgres NULL'ları
-- birbirinden farklı sayar): tedarikçi belge numarası girilmemiş faturalar
-- serbest kalır.
--
-- TEŞHİS (migration öncesi çalıştırılır; satır dönerse önce onlar temizlenmeli):
--   SELECT clinic_id, supplier_id, invoice_number, COUNT(*) AS adet,
--          ARRAY_AGG(id) AS fatura_idleri, ARRAY_AGG(grand_total) AS tutarlar
--     FROM "purchase_invoices"
--    WHERE invoice_number IS NOT NULL
--    GROUP BY clinic_id, supplier_id, invoice_number
--   HAVING COUNT(*) > 1;
--
-- Mükerrer satırlardan hangisinin kalacağı ve muhasebe fişinin storno'lanması
-- MUHASEBE KARARIDIR — otomatik silme yapılmaz.

CREATE UNIQUE INDEX "purchase_invoices_clinic_id_supplier_id_invoice_number_key"
  ON "purchase_invoices" ("clinic_id", "supplier_id", "invoice_number");
