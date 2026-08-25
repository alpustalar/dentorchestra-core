import { Module } from '@nestjs/common';
import { SearchFlightsTool } from './search-flights.tool';
import { BookFlightTool } from './book-flight.tool';
import { GetFlightBookingsTool } from './get-flight-bookings.tool';
import { CancelFlightBookingTool } from './cancel-flight-booking.tool';

/**
 * Uçuş (Duffel) AI araçları. Her araç `@AiTool()` ile işaretlidir; merkezi
 * `AiToolRegistry` uygulama-geneli keşifle toplar. Araçlar dış modüllere yalnız
 * CommandBus/QueryBus ile gider; `AiToolSupport` global sağlanır — ek import gerekmez.
 */
export const FLIGHT_AI_TOOLS = [
  SearchFlightsTool,
  BookFlightTool,
  GetFlightBookingsTool,
  CancelFlightBookingTool,
];

@Module({
  providers: FLIGHT_AI_TOOLS,
  exports: FLIGHT_AI_TOOLS,
})
export class FlightAiToolsModule {}
