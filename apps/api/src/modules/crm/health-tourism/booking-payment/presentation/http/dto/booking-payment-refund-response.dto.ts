import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { FinanceResponseGroups } from '@modules/finance/shared/domain/finance.contracts';
import {
  CurrencySchema,
  CurrencyType,
} from '@input-type-schemas/CurrencySchema';
import {
  BookingPaymentProviderValue,
  BookingPaymentRefundKindValue,
  BookingPaymentRefundOriginValue,
  BookingPaymentRefundStatusValue,
} from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment-refund';
import { BookingPaymentRefundKindSchema } from '@input-type-schemas/BookingPaymentRefundKindSchema';
import { BookingPaymentRefundOriginSchema } from '@input-type-schemas/BookingPaymentRefundOriginSchema';
import { BookingPaymentRefundStatusSchema } from '@input-type-schemas/BookingPaymentRefundStatusSchema';
import { BookingPaymentProviderSchema } from '@input-type-schemas/BookingPaymentProviderSchema';

const { FINANCIAL, MANAGEMENT, ADMIN } = FinanceResponseGroups;

/** Platform iadesi finansaldır: tutarlar ve sağlayıcı referansları muhasebe hizasında tutulur. */
const FIN = { groups: [FINANCIAL, MANAGEMENT, ADMIN] };

/**
 * Kapanmamış rezervasyon iadesi (operatörün "sağlayıcı panelinde doğrula" satırı).
 * Karar damgası alanları (`resolvedById`, notlar) bilerek YOK: bu liste kapanmamış satırları
 * gösterir; kapanış izi denetim kaydındadır.
 */
export class UnresolvedBookingPaymentRefundResponseDto {
  @Expose(FIN) id: string;
  @Expose(FIN) bookingPaymentId: string;
  @Expose(FIN) clinicId: string;

  @ApiProperty({ enum: BookingPaymentRefundKindSchema.options })
  @Expose(FIN)
  kind: BookingPaymentRefundKindValue;

  @ApiProperty({ enum: BookingPaymentRefundOriginSchema.options })
  @Expose(FIN)
  origin: BookingPaymentRefundOriginValue;

  @ApiProperty({ enum: BookingPaymentProviderSchema.options })
  @Expose(FIN)
  provider: BookingPaymentProviderValue;

  @Expose(FIN) chargeProviderRef: string;

  @Expose(FIN)
  @Type(() => String)
  amount: string;

  @ApiProperty({ enum: CurrencySchema.options })
  @Expose(FIN)
  currency: CurrencyType;

  @ApiProperty({ enum: BookingPaymentRefundStatusSchema.options })
  @Expose(FIN)
  status: BookingPaymentRefundStatusValue;

  @Expose(FIN) attemptCount: number;

  /** Sağlayıcıya iletilen anahtar (iyzico `conversationId`): panelde bununla aranır. */
  @Expose(FIN) idempotencyKey: string;

  @Expose(FIN) failureReason: string | null;

  @Expose(FIN)
  @Type(() => Date)
  requestedAt: Date | null;

  /** PENDING ve süresi geçmiş: çağrı takılmış olabilir. */
  @Expose(FIN) stale: boolean;
}
