import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { QueueEDocumentHandler } from './queue-e-document/queue-e-document.handler';
import { QueueEDocumentCancelHandler } from './queue-e-document-cancel/queue-e-document-cancel.handler';
import { EDocumentQueueModule } from '../../infrastructure/queue/e-document-queue.module';
import { EDocumentIntegrationConfigRepositoryModule } from '../../infrastructure/persistence/prisma/repositories/e-document-integration-config/e-document-integration-config.repository.module';
import { EInvoiceAdapterModule } from '../../infrastructure/adapters/e-invoice-adapter.module';
import { UpsertEDocumentIntegrationHandler } from './upsert-e-document-integration/upsert-e-document-integration.handler';
import { TestEDocumentIntegrationHandler } from './test-e-document-integration/test-e-document-integration.handler';
import { RemoveEDocumentIntegrationHandler } from './remove-e-document-integration/remove-e-document-integration.handler';
import { EDocumentIntegrationAccessService } from '../services/e-document-integration-access.service';

export const E_DOCUMENT_COMMAND_HANDLERS = [
  QueueEDocumentHandler,
  QueueEDocumentCancelHandler,
  UpsertEDocumentIntegrationHandler,
  TestEDocumentIntegrationHandler,
  RemoveEDocumentIntegrationHandler,
];

@Module({
  imports: [
    CqrsModule,
    EDocumentQueueModule,
    EDocumentIntegrationConfigRepositoryModule,
    EInvoiceAdapterModule,
  ],
  providers: [
    ...E_DOCUMENT_COMMAND_HANDLERS,
    EDocumentIntegrationAccessService,
  ],
  exports: E_DOCUMENT_COMMAND_HANDLERS,
})
export class EDocumentCommandModule {}
