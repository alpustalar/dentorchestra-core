import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetAccountingPeriodsQuery } from '@modules/finance/accounting/periods/application/queries/get-accounting-periods/get-accounting-periods.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import { AccountingPeriodResponseDto } from '@modules/finance/accounting/periods/presentation/http/dto/accounting-period-response.dto';
import { GetAccountingPeriodsFilterDto } from '@shared/modules/accounting-period/dto/queries';
import type { AccountingPeriod } from '@shared';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { ACCOUNTINGPERIOD } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(ACCOUNTINGPERIOD.read)
@Controller('periods')
export class AccountingPeriodQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  /**
   * `clinicId` **query string**'ten gelir. Eskiden `@Param('clinicId')` ile
   * okunuyordu ama rotada böyle bir parametre yoktu: `ParseUUIDPipe` her istekte
   * `undefined` görüp 400 attığı için uç tümüyle ölüydü.
   */
  @Get()
  @Serialize<AccountingPeriod, AccountingPeriodResponseDto>(
    AccountingPeriodResponseDto,
    { isArray: true }
  )
  getPeriods(
    @GetContext() ctx: IGetContext,
    @Query() filter: GetAccountingPeriodsFilterDto
  ) {
    return this.queryBus.execute(
      new GetAccountingPeriodsQuery(filter.clinicId, ctx)
    );
  }
}
