import { Decimal } from 'decimal.js';
import { CurrencyType } from '@input-type-schemas/CurrencySchema';
import { DuffelFlightBookingModeType } from '@input-type-schemas/DuffelFlightBookingModeSchema';
import { JsonValueType } from '@input-type-schemas/JsonValueSchema';
import { LogSource } from '@src/domain/constants/log-action.constant';

/**
 * Entity `create()` girişi. Kayıt her iki yolda da (HOLD / INSTANT) Duffel'da sipariş
 * açıldıktan SONRA yaratılır; bu yüzden `duffelOrderId` zorunludur.
 */
export interface CreateFlightBookingProps {
  id?: string;
  duffelOrderId: string;
  /** Hold yolunda bilet henüz kesilmediği için PNR boş gelebilir. */
  bookingReference?: string | null;
  offerId: string;
  mode: DuffelFlightBookingModeType;
  passengers: JsonValueType;
  slices: JsonValueType;
  totalAmount: number | Decimal;
  currency: CurrencyType;
  /** Hold yolunda Duffel'ın verdiği ödeme son tarihi. */
  holdExpiresAt?: Date | null;

  organizationId: string;
  clinicId: string;
  patientId?: string | null;
  leadId?: string | null;

  /** Event metadata — domain event'leri entity içinde raise edilir. */
  actorId: string;
  logSource: LogSource;
}

export interface ConfirmFlightBookingProps {
  /** Ödeme sonrası havayolundan gelen PNR; Duffel vermezse null bırakılır. */
  bookingReference: string | null;
  actorId: string;
  logSource: LogSource;
}

export interface CancelFlightBookingProps {
  actorId: string;
  logSource: LogSource;
  reason?: string;
}
