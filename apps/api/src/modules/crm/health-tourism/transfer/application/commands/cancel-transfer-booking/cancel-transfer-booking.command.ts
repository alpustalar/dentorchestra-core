import { CancelTransferBookingDto } from '@shared/modules/health-tourism/dto/commands';
import { IGetContext } from '@common/decorators/get-context.decorator';
import type { CancelTransferBookingResponse } from './cancel-transfer-booking.response';

export class CancelTransferBookingCommand {
  readonly __responseType!: CancelTransferBookingResponse;

  constructor(
    public readonly dto: CancelTransferBookingDto,
    public readonly ctx: IGetContext
  ) {}
}
