import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { assertNever } from '@common/utils';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import {
  IPaymentLinkProvider,
  IYZICO_PAYMENT_LINK,
  STRIPE_PAYMENT_LINK,
} from '@src/infrastructure/payment/links/payment-link.port';
import {
  FX_RATE_PROVIDER,
  IFxRateProvider,
} from '@src/infrastructure/payment/links/fx-rate.port';
import {
  IServiceFeeProvider,
  SERVICE_FEE_PROVIDER,
} from '@src/infrastructure/payment/links/service-fee.port';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';
import {
  BookingIntent,
  BookingPaymentLinks,
} from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import { BookingPaymentLinkGenerationException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment.exceptions';
import { InitiateBookingPaymentCommand } from './initiate-booking-payment.command';
import {
  BookingPaymentLinkOption,
  InitiateBookingPaymentResponse,
} from './initiate-booking-payment.response';
import { Currency } from '@src/domain/value-objects';
import {
  BOOKING_PAYMENT_COMMAND_REPOSITORY,
  IBookingPaymentCommandRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.command.repository';

@CommandHandler(InitiateBookingPaymentCommand)
export class InitiateBookingPaymentHandler
  implements
    ICommandHandler<
      InitiateBookingPaymentCommand,
      InitiateBookingPaymentResponse
    >
{
  private readonly logger = new Logger(InitiateBookingPaymentHandler.name);

  constructor(
    @Inject(IYZICO_PAYMENT_LINK)
    private readonly iyzicoLink: IPaymentLinkProvider,
    @Inject(STRIPE_PAYMENT_LINK)
    private readonly stripeLink: IPaymentLinkProvider,
    @Inject(FX_RATE_PROVIDER)
    private readonly fx: IFxRateProvider,
    @Inject(SERVICE_FEE_PROVIDER)
    private readonly serviceFee: IServiceFeeProvider,
    @Inject(BOOKING_PAYMENT_COMMAND_REPOSITORY)
    private readonly bookingPaymentRepo: IBookingPaymentCommandRepository,
    private readonly txManager: TransactionManager
  ) {}

  async execute(
    command: InitiateBookingPaymentCommand
  ): Promise<InitiateBookingPaymentResponse> {
    const { input } = command;

    const saleCurrency = input.netCurrency;
    // Komisyon platform geliridir → oran klinikten değil platform-global ayardan gelir.
    const feePercent = this.serviceFee.getServiceFeePercent();
    const fee = feePercent > 0 ? feePercent : 0;
    const saleAmount = this.round2(input.netAmount * (1 + fee / 100));

    // FX → TRY (iyzico). Çözülemezse iyzico linki atlanır, Stripe yine üretilir.
    let fxRate: number | null = null;
    let tryAmount = saleAmount;
    try {
      fxRate = await this.fx.getRate(saleCurrency, Currency.enum.TRY);
      tryAmount = this.round2(saleAmount * fxRate);
    } catch (err) {
      this.logger.warn(
        `FX kuru çözülemedi (${saleCurrency}→TRY): ${
          err instanceof Error ? err.message : err
        } — iyzico linki atlanacak.`
      );
    }

    const id = randomUUID();
    const description = this.buildDescription(input.intent);
    const links: BookingPaymentLinks = {};
    let iyzicoOption: BookingPaymentLinkOption | null = null;
    let stripeOption: BookingPaymentLinkOption | null = null;

    // iyzico — TRY (yurt içi). Yalnız FX çözülebildiyse.
    if (fxRate !== null) {
      try {
        const r = await this.iyzicoLink.createLink({
          bookingPaymentId: id,
          amount: tryAmount,
          currency: Currency.enum.TRY,
          description,
          buyer: input.buyer,
          ip: input.ip,
        });
        links.iyzicoConversationId = r.sessionId;
        links.iyzicoToken = r.token ?? null;
        links.iyzicoUrl = r.url;
        iyzicoOption = {
          url: r.url,
          amount: tryAmount,
          currency: Currency.enum.TRY,
        };
      } catch (err) {
        this.logger.warn(
          `iyzico linki üretilemedi: ${err instanceof Error ? err.message : err}`
        );
      }
    }

    // Stripe — EUR/USD (yurt dışı). Satış TRY ise atlanır.
    if (saleCurrency !== Currency.enum.TRY) {
      try {
        const r = await this.stripeLink.createLink({
          bookingPaymentId: id,
          amount: saleAmount,
          currency: saleCurrency,
          description,
          buyer: input.buyer,
          ip: input.ip,
        });
        links.stripeSessionId = r.sessionId;
        links.stripeUrl = r.url;
        stripeOption = {
          url: r.url,
          amount: saleAmount,
          currency: saleCurrency,
        };
      } catch (err) {
        this.logger.warn(
          `Stripe linki üretilemedi: ${err instanceof Error ? err.message : err}`
        );
      }
    }

    if (!iyzicoOption && !stripeOption) {
      throw new BookingPaymentLinkGenerationException();
    }

    const entity = BookingPayment.create({
      id,
      bookingType: input.bookingType,
      saleCurrency,
      saleAmount,
      tryAmount,
      netAmount: input.netAmount,
      fxRate,
      intent: input.intent,
      clinicId: input.clinicId,
      organizationId: input.organizationId,
      patientId: input.patientId,
      leadId: input.leadId,
      conversationId: input.conversationId,
    });
    entity.attachLinks(links);

    await this.txManager.run(async () => {
      await this.bookingPaymentRepo.create(entity);
    });

    return {
      bookingPaymentId: id,
      saleAmount,
      saleCurrency,
      iyzico: iyzicoOption,
      stripe: stripeOption,
    };
  }

  /**
   * Ödeme linkinde görünen açıklama. `switch` + `assertNever` bilinçli: ikili
   * `if/else` iken yeni bir rezervasyon türü sessizce "Havalimanı transferi"
   * olarak etiketleniyordu — hasta yanlış açıklamalı bir link görürdü.
   */
  private buildDescription(intent: BookingIntent): string {
    switch (intent.type) {
      case 'HOTEL':
        return `Otel rezervasyonu — ${intent.hotelName}`;
      case 'TRANSFER':
        return `Havalimanı transferi — ${intent.vehicleName}`;
      case 'FLIGHT':
        return `Uçuş rezervasyonu — ${intent.summary}`;
      default:
        return assertNever(
          intent,
          'Ödeme açıklaması üretilemeyen rezervasyon türü.'
        );
    }
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
