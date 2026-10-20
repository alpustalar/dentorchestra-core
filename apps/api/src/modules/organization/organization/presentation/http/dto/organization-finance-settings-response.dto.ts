import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { BillingTargetType as BillingTarget } from '@input-type-schemas/BillingTargetSchema';

const { MANAGEMENT, ADMIN } = ResponseGroups;

export class OrganizationFinanceSettingsResponseDto {
  @Expose() id: string;
  @Expose() organizationId: string;

  // --- Abonelik ve Faturalandırma Stratejisi (Yönetim ve Üst Roller) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  subscriptionBillingTarget: BillingTarget;

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
