import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { JsonValueType as JsonValue } from '@input-type-schemas/JsonValueSchema';

const { MANAGEMENT, ADMIN } = ResponseGroups;

export class HotelbedsHotelResponseDto {
  @Expose() id: string;

  // --- Genel Otel Kataloğu (Herkese Açık) ---
  @Expose() name: string;
  @Expose() categoryCode: string;
  @Expose() categoryName: string | null;
  @Expose() destinationCode: string;
  @Expose() destinationName: string | null;
  @Expose() address: string | null;
  @Expose() latitude: number | null;
  @Expose() longitude: number | null;
  @Expose() images: JsonValue | null;
  @Expose() phones: JsonValue | null;

  // --- API Senkronizasyon ve Sistem Verileri ---
  @Expose({ groups: [ADMIN] })
  @Type(() => Date)
  lastSyncedAt: Date;

  // --- Audit Zaman Damgaları (Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
