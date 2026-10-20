import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators/get-context.decorator';
import { OpenCardChargeback } from '@shared/modules/bank/types/commands';

/**
 * Kart itirazı AÇILIŞI — sağlayıcı kart sahibinin itirazı üzerine parayı kesti.
 * Dönüş: itirazın id'si.
 */
export class OpenCardChargebackCommand implements ICommand {
  readonly __responseType!: string;
  constructor(
    public readonly data: OpenCardChargeback,
    public readonly ctx: IGetContext
  ) {}
}
