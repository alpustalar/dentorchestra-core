import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { DuffelFlightBookingStatusType as DuffelFlightBookingStatus, DuffelFlightBookingStatusSchema } from '@input-type-schemas/DuffelFlightBookingStatusSchema';
import { DuffelFlightBookingModeType as DuffelFlightBookingMode, DuffelFlightBookingModeSchema } from '@input-type-schemas/DuffelFlightBookingModeSchema';
import { JsonValueType as JsonValue } from '@input-type-schemas/JsonValueSchema';

const { INTERNAL, MANAGEMENT, DATA_OWNER, FINANCIAL, ADMIN } = ResponseGroups;

export class DuffelFlightBookingResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;
  @Expose() organizationId: string;
  @Expose() patientId: string | null;
  @Expose() leadId: string | null;

  // --- Uçuş Temel Bilgileri (Herkese Açık) ---
  @ApiProperty({ enum: DuffelFlightBookingStatusSchema.options })
  @Expose() status: DuffelFlightBookingStatus;
  @Expose() slices: JsonValue;

  // --- Yolcu Bilgileri (İç Ekip, Yolcunun Kendisi ve Yönetim/Admin) ---
  // Yolcu listesi ad/soyad/doğum tarihi taşır; otel "holder"ından daha hassastır.
  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  passengers: JsonValue;

  // PNR ile havayolu sitesinden rezervasyona erişilebilir → kimlik doğrulayan kişi görsün.
  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  bookingReference: string | null;

  // --- Tedarikçi Referansları (Sadece İç Operasyon, Yönetim ve Admin) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  duffelOrderId: string;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  offerId: string;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: DuffelFlightBookingModeSchema.options })
  mode: DuffelFlightBookingMode;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  holdExpiresAt: Date | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  failureReason: string | null;

  // --- Finansal Maliyet Verileri (Sadece Finans, Yönetim ve Admin) ---
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  currency: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  totalAmount: number;

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
