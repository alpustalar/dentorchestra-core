import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { FinanceResponseGroups } from '@modules/finance/shared/domain/finance.contracts';
import { JournalEntryStatusType, JournalEntryStatusSchema } from '@input-type-schemas/JournalEntryStatusSchema';

const { FINANCIAL, MANAGEMENT, ADMIN } = FinanceResponseGroups;

const FIN = { groups: [FINANCIAL, MANAGEMENT, ADMIN] };

/**
 * Yevmiye fişi kaydı (JournalEntry). Defter verisi olduğu için tabanı yoktur.
 * `entryNo` Prisma'da BigInt — JSON'a string olarak taşınır.
 */
export class JournalEntryResponseDto {
  @Expose(FIN) id: string;
  @Expose(FIN) clinicId: string;
  @Expose(FIN) periodId: string;

  @Expose(FIN)
  @Type(() => String)
  entryNo: string | null;

  @Expose(FIN)
  @Type(() => Date)
  entryDate: Date;

  @Expose(FIN) description: string | null;
  @ApiProperty({ enum: JournalEntryStatusSchema.options })
  @Expose(FIN) status: JournalEntryStatusType;

  // --- İzlenebilirlik (fişi kim/hangi olay üretti, ters kaydı var mı) ---
  @Expose(FIN) eventId: string | null;
  @Expose(FIN) reversedById: string | null;
  @Expose(FIN) performedById: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;

  @Expose(FIN)
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
