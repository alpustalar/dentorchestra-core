import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  E_DOCUMENT_INTEGRATION_CONFIG_QUERY_REPOSITORY,
  IEDocumentIntegrationConfigQueryRepository,
} from '@modules/finance/e-document/domain/repositories/e-document-integration-config.repository';
import { EDocumentIntegrationAccessService } from '../../services/e-document-integration-access.service';
import { GetEDocumentIntegrationQuery } from './get-e-document-integration.query';
import type { GetEDocumentIntegrationResponse } from './get-e-document-integration.response';

@QueryHandler(GetEDocumentIntegrationQuery)
export class GetEDocumentIntegrationHandler implements IQueryHandler<
  GetEDocumentIntegrationQuery,
  GetEDocumentIntegrationResponse
> {
  constructor(
    @Inject(E_DOCUMENT_INTEGRATION_CONFIG_QUERY_REPOSITORY)
    private readonly repo: IEDocumentIntegrationConfigQueryRepository,
    private readonly access: EDocumentIntegrationAccessService
  ) {}

  async execute(
    query: GetEDocumentIntegrationQuery
  ): Promise<GetEDocumentIntegrationResponse> {
    const { scope, sourceId, ctx } = query.payload;
    this.access.assertCanManage(scope, sourceId, ctx);
    return {
      data:
        scope === 'CLINIC'
          ? await this.repo.findEffectiveByClinicId(sourceId)
          : await this.repo.findByScope(scope, sourceId),
    };
  }
}
