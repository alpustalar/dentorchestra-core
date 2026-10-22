import { Module } from '@nestjs/common';
import { GetEDocumentIntegrationHandler } from './get-e-document-integration/get-e-document-integration.handler';
import { EDocumentIntegrationAccessService } from '../services/e-document-integration-access.service';
import { EDocumentIntegrationConfigRepositoryModule } from '../../infrastructure/persistence/prisma/repositories/e-document-integration-config/e-document-integration-config.repository.module';

@Module({
  imports: [EDocumentIntegrationConfigRepositoryModule],
  providers: [
    GetEDocumentIntegrationHandler,
    EDocumentIntegrationAccessService,
  ],
})
export class EDocumentQueryModule {}
