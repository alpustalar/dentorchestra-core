import { ICommand } from '@nestjs/cqrs';
import type { IGetContext } from '@common/decorators';
import type { UpsertEDocumentIntegration } from '@shared/modules/e-document/types';
import type { EDocumentIntegrationScope } from '@modules/finance/e-document/domain/contracts/e-document.contracts';

export class UpsertEDocumentIntegrationCommand implements ICommand {
  readonly __responseType!: string;

  constructor(
    public readonly payload: {
      readonly scope: EDocumentIntegrationScope;
      readonly sourceId: string;
      readonly data: UpsertEDocumentIntegration;
      readonly ctx: IGetContext;
    }
  ) {}
}
