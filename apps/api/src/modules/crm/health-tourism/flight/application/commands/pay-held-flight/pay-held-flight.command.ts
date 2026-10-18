import { IGetContext } from '@common/decorators/get-context.decorator';
import { PayHeldFlightResponse } from './pay-held-flight.response';

/**
 * Hibrit akışın **ödeme** ayağı: tahsilat onaylandıktan sonra tutulan Duffel
 * siparişi bakiyeden ödenir ve bilet kesilir. Saga `book()` içinden çağırır.
 *
 * Dönüş `bookingId` + **fiilen ödenen** tutar; saga id'yi iade yolu için saklar,
 * tutarı defterin tedarikçi borcu satırı için kullanır. İmza `BookFlightCommand`
 * ile aynı şekle sahiptir (saga ikisini aynı dalda kullanıyor).
 */
export class PayHeldFlightCommand {
  readonly __responseType!: PayHeldFlightResponse;

  constructor(
    public readonly payload: {
      readonly bookingId: string;
      readonly ctx: IGetContext;
    }
  ) {}
}
