import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { PaginationDto } from '@shared';
import { GetPurchaseRequestsFilterDto } from '@shared/modules/purchasing/dto/queries';
import { GetPurchaseRequestsQuery } from '@modules/supply/purchasing/application/queries/get-purchase-requests/get-purchase-requests.query';
import { GetPurchaseRequestByIdQuery } from '@modules/supply/purchasing/application/queries/get-purchase-request-by-id/get-purchase-request-by-id.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import { PurchaseRequestResponseDto } from '@modules/supply/purchasing/presentation/http/dto/purchasing-response.dto';
import type { PurchaseRequestWithItems } from '@modules/supply/purchasing/domain/contracts';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { PURCHASEREQUEST } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(PURCHASEREQUEST.read)
@Controller('requests')
export class PurchaseRequestQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}
  @Get()
  @Serialize<PurchaseRequestWithItems, PurchaseRequestResponseDto>(
    PurchaseRequestResponseDto,
    { isArray: true }
  )
  list(
    @Query() dto: GetPurchaseRequestsFilterDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetPurchaseRequestsQuery({ filter: dto, pagination, ctx })
    );
  }
  @Get(':requestId')
  @Serialize<PurchaseRequestWithItems, PurchaseRequestResponseDto>(
    PurchaseRequestResponseDto
  )
  getById(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetPurchaseRequestByIdQuery(requestId, ctx)
    );
  }
}
