import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import {
  GetContext,
  IGetContext,
} from '@common/decorators/get-context.decorator';
import { HasCapability } from '@common/decorators';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { PaginationDto } from '@shared';
import { Serialize } from '@common/decorators/serialize.decorator';
import {
  GetUnbridgedBookingLedgerEntriesFilterDto,
  GetUnresolvedBookingPaymentRefundsFilterDto,
} from '@shared/modules/health-tourism/dto/queries';
import { FindUnresolvedBookingPaymentRefundsQuery } from '@modules/crm/health-tourism/booking-payment/application/queries/find-unresolved-booking-payment-refunds/find-unresolved-booking-payment-refunds.query';
import { UnresolvedBookingPaymentRefundResponseDto } from '@modules/crm/health-tourism/booking-payment/presentation/http/dto/booking-payment-refund-response.dto';
import type { UnresolvedBookingPaymentRefundRow } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment-refund';
import { FindUnbridgedBookingLedgerEntriesQuery } from '@modules/crm/health-tourism/booking-payment/application/queries/find-unbridged-booking-ledger-entries/find-unbridged-booking-ledger-entries.query';
import { ROUTE_PATHS } from '@common/constants/routes.constant';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { BOOKINGPAYMENT, BOOKINGPAYMENTREFUND } = CAPABILITIES;

/**
 * Platform defteri mutabakat ekranı.
 *
 * Listenin karşılığı bir "sessiz kayıp" senaryosudur: para hareket etmiş
 * (tahsil edilmiş ya da iade edilmiş) ama ekonomik olay hiç yazılmamıştır.
 * Olay yazılmadığı için fişlenmemiş-olay süpürmesi bunu göremez; eksiklerin
 * görünür olduğu tek yer burasıdır.
 */
@Controller(ROUTE_PATHS.BOOKING_PAYMENTS.ROOT)
@UseGuards(AuthGuard, CapabilityGuard)
export class BookingPaymentQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @HasCapability(BOOKINGPAYMENT.read)
  @Get(ROUTE_PATHS.BOOKING_PAYMENTS.UNBRIDGED)
  unbridged(
    @Query() filter: GetUnbridgedBookingLedgerEntriesFilterDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new FindUnbridgedBookingLedgerEntriesQuery({ filter, ctx })
    );
  }

  /** Kapanmamış iadeler: doğrulanmamış, reddedilmiş ve takılmış (operatörün paneldeki listesi). */
  @HasCapability(BOOKINGPAYMENTREFUND.read)
  @Get(ROUTE_PATHS.BOOKING_PAYMENTS.REFUNDS_UNRESOLVED)
  @Serialize<
    UnresolvedBookingPaymentRefundRow,
    UnresolvedBookingPaymentRefundResponseDto
  >(UnresolvedBookingPaymentRefundResponseDto, { isArray: true })
  unresolvedRefunds(
    @Query() filter: GetUnresolvedBookingPaymentRefundsFilterDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new FindUnresolvedBookingPaymentRefundsQuery({ filter, pagination, ctx })
    );
  }
}
