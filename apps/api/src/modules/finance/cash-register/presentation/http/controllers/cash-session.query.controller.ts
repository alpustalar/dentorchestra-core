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
import { GetCashSessionsFilterDto } from '@shared/modules/cash-register/dto/queries';
import { GetCashSessionsQuery } from '@modules/finance/cash-register/application/queries/get-cash-sessions/get-cash-sessions.query';
import { GetCashSessionByIdQuery } from '@modules/finance/cash-register/application/queries/get-cash-session-by-id/get-cash-session-by-id.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import { CashSessionResponseDto } from '@modules/finance/cash-register/presentation/http/dto/cash-register-response.dto';
import type { CashSession as ICashSession } from '@shared';
import type { CashSessionWithMovements } from '@modules/finance/cash-register/domain/contracts';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { CASHSESSION } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(CASHSESSION.read)
@Controller('sessions')
export class CashSessionQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}
  @Get()
  @Serialize<ICashSession, CashSessionResponseDto>(CashSessionResponseDto, {
    isArray: true,
  })
  list(
    @Query() dto: GetCashSessionsFilterDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetCashSessionsQuery({ filter: dto, pagination, ctx })
    );
  }
  @Get(':sessionId')
  @Serialize<CashSessionWithMovements, CashSessionResponseDto>(
    CashSessionResponseDto
  )
  getById(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetCashSessionByIdQuery(sessionId, ctx));
  }
}
