-- Sanal POS iade/iptal girişimi damgası (§97, kural 18d): SDK çağrısı transaction dışında olduğu için
-- uçuştaki iade, aynı taksitte açılan kart itirazını göremiyordu. Damga çağrıdan ÖNCE, ödeme satırı
-- kilitliyken yazılır; doluyken itiraz açılamaz.
-- Ek-yönlü: kolon nullable, mevcut satırlar NULL kalır (davranış değişmez).
ALTER TABLE "payment_installments" ADD COLUMN "reversal_requested_at" TIMESTAMP(3);
