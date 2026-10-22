import { Module } from '@nestjs/common';
import { E_INVOICE_PORT } from '@modules/finance/e-document/domain/ports/e-invoice.port';
import { NoopEInvoiceAdapter } from './noop/noop-e-invoice.adapter';
import { NilveraEInvoiceAdapter } from './nilvera/nilvera-e-invoice.adapter';
import { NilveraHttpClient } from './nilvera/nilvera-http.client';
import { ClinicScopedEInvoiceAdapter } from './clinic-scoped-e-invoice.adapter';
import { ResolveEDocumentIntegrationService } from '@modules/finance/e-document/application/services/resolve-e-document-integration.service';
import { EDocumentIntegrationConfigRepositoryModule } from '@modules/finance/e-document/infrastructure/persistence/prisma/repositories/e-document-integration-config/e-document-integration-config.repository.module';

@Module({
  imports: [EDocumentIntegrationConfigRepositoryModule],
  providers: [
    NoopEInvoiceAdapter,
    NilveraHttpClient,
    NilveraEInvoiceAdapter,
    ResolveEDocumentIntegrationService,
    ClinicScopedEInvoiceAdapter,
    {
      provide: E_INVOICE_PORT,
      useExisting: ClinicScopedEInvoiceAdapter,
    },
  ],
  exports: [
    E_INVOICE_PORT,
    NilveraEInvoiceAdapter,
    ResolveEDocumentIntegrationService,
  ],
})
export class EInvoiceAdapterModule {}
