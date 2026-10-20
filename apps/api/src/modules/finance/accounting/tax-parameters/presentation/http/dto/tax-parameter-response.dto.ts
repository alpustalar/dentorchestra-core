import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { FinanceResponseGroups } from '@modules/finance/shared/domain/finance.contracts';
import { TaxParameterKeyType, TaxParameterKeySchema } from '@input-type-schemas/TaxParameterKeySchema';

const { INTERNAL, FINANCIAL, MANAGEMENT, ADMIN } = FinanceResponseGroups;

/**
 * Vergi parametresi (KDV/stopaj/kurumlar oranı). Fatura kesen personel de oranı
 * görmek zorundadır — oran ve geçerlilik aralığı INTERNAL'a açıktır; organizasyon
 * bağı ve denetim damgaları yönetime özel.
 */
export class TaxParameterResponseDto {
  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  id: string;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  clinicId: string;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: TaxParameterKeySchema.options })
  key: TaxParameterKeyType;

  // Decimal — hassasiyet kaybı olmaması için string olarak taşınır.
  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => String)
  rate: string;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  validFrom: Date;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  validTo: Date | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
