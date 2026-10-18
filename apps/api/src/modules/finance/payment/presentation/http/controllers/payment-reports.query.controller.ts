import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetArAgingQuery } from '@modules/finance/payment/application/queries/get-ar-aging/get-ar-aging.query';
import { GetProviderRevenueQuery } from '@modules/finance/payment/application/queries/get-provider-revenue/get-provider-revenue.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import {
  ArAgingReportResponseDto,
  ProviderRevenueReportResponseDto,
} from '@modules/finance/payment/presentation/http/dto/payment-response.dto';
import type { ArAgingReport } from '@modules/finance/payment/application/queries/get-ar-aging/get-ar-aging.response';
import type { ProviderRevenueReport } from '@modules/finance/payment/application/queries/get-provider-revenue/get-provider-revenue.response';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

/**
 * Klinik yönetim raporları (tahsilat odaklı, mali tablo dışı): açık taksit
 * riski (AR aging) ve hekim bazında ciro. Kapsam aktörün clinic bağlamıdır.
 */
const { PAYMENT } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(PAYMENT.read)
@Controller('reports')
export class PaymentReportsQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @Get('ar-aging')
  @Serialize<ArAgingReport, ArAgingReportResponseDto>(ArAgingReportResponseDto)
  arAging(@GetContext() ctx: IGetContext, @Query('asOf') asOf?: string) {
    return this.queryBus.execute(
      new GetArAgingQuery(
        this.resolveClinicId(ctx),
        ctx,
        asOf ? new Date(asOf) : undefined
      )
    );
  }

  @Get('provider-revenue')
  @Serialize<ProviderRevenueReport, ProviderRevenueReportResponseDto>(
    ProviderRevenueReportResponseDto
  )
  providerRevenue(
    @GetContext() ctx: IGetContext,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return this.queryBus.execute(
      new GetProviderRevenueQuery(
        this.resolveClinicId(ctx),
        ctx,
        dateFrom ? new Date(dateFrom) : undefined,
        dateTo ? new Date(dateTo) : undefined
      )
    );
  }

  private resolveClinicId(ctx: IGetContext): string {
    const clinicId = ctx.actor.clinicId;
    if (!clinicId) {
      throw new BadRequestException('Aktörün clinic bağlamı yok.');
    }
    return clinicId;
  }
}
