import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { PosTransactionStatusType as PosTransactionStatus } from '@input-type-schemas/PosTransactionStatusSchema';
import { JsonValueType } from '@input-type-schemas/JsonValueSchema';

const { INTERNAL, MANAGEMENT, FINANCIAL, ADMIN } = ResponseGroups;

export class PosTransactionResponseDto {
  @Expose() id: string;
  @Expose() posDeviceId: string;
  @Expose() clinicId: string;
  @Expose() patientId: string | null;

  // --- Genel Durum ve Takip Bilgileri (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  appointmentId: string | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  paymentId: string | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  status: PosTransactionStatus;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  externalRef: string | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  initiatedAt: Date;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  completedAt: Date | null;

  // --- Finansal Raporlama Tutarları (Sadece Finans, Yönetim ve Admin) ---
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  currency: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  amount: number;

  // --- Gateway Ham Logları ve Sırlar (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  rawRequest: JsonValueType | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  rawResponse: JsonValueType | null;

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
