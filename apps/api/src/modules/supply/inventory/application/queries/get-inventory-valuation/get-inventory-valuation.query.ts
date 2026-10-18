import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators/get-context.decorator';
import { GetInventoryValuationResponse } from './get-inventory-valuation.response';

/**
 * Kliniğin eldeki stoğunun **fiili maliyeti** (parti bazlı). Mutabakatın ve
 * envanter değerinin tek kaynağı; bugüne kadar stok yalnız **miktar** olarak
 * raporlanıyordu, dolayısıyla 150 bakiyesiyle karşılaştırılacak bir sayı yoktu.
 */
export class GetInventoryValuationQuery implements IQuery {
  readonly __responseType!: GetInventoryValuationResponse;
  constructor(
    public readonly clinicId: string,
    public readonly ctx: IGetContext
  ) {}
}
