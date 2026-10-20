import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';

const { MANAGEMENT, DATA_OWNER, INTERNAL, ADMIN } = ResponseGroups;

export class TreatmentPackageResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;

  // --- Genel Paket Bilgileri (Herkese Açık) ---
  @Expose() name: string;
  @Expose() examinationCount: number;
  @Expose() controlCount: number;
  @Expose() totalSessionCount: number;
  @Expose() validityDays: number;
  @Expose() isActive: boolean;

  // --- Finansal Bilgiler (Finans, Yönetim ve Admin Görebilir) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  price: number;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  currency: string;

  // --- Audit Zaman Damgaları (Yönetim, Sahip ve Admin) ---
  @Expose({ groups: [MANAGEMENT, DATA_OWNER, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  deletedAt: Date | null;
}
