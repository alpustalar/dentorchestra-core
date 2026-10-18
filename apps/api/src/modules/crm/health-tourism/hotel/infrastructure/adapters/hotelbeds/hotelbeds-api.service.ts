import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CancelHotelBookingResult,
  CheckRateResult,
  CreateHotelbedsBookingParams,
  HotelbedsBookingResult,
  HotelContentItem,
  HotelSearchParams,
  IHotelbedsApiService,
} from '@modules/crm/health-tourism/hotel/domain/interfaces/hotelbeds-api.interface';
import { ENV } from '@common/constants/env.constant';
import { HotelAvailabilityItem } from '@modules/crm/health-tourism/hotel/domain/contracts';

const HOTELS_API_BASE = 'https://api.hotelbeds.com/hotel-api/1.0';
const CONTENT_API_BASE = 'https://api.hotelbeds.com/hotel-content-api/1.0';

@Injectable()
export class HotelbedsApiService implements IHotelbedsApiService {
  private readonly logger = new Logger(HotelbedsApiService.name);
  private readonly apiKey: string;
  private readonly secret: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.getOrThrow<string>(ENV.HOTELBEDS_HOTEL_API_KEY);
    this.secret = this.config.getOrThrow<string>(ENV.HOTELBEDS_HOTEL_SECRET);
  }

  async searchAvailability(
    params: HotelSearchParams
  ): Promise<HotelAvailabilityItem[]> {
    const body = {
      stay: {
        checkIn: this.formatDate(params.checkIn),
        checkOut: this.formatDate(params.checkOut),
      },
      occupancies: params.occupancies,
      ...(params.destinationCode
        ? { destination: { code: params.destinationCode } }
        : {}),
      ...(params.hotelCodes?.length
        ? { hotels: { hotel: params.hotelCodes.map(Number) } }
        : {}),
      filter: { minCategory: 1, maxCategory: 5 },
    };

    const res = await fetch(`${HOTELS_API_BASE}/hotels`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Hotelbeds availability hatası: ${res.status} ${err}`);
    }

    const json = (await res.json()) as {
      hotels?: { hotels?: RawHotelResult[] };
    };
    return (json.hotels?.hotels ?? []).map(mapHotelToAvailability);
  }

  async checkRate(rateKey: string): Promise<CheckRateResult> {
    const res = await fetch(`${HOTELS_API_BASE}/checkrates`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ rooms: [{ rateKey }] }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Hotelbeds checkRate hatası: ${res.status} ${err}`);
    }

    const json = (await res.json()) as {
      hotel?: { rooms?: RawRoom[] };
      currency?: string;
    };
    const room = json.hotel?.rooms?.[0];
    const rate = room?.rates?.[0];

    if (!rate) throw new Error('CheckRate sonucu boş geldi.');

    return {
      rateKey: rate.rateKey,
      net: parseFloat(rate.net),
      currency: json.currency ?? 'USD',
      boardCode: rate.boardCode,
      rateComments: rate.rateComments,
    };
  }

  async createBooking(
    params: CreateHotelbedsBookingParams
  ): Promise<HotelbedsBookingResult> {
    const body = {
      holder: { name: params.holderName, surname: params.holderSurname },
      rooms: params.rooms,
      clientReference: params.clientReference,
      ...(params.remarks ? { remark: params.remarks } : {}),
      ...(params.tolerance ? { tolerance: params.tolerance } : {}),
    };

    const res = await fetch(`${HOTELS_API_BASE}/bookings`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Hotelbeds booking hatası: ${res.status} ${err}`);
    }

    const json = (await res.json()) as { booking?: RawBooking };
    const booking = json.booking;
    if (!booking) throw new Error('Booking yanıtı boş.');

    return {
      reference: booking.reference,
      hotelCode: String(booking.hotel?.code ?? ''),
      checkIn: booking.hotel?.checkIn ?? '',
      checkOut: booking.hotel?.checkOut ?? '',
      // `?? '0'` YOK: sağlayıcı ücretlendirdiği tutarı bildirmediyse maliyet
      // BİLİNMİYOR demektir, sıfır değil. NaN entity kapısında durur (`Money` +
      // pozitiflik); sıfır o kapıdan geçerdi ve defterdeki tedarikçi borcunu
      // sıfırlayıp komisyonu satışın tamamı gibi gösterirdi.
      totalNet: parseFloat(booking.totalNet as string),
      currency: booking.currency ?? 'USD',
      status: booking.status ?? 'CONFIRMED',
      holderName: booking.holder?.name ?? '',
      holderSurname: booking.holder?.surname ?? '',
      rooms: booking.hotel?.rooms ?? [],
    };
  }

  /**
   * Rezervasyonu iptal eder ve sağlayıcı referansını döner.
   *
   * **İptal cezası bilinçli olarak OKUNMUYOR.** Yanıt gövdesinde iptal edilmiş
   * rezervasyonun `totalNet`/`pendingAmount` alanları geliyor ama bu alanların
   * iptal sonrası semantiği (kalan ceza mı, orijinal tutar mı) canlı/sandbox
   * yanıtına karşı **doğrulanmadı**. Yanlış yorum pahalıya patlar: orijinal
   * tutarı ceza sanmak, her iptalde maliyetin tamamını zarar (689) yazıp
   * tedarikçi borcunu (320) hiç düşürmemek demektir. Bu yüzden ceza "bilinmiyor"
   * olarak taşınır; iade akışı cezasız ters kayıt yazar ve farkı alarmla
   * duyurur (transferde alan `cancellationAmount` adıyla geldiği için okunuyor).
   *
   * Doğrulandığında değişiklik tek satırdır: yanıt gövdesi parse edilip
   * `retained` doldurulur.
   */
  async cancelBooking(reference: string): Promise<CancelHotelBookingResult> {
    const res = await fetch(
      `${HOTELS_API_BASE}/bookings/${reference}?cancellationFlag=CANCELLATION`,
      {
        method: 'DELETE',
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Hotelbeds iptal hatası: ${res.status} ${err}`);
    }

    return { reference, retainedAmount: null, currency: null };
  }

  async getHotelContent(params: {
    countryCode: string;
    from: number;
    to: number;
  }): Promise<{ items: HotelContentItem[]; total: number }> {
    const query = new URLSearchParams({
      countryCode: params.countryCode,
      fields:
        'code,name,categoryCode,categoryName,destinationCode,destinationName,coordinates,address,images,phones',
      language: 'ENG',
      from: String(params.from),
      to: String(params.to),
    });

    const res = await fetch(`${CONTENT_API_BASE}/hotels?${query}`, {
      headers: this.buildHeaders(),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Hotelbeds content hatası: ${res.status} ${err}`);
    }

    const json = (await res.json()) as {
      hotels?: HotelContentItem[];
      total?: number;
    };
    return {
      items: json.hotels ?? [],
      total: json.total ?? 0,
    };
  }

  private buildHeaders(): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHash('sha256')
      .update(this.apiKey + this.secret + timestamp)
      .digest('hex');

    return {
      'Api-key': this.apiKey,
      'X-Signature': signature,
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'Content-Type': 'application/json',
    };
  }

  private formatDate(date: string): string {
    return date.split('T')[0];
  }
}

// ─── Raw response types (Hotelbeds API shape) ─────────────────────────────────

interface RawRate {
  rateKey: string;
  rateType: string;
  net: string;
  boardCode: string;
  boardName?: string;
  rooms: number;
  adults: number;
  children: number;
  cancellationPolicies?: { amount: string; from: string }[];
  rateComments?: string;
}

interface RawRoom {
  code: string;
  name?: string;
  rates?: RawRate[];
}

interface RawHotelResult {
  code: number;
  name?: string;
  categoryCode?: string;
  categoryName?: string;
  destinationCode?: string;
  destinationName?: string;
  latitude?: number;
  longitude?: number;
  currency?: string;
  minRate?: string;
  maxRate?: string;
  rooms?: RawRoom[];
}

interface RawBooking {
  reference: string;
  status?: string;
  totalNet?: string;
  currency?: string;
  holder?: { name: string; surname: string };
  hotel?: {
    code?: number;
    checkIn?: string;
    checkOut?: string;
    rooms?: unknown;
  };
}

function mapHotelToAvailability(raw: RawHotelResult): HotelAvailabilityItem {
  return {
    code: String(raw.code),
    name: raw.name ?? '',
    categoryCode: raw.categoryCode,
    categoryName: raw.categoryName,
    destinationCode: raw.destinationCode,
    destinationName: raw.destinationName,
    latitude: raw.latitude,
    longitude: raw.longitude,
    currency: raw.currency ?? 'USD',
    minRate: parseFloat(raw.minRate ?? '0'),
    maxRate: parseFloat(raw.maxRate ?? '0'),
    rooms: (raw.rooms ?? []).map((room) => ({
      code: room.code,
      name: room.name,
      rates: (room.rates ?? []).map((r) => ({
        rateKey: r.rateKey,
        rateType: r.rateType as 'BOOKABLE' | 'RECHECK',
        net: parseFloat(r.net),
        currency: raw.currency ?? 'USD',
        boardCode: r.boardCode,
        boardName: r.boardName,
        rooms: r.rooms,
        adults: r.adults,
        children: r.children,
        cancellationPolicies: r.cancellationPolicies,
      })),
    })),
  };
}
