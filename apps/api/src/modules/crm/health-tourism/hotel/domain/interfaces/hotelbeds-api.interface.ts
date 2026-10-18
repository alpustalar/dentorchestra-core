import { HotelAvailabilityItem } from '@modules/crm/health-tourism/hotel/domain/contracts';

export const HOTELBEDS_API_SERVICE = Symbol('IHotelbedsApiService');

export interface HotelSearchParams {
  checkIn: string;
  checkOut: string;
  occupancies: Array<{ rooms: number; adults: number; children: number }>;
  destinationCode?: string;
  hotelCodes?: string[];
}

export interface CheckRateResult {
  rateKey: string;
  net: number;
  currency: string;
  boardCode: string;
  rateComments?: string;
}

export interface HotelbedsBookingRoom {
  rateKey: string;
  paxes: Array<{
    roomId: number;
    type: 'AD' | 'CH';
    name: string;
    surname: string;
    age?: number;
  }>;
}

export interface CreateHotelbedsBookingParams {
  holderName: string;
  holderSurname: string;
  rooms: HotelbedsBookingRoom[];
  clientReference: string;
  remarks?: string;
  tolerance?: number;
}

export interface HotelbedsBookingResult {
  reference: string;
  hotelCode: string;
  checkIn: string;
  checkOut: string;
  totalNet: number;
  currency: string;
  status: string;
  holderName: string;
  holderSurname: string;
  rooms: unknown;
}

export interface HotelContentItem {
  code: string;
  name: { content: string }[];
  category?: { code: string; description?: { content: string }[] };
  destinationCode: string;
  destinationName?: { content: string }[];
  coordinates?: { longitude: number; latitude: number };
  address?: { content: string };
  images?: unknown[];
  phones?: unknown[];
}

/**
 * Otel iptalinin sonucu. `retainedAmount === null` → sağlayıcının alıkoyduğu
 * ceza **bilinmiyor** (0 ile aynı şey değil; bkz. adapter notu). Para birimi
 * yalnız tutar varsa anlamlıdır.
 */
export interface CancelHotelBookingResult {
  reference: string;
  retainedAmount: number | null;
  currency: string | null;
}

export interface IHotelbedsApiService {
  searchAvailability(
    params: HotelSearchParams
  ): Promise<HotelAvailabilityItem[]>;
  checkRate(rateKey: string): Promise<CheckRateResult>;
  createBooking(
    params: CreateHotelbedsBookingParams
  ): Promise<HotelbedsBookingResult>;
  cancelBooking(reference: string): Promise<CancelHotelBookingResult>;
  getHotelContent(params: {
    countryCode: string;
    from: number;
    to: number;
  }): Promise<{
    items: HotelContentItem[];
    total: number;
  }>;
}
