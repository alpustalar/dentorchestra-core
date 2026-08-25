import { IGetContext } from '@common/decorators/get-context.decorator';
import { BookFlight } from '@shared/modules/health-tourism/types/commands';
import { HoldFlightResponse } from './hold-flight.response';

/**
 * Hibrit akışın **hold** ayağı: koltuğu ödeme öncesi tutar.
 *
 * Otel/transferden farklı olarak Duffel'a çağrı tahsilattan ÖNCE gider — teklif
 * ödeme sürerken bayatlarsa hasta parayı ödemiş ama uçuş kalmamış olurdu. Hold
 * bunu ortadan kaldırır: yer bizde, ödeme sonra.
 */
export class HoldFlightCommand {
  readonly __responseType!: HoldFlightResponse;

  constructor(
    public readonly data: BookFlight,
    public readonly ctx: IGetContext
  ) {}
}
