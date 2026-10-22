import { Module } from '@nestjs/common';
import {
  E_DOCUMENT_INTEGRATION_CONFIG_COMMAND_REPOSITORY,
  E_DOCUMENT_INTEGRATION_CONFIG_QUERY_REPOSITORY,
} from '@modules/finance/e-document/domain/repositories/e-document-integration-config.repository';
import { EDocumentIntegrationConfigCommandRepository } from './e-document-integration-config.command.repository';
import { EDocumentIntegrationConfigQueryRepository } from './e-document-integration-config.query.repository';

@Module({
  providers: [
    {
      provide: E_DOCUMENT_INTEGRATION_CONFIG_COMMAND_REPOSITORY,
      useClass: EDocumentIntegrationConfigCommandRepository,
    },
    {
      provide: E_DOCUMENT_INTEGRATION_CONFIG_QUERY_REPOSITORY,
      useClass: EDocumentIntegrationConfigQueryRepository,
    },
  ],
  exports: [
    E_DOCUMENT_INTEGRATION_CONFIG_COMMAND_REPOSITORY,
    E_DOCUMENT_INTEGRATION_CONFIG_QUERY_REPOSITORY,
  ],
})
export class EDocumentIntegrationConfigRepositoryModule {}
