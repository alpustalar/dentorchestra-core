import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { AdminRequestTypeType as AdminRequestType, AdminRequestTypeSchema } from '@input-type-schemas/AdminRequestTypeSchema';
import { AdminRequestStatusType as AdminRequestStatus, AdminRequestStatusSchema } from '@input-type-schemas/AdminRequestStatusSchema';

const { MANAGEMENT, ADMIN } = ResponseGroups;

export class AdminRequestResponseDto {
  @Expose() id: string;
  @Expose() organizationId: string | null;
  @Expose() clinicId: string | null;

  // --- Temel Talep Bilgileri (Yönetim ve Üst Roller Görebilir) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: AdminRequestTypeSchema.options })
  type: AdminRequestType;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: AdminRequestStatusSchema.options })
  status: AdminRequestStatus;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  targetId: string;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  requestedBy: string;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  metadata: any | null;

  // --- İnceleme ve Değerlendirme Verileri (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  reviewedBy: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  reviewNote: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  reviewedAt: Date | null;

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
