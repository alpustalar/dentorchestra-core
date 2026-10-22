import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';

export class InitiateMetaOAuthCommand implements ICommand {
  readonly __responseType!: string;

  constructor(
    public readonly payload: {
      readonly clinicId: string;
      readonly returnPath: string;
      readonly ctx: IGetContext;
    }
  ) {}
}
