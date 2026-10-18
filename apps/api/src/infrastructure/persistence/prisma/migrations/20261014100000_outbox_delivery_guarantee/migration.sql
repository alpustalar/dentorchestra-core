-- Outbox teslim garantisi: sahiplenme (lease), deneme sayacı, ölü mektup ve
-- transaction-içi sırayı koruyan teslim numarası.
--
-- Hepsi eklemedir; mevcut satırlar varsayılanlarla dolar (attempts = 0, seq
-- fiziksel sırayla atanır). Veri çakışması yok, geri alınabilir.

-- AlterTable
ALTER TABLE "Outbox" ADD COLUMN     "seq" BIGSERIAL NOT NULL,
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "claimedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Outbox_seq_key" ON "Outbox"("seq");

-- CreateIndex
-- Yoklama sorgusunun indeksi: tablo yalnız büyüyor (işlenmiş kayıt silinmiyor) ve
-- her 5 saniyede taranıyordu — indekssiz hâlde bu, sürekli büyüyen bir seq scan'dir.
CREATE INDEX "Outbox_processedAt_failedAt_seq_idx" ON "Outbox"("processedAt", "failedAt", "seq");
