CREATE TYPE "EDocumentProvider" AS ENUM ('NILVERA', 'LOGO', 'PARASUT');
CREATE TYPE "EDocumentEnvironment" AS ENUM ('TEST', 'PRODUCTION');
CREATE TYPE "EDocumentIntegrationScope" AS ENUM ('CLINIC', 'ORGANIZATION');

CREATE TABLE "e_document_integration_configs" (
    "id" TEXT NOT NULL,
    "scope" "EDocumentIntegrationScope" NOT NULL,
    "provider" "EDocumentProvider" NOT NULL,
    "environment" "EDocumentEnvironment" NOT NULL,
    "credentials_ciphertext" TEXT NOT NULL,
    "credential_hint" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_tested_at" TIMESTAMP(3),
    "last_test_succeeded" BOOLEAN,
    "clinic_id" TEXT,
    "organization_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "e_document_integration_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "e_document_integration_configs_exactly_one_scope_check"
      CHECK (
        ("scope" = 'CLINIC' AND "clinic_id" IS NOT NULL AND "organization_id" IS NULL)
        OR
        ("scope" = 'ORGANIZATION' AND "organization_id" IS NOT NULL AND "clinic_id" IS NULL)
      )
);

CREATE UNIQUE INDEX "e_document_integration_configs_clinic_id_key"
  ON "e_document_integration_configs"("clinic_id");
CREATE UNIQUE INDEX "e_document_integration_configs_organization_id_key"
  ON "e_document_integration_configs"("organization_id");
CREATE INDEX "e_document_integration_configs_provider_is_active_idx"
  ON "e_document_integration_configs"("provider", "is_active");

ALTER TABLE "e_document_integration_configs"
  ADD CONSTRAINT "e_document_integration_configs_clinic_id_fkey"
  FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "e_document_integration_configs"
  ADD CONSTRAINT "e_document_integration_configs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
