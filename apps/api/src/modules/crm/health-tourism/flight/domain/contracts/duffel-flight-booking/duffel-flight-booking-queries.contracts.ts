import { CurrencyType } from '@input-type-schemas/CurrencySchema';
// Barrel'dan DEĞİL: barrel yaprak NestJS modülünü ve uyarı yayıncısına bağlı
// servisi de dışa açıyor; sözleşme dosyası yalnız TİPE bağımlı kalmalı.
import { QuoteOptionOwner } from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option.contracts';

// ==========================================
// OKUMA MODELLERİ (READ MODELS)
// ==========================================

/** Bir uçuş bacağındaki tek segment (aktarmalı uçuşta birden çok olur). */
export interface FlightSegment {
  originIata: string;
  originName: string | null;
  destinationIata: string;
  destinationName: string | null;
  /** ISO 8601, havalimanının yerel saatinde. */
  departingAt: string;
  arrivingAt: string;
  /** Taşıyıcı IATA kodu (ör. "TK"). */
  carrierIata: string;
  carrierName: string;
  /** Uçuş numarası (ör. "1988") — transfer akışı bunu kullanır. */
  flightNumber: string | null;
}

/** Gidiş (ve varsa dönüş) bacağı. */
export interface FlightSlice {
  originIata: string;
  destinationIata: string;
  /** Dakika cinsinden toplam süre; Duffel vermezse null. */
  durationMinutes: number | null;
  segments: FlightSegment[];
}

/** Aramadan dönen tek teklif — Duffel `Offer`'ının domain karşılığı. */
export interface FlightOffer {
  offerId: string;
  totalAmount: number;
  currency: CurrencyType;
  /** Teklifin Duffel'da bayatlayacağı an; cache TTL'i buradan hesaplanır. */
  expiresAt: string;
  /**
   * `false` ise koltuk "hold" ile tutulup sonra ödenebilir (hibrit akışın hold ayağı).
   * `true` ise sipariş yalnız ödemeyle birlikte açılabilir.
   */
  requiresInstantPayment: boolean;
  /** Hold yolunda ödemenin yapılması gereken son an; instant tekliflerde null. */
  paymentRequiredBy: string | null;
  /** Doluysa havayolu fiyatı bu ana kadar garantiliyor. */
  priceGuaranteeExpiresAt: string | null;
  ownerName: string;
  ownerIata: string;
  slices: FlightSlice[];
}

/**
 * Arama ile rezervasyon arasında Redis'te taşınan teklif token'ı. LLM'e yalnız kısa
 * `optionId` verilir; Duffel `offerId`'si buraya mühürlenir ve modele hiç gösterilmez
 * (otel `rateKey` / transfer `rateKey` kuralının aynısı).
 */
export interface FlightOfferToken {
  /**
   * Teklifi üreten kiracı + görüşme. Okuma anında **doğrulanır**: önbellek
   * anahtarını bilmek teklifi kullanma yetkisi vermez
   * (`QuoteOptionOwnershipService`).
   */
  owner: QuoteOptionOwner;

  offerId: string;
  totalAmount: number;
  currency: CurrencyType;
  requiresInstantPayment: boolean;
  paymentRequiredBy: string | null;
  expiresAt: string;
  ownerName: string;
  /** Özet metin — ödeme linki açıklamasında ve AI cevabında kullanılır. */
  summary: string;
  originIata: string;
  destinationIata: string;
  departingAt: string;
  slices: FlightSlice[];
}

/** Rezervasyon listeleme filtresi. */
export interface FindFlightBookingsFilter {
  organizationId: string;
  clinicId?: string;
  patientId?: string;
  leadId?: string;
}
