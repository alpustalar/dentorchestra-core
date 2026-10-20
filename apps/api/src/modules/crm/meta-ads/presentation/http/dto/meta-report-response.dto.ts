import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';

const { INTERNAL, MANAGEMENT, FINANCIAL, ADMIN } = ResponseGroups;

/** Rapor dönemi. */
export class MetaReportPeriodDto {
  @Expose()
  @Type(() => Date)
  from: Date;

  @Expose()
  @Type(() => Date)
  to: Date;
}

/**
 * Kampanya performans satırı. Kampanya kimliği ve dönüşüm adetleri klinik içi
 * bilgidir; harcama ve tıklama maliyeti bütçe verisi olduğu için finans/yönetime özel.
 */
export class MetaCampaignSummaryResponseDto {
  @Expose({ groups: [INTERNAL, MANAGEMENT, FINANCIAL, ADMIN] })
  campaignId: string;

  @Expose({ groups: [INTERNAL, MANAGEMENT, FINANCIAL, ADMIN] })
  campaignName: string;

  @Expose({ groups: [INTERNAL, MANAGEMENT, FINANCIAL, ADMIN] })
  clicks: number;

  @Expose({ groups: [INTERNAL, MANAGEMENT, FINANCIAL, ADMIN] })
  leads: number;

  @Expose({ groups: [INTERNAL, MANAGEMENT, FINANCIAL, ADMIN] })
  conversions: number;

  // --- Bütçe (finans/yönetim) ---
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  spend: number;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  cpc: number;
}

/**
 * Meta reklam performans raporu. Adet metrikleri klinik personeline açık;
 * para birimi taşıyan her alan (harcama, lead/randevu maliyeti) finans/yönetime özel.
 */
export class MetaReportResponseDto {
  @Expose()
  @Type(() => MetaReportPeriodDto)
  period: MetaReportPeriodDto;

  // --- Adet metrikleri (klinik içi) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, FINANCIAL, ADMIN] })
  totalClicks: number;

  @Expose({ groups: [INTERNAL, MANAGEMENT, FINANCIAL, ADMIN] })
  totalLeads: number;

  @Expose({ groups: [INTERNAL, MANAGEMENT, FINANCIAL, ADMIN] })
  convertedLeads: number;

  @Expose({ groups: [INTERNAL, MANAGEMENT, FINANCIAL, ADMIN] })
  conversionRate: number;

  // --- Bütçe / maliyet (finans-yönetim) ---
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  totalSpend: number;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  averageCpc: number;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  costPerLead: number;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  costPerAppointment: number;

  @Expose({ groups: [INTERNAL, MANAGEMENT, FINANCIAL, ADMIN] })
  @Type(() => MetaCampaignSummaryResponseDto)
  campaigns: MetaCampaignSummaryResponseDto[];
}
