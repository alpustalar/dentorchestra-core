import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { MetaLeadStatusType as MetaLeadStatus, MetaLeadStatusSchema } from '@input-type-schemas/MetaLeadStatusSchema';
import { JsonValueType as JsonValue } from '@input-type-schemas/JsonValueSchema';

const { INTERNAL, MANAGEMENT, DATA_OWNER, ADMIN } = ResponseGroups;

export class MetaLeadResponseDto {
  @Expose() id: string;
  @Expose() metaAdAccountId: string;
  @ApiProperty({ enum: MetaLeadStatusSchema.options })
  @Expose() status: MetaLeadStatus;

  // --- Temel Aday Künyesi (CRM Personeli, Adayın Kendisi ve Yönetici/Admin Görebilir) ---
  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  name: string | null;

  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  phone: string | null;

  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  email: string | null;

  // --- Meta Kampanya ve Form Kaynak Bilgileri (İç Operasyon, Yönetim ve Admin) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  metaLeadId: string;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  formId: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  campaignId: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  campaignName: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  adsetId: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  adId: string | null;

  // --- İç Sistem Eşleşme Bilgileri (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  matchedPatientId: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  matchedAppointmentId: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  matchedAt: Date | null;

  // --- Ham Webhook Verisi (Kesinlikle Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  rawData: JsonValue; // Meta Graph API'den gelen filtrelenmemiş ham obje

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
