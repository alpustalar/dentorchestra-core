import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../packages/shared/common/constants/response-groups.constant';
import { ConversationStatus, MessageChannel } from '@shared';

const { INTERNAL, MANAGEMENT, ADMIN } = ResponseGroups;

export class ConversationResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;
  @Expose() organizationId: string;

  // --- Kontak Temel Bilgileri (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  channel: MessageChannel;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  contactPhone: string;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  contactName: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  patientId: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  leadId: string | null;

  // --- Akış ve Atama Durumları (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  status: ConversationStatus;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  assignedUserId: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  unreadCount: number;

  // --- Zaman Damgaları ve Oturum Pencereleri (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  lastMessageAt: Date | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  lastInboundAt: Date | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  agentReadAt: Date | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  windowExpiresAt: Date | null;

  // --- Pazarlama ve İzin Tercihleri (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  marketingOptOut: boolean;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  optOutAt: Date | null;

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
