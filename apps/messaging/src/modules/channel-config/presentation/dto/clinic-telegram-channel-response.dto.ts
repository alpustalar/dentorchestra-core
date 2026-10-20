import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../packages/shared/common/constants/response-groups.constant';
import { TelegramProviderType as TelegramProvider } from '@shared';
import { TelegramChannelStatusType as TelegramChannelStatus } from '@shared';

const { INTERNAL, MANAGEMENT, ADMIN } = ResponseGroups;

export class ClinicTelegramChannelResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;
  @Expose() organizationId: string;

  // --- Temel Kanal Kimlik Bilgileri (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  provider: TelegramProvider;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  status: TelegramChannelStatus;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  botUsername: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  isActive: boolean;

  // --- Sağlık ve Hata Durum İzleme (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  lastError: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  phoneNumber: string | null;

  // --- Entegrasyon Kritik Sırları ve Oturum Verileri
  @Expose({ groups: [ADMIN] })
  botTokenEnc: string | null;

  @Expose({ groups: [ADMIN] })
  webhookSecret: string | null;

  @Expose({ groups: [ADMIN] })
  mtprotoSessionEnc: string | null;

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
