import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';

const { MANAGEMENT, ADMIN } = ResponseGroups;

export class ClinicPaymentGatewayResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;

  // --- Iyzico Entegrasyon Anahtarı (Kesinlikle Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  iyzicoSubMerchantKey: string;

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
