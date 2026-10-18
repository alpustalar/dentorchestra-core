// Barrel'dan DEĞİL: barrel yaprak NestJS modülünü ve uyarı yayıncısına bağlı
// servisi de dışa açıyor; sözleşme dosyası yalnız TİPE bağımlı kalmalı.
import { QuoteOptionOwner } from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option.contracts';
// ==========================================
// SORGULAMA SÖZLEŞMELERİ (FILTERS)
// ==========================================

export interface FindTransferBookingsFilter {
  organizationId: string;
  clinicId?: string;
  patientId?: string;
  leadId?: string; // Sağlık turizmi CRM potansiyel hasta referansı
}

// ==========================================
// AI RATE-OPTION TOKEN (kısa optionId → HotelBeds transfer bağlamı)
// ==========================================

/**
 * `search_transfers`'in cache'e yazdığı, `book_transfer`'in optionId ile çözdüğü bağlam.
 * AI kısa bir optionId sunar; gerçek rateKey + yön/fiyat burada saklanır.
 */
export interface TransferRateOptionToken {
  /**
   * Teklifi üreten kiracı + görüşme. Okuma anında **doğrulanır**: önbellek
   * anahtarını bilmek teklifi kullanma yetkisi vermez
   * (`QuoteOptionOwnershipService`).
   */
  owner: QuoteOptionOwner;

  rateKey: string;
  direction: 'ARRIVAL' | 'DEPARTURE';
  vehicleName: string;
  categoryName: string;
  totalAmount: number;
  currency: string;
  fromCode: string;
  toCode: string;
}
