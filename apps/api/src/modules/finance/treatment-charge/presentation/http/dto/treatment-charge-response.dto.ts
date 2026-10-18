import { Expose, Type } from 'class-transformer';
import { TreatmentChargeResponseGroups } from '@modules/finance/treatment-charge/domain/contracts/treatment-charge';

const { INTERNAL, FINANCIAL, MANAGEMENT, ADMIN } =
  TreatmentChargeResponseGroups;

/** "Ne yapıldı" tarafı — randevuyu yürüten klinik personeline açık. */
const OPS = { groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] };
/** Para tarafı — tutar, indirim, KDV. */
const FIN = { groups: [FINANCIAL, MANAGEMENT, ADMIN] };

/**
 * İşlem satırı. Hangi tedavinin kaç adet yapıldığı operasyonel bilgidir; liste
 * fiyatı, indirim ve KDV finansal tier'dadır. İndirimi **kimin onayladığı**
 * yalnız yönetime açıktır — personelin birbirinin indirim yetkisini görmesi
 * gerekmez.
 */
export class TreatmentChargeResponseDto {
  @Expose(OPS) id: string;
  @Expose(OPS) clinicId: string;
  @Expose(OPS) appointmentId: string;
  @Expose(OPS) patientId: string;
  @Expose(OPS) treatmentId: string;
  @Expose(OPS) description: string | null;

  @Expose(OPS)
  @Type(() => String)
  quantity: string;

  // --- Fiyatlandırma (finans) ---
  @Expose(FIN)
  @Type(() => String)
  listPrice: string;

  @Expose(FIN)
  @Type(() => String)
  discountRate: string;

  @Expose(FIN)
  @Type(() => String)
  discountAmount: string;

  @Expose(FIN) discountReason: string | null;

  @Expose(FIN)
  @Type(() => String)
  netAmount: string;

  @Expose(FIN) vatRate: number;

  @Expose(FIN)
  @Type(() => String)
  vatAmount: string;

  @Expose(FIN)
  @Type(() => String)
  grossAmount: string;

  @Expose(FIN) currency: string;

  // --- İptal izi (operasyon görebilmeli: satır neden faturaya girmedi) ---
  @Expose(OPS)
  @Type(() => Date)
  voidedAt: Date | null;

  @Expose(OPS) voidReason: string | null;

  // --- Denetim (yönetim) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  discountApprovedById: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  createdById: string | null;

  @Expose(OPS)
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}

/** Randevunun satır toplamları — faturanın ve tahsilatın dayanağı. */
export class AppointmentChargeSummaryResponseDto {
  @Expose(OPS) appointmentId: string;
  @Expose(OPS) clinicId: string;
  @Expose(OPS) patientId: string;
  @Expose(OPS) lineCount: number;

  @Expose(FIN) currency: string;

  @Expose(FIN)
  @Type(() => String)
  listTotal: string;

  @Expose(FIN)
  @Type(() => String)
  discountTotal: string;

  @Expose(FIN)
  @Type(() => String)
  netTotal: string;

  @Expose(FIN)
  @Type(() => String)
  vatTotal: string;

  @Expose(FIN)
  @Type(() => String)
  grandTotal: string;

  @Expose(FIN) vatRate: number;
}

/** Liste + özet zarfı. */
export class AppointmentChargesResponseDto {
  @Expose(OPS)
  @Type(() => TreatmentChargeResponseDto)
  items: TreatmentChargeResponseDto[];

  @Expose(OPS)
  @Type(() => AppointmentChargeSummaryResponseDto)
  summary: AppointmentChargeSummaryResponseDto | null;
}
