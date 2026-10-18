import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators/get-context.decorator';
import { RecordProductUsageDto } from '@shared/modules/inventory/dto/commands';

export class RecordProductUsageCommand implements ICommand {
  readonly __responseType!: void;
  constructor(
    public readonly clinicId: string,
    public readonly dto: RecordProductUsageDto,
    public readonly ctx: IGetContext
  ) {}
}
