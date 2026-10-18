import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators/get-context.decorator';
import { RecordProviderSettlement } from '@shared/modules/bank/types/commands';

export class RecordProviderSettlementCommand implements ICommand {
  readonly __responseType!: string;
  constructor(
    public readonly data: RecordProviderSettlement,
    public readonly ctx: IGetContext
  ) {}
}
