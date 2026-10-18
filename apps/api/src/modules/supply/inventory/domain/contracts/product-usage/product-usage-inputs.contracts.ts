import { Quantity } from '@src/domain/value-objects/quantity.vo';

/**
 * Malzeme tüketim kaydı girişi. Tüketimin **neden** yapıldığını (hangi randevu,
 * hangi parti) taşıyan tek kayıt budur: stok hareketi yalnız miktarı ve maliyeti
 * tutar, randevu bağını tutmaz.
 */
export interface CreateProductUsageProps {
  id?: string;
  productId: string;
  clinicId: string;
  batchId?: string | null;
  appointmentId?: string | null;
  usedByProviderId?: string | null;
  quantity: Quantity;
  /** Tüketimle aynı anda yazılan stok hareketinin kimliği (izlenebilirlik). */
  stockMovementId?: string | null;
  notes?: string | null;
}
