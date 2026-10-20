import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { PosProviderType as PosProvider, PosProviderSchema } from '@input-type-schemas/PosProviderSchema';

const { INTERNAL, MANAGEMENT, FINANCIAL, ADMIN } = ResponseGroups;

export class PosDeviceResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;

  // --- Genel Cihaz Tanımları (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  label: string;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: PosProviderSchema.options })
  provider: PosProvider;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  isActive: boolean;

  // --- Ağ ve Donanım Parametreleri (Sadece Finans, Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  terminalId: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  merchantId: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  host: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  port: number | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  deviceUniqueId: string | null;

  // --- Audit ve Sistem Durumları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  isDeleted: boolean;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
