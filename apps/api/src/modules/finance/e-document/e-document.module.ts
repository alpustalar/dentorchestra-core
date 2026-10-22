import { Module } from '@nestjs/common';
import { EDocumentCommandModule } from './application/commands/command.module';
import { EDocumentQueueModule } from './infrastructure/queue/e-document-queue.module';
import { EDocumentQueryModule } from './application/queries/query.module';
import { EDocumentPresentationModule } from './presentation/presentation.module';

/**
 * Entegratör (e-Belge) modülü (doc 07). Çekirdek yalnız EInvoicePort'u tanır;
 * entegratör kapalıyken NoopEInvoiceAdapter devrede (belge INTERNAL). Yönetim
 * route'ları credential kurulumunu sağlar; belge işleme BullMQ processor'dadır.
 */
@Module({
  imports: [
    EDocumentCommandModule,
    EDocumentQueryModule,
    EDocumentQueueModule,
    EDocumentPresentationModule,
  ],
  exports: [EDocumentCommandModule],
})
export class EDocumentModule {}
