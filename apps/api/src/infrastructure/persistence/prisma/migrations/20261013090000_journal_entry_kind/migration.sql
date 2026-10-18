-- Yevmiye fişine **nitelik** (kind) kolonu: ekonomik fiş ↔ dönem sonu kapanış fişi.
--
-- NEDEN:
-- Yıl sonu kapanış fişi 6/7 (gelir/gider) hesaplarını ters kayıtla sıfırlar ve kârı
-- 690 → 590'a taşır. Bugün bu fişi ekonomik bir fişten ayırt edecek hiçbir işaret
-- yok (`event_id` hem kapanışta hem stornoda NULL). Sonuç: bir yıl kapatıldıktan
-- sonra o yılın **gelir tablosu sıfır ciro** gösteriyor — kapanış fişinin ters
-- satırları gerçek satışları birebir götürüyor. Hata sessiz: kapanış fişi kendi
-- içinde dengeli olduğu için "Σborç = Σalacak" ve mizan kontrolleri tutmaya devam
-- eder (CLAUDE.md finans kuralı 8'in aynı deseni: dengeli bir fiş hatayı saklar).
--
-- Bilanço bu fişi saymak ZORUNDADIR (kârı öz kaynağa taşıyan kayıt odur), gelir
-- tablosu saymamalıdır. Yani ayrım bir **rapor parametresi** değil, fişin kendi
-- niteliğidir → kolon fişin üstünde durur.
--
-- Değerler, bugün fiilen yazılan iki nitelikle sınırlı tutuldu (okunmayan kolon/
-- değer eklemek CLAUDE.md finans kuralı 10'un yasakladığı şeydir): açılış fişi
-- (OPENING) özelliği yazıldığında üçüncü değer o turda eklenir.
--
-- Geçmiş satırlar: DEFAULT 'OPERATIONAL' doğru varsayımdır — bugüne kadar hiçbir
-- klinikte dönem kapanışı yapılmadıysa kapanış fişi de yoktur. Kapanış yapılmış bir
-- kurulumda bu satırlar elle `CLOSING`'e çekilmelidir (aşağıdaki NOT).

-- 1) Nitelik enum'u
CREATE TYPE "JournalEntryKind" AS ENUM ('OPERATIONAL', 'CLOSING');

-- 2) Kolon — ek, varsayılanlı: mevcut satırlar OPERATIONAL olur, veri çatışması yok.
ALTER TABLE "journal_entries"
  ADD COLUMN "kind" "JournalEntryKind" NOT NULL DEFAULT 'OPERATIONAL';

-- NOT (elle, yalnız gerekirse): bu migration'dan önce yıl sonu kapanışı yapılmış bir
-- veritabanında eski kapanış fişleri OPERATIONAL kalır ve kapanmış yılın gelir
-- tablosu hâlâ sıfır görünür. Kapanış fişleri `event_id IS NULL` + kapanış
-- açıklamasıyla ayırt edilebilir; düzeltme bir muhasebe kararı olduğu için otomatik
-- UPDATE yazılmadı (geçmişi geriye dönük yorumlayan bir değişiklik — kural 11).
