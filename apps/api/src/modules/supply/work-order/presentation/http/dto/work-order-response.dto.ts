import { ApiProperty } from '@nestjs/swagger';
import { Expose, ExposeOptions, Type } from 'class-transformer';
import { ExternalWorkOrderStatusType, ExternalWorkOrderStatusSchema } from '@input-type-schemas/ExternalWorkOrderStatusSchema';
import { ResponseGroups } from '@common/constants';

const OPS: ExposeOptions = {
  groups: [ResponseGroups.INTERNAL, ResponseGroups.ADMIN],
};

export class ExternalWorkOrderItemResponseDto {
  @Expose(OPS) id: string;
  @Expose(OPS) workOrderId: string;
  @Expose(OPS) description: string;

  @Expose(OPS)
  @Type(() => String)
  quantity: string;

  @Expose(OPS) specs: unknown;

  @Expose(OPS)
  @Type(() => String)
  unitCost: string | null;
}

/**
 * Dış iş emri. Termin/durum takibi klinik içi; **anlaşılan ve gerçekleşen
 * maliyet** tedarikçi pazarlığıdır — yalnız finans/yönetim görür.
 */
export class ExternalWorkOrderResponseDto {
  @Expose(OPS) id: string;
  @Expose(OPS) clinicId: string;
  @Expose(OPS) supplierId: string;
  @Expose(OPS) patientId: string | null;
  @Expose(OPS) treatmentId: string | null;
  @Expose(OPS) providerId: string | null;
  @Expose(OPS) referenceNo: string | null;
  @ApiProperty({ enum: ExternalWorkOrderStatusSchema.options })
  @Expose(OPS) status: ExternalWorkOrderStatusType;

  @Expose(OPS)
  @Type(() => Date)
  sentAt: Date | null;

  @Expose(OPS)
  @Type(() => Date)
  dueDate: Date | null;

  @Expose(OPS)
  @Type(() => Date)
  receivedAt: Date | null;

  @Expose(OPS)
  @Type(() => Date)
  fittedAt: Date | null;

  @Expose(OPS)
  @Type(() => Date)
  cancelledAt: Date | null;

  @Expose(OPS) cancelReason: string | null;
  @Expose(OPS) remakeOfId: string | null;
  @Expose(OPS) remakeReason: string | null;
  @Expose(OPS) note: string | null;

  @Expose(OPS)
  @Type(() => ExternalWorkOrderItemResponseDto)
  items?: ExternalWorkOrderItemResponseDto[];

  // --- Tedarikçi maliyeti (finans) ---
  @Expose(OPS)
  @Type(() => String)
  agreedCost: string | null;

  @Expose(OPS)
  @Type(() => String)
  actualCost: string | null;

  @Expose(OPS) currency: string;

  @Expose(OPS)
  overdueNotifiedAt: Date | null;

  @Expose(OPS)
  organizationId: string;

  @Expose(OPS)
  createdById: string | null;

  @Expose(OPS)
  @Type(() => Date)
  createdAt: Date;
}

/** Durum bazlı iş emri sayacı + geciken adedi (takip panosu başlıkları). */
export class WorkOrderSummaryResponseDto {
  @Expose(OPS) byStatus: Record<string, number>;
  @Expose(OPS) overdueCount: number;
}
