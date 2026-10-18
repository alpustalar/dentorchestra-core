import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { QueueEDocumentHandler } from './queue-e-document/queue-e-document.handler';
import { QueueEDocumentCancelHandler } from './queue-e-document-cancel/queue-e-document-cancel.handler';
import { EDocumentQueueModule } from '../../infrastructure/queue/e-document-queue.module';

export const E_DOCUMENT_COMMAND_HANDLERS = [
  QueueEDocumentHandler,
  QueueEDocumentCancelHandler,
];

@Module({
  imports: [CqrsModule, EDocumentQueueModule],
  providers: E_DOCUMENT_COMMAND_HANDLERS,
  exports: E_DOCUMENT_COMMAND_HANDLERS,
})
export class EDocumentCommandModule {}
