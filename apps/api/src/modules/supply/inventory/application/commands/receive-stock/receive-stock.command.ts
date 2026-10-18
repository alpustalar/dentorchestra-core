import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators/get-context.decorator';
import { ReceiveStockDto } from '@shared/modules/inventory/dto/commands';

export class ReceiveStockCommand implements ICommand {
  readonly __responseType!: string;
  constructor(
    public readonly clinicId: string,
    public readonly dto: ReceiveStockDto,
    public readonly ctx: IGetContext
  ) {}
}
