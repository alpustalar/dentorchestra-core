import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { AccountTypeType as AccountType, AccountTypeSchema } from '@input-type-schemas/AccountTypeSchema';
import { AccountSideType as AccountSide, AccountSideSchema } from '@input-type-schemas/AccountSideSchema';

const { INTERNAL, MANAGEMENT, FINANCIAL, ADMIN } = ResponseGroups;

export class AccountResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;
  @Expose() organizationId: string;

  // --- Temel Hesap Tanımları (İç Operasyon, Finans, Yönetim ve Admin) ---
  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  code: string; // Muhasebe kodu (Örn: 100.01.001)

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  name: string; // Hesap adı (Örn: Merkez TL Kasası)

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  parentId: string | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: AccountTypeSchema.options })
  type: AccountType; // ASSET, LIABILITY, EQUITY, INCOME, EXPENSE

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  isActive: boolean;

  // --- Finansal ve Muhasebe Çalışma Kuralları (Sadece Finans, Yönetim ve Admin) ---
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: AccountSideSchema.options })
  normalSide: AccountSide; // DEBIT (Borç) veya CREDIT (Alacak) karakterli hesap

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  isPostable: boolean; // Doğrudan yevmiye kaydı alabilir mi (Uç hesap mı)?

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  requiresParty: boolean; // Cari hesap / alt parti eşleşmesi zorunlu mu?

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  currency: string | null; // Hesabın para birimi (Çoklu para birimi takibi için)

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
