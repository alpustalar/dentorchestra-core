import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';

const { MANAGEMENT, ADMIN, FINANCIAL } = ResponseGroups;

export class ProductBatchResponseDto {
  @Expose() id: string;
  @Expose() productId: string;
  @Expose() clinicId: string;
  @Expose() supplierId: string | null;
  @Expose() lotNumber: string | null;

  @Expose()
  @Type(() => Date)
  expiresAt: Date | null;

  @Expose()
  @Type(() => String) // Decimal miktar hassasiyetini korumak için string cast
  quantity: string;

  @Expose({ groups: [MANAGEMENT, FINANCIAL, ADMIN] })
  @Type(() => String) // Parasal karşılığı kuruş kaybı olmaması için string iletiyoruz
  purchasePrice: string;

  @Expose({ groups: [MANAGEMENT, FINANCIAL, ADMIN] })
  currency: string;

  // --- Audit & Log Bilgileri ---
  @Expose()
  @Type(() => Date)
  receivedAt: Date;

  @Expose() notes: string | null;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
}
