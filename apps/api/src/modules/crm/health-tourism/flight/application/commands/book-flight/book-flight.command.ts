import { IGetContext } from '@common/decorators/get-context.decorator';
import { BookFlight } from '@shared/modules/health-tourism/types/commands';
import { BookFlightResponse } from './book-flight.response';

/**
 * Hibrit akışın **instant** ayağı: teklif hold'a uygun değilse (havayolu anında
 * ödeme istiyorsa) sipariş tahsilat onayında, ödemeyle birlikte açılır.
 *
 * Dönüş yalnız id değil: Duffel'ın sipariş için **fiilen** ücretlendirdiği tutar da
 * döner (saga teklif ile karşılaştırıp defteri fiilî maliyetten yazar).
 */
export class BookFlightCommand {
  readonly __responseType!: BookFlightResponse;

  constructor(
    public readonly data: BookFlight,
    public readonly ctx: IGetContext
  ) {}
}
