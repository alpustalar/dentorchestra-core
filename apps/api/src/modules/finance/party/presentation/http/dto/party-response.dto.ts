import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { PartyTypeType as PartyType, PartyTypeSchema } from '@input-type-schemas/PartyTypeSchema';
import { PartyRoleType as PartyRole, PartyRoleSchema } from '@input-type-schemas/PartyRoleSchema';
import { PartyOriginTypeType as PartyOriginType, PartyOriginTypeSchema } from '@input-type-schemas/PartyOriginTypeSchema';

const { INTERNAL, MANAGEMENT, FINANCIAL, ADMIN, DATA_OWNER } = ResponseGroups;

export class PartyResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;
  @Expose() organizationId: string;

  // --- Temel Künye Bilgileri (Herkese Açık) ---
  @Expose() name: string;
  @ApiProperty({ enum: PartyTypeSchema.options })
  @Expose() type: PartyType;
  @ApiProperty({ enum: PartyRoleSchema.options, isArray: true })
  @Expose() roles: PartyRole[];
  @Expose() isActive: boolean;

  // --- İletişim Detayları (İç Personel, Sahip ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, DATA_OWNER, MANAGEMENT, ADMIN] })
  email: string | null;

  @Expose({ groups: [INTERNAL, DATA_OWNER, MANAGEMENT, ADMIN] })
  phone: string | null;

  @Expose({ groups: [INTERNAL, DATA_OWNER, MANAGEMENT, ADMIN] })
  address: string | null;

  // --- Kurumsal ve Vergi Sırları (Sadece Finans, Yönetim ve Admin) ---
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  taxNumber: string | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  taxOffice: string | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  isEInvoiceUser: boolean;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  eInvoiceMailbox: string | null;

  // --- Muhasebe Hesap Eşleşmeleri (Sadece Finans, Yönetim ve Admin) ---
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  receivableAccountId: string | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  payableAccountId: string | null;

  // --- Ulusal Kimlik Zırhı (Sadece Veri Sahibi, Yönetim ve Admin - KVKK) ---
  @Expose({ groups: [DATA_OWNER, MANAGEMENT, ADMIN] })
  nationalId: string | null;

  // --- Sistem ve Entegrasyon Kaynağı Verileri (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: PartyOriginTypeSchema.options })
  originType: PartyOriginType;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  originId: string | null;

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
