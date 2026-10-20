import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { HotelbedsTransferBookingStatusType as HotelbedsTransferBookingStatus, HotelbedsTransferBookingStatusSchema } from '@input-type-schemas/HotelbedsTransferBookingStatusSchema';
import { JsonValueType as JsonValue } from '@input-type-schemas/JsonValueSchema';

const { INTERNAL, MANAGEMENT, DATA_OWNER, FINANCIAL, ADMIN } = ResponseGroups;

export class HotelbedsTransferBookingResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string | null;
  @Expose() organizationId: string;
  @Expose() patientId: string | null;
  @Expose() leadId: string | null;

  // --- Transfer Temel Bilgileri (Herkese Açık) ---
  @ApiProperty({ enum: HotelbedsTransferBookingStatusSchema.options })
  @Expose() status: HotelbedsTransferBookingStatus;
  @Expose() transfers: JsonValue;

  // --- Yolcu / Sorumlu Bilgileri (İç Ekip, Yolcunun Kendisi ve Yönetim/Admin) ---
  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  holderName: string;

  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  holderSurname: string;

  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  holderEmail: string;

  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  holderPhone: string;

  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  remarks: string | null;

  // --- Tedarikçi Referansları (Sadece İç Operasyon, Yönetim ve Admin) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  reference: string;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  clientReference: string | null;

  // --- Finansal Maliyet Verileri (Sadece Finans, Yönetim ve Admin) ---
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  currency: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  totalAmount: number; // Transfer net maliyeti

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
