import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { Serialize } from '@common/decorators/serialize.decorator';
import { PaginationDto } from '@shared';
import { GetCardChargebacksFilterDto } from '@shared/modules/bank/dto/queries';
import { GetCardChargebacksQuery } from '@modules/finance/bank/application/queries/get-card-chargebacks/get-card-chargebacks.query';
import { CardChargebackResponseDto } from '@modules/finance/bank/presentation/http/dto/bank-response.dto';
import type { CardChargeback as ICardChargeback } from '@shared';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { CARDCHARGEBACK } = CAPABILITIES;

@UseGuards(AuthGuard, CapabilityGuard)
@Controller('card-chargebacks')
export class CardChargebackQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @HasCapability(CARDCHARGEBACK.read)
  @Get()
  @Serialize<ICardChargeback, CardChargebackResponseDto>(
    CardChargebackResponseDto, { isArray: true })
  list(
    @Query() dto: GetCardChargebacksFilterDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetCardChargebacksQuery({ filter: dto, pagination, ctx })
    );
  }
}
