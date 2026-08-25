import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Duffel } from '@duffel/api';
import type {
  CreateOfferRequestSlice,
  Offer,
  OfferSlice,
  OfferSliceSegment,
} from '@duffel/api/types';

/**
 * `offerRequests.create` teklifleri `available_services` alanı olmadan döndürür;
 * `offers.get` tam `Offer` verir. Eşleyici ikisini de yutabilsin diye gevşek tip.
 */
type MappableOffer = Omit<Offer, 'available_services'>;
import { ENV } from '@common/constants/env.constant';
import {
  CurrencySchema,
  CurrencyType,
} from '@input-type-schemas/CurrencySchema';
import {
  CreateFlightOrderParams,
  FlightCancellationResult,
  FlightOrderResult,
  FlightSearchParams,
  IDuffelApiService,
} from '@modules/crm/health-tourism/flight/domain/interfaces/duffel-api.interface';
import type {
  FlightOffer,
  FlightSegment,
  FlightSlice,
} from '@modules/crm/health-tourism/flight/domain/contracts';
import {
  DuffelApiException,
  DuffelCredentialsMissingException,
} from '@modules/crm/health-tourism/flight/domain/exceptions/duffel-flight.exceptions';
import type { FlightPassenger } from '@shared/modules/health-tourism/types/commands';

/** Sistemin taşıyabildiği para birimleri; dışındaki teklifler elenir. */
const SUPPORTED_CURRENCIES = CurrencySchema.options;

/** Aramada dönecek azami teklif sayısı — LLM'e verilecek liste zaten kısaltılıyor. */
const MAX_OFFERS = 50;

@Injectable()
export class DuffelApiService implements IDuffelApiService {
  private readonly logger = new Logger(DuffelApiService.name);
  private client: Duffel | null = null;

  constructor(private readonly config: ConfigService) {}

  /**
   * Tembel istemci: token yoksa uygulama açılışında değil, ilk uçuş çağrısında
   * patlar. Böylece Duffel hesabı olmayan bir kurulumda geri kalan her şey çalışır.
   */
  private get duffel(): Duffel {
    if (this.client) return this.client;

    const token = this.config.get<string>(ENV.DUFFEL_ACCESS_TOKEN);
    if (!token) throw new DuffelCredentialsMissingException();

    this.client = new Duffel({ token });
    return this.client;
  }

  async searchOffers(params: FlightSearchParams): Promise<FlightOffer[]> {
    // `arrival_time` / `departure_time` Duffel'da zorunlu ama nullable: saat aralığı
    // filtresi uygulamıyoruz, gün boyu tüm teklifler gelsin.
    const slices: CreateOfferRequestSlice[] = [
      {
        origin: params.originIata,
        destination: params.destinationIata,
        departure_date: params.departureDate,
        arrival_time: null,
        departure_time: null,
      },
    ];

    if (params.returnDate) {
      slices.push({
        origin: params.destinationIata,
        destination: params.originIata,
        departure_date: params.returnDate,
        arrival_time: null,
        departure_time: null,
      });
    }

    const response = await this.call('searchOffers', () =>
      this.duffel.offerRequests.create({
        slices,
        passengers: buildSearchPassengers(params),
        cabin_class: params.cabinClass,
        return_offers: true,
      })
    );

    const rawOffers = response.data.offers ?? [];
    const mapped: FlightOffer[] = [];

    for (const offer of rawOffers.slice(0, MAX_OFFERS)) {
      const currency = toSupportedCurrency(offer.total_currency);
      // Desteklenmeyen para birimi sessizce TRY'ye yazılmaz; teklif listeden düşer.
      if (!currency) continue;
      mapped.push(mapOfferToDomain(offer, currency));
    }

    if (rawOffers.length > 0 && mapped.length === 0) {
      this.logger.warn(
        `Duffel ${rawOffers.length} teklif döndürdü ama hiçbiri desteklenen para biriminde değil (${SUPPORTED_CURRENCIES.join('/')}).`
      );
    }

    return mapped;
  }

  async getOffer(offerId: string): Promise<FlightOffer | null> {
    try {
      const response = await this.duffel.offers.get(offerId);
      const currency = toSupportedCurrency(response.data.total_currency);
      if (!currency) return null;
      return mapOfferToDomain(response.data, currency);
    } catch (error) {
      // Bayatlamış/silinmiş teklif 404 döner — bu bir hata değil, "yok" cevabıdır.
      if (isNotFound(error)) return null;
      throw new DuffelApiException('getOffer', extractMessage(error));
    }
  }

  async createHoldOrder(
    params: CreateFlightOrderParams
  ): Promise<FlightOrderResult> {
    const response = await this.call('createHoldOrder', () =>
      this.duffel.orders.create({
        type: 'pay_later',
        selected_offers: [params.offerId],
        passengers: buildOrderPassengers(params),
        metadata: params.metadata,
      })
    );

    return mapOrderToResult(response.data);
  }

  async createInstantOrder(
    params: CreateFlightOrderParams
  ): Promise<FlightOrderResult> {
    // Instant siparişte ödeme gövdeyle birlikte gider; tutar teklifin tam tutarıdır.
    const offer = await this.getOffer(params.offerId);
    if (!offer)
      throw new DuffelApiException(
        'createInstantOrder',
        'Teklif bulunamadı veya süresi doldu.'
      );

    const response = await this.call('createInstantOrder', () =>
      this.duffel.orders.create({
        type: 'instant',
        selected_offers: [params.offerId],
        passengers: buildOrderPassengers(params),
        payments: [
          {
            type: 'balance',
            amount: offer.totalAmount.toFixed(2),
            currency: offer.currency,
          },
        ],
        metadata: params.metadata,
      })
    );

    return mapOrderToResult(response.data);
  }

  async payOrder(params: {
    orderId: string;
    amount: string;
    currency: string;
  }): Promise<void> {
    await this.call('payOrder', () =>
      this.duffel.payments.create({
        order_id: params.orderId,
        payment: {
          type: 'balance',
          amount: params.amount,
          currency: params.currency,
        },
      })
    );
  }

  async cancelOrder(orderId: string): Promise<FlightCancellationResult> {
    // Duffel'da iptal iki adımdır: önce iptal talebi açılır, sonra onaylanır.
    const pending = await this.call('cancelOrder.create', () =>
      this.duffel.orderCancellations.create({ order_id: orderId })
    );

    const confirmed = await this.call('cancelOrder.confirm', () =>
      this.duffel.orderCancellations.confirm(pending.data.id)
    );

    return {
      cancellationId: confirmed.data.id,
      refundAmount: confirmed.data.refund_amount ?? null,
      refundCurrency: confirmed.data.refund_currency ?? null,
    };
  }

  /** Tüm Duffel çağrılarının ortak hata sarmalayıcısı. */
  private async call<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof DuffelCredentialsMissingException) throw error;
      throw new DuffelApiException(operation, extractMessage(error));
    }
  }
}

// ==========================================
// EŞLEME (Duffel → domain)
// ==========================================

function buildSearchPassengers(params: FlightSearchParams) {
  const passengers: Array<{ type: 'adult' } | { age: number }> = [];
  for (let i = 0; i < params.adults; i++) passengers.push({ type: 'adult' });
  // Duffel çocuk/bebeği yaşla ayırır; tip yerine yaş gönderilir.
  for (let i = 0; i < params.children; i++) passengers.push({ age: 8 });
  for (let i = 0; i < params.infants; i++) passengers.push({ age: 1 });
  return passengers;
}

function buildOrderPassengers(params: CreateFlightOrderParams) {
  return params.passengers.map((p: FlightPassenger, index: number) => ({
    id: `pas_${index}`,
    type: p.type,
    title: p.title ?? 'mr',
    given_name: p.givenName,
    family_name: p.familyName,
    born_on: p.bornOn,
    gender: p.gender ?? 'm',
    email: params.contactEmail,
    phone_number: params.contactPhone,
  }));
}

function mapSegment(segment: OfferSliceSegment): FlightSegment {
  return {
    originIata: segment.origin.iata_code ?? '',
    originName: segment.origin.name ?? null,
    destinationIata: segment.destination.iata_code ?? '',
    destinationName: segment.destination.name ?? null,
    departingAt: segment.departing_at,
    arrivingAt: segment.arriving_at,
    carrierIata: segment.marketing_carrier?.iata_code ?? '',
    carrierName: segment.marketing_carrier?.name ?? '',
    flightNumber: segment.marketing_carrier_flight_number ?? null,
  };
}

function mapSlice(slice: OfferSlice): FlightSlice {
  return {
    originIata: slice.origin.iata_code ?? '',
    destinationIata: slice.destination.iata_code ?? '',
    durationMinutes: parseIso8601Minutes(slice.duration),
    segments: (slice.segments ?? []).map(mapSegment),
  };
}

function mapOfferToDomain(
  offer: MappableOffer,
  currency: CurrencyType
): FlightOffer {
  return {
    offerId: offer.id,
    totalAmount: Number(offer.total_amount),
    currency,
    expiresAt: offer.expires_at,
    requiresInstantPayment:
      offer.payment_requirements?.requires_instant_payment ?? true,
    paymentRequiredBy: offer.payment_requirements?.payment_required_by ?? null,
    priceGuaranteeExpiresAt:
      offer.payment_requirements?.price_guarantee_expires_at ?? null,
    ownerName: offer.owner?.name ?? '',
    ownerIata: offer.owner?.iata_code ?? '',
    slices: (offer.slices ?? []).map(mapSlice),
  };
}

function mapOrderToResult(order: {
  id: string;
  booking_reference?: string | null;
  total_amount: string;
  total_currency: string;
  payment_status?: { payment_required_by?: string | null } | null;
}): FlightOrderResult {
  return {
    orderId: order.id,
    bookingReference: order.booking_reference ?? null,
    totalAmount: order.total_amount,
    currency: order.total_currency,
    paymentRequiredBy: order.payment_status?.payment_required_by ?? null,
  };
}

/** `Currency` enum'unda karşılığı olmayan para birimleri için `null`. */
function toSupportedCurrency(raw: string | null): CurrencyType | null {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(upper)
    ? (upper as CurrencyType)
    : null;
}

/** Duffel süreyi ISO 8601 aralığı olarak verir (ör. "PT2H30M"). */
function parseIso8601Minutes(
  duration: string | null | undefined
): number | null {
  if (!duration) return null;
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?$/.exec(duration);
  if (!match) return null;
  const [, days, hours, minutes] = match;
  const total =
    Number(days ?? 0) * 1440 + Number(hours ?? 0) * 60 + Number(minutes ?? 0);
  return total > 0 ? total : null;
}

function isNotFound(error: unknown): boolean {
  const meta = (error as { meta?: { status?: number } })?.meta;
  return meta?.status === 404;
}

function extractMessage(error: unknown): string {
  const duffelErrors = (
    error as { errors?: Array<{ message?: string; title?: string }> }
  )?.errors;

  if (Array.isArray(duffelErrors) && duffelErrors.length > 0) {
    return duffelErrors
      .map((e) => e.message ?? e.title ?? 'bilinmeyen hata')
      .join('; ');
  }

  return error instanceof Error ? error.message : String(error);
}
