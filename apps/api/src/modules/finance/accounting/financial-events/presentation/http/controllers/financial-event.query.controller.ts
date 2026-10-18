import {
  Controller,
  Get,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import type { FinancialEvent } from '@shared';
import { PaginationDto } from '@shared';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetFinancialEventsQuery } from '@modules/finance/accounting/financial-events/application/queries/get-financial-events/get-financial-events.query';
import { GetUnpostedFinancialEventsQuery } from '@modules/finance/accounting/financial-events/application/queries/get-unposted-financial-events/get-unposted-financial-events.query';
import { GetUnpostedFinancialEventsFilterDto } from '@shared/modules/financial-event/dto/queries';
import { POSTABLE_FINANCIAL_EVENT_TYPES } from '@modules/finance/accounting/posting/domain/posting/postable-event-types.constant';
import { FinancialEventTypeType as FinancialEventType } from '@input-type-schemas/FinancialEventTypeSchema';
import { Serialize } from '@common/decorators/serialize.decorator';
import { FinancialEventResponseDto } from '@modules/finance/accounting/financial-events/presentation/http/dto/financial-event-response.dto';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { FINANCIALEVENT } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(FINANCIALEVENT.read)
@Controller('financial-events')
export class FinancialEventQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}
  @Get()
  @Serialize<FinancialEvent, FinancialEventResponseDto>(
    FinancialEventResponseDto
  )
  getEvents(
    @GetContext() ctx: IGetContext,
    @Query() pagination: PaginationDto,
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    @Query('type') type?: FinancialEventType,
    @Query('sourceModule') sourceModule?: string,
    @Query('sourceRefId') sourceRefId?: string
  ) {
    return this.queryBus.execute(
      new GetFinancialEventsQuery({
        clinicId,
        pagination,
        ctx,
        type,
        sourceModule,
        sourceRefId,
      })
    );
  }

  /**
   * Mutabakat: aralıkta fişlenmemiş (mizana girmemiş) ekonomik olaylar.
   * Dönem kapanışı bu liste boşalmadan geçmez; liste boş değilse
   * `POST /financial-events/post-unposted` ile yeniden fişleme denenir.
   */
  @Get('unposted')
  @Serialize<FinancialEvent, FinancialEventResponseDto>(
    FinancialEventResponseDto
  )
  getUnposted(
    @GetContext() ctx: IGetContext,
    @Query() pagination: PaginationDto,
    @Query() filter: GetUnpostedFinancialEventsFilterDto
  ) {
    return this.queryBus.execute(
      new GetUnpostedFinancialEventsQuery({
        filter: { ...filter, types: POSTABLE_FINANCIAL_EVENT_TYPES },
        pagination,
        ctx,
      })
    );
  }
}
