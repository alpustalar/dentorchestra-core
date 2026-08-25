import { IGetContext } from '@common/decorators/get-context.decorator';

/**
 * Hibrit akışın **ödeme** ayağı: tahsilat onaylandıktan sonra tutulan Duffel
 * siparişi bakiyeden ödenir ve bilet kesilir. Saga `book()` içinden çağırır.
 *
 * Dönüş `string` (dahili booking id) — saga bunu `bookingId` olarak saklar,
 * iade yolu bununla arar. Bu yüzden imza `BookFlightCommand` ile aynı şekle sahiptir.
 */
export class PayHeldFlightCommand {
  readonly __responseType!: string;

  constructor(
    public readonly payload: {
      readonly bookingId: string;
      readonly ctx: IGetContext;
    }
  ) {}
}
