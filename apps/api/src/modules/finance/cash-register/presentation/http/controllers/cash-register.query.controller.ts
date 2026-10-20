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
import { GetCashRegistersFilterDto } from '@shared/modules/cash-register/dto/queries';
import { GetCashRegistersQuery } from '@modules/finance/cash-register/application/queries/get-cash-registers/get-cash-registers.query';
import { GetCashRegisterByIdQuery } from '@modules/finance/cash-register/application/queries/get-cash-register-by-id/get-cash-register-by-id.query';
import { GetOpenCashSessionQuery } from '@modules/finance/cash-register/application/queries/get-open-cash-session/get-open-cash-session.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import {
  CashRegisterResponseDto,
  CashSessionResponseDto,
} from '@modules/finance/cash-register/presentation/http/dto/cash-register-response.dto';
import type {
  CashRegister as ICashRegister,
  CashSession as ICashSession,
} from '@shared';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { CASHREGISTER, CASHSESSION } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@Controller('registers')
export class CashRegisterQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @HasCapability(CASHREGISTER.read)
  @Get()
  @Serialize<ICashRegister, CashRegisterResponseDto>(CashRegisterResponseDto, {
    isArray: true,
  })
  list(
    @Query() dto: GetCashRegistersFilterDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetCashRegistersQuery({ filter: dto, pagination, ctx })
    );
  }

  @HasCapability(CASHREGISTER.read)
  @Get(':registerId')
  @Serialize<ICashRegister, CashRegisterResponseDto>(CashRegisterResponseDto)
  getById(
    @Param('registerId', ParseUUIDPipe) registerId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetCashRegisterByIdQuery(registerId, ctx));
  }

  @HasCapability(CASHSESSION.read)
  @Get(':registerId/open-session')
  @Serialize<ICashSession, CashSessionResponseDto>(CashSessionResponseDto)
  getOpenSession(
    @Param('registerId', ParseUUIDPipe) registerId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetOpenCashSessionQuery(registerId, ctx));
  }
}
