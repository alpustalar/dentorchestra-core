import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';

const { INTERNAL, MANAGEMENT, FINANCIAL, ADMIN } = ResponseGroups;

export class MetaCampaignMetricResponseDto {
  @Expose() id: string;
  @Expose() metaAdAccountId: string;
  @Expose() campaignId: string;

  // --- Genel Kampanya Künyesi (İç Ekip, Yönetim ve Admin) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  campaignName: string;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  date: Date;

  // --- Performans Metrikleri (Sadece Pazarlama Operasyonu, Yönetim ve Admin) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  clicks: number;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  impressions: number;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  ctr: number | null; // Tıklama oranı (Decimal'den number'a)

  // --- Finansal Maliyet Metrikleri (Sadece Finans, Üst Yönetim ve Admin) ---
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  currency: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  spend: number; // Toplam harcanan bütçe

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  cpc: number | null; // Tıklama başına maliyet

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
