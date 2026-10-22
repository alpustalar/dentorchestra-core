import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { FinanceResponseGroups } from '@modules/finance/shared/domain/finance.contracts';
import {
  PosTransactionKindSchema,
  PosTransactionKindType as PosTransactionKind,
} from '@input-type-schemas/PosTransactionKindSchema';
import {
  PosTransactionStatusSchema,
  PosTransactionStatusType as PosTransactionStatus,
} from '@input-type-schemas/PosTransactionStatusSchema';
import {
  PosProviderSchema,
  PosProviderType as PosProvider,
} from '@input-type-schemas/PosProviderSchema';

const { INTERNAL, FINANCIAL, MANAGEMENT, ADMIN } = FinanceResponseGroups;

/**
 * Tek bir POS işleminin sanitize edilmiş durum özeti. Sağlayıcıya giden/dönen
 * ham istek/yanıt gövdeleri hiçbir zaman buraya taşınmaz — bu yalnız
 * `PosTransactionSummary` read-model'inin HTTP yansımasıdır.
 */
export class PosTransactionStatusResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;
  @Expose() patientId: string | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: PosTransactionKindSchema.options })
  kind: PosTransactionKind;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: PosTransactionStatusSchema.options })
  status: PosTransactionStatus;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: PosProviderSchema.options })
  provider: PosProvider;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  paymentId: string | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  completedAt: Date | null;

  // Decimal — hassasiyet kaybı olmaması için string olarak taşınır.
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => String)
  amount: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  currency: string;
}
