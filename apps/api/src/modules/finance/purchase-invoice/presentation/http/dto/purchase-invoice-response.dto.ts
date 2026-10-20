import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { CurrencyType, CurrencySchema } from '@input-type-schemas/CurrencySchema';
import { PurchaseInvoiceStatusType, PurchaseInvoiceStatusSchema } from '@input-type-schemas/PurchaseInvoiceStatusSchema';

const { INTERNAL, MANAGEMENT, FINANCIAL, ADMIN } = ResponseGroups;

export class PurchaseInvoiceResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;
  @Expose() organizationId: string;
  @Expose() supplierId: string;

  // --- Genel Fatura Detayları (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  invoiceNumber: string | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  invoiceDate: Date;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: PurchaseInvoiceStatusSchema.options })
  status: PurchaseInvoiceStatusType;

  /** Eşleştirildiği satın alma siparişi — null ise serbest fatura. */
  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  purchaseOrderId: string | null;

  // --- Muhasebe Kodlama ve Finansal Tutarlar (Sadece Finans, Yönetim ve Admin) ---
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  lineAccountCode: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: CurrencySchema.options })
  currency: CurrencyType;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  vatRate: number;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  netTotal: number;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  vatTotal: number;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  grandTotal: number;

  // --- İptal İzi ---
  /**
   * `status = CANCELLED` belgenin hükümsüz olduğunu söyler; "ne zaman, neden"
   * sorusunun cevabı burada. İptal edilmemiş faturada ikisi de null.
   */
  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  cancelledAt: Date | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  cancelReason: string | null;

  /** İptali yapan personel (Firebase UID) — yönetim/denetim tier'ı. */
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  cancelledById: string | null;

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
