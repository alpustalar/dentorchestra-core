import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { PurchaseRequestStatusType, PurchaseRequestStatusSchema } from '@input-type-schemas/PurchaseRequestStatusSchema';
import { PurchaseOrderStatusType, PurchaseOrderStatusSchema } from '@input-type-schemas/PurchaseOrderStatusSchema';
import { PurchaseOrderBillingStatusType, PurchaseOrderBillingStatusSchema } from '@input-type-schemas/PurchaseOrderBillingStatusSchema';

const { INTERNAL, FINANCIAL, MANAGEMENT, ADMIN } = ResponseGroups;

/** Talebi açan/karşılayan klinik personeli kalemleri ve durumu görebilir. */
const OPS = { groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] };
/** Fiyat/tutar — satın alma bütçesi, finans ve yönetim. */
const FIN = { groups: [FINANCIAL, MANAGEMENT, ADMIN] };

/**
 * Satın alma talebi kalemi. Ne istendiği depo personeline açık; tahmini birim
 * fiyat bütçe verisidir.
 */
export class PurchaseRequestItemResponseDto {
  @Expose(OPS) id: string;
  @Expose(OPS) requestId: string;
  @Expose(OPS) productId: string | null;
  @Expose(OPS) description: string;
  @Expose(OPS) unit: string | null;

  @Expose(OPS)
  @Type(() => String)
  quantity: string;

  @Expose(FIN)
  @Type(() => String)
  estimatedUnitPrice: string | null;
}

/** Satın alma talebi (PR). Onay değerlendirmesi yönetime özeldir. */
export class PurchaseRequestResponseDto {
  @Expose(OPS) id: string;
  @Expose(OPS) clinicId: string;
  @ApiProperty({ enum: PurchaseRequestStatusSchema.options })
  @Expose(OPS) status: PurchaseRequestStatusType;
  @Expose(OPS) requestedById: string;

  @Expose(OPS)
  @Type(() => Date)
  neededBy: Date | null;

  @Expose(OPS) note: string | null;

  @Expose(OPS)
  @Type(() => PurchaseRequestItemResponseDto)
  items?: PurchaseRequestItemResponseDto[];

  // --- Onay değerlendirmesi (yönetim) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  reviewedById: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  reviewedAt: Date | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  reviewNote: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;

  @Expose(OPS)
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}

/**
 * Sipariş kalemi. Sipariş/teslim miktarı mal kabul yapan personelin işidir;
 * birim fiyat ve satır tutarları finans tier'ındadır.
 */
export class PurchaseOrderItemResponseDto {
  @Expose(OPS) id: string;
  @Expose(OPS) orderId: string;
  @Expose(OPS) productId: string | null;
  @Expose(OPS) description: string;

  @Expose(OPS)
  @Type(() => String)
  quantityOrdered: string;

  @Expose(OPS)
  @Type(() => String)
  quantityReceived: string;

  // --- Fiyatlandırma (finans) ---
  @Expose(FIN)
  @Type(() => String)
  unitPrice: string;

  @Expose(FIN) vatRate: number;

  @Expose(FIN)
  @Type(() => String)
  lineNet: string;

  @Expose(FIN)
  @Type(() => String)
  lineVat: string;

  @Expose(FIN)
  @Type(() => String)
  lineTotal: string;
}

/** Satın alma siparişi (PO). Toplamlar finans tier'ında. */
export class PurchaseOrderResponseDto {
  @Expose(OPS) id: string;
  @Expose(OPS) clinicId: string;
  @Expose(OPS) supplierId: string;
  @Expose(OPS) purchaseRequestId: string | null;
  @ApiProperty({ enum: PurchaseOrderStatusSchema.options })
  @Expose(OPS) status: PurchaseOrderStatusType;

  @Expose(OPS)
  @Type(() => Date)
  orderDate: Date;

  @Expose(OPS)
  @Type(() => Date)
  expectedDate: Date | null;

  @Expose(OPS) note: string | null;

  @Expose(OPS)
  @Type(() => PurchaseOrderItemResponseDto)
  items?: PurchaseOrderItemResponseDto[];

  // --- Tutarlar (finans) ---
  @Expose(FIN) currency: string;

  @Expose(FIN)
  @Type(() => String)
  netTotal: string;

  @Expose(FIN)
  @Type(() => String)
  vatTotal: string;

  @Expose(FIN)
  @Type(() => String)
  grandTotal: string;

  /** Faturalanan tutar finans verisidir; eşleştirme durumu operasyona da açık. */
  @Expose(FIN)
  @Type(() => String)
  invoicedTotal: string;

  @ApiProperty({ enum: PurchaseOrderBillingStatusSchema.options })
  @Expose(OPS) billingStatus: PurchaseOrderBillingStatusType;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;

  @Expose(OPS)
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
