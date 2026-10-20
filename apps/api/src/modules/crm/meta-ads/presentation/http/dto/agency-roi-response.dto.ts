import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { MetaReportPeriodDto } from './meta-report-response.dto';

const { MANAGEMENT, FINANCIAL, ADMIN } = ResponseGroups;

/**
 * ROI raporu baştan sona ciro/kâr verisidir — hiçbir alanı taban değildir;
 * tamamı finans/yönetim tier'ında tutulur.
 */
export class RoiPeriodTotalsResponseDto {
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] }) spend: number;
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] }) revenue: number;
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] }) netProfit: number;
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] }) roas: number;
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] }) roiPercent: number;
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] }) attributedLeads: number;
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] }) convertedPatients: number;
}

/** Önceki döneme göre değişim yüzdeleri. */
export class RoiDeltasResponseDto {
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] }) spendPct: number;
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] }) revenuePct: number;
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] }) roasPct: number;
}

/** Kampanya-başı ROI kırılımı. */
export class RoiCampaignBreakdownResponseDto {
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] }) campaignId: string;
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] }) campaignName: string;
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] }) spend: number;
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] }) attributedLeads: number;
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] }) convertedPatients: number;
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] }) revenue: number;
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] }) roas: number;
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] }) roiPercent: number;
}

/** Ajans ROI raporu — cari + önceki dönem + değişim + kampanya kırılımı. */
export class AgencyRoiReportResponseDto {
  @Expose()
  @Type(() => MetaReportPeriodDto)
  period: MetaReportPeriodDto;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => RoiPeriodTotalsResponseDto)
  current: RoiPeriodTotalsResponseDto;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => RoiPeriodTotalsResponseDto)
  previous: RoiPeriodTotalsResponseDto;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => RoiDeltasResponseDto)
  deltas: RoiDeltasResponseDto;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => RoiCampaignBreakdownResponseDto)
  campaigns: RoiCampaignBreakdownResponseDto[];
}
