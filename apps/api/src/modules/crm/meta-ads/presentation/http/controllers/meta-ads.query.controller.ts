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
import {
  GetMetaLeadsDto,
  GetMetaReportDto,
  GetRoiReportDto,
} from '@shared/modules/meta-ads/dto/queries';
import { GetMetaReportQuery } from '@modules/crm/meta-ads/application/queries/get-meta-report/get-meta-report.query';
import { GetAgencyRoiReportQuery } from '@modules/crm/meta-ads/application/queries/get-agency-roi-report/get-agency-roi-report.query';
import { GetMetaLeadsQuery } from '@modules/crm/meta-ads/application/queries/get-meta-leads/get-meta-leads.query';
import { GetMetaAccountsQuery } from '@modules/crm/meta-ads/application/queries/get-meta-accounts/get-meta-accounts.query';
import { PaginationDto } from '@shared';
import { Serialize } from '@common/decorators/serialize.decorator';
import {
  AgencyRoiReportResponseDto,
  MetaAdAccountResponseDto,
  MetaLeadResponseDto,
  MetaReportResponseDto,
} from '@modules/crm/meta-ads/presentation/http/dto';
import type {
  AgencyRoiReport,
  MetaAdAccountResponse,
  MetaLeadResponse,
  MetaReportResponse,
} from '@shared/modules/meta-ads/interfaces';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { METAADACCOUNT, METACAMPAIGNMETRIC, METALEAD } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@Controller()
export class MetaAdsQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @HasCapability(METAADACCOUNT.read)
  @Get('clinics/:clinicId/accounts')
  @Serialize<MetaAdAccountResponse, MetaAdAccountResponseDto>(
    MetaAdAccountResponseDto,
    { isArray: true }
  )
  getAccounts(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetMetaAccountsQuery(clinicId, ctx));
  }

  @HasCapability(METACAMPAIGNMETRIC.read)
  @Get('clinics/:clinicId/reports')
  @Serialize<MetaReportResponse, MetaReportResponseDto>(MetaReportResponseDto)
  getReport(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Query() dto: GetMetaReportDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetMetaReportQuery(clinicId, dto.from, dto.to, ctx, dto.campaignId)
    );
  }

  @HasCapability(METACAMPAIGNMETRIC.read)
  @Get('clinics/:clinicId/roi')
  @Serialize<AgencyRoiReport, AgencyRoiReportResponseDto>(
    AgencyRoiReportResponseDto
  )
  getRoiReport(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Query() dto: GetRoiReportDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetAgencyRoiReportQuery({
        clinicId,
        from: dto.from,
        to: dto.to,
        ctx,
        campaignId: dto.campaignId,
      })
    );
  }

  @HasCapability(METALEAD.read)
  @Get('clinics/:clinicId/leads')
  @Serialize<MetaLeadResponse, MetaLeadResponseDto>(MetaLeadResponseDto, {
    isArray: true,
  })
  getLeads(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Query() dto: GetMetaLeadsDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetMetaLeadsQuery(clinicId, pagination, ctx, dto.status)
    );
  }
}
