import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { FinanceResponseGroups } from '@modules/finance/shared/domain/finance.contracts';
import { CurrencyType, CurrencySchema } from '@input-type-schemas/CurrencySchema';
import { CashRegisterStatusType, CashRegisterStatusSchema } from '@input-type-schemas/CashRegisterStatusSchema';
import { CashSessionStatusType, CashSessionStatusSchema } from '@input-type-schemas/CashSessionStatusSchema';
import { CashMovementTypeType, CashMovementTypeSchema } from '@input-type-schemas/CashMovementTypeSchema';
import { CashMovementDirectionType, CashMovementDirectionSchema } from '@input-type-schemas/CashMovementDirectionSchema';

const { INTERNAL, FINANCIAL, MANAGEMENT, ADMIN } = FinanceResponseGroups;

const FIN = { groups: [FINANCIAL, MANAGEMENT, ADMIN] };
/** Kasayı fiilen kullanan resepsiyon personeli de görebilmeli. */
const OPS = { groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] };

/**
 * Kasa tanımı. Kasiyerin hangi kasada çalıştığını bilmesi gerekir — ad/durum/para
 * birimi INTERNAL'a açıktır; organizasyon bağı ve denetim damgaları yönetime özel.
 */
export class CashRegisterResponseDto {
  @Expose(OPS) id: string;
  @Expose(OPS) clinicId: string;
  @Expose(OPS) name: string;
  @ApiProperty({ enum: CurrencySchema.options })
  @Expose(OPS) currency: CurrencyType;
  @ApiProperty({ enum: CashRegisterStatusSchema.options })
  @Expose(OPS) status: CashRegisterStatusType;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;

  @Expose(FIN)
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}

/**
 * Kasa hareketi. Kasiyer kendi oturumundaki hareketleri görür (INTERNAL);
 * muhasebe referansları finans tarafında kalır.
 */
export class CashMovementResponseDto {
  @Expose(OPS) id: string;
  @Expose(OPS) cashSessionId: string;
  @Expose(OPS) clinicId: string;
  @ApiProperty({ enum: CashMovementTypeSchema.options })
  @Expose(OPS) type: CashMovementTypeType;
  @ApiProperty({ enum: CashMovementDirectionSchema.options })
  @Expose(OPS) direction: CashMovementDirectionType;

  @Expose(OPS)
  @Type(() => String)
  amount: string;

  @ApiProperty({ enum: CurrencySchema.options })
  @Expose(OPS) currency: CurrencyType;
  @Expose(OPS) description: string | null;
  @Expose(OPS) performedById: string;

  @Expose(OPS)
  @Type(() => Date)
  occurredAt: Date;

  // --- Kaynak kayıt bağı (finans) ---
  @Expose(FIN) referenceType: string | null;
  @Expose(FIN) referenceId: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;

  @Expose(FIN)
  @Type(() => Date)
  createdAt: Date;
}

/**
 * Kasa oturumu. Kasiyer açılış nakdini ve oturumun açık olduğunu görmelidir;
 * **sayım farkı** (`difference`, `countedAmount`, `expectedAmount`) denetim
 * verisidir — kasiyerden gizlenir, yalnız finans/yönetim görür.
 */
export class CashSessionResponseDto {
  @Expose(OPS) id: string;
  @Expose(OPS) cashRegisterId: string;
  @Expose(OPS) clinicId: string;
  @ApiProperty({ enum: CashSessionStatusSchema.options })
  @Expose(OPS) status: CashSessionStatusType;
  @ApiProperty({ enum: CurrencySchema.options })
  @Expose(OPS) currency: CurrencyType;

  @Expose(OPS)
  @Type(() => String)
  openingFloat: string;

  @Expose(OPS) openedById: string;
  @Expose(OPS) closedById: string | null;

  @Expose(OPS)
  @Type(() => Date)
  openedAt: Date;

  @Expose(OPS)
  @Type(() => Date)
  closedAt: Date | null;

  @Expose(OPS)
  @Type(() => CashMovementResponseDto)
  movements?: CashMovementResponseDto[];

  // --- Sayım / fark denetimi (finans-yönetim) ---
  @Expose(FIN)
  @Type(() => String)
  expectedAmount: string | null;

  @Expose(FIN)
  @Type(() => String)
  countedAmount: string | null;

  @Expose(FIN)
  @Type(() => String)
  difference: string | null;

  @Expose(FIN) note: string | null;

  // --- Muhasebe köprüsü izi ---
  @Expose(FIN) accountingEventId: string | null;

  @Expose(FIN)
  @Type(() => Date)
  postedToAccountingAt: Date | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;

  @Expose(FIN)
  @Type(() => Date)
  createdAt: Date;
}
