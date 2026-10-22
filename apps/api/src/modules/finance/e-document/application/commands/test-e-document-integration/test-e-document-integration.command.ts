import { ICommand } from '@nestjs/cqrs';
import type { IGetContext } from '@common/decorators';
import type { EDocumentIntegrationScope } from '@modules/finance/e-document/domain/contracts/e-document.contracts';
import type { TestEDocumentIntegrationResponse } from './test-e-document-integration.response';

export class TestEDocumentIntegrationCommand implements ICommand {
  readonly __responseType!: TestEDocumentIntegrationResponse;

  constructor(
    public readonly payload: {
      readonly scope: EDocumentIntegrationScope;
      readonly sourceId: string;
      readonly ctx: IGetContext;
    }
  ) {}
}
