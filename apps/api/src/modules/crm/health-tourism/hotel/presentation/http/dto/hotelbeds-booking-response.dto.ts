import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { HotelbedsBookingStatusType as HotelbedsBookingStatus, HotelbedsBookingStatusSchema } from '@input-type-schemas/HotelbedsBookingStatusSchema';
import { JsonValueType as JsonValue } from '@input-type-schemas/JsonValueSchema';

const { INTERNAL, MANAGEMENT, DATA_OWNER, FINANCIAL, ADMIN } = ResponseGroups;

export class HotelbedsBookingResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;
  @Expose() organizationId: string;
  @Expose() patientId: string | null;
  @Expose() leadId: string | null;

  // --- Rezervasyon Temel Bilgileri (Herkese Açık) ---
  @Expose() hotelCode: string;
  @ApiProperty({ enum: HotelbedsBookingStatusSchema.options })
  @Expose() status: HotelbedsBookingStatus;

  @Expose()
  @Type(() => Date)
  checkIn: Date;

  @Expose()
  @Type(() => Date)
  checkOut: Date;

  // --- Rezervasyon Sahibi Bilgileri (İç Operasyon, Hasta/Sahip ve Yönetim/Admin) ---
  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  holderName: string;

  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  holderSurname: string;

  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  rooms: JsonValue;

  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  remarks: string | null;

  // --- Tedarikçi Referansları (Sadece İç Operasyon, Yönetim ve Admin) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  reference: string;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  clientReference: string | null;

  // --- Finansal Kâr / Maliyet Bilgileri (Sadece Finans, Yönetim ve Admin) ---
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  currency: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  totalNet: number; // Hotelbeds ham geliş maliyeti (Dışarı sızmamalı)

  @Expose({ groups: [ADMIN] })
  @Type(() => Number)
  serviceFee: number | null; // Kliniğin aldığı hizmet payı

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
