-- Platformun kendi tahsilatının defteri + `external_id`'nin rol ayrımı.
--
-- SORUN 1 (tek kolon, iki rol): `subscriptions.external_id` hem ödeme
-- callback'inin korelasyon anahtarıydı (iyzico `conversationId` — callback
-- aboneliği YALNIZ bununla buluyor) hem de `confirmPayment`/`renew` tarafından
-- `iyzicoPaymentId` ile ÜZERİNE YAZILIYORDU. İlk bildirimden sonra anahtar
-- kayboluyor; iyzico'nun aynı ödeme için gönderdiği ikinci bildirim (callback +
-- webhook ikilisi — kodun kendi yorumunda yazıyor) aboneliği bulamayıp 404
-- alıyordu. O bildirimde gelen `savedCard` da kayboluyordu → sonraki yenilemede
-- kayıtlı kart yok → PAST_DUE (hizmet kesintisi + tahsilat kaybı).
--
-- SORUN 2 (tahsilatın kaydı yok): çekilen tutarın/ödeme kimliğinin kalıcı tek izi
-- audit log satırı ve yukarıdaki ezilen kolondu. Sonuçları: iade edilemiyor
-- (paymentId yok), sağlayıcıyla mutabakat yapılamıyor, "bu ay ne tahsil ettik"
-- cevaplanamıyor ve **dönem başına idempotency anahtarı yok**: başarılı çekimden
-- sonra transaction geri alınırsa bir sonraki cron kartı İKİNCİ KEZ çekiyordu.
--
-- Çözüm: tahsilat satırı para hareketinden ÖNCE commit edilir (claim-then-charge)
-- ve `(subscription_id, period_start)` tekilliği aynı dönemin iki kez tahsil
-- edilmesini DB düzeyinde imkânsız kılar.
--
-- Veri çatışması YOK: yeni tablo + yeni nullable kolon. Mevcut `external_id`
-- değerleri olduğu gibi kalır; geçmiş tahsilatlar geriye dönük üretilemez
-- (hangi dönemde ne çekildiği bilinmiyor) ve UYDURULMAZ.

CREATE TYPE "SubscriptionChargeStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

ALTER TABLE "subscriptions" ADD COLUMN "provider_payment_id" TEXT;

CREATE TABLE "subscription_charges" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "paid_amount" DECIMAL(10,2),
    "status" "SubscriptionChargeStatus" NOT NULL DEFAULT 'PENDING',
    "provider_payment_id" TEXT,
    "conversation_id" TEXT,
    "failure_reason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "charged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_charges_pkey" PRIMARY KEY ("id")
);

-- Dönem başına tek tahsilat — mükerrer çekimin DB tarafındaki son savunması.
CREATE UNIQUE INDEX "subscription_charges_subscription_id_period_start_key"
  ON "subscription_charges"("subscription_id", "period_start");

CREATE INDEX "subscription_charges_organization_id_idx" ON "subscription_charges"("organization_id");
CREATE INDEX "subscription_charges_status_idx" ON "subscription_charges"("status");

ALTER TABLE "subscription_charges"
  ADD CONSTRAINT "subscription_charges_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
