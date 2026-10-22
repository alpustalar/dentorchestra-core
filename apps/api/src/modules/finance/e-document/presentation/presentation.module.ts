import { Module } from '@nestjs/common';
import { EDocumentIntegrationController } from './http/controllers/e-document-integration.controller';

@Module({ controllers: [EDocumentIntegrationController] })
export class EDocumentPresentationModule {}
