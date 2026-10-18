import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import {
  GetContext,
  IGetContext,
} from '@common/decorators/get-context.decorator';
import { HasCapability } from '@common/decorators';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { BackfillBookingLedgerEntriesDto } from '@shared/modules/health-tourism/dto/commands';
import { BackfillBookingLedgerEntriesCommand } from '@modules/crm/health-tourism/booking-payment/application/commands/backfill-booking-ledger-entries/backfill-booking-ledger-entries.command';
import { ROUTE_PATHS } from '@common/constants/routes.constant';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { BOOKINGPAYMENT } = CAPABILITIES;

@Controller(ROUTE_PATHS.BOOKING_PAYMENTS.ROOT)
@UseGuards(AuthGuard, CapabilityGuard)
export class BookingPaymentCommandController {
  constructor(private readonly commandBus: TSCommandBus) {}

  /**
   * Platform defterine yazılamamış rezervasyon fişlerini yazar (telafi turu).
   * İdempotent: `dedupeKey` sayesinde tekrar çalıştırmak mükerrer olay üretmez.
   * Yetki **platform kiracısı** üzerinden değerlendirilir (handler'da).
   */
  @HasCapability(BOOKINGPAYMENT.create)
  @Post(ROUTE_PATHS.BOOKING_PAYMENTS.BACKFILL_LEDGER)
  backfillLedger(
    @Body() data: BackfillBookingLedgerEntriesDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new BackfillBookingLedgerEntriesCommand({ data, ctx })
    );
  }
}
