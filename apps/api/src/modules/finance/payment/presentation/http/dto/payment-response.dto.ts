import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '@common/constants/response-groups.constant';
import { PaymentStatusType as PaymentStatus } from '@input-type-schemas/PaymentStatusSchema';
import { PaymentMethodType as PaymentMethod } from '@input-type-schemas/PaymentMethodSchema';
import { InstallmentStatusType as InstallmentStatus } from '@input-type-schemas/InstallmentStatusSchema';

const { INTERNAL, MANAGEMENT, FINANCIAL, ADMIN } = ResponseGroups;

export class PaymentInstallmentResponseDto {
  @Expose() id: string;
  @Expose() paymentId: string;
  @Expose() installmentNo: number;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  status: InstallmentStatus;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  method: PaymentMethod;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  note: string | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  dueDate: Date | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  paidAt: Date | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  currency: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  amount: number;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}

export class PaymentResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;
  @Expose() patientId: string;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  appointmentId: string | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  providerId: string | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  status: PaymentStatus;

  // --- Finansal Raporlama ve Limit Bilgileri ---
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  currency: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  totalAmount: number;

  // --- İlişkili Alt Taksit Dağılımı ---
  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => PaymentInstallmentResponseDto)
  installments: PaymentInstallmentResponseDto[];

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}

// ─────────────────── ALACAK YAŞLANDIRMA (AR aging) ───────────────────
// Tahsilat riski tamamen finansal bir görünümdür — tabansız tutulur.

const FIN_ONLY = { groups: [FINANCIAL, MANAGEMENT, ADMIN] };

/**
 * Yaşlandırma kovası — açık taksitlerin vade yaşına göre dağılımı.
 * Kova başına `currency` zorunlu: farklı para birimleri toplanmaz.
 */
export class ArAgingBucketResponseDto {
  @Expose(FIN_ONLY) label: string;
  @Expose(FIN_ONLY) currency: string;
  @Expose(FIN_ONLY) count: number;
  @Expose(FIN_ONLY) amount: string;
}

/** Hasta bazlı açık taksit riski. */
export class ArAgingPatientRiskResponseDto {
  @Expose(FIN_ONLY) patientId: string;
  @Expose(FIN_ONLY) currency: string;
  @Expose(FIN_ONLY) outstanding: string;
  @Expose(FIN_ONLY) overdue: string;

  @Expose(FIN_ONLY)
  @Type(() => Date)
  oldestDueDate: Date | null;
}

export class ArAgingSummaryResponseDto {
  @Expose(FIN_ONLY) currency: string;
  @Expose(FIN_ONLY) totalOutstanding: string;
  @Expose(FIN_ONLY) totalOverdue: string;
  @Expose(FIN_ONLY) totalCollected: string;
  @Expose(FIN_ONLY) collectionRate: string;
}

export class ArAgingReportResponseDto {
  @Expose(FIN_ONLY) clinicId: string;

  @Expose(FIN_ONLY)
  @Type(() => Date)
  asOf: Date;

  @Expose(FIN_ONLY)
  @Type(() => ArAgingBucketResponseDto)
  buckets: ArAgingBucketResponseDto[];

  @Expose(FIN_ONLY)
  @Type(() => ArAgingPatientRiskResponseDto)
  patients: ArAgingPatientRiskResponseDto[];

  @Expose(FIN_ONLY)
  @Type(() => ArAgingSummaryResponseDto)
  summaries: ArAgingSummaryResponseDto[];
}

// ─────────────────────── HEKİM BAZINDA CİRO ──────────────────────────

/** Hekim bazında tahsil edilmiş ciro satırı (hekim + para birimi). */
export class ProviderRevenueLineResponseDto {
  @Expose(FIN_ONLY) providerId: string | null;
  @Expose(FIN_ONLY) currency: string;
  @Expose(FIN_ONLY) collected: string;
  @Expose(FIN_ONLY) count: number;
}

/** Para birimi başına genel toplam. */
export class ProviderRevenueTotalResponseDto {
  @Expose(FIN_ONLY) currency: string;
  @Expose(FIN_ONLY) collected: string;
}

export class ProviderRevenueReportResponseDto {
  @Expose(FIN_ONLY) clinicId: string;

  @Expose(FIN_ONLY)
  @Type(() => Date)
  dateFrom: Date | null;

  @Expose(FIN_ONLY)
  @Type(() => Date)
  dateTo: Date | null;

  @Expose(FIN_ONLY)
  @Type(() => ProviderRevenueLineResponseDto)
  lines: ProviderRevenueLineResponseDto[];

  @Expose(FIN_ONLY)
  @Type(() => ProviderRevenueTotalResponseDto)
  totals: ProviderRevenueTotalResponseDto[];
}
