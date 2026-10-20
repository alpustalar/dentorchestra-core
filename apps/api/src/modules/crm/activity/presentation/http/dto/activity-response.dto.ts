import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ActivityResponseGroups } from '@modules/crm/activity/domain/contracts/activity';
import { ActivityTypeType as ActivityType, ActivityTypeSchema } from '@input-type-schemas/ActivityTypeSchema';
import { ActivityStatusType as ActivityStatus, ActivityStatusSchema } from '@input-type-schemas/ActivityStatusSchema';

const { INTERNAL, MANAGEMENT, ADMIN } = ActivityResponseGroups;

/**
 * CRM aktivitesi (görev/arama/toplantı/not). Konu ve zamanlama liste ızgarası için
 * tabandadır; serbest metin not ile aday/hasta bağı klinik içi bilgidir.
 */
export class ActivityResponseDto {
  // --- Liste ızgarası ---
  @Expose() id: string;
  @Expose() clinicId: string;
  @ApiProperty({ enum: ActivityTypeSchema.options })
  @Expose() type: ActivityType;
  @ApiProperty({ enum: ActivityStatusSchema.options })
  @Expose() status: ActivityStatus;
  @Expose() subject: string;

  @Expose()
  @Type(() => Date)
  dueAt: Date | null;

  @Expose()
  @Type(() => Date)
  completedAt: Date | null;

  // --- İlişkiler ve serbest metin (klinik içi) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  notes: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  leadId: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  patientId: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  assignedToId: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  createdById: string | null;

  // --- Denetim ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
