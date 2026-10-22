import { IQuery } from '@nestjs/cqrs';
import type { IGetContext } from '@common/decorators';
import type { GetEDocumentIntegrationResponse } from './get-e-document-integration.response';
import type { EDocumentIntegrationScope } from '@modules/finance/e-document/domain/contracts/e-document.contracts';

export class GetEDocumentIntegrationQuery implements IQuery {
  readonly __responseType!: GetEDocumentIntegrationResponse;

  constructor(
    public readonly payload: {
      readonly scope: EDocumentIntegrationScope;
      readonly sourceId: string;
      readonly ctx: IGetContext;
    }
  ) {}
}
