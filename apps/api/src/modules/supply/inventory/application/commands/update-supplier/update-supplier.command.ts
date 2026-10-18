import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators/get-context.decorator';
import { UpdateSupplierDto } from '@shared/modules/inventory/dto/commands';

export class UpdateSupplierCommand implements ICommand {
  readonly __responseType!: void;
  constructor(
    public readonly supplierId: string,
    public readonly dto: UpdateSupplierDto,
    public readonly ctx: IGetContext
  ) {}
}
