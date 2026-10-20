import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetAccountingPeriodsQuery } from '@modules/finance/accounting/periods/application/queries/get-accounting-periods/get-accounting-periods.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import { AccountingPeriodResponseDto } from '@modules/finance/accounting/periods/presentation/http/dto/accounting-period-response.dto';
import {
  GetAccountingPeriodsFilterDto,
  GetYearEndClosingPreviewFilterDto,
} from '@shared/modules/accounting-period/dto/queries';
import type { AccountingPeriod } from '@shared';
import type { YearEndClosingPreview } from '@shared/modules/accounting-period/interfaces';
import { GetYearEndClosingPreviewQuery } from '@modules/finance/accounting/posting/application/queries/get-year-end-closing-preview/get-year-end-closing-preview.query';
import { YearEndClosingPreviewResponseDto } from '@modules/finance/accounting/periods/presentation/http/dto/year-end-closing-preview-response.dto';
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

  /**
   * Yıl sonu kapanış **önizlemesi** — hiçbir şey yazmaz.
   *
   * `POST` olmasının sebebi gövde: seçim (tahakkuk edilecek siparişler) sorgu dizesine
   * sığmayacak kadar yapılandırılmıştır. Kapanış geri alınamaz; bu yüzden `POST :id/close`
   * önizlemenin döndürdüğü `expectedLastEntryNo` olmadan çalışmaz.
   */
  @Post(':id/closing-preview')
  @HttpCode(HttpStatus.OK)
  @Serialize<YearEndClosingPreview, YearEndClosingPreviewResponseDto>(
    YearEndClosingPreviewResponseDto
  )
  closingPreview(
    @GetContext() ctx: IGetContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GetYearEndClosingPreviewFilterDto
  ) {
    return this.queryBus.execute(
      new GetYearEndClosingPreviewQuery({ periodId: id, filter: dto, ctx })
    );
  }
}
