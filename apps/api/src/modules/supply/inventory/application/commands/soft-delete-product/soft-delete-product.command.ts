import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators/get-context.decorator';

export class SoftDeleteProductCommand implements ICommand {
  readonly __responseType!: void;
  constructor(
    public readonly productId: string,
    public readonly ctx: IGetContext
  ) {}
}
