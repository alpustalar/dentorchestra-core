import { IGetContext } from '@common/decorators/get-context.decorator';
import { BookFlight } from '@shared/modules/health-tourism/types/commands';

/**
 * Hibrit akışın **instant** ayağı: teklif hold'a uygun değilse (havayolu anında
 * ödeme istiyorsa) sipariş tahsilat onayında, ödemeyle birlikte açılır.
 *
 * Dönüş `string` (dahili booking id) — saga bunu `bookingId` olarak saklar.
 */
export class BookFlightCommand {
  readonly __responseType!: string;

  constructor(
    public readonly data: BookFlight,
    public readonly ctx: IGetContext
  ) {}
}
