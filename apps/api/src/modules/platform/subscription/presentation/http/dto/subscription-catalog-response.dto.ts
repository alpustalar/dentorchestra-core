import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';

const { ADMIN } = ResponseGroups;

/**
 * Abonelik kataloğu platform fiyatlandırmasıdır — kiracıya değil, platform
 * yöneticisine aittir. EntityPolicy yalnız sistem yöneticisine ADMIN grubu
 * verdiği için tüm alanlar ADMIN tier'ındadır.
 */
const PLATFORM = { groups: [ADMIN] };

/** Satın alınabilir eklenti modülü. */
export class SubscriptionModuleResponseDto {
  @Expose(PLATFORM) id: string;
  @Expose(PLATFORM) key: string;
  @Expose(PLATFORM) name: string;
  @Expose(PLATFORM) description: string | null;

  @Expose(PLATFORM)
  @Type(() => String)
  monthlyPrice: string;

  @Expose(PLATFORM) currency: string;
  @Expose(PLATFORM) isActive: boolean;
}

/** Plana bağlı modül özeti (bundle içeriği). */
export class PlanModuleSummaryResponseDto {
  @Expose(PLATFORM) id: string;
  @Expose(PLATFORM) key: string;
  @Expose(PLATFORM) name: string;
}

/** Plan kataloğu satırı (fiyat + bundle modüller). */
export class PlanResponseDto {
  @Expose(PLATFORM) id: string;
  @Expose(PLATFORM) planId: string;
  @Expose(PLATFORM) name: string;

  @Expose(PLATFORM)
  @Type(() => String)
  monthlyPrice: string;

  @Expose(PLATFORM) currency: string;
  @Expose(PLATFORM) isActive: boolean;

  @Expose(PLATFORM)
  @Type(() => PlanModuleSummaryResponseDto)
  modules: PlanModuleSummaryResponseDto[];
}
