import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { StockMovementTypeType, StockMovementTypeSchema } from '@input-type-schemas/StockMovementTypeSchema';
import { StockMovementDirectionType, StockMovementDirectionSchema } from '@input-type-schemas/StockMovementDirectionSchema';

const { MANAGEMENT, ADMIN, FINANCIAL } = ResponseGroups;

export class StockMovementResponseDto {
  // --- Çekirdek Kimlik Bilgileri ---
  @Expose() id: string;
  @Expose() productId: string;
  @Expose() clinicId: string;
  @Expose() batchId: string | null;

  // --- Hareketin Niteliği ---
  @ApiProperty({ enum: StockMovementTypeSchema.options })
  @Expose() type: StockMovementTypeType; // ADJUSTMENT, SALE, PURCHASE vb.
  @ApiProperty({ enum: StockMovementDirectionSchema.options })
  @Expose() direction: StockMovementDirectionType; // IN, OUT

  // --- Miktar (Hassas Sayı) ---
  @Expose()
  @Type(() => String) // decimal.js miktar hassasiyetini korumak için string cast
  quantity: string;

  // --- Finansal Parametreler (Rol Korumalı) ---
  @Expose({ groups: [MANAGEMENT, FINANCIAL, ADMIN] })
  @Type(() => String)
  unitPrice: string | null;

  @Expose()
  currency: string; // TRY, USD, EUR vb. Tüm roller birimi görebilmeli

  @Expose({ groups: [MANAGEMENT, FINANCIAL, ADMIN] })
  vatRate: number | null;

  @Expose({ groups: [MANAGEMENT, FINANCIAL, ADMIN] })
  @Type(() => String)
  vatAmount: string | null;

  @Expose({ groups: [MANAGEMENT, FINANCIAL, ADMIN] })
  @Type(() => String)
  totalAmount: string | null;

  // --- İlişkisel ve Operasyonel İzler ---
  @Expose({ groups: [MANAGEMENT, FINANCIAL, ADMIN] })
  financeLedgerId: string | null; // Muhasebe entegrasyonu bağı için

  @Expose()
  performedById: string | null; // Hareketi gerçekleştiren personel ID'si

  @Expose()
  notes: string | null;

  // --- Audit Zaman Damgası ---
  @Expose()
  @Type(() => Date)
  createdAt: Date;
}
