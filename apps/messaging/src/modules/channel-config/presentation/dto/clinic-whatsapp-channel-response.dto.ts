import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../packages/shared/common/constants/response-groups.constant';

const { INTERNAL, MANAGEMENT, ADMIN } = ResponseGroups;

export class ClinicWhatsappChannelResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;
  @Expose() organizationId: string;

  // --- Temel Kanal Kimlik Bilgileri (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  phoneNumberId: string;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  wabaId: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  displayPhoneNumber: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  isActive: boolean;

  // --- Kanal Kalitesi ve Limit Durumları (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  qualityRating: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  messagingTier: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  registeredAt: Date | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  tokenExpiresAt: Date | null;

  // --- Entegrasyon Kritik Sırları ve PIN Verileri (Kesinlikle Sadece Admin) ---
  @Expose({ groups: [ADMIN] })
  accessToken: string | null;

  @Expose({ groups: [ADMIN] })
  verifyToken: string | null;

  @Expose({ groups: [ADMIN] })
  registrationPin: string | null;

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
