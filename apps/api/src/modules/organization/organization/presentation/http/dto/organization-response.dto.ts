import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { GlobalStatusType as GlobalStatus, GlobalStatusSchema } from '@input-type-schemas/GlobalStatusSchema';

const { INTERNAL, MANAGEMENT, ADMIN } = ResponseGroups;

export class OrganizationResponseDto {
  @Expose() id: string;

  // --- Genel Organizasyon Kimlik ve İletişim Bilgileri (Herkes Görebilir) ---
  @Expose() name: string;
  @Expose() slug: string;
  @Expose() phone: string | null;
  @Expose() email: string | null;

  // --- Lokasyon Bilgileri (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  address: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  city: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  district: string | null;

  // --- Operasyonel Ayarlar ve Durum (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: GlobalStatusSchema.options })
  status: GlobalStatus;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  timezone: string;

  // --- Sistem ve Audit Zaman Damgaları (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  deletedAt: Date | null;
}
