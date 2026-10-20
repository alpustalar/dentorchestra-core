import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../packages/shared/common/constants/response-groups.constant';
import { AiProviderType } from '@shared';

const { INTERNAL, MANAGEMENT, ADMIN } = ResponseGroups;

export class ClinicAiAgentConfigResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;
  @Expose() organizationId: string;

  // --- Temel Ajan Durumu ve Model Detayları (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  isEnabled: boolean;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  provider: AiProviderType;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  model: string;

  // --- Davranışsal Persona ve Kurallar (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  systemPrompt: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  maxTokens: number | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  replyOnlyWithinWindow: boolean;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  businessHours: any | null;

  // --- Entegrasyon Sırları ve Kritik Parametreler (Kesinlikle Sadece Admin) ---
  @Expose({ groups: [ADMIN] })
  apiKey: string | null;

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
