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
import { PaginationDto } from '@shared';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetPayrollAccrualsQuery } from '@modules/finance/payroll/application/queries/get-payroll-accruals/get-payroll-accruals.query';
import { GetPayrollAccrualByIdQuery } from '@modules/finance/payroll/application/queries/get-payroll-accrual-by-id/get-payroll-accrual-by-id.query';
import { GetPayrollAccrualsFilterDto } from '@shared/modules/payroll/dto/queries';
import { Serialize } from '@common/decorators/serialize.decorator';
import { PayrollAccrualResponseDto } from '@modules/finance/payroll/presentation/http/dto/payroll-accrual-response.dto';
import { PayrollAccrual } from '@modules/finance/payroll/domain/contracts/payroll.contracts';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

/**
 * Bordro için ayrı bir yetki yok (bilinçli — doc 09 §33): okuma `FINANCIALEVENT.read`
 * ile aynı eksende açılır, tahakkuk zaten `FINANCIALEVENT.create` ile yazılıyor.
 */
const { FINANCIALEVENT } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(FINANCIALEVENT.read)
@Controller('accruals')
export class PayrollQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @Get()
  @Serialize<PayrollAccrual, PayrollAccrualResponseDto>(
    PayrollAccrualResponseDto,
    { isArray: true }
  )
  getAccruals(
    @GetContext() ctx: IGetContext,
    @Query() pagination: PaginationDto,
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    @Query() filter: GetPayrollAccrualsFilterDto
  ) {
    return this.queryBus.execute(
      new GetPayrollAccrualsQuery({ clinicId, ...filter, pagination, ctx })
    );
  }

  @Get(':id')
  @Serialize<PayrollAccrual, PayrollAccrualResponseDto>(
    PayrollAccrualResponseDto
  )
  getAccrualById(
    @Param('id') financialEventId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetPayrollAccrualByIdQuery(financialEventId, ctx)
    );
  }
}
