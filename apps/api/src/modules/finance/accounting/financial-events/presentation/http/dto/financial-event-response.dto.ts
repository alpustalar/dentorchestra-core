import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { FinanceResponseGroups } from '@modules/finance/shared/domain/finance.contracts';
import { FinancialEventTypeType, FinancialEventTypeSchema } from '@input-type-schemas/FinancialEventTypeSchema';

const { FINANCIAL, MANAGEMENT, ADMIN } = FinanceResponseGroups;

const FIN = { groups: [FINANCIAL, MANAGEMENT, ADMIN] };

/**
 * Finansal olay parkesi (FinancialEvent) — muhasebeleştirmenin ham girdisi.
 * `payload` olaya özgü serbest JSON'dur ve tutarları taşır; idempotentlik anahtarı
 * (`dedupeKey`) ile birlikte yalnız yönetim/admin görür — destek ekranında sızmasın.
 */
export class FinancialEventResponseDto {
  @Expose(FIN) id: string;
  @Expose(FIN) clinicId: string;
  @ApiProperty({ enum: FinancialEventTypeSchema.options })
  @Expose(FIN) type: FinancialEventTypeType;

  @Expose(FIN)
  @Type(() => Date)
  occurredAt: Date;

  @Expose(FIN) sourceModule: string;
  @Expose(FIN) sourceRefId: string | null;
  @Expose(FIN) performedById: string | null;

  @Expose(FIN)
  @Type(() => Date)
  createdAt: Date;

  // --- Ham olay gövdesi ve idempotentlik izi (yönetim) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  payload: unknown;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  dedupeKey: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;
}
