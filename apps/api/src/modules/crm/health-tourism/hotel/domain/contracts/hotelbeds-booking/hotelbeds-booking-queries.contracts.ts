// Barrel'dan DEĞİL: barrel yaprak NestJS modülünü ve uyarı yayıncısına bağlı
// servisi de dışa açıyor; sözleşme dosyası yalnız TİPE bağımlı kalmalı.
import { QuoteOptionOwner } from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option.contracts';
// ==========================================
// FİLTRELER
// ==========================================

export interface FindHotelBookingsFilter {
  organizationId: string;
  patientId?: string;
  leadId?: string;
}

// ==========================================
// YARDIMCI TİPLER (availability arama sonuçları)
// ==========================================

export interface CancellationPolicy {
  amount: string;
  from: string;
}

export interface HotelRate {
  rateKey: string;
  rateType: 'BOOKABLE' | 'RECHECK';
  net: number;
  currency: string;
  boardCode: string;
  boardName?: string;
  rooms: number;
  adults: number;
  children: number;
  cancellationPolicies?: CancellationPolicy[];
}

export interface HotelRoomOption {
  code: string;
  name?: string;
  rates: HotelRate[];
}

/** Otel arama (availability) sonucu — HotelBeds entegrasyonundan gelen okuma modeli. */
export interface HotelAvailabilityItem {
  code: string;
  name: string;
  categoryCode?: string;
  categoryName?: string;
  destinationCode?: string;
  destinationName?: string;
  latitude?: number;
  longitude?: number;
  currency: string;
  minRate: number;
  maxRate: number;
  rooms: HotelRoomOption[];
}

// ==========================================
// AI RATE-OPTION TOKEN (kısa optionId → HotelBeds rezervasyon bağlamı)
// ==========================================

/**
 * `search_hotels`'in cache'e yazdığı, `book_hotel`'in optionId ile çözdüğü rezervasyon
 * bağlamı. AI kısa bir optionId sunar; gerçek rateKey + fiyat/tarih burada saklanır.
 */
export interface HotelRateOptionToken {
  /**
   * Teklifi üreten kiracı + görüşme. Okuma anında **doğrulanır**: önbellek
   * anahtarını bilmek teklifi kullanma yetkisi vermez
   * (`QuoteOptionOwnershipService`).
   */
  owner: QuoteOptionOwner;

  hotelCode: string;
  hotelName: string;
  roomName: string;
  boardName: string;
  rateKey: string;
  checkIn: string;
  checkOut: string;
  net: number;
  currency: string;
  adults: number;
  children: number;
}
