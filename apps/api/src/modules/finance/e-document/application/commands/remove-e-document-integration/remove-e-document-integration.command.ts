import { ICommand } from '@nestjs/cqrs';
import type { IGetContext } from '@common/decorators';
import type { EDocumentIntegrationScope } from '@modules/finance/e-document/domain/contracts/e-document.contracts';

export class RemoveEDocumentIntegrationCommand implements ICommand {
  readonly __responseType!: void;

  constructor(
    public readonly payload: {
      readonly scope: EDocumentIntegrationScope;
      readonly sourceId: string;
      readonly ctx: IGetContext;
    }
  ) {}
}
