import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../packages/shared/common/constants/response-groups.constant';

const { INTERNAL, MANAGEMENT, ADMIN } = ResponseGroups;

export class ClinicInstagramChannelResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;
  @Expose() organizationId: string;

  // --- Temel Kanal Kimlik Bilgileri (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  igUserId: string;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  pageId: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  username: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  isActive: boolean;

  // --- Sağlık ve Hata Durum İzleme (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  lastError: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  tokenExpiresAt: Date | null;

  // --- Entegrasyon token
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  accessToken: string | null;

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
