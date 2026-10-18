import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '@common/constants/response-groups.constant';
import { InvoiceStatusType as InvoiceStatus } from '@input-type-schemas/InvoiceStatusSchema';
import { EDocumentTypeType as EDocumentType } from '@input-type-schemas/EDocumentTypeSchema';
import { EDocumentStatusType as EDocumentStatus } from '@input-type-schemas/EDocumentStatusSchema';
import { JsonValueType as JsonValue } from '@input-type-schemas/JsonValueSchema';

const { INTERNAL, MANAGEMENT, FINANCIAL, ADMIN } = ResponseGroups;

export class InvoiceResponseDto {
  @Expose() id: string;
  @Expose() organizationId: string;
  @Expose() clinicId: string;
  @Expose() patientId: string;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  appointmentId: string | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  status: InvoiceStatus;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  invoiceNumber: string | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  issuedAt: Date | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  documentType: EDocumentType | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  einvoiceUuid: string | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  einvoiceStatus: EDocumentStatus;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  cancelledAt: Date | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  cancelReason: string | null;

  /** İptali yapan personel (Firebase UID) — yalnız yönetim/denetim tier'ı. */
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  cancelledById: string | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  paymentId: string | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  currency: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  vatRate: number;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  amount: number;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  netTotal: number;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  vatTotal: number;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  providerRef: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  rawResponse: JsonValue | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  isDeleted: boolean;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}

/**
 * Fatura liste satırı (InvoiceListItem read-model). Fatura no/durum resepsiyonun
 * takip ettiği bilgidir; tutar finans tier'ındadır.
 */
export class InvoiceListItemResponseDto {
  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  id: string;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  clinicId: string;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  patientId: string;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  status: InvoiceStatus;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  invoiceNumber: string | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  issuedAt: Date | null;

  // --- Tutar (finans) ---
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => String)
  grandTotal: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  currency: string;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;
}

/**
 * Fatura detay okuma modeli (InvoiceView). KDV kırılımı tamamen finans tier'ında;
 * resepsiyon yalnız faturanın varlığını/durumunu görür.
 */
export class InvoiceViewResponseDto {
  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  id: string;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  clinicId: string;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  patientId: string;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  status: InvoiceStatus;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  issuedAt: Date | null;

  // İptal izi operasyon tier'ında: resepsiyon da "bu belge iptal edilmiş, neden"
  // sorusunun cevabını görmek zorunda (tutarı görmesi gerekmeden).
  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  cancelledAt: Date | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  cancelReason: string | null;

  // --- KDV kırılımı ve tutarlar (finans) ---
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => String)
  netTotal: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => String)
  vatTotal: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => String)
  grandTotal: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => String)
  vatRate: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  currency: string;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;
}
