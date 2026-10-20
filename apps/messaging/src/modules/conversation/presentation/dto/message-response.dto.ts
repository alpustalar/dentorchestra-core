import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../packages/shared/common/constants/response-groups.constant';
import { MessageDirectionType as MessageDirection } from '@shared';
import { MessageStatusType as MessageStatus } from '@shared';
import { MessageTypeType as MessageType } from '@shared';

const { INTERNAL, MANAGEMENT, ADMIN } = ResponseGroups;

export class MessageResponseDto {
  @Expose() id: string;
  @Expose() conversationId: string;

  // --- Temel Mesaj İçeriği ve Yönü (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  direction: MessageDirection;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  type: MessageType;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  body: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  mediaUrl: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  mediaType: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  status: MessageStatus;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  sentByUserId: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  replyToExternalId: string | null;

  // --- Şablon (Template) Meta Verileri (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  templateName: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  templateLanguage: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  templateParams: any | null;

  // --- Gateway Referansları ve Hata Durumları (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  externalId: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  errorReason: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  errorCode: string | null;

  // --- Faturalandırma ve Ham Veri Paylaşımları (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  pricingCategory: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  billable: boolean | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  payload: any | null;

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
