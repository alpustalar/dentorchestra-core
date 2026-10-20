-- Kliniğin işletme biçimi (şirket / şahıs): yıl sonu devrinin hedefini belirler.
-- Ek-yönlü: kolon nullable; mevcut kliniklerde NULL kalır (kapanışta devir adımı atlanır, önizleme uyarır).
CREATE TYPE "BusinessType" AS ENUM ('COMPANY', 'SOLE_PROPRIETOR');

ALTER TABLE "clinic_finance_settings" ADD COLUMN "business_type" "BusinessType";
