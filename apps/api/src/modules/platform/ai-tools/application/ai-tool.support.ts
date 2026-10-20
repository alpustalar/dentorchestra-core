import { Injectable, Logger } from '@nestjs/common';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { IGetContext } from '@common/decorators';
import { ActorContext } from '@common/interfaces';
import { SYSTEM_ACTOR } from '@common/constants/system-actor.constant';
import { ExecutionSources } from '../../../../../../../packages/shared/common/constants/execution-source.constant';
import { TimeZoneType } from '@input-type-schemas/TimeZoneSchema';
import { GetClinicTimezoneQuery } from '@modules/organization/clinic/application/queries/get-clinic-timezone/get-clinic-timezone.query';
import { GetClinicHealthTourismConfigQuery } from '@modules/crm/health-tourism/config/application/queries/get-clinic-health-tourism-config/get-clinic-health-tourism-config.query';
import { GetAppointmentDetailQuery } from '@modules/clinical/appointment/application/queries/get-appointment-detail/get-appointment-detail.query';
import { GetHotelBookingsQuery } from '@modules/crm/health-tourism/hotel/application/queries/get-hotel-bookings/get-hotel-bookings.query';
import { GetTransferBookingsQuery } from '@modules/crm/health-tourism/transfer/application/queries/get-transfer-bookings/get-transfer-bookings.query';
import { GetFlightBookingsQuery } from '@modules/crm/health-tourism/flight/application/queries/get-flight-bookings/get-flight-bookings.query';
import { RefundBookingPaymentCommand } from '@modules/crm/health-tourism/booking-payment/application/commands/refund-booking-payment/refund-booking-payment.command';
import { SupplierRetainedCost } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import { InitiateBookingPaymentResponse } from '@modules/crm/health-tourism/booking-payment/application/commands/initiate-booking-payment/initiate-booking-payment.response';
import {
  GetFlightBookingsDto,
  GetHotelBookingsDto,
  GetTransferBookingsDto,
} from '@shared/modules/health-tourism/dto/queries';
import { AiToolContext, AiToolResult } from '@common/ai-tools';
import { Currency } from '@src/domain/value-objects/currency.vo';

/**
 * AI araçlarının paylaştığı bus-orkestrasyon yardımcıları (context kurulumu, klinik
 * timezone/config çözümü, sahiplik doğrulama sorguları, iade tetikleme, ödeme linki
 * render). Her araç yalnız ihtiyacı kadarını çağırır; tüm dağıtımlar CommandBus/QueryBus
 * üzerinden yapılır (cross-module kural: yalnız bus).
 */
/**
 * İade tetikleyicisinin girdisi. `retained` iptal komutunun yanıtından gelir
 * (sağlayıcının alıkoyduğu ceza); bilinmiyorsa `null`.
 */
interface RefundForCancelledBookingProps {
  readonly bookingId: string;
  readonly retained: SupplierRetainedCost | null;
}

@Injectable()
export class AiToolSupport {
  private readonly logger = new Logger(AiToolSupport.name);

  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus
  ) {}

  /** Kontak bilgisinden klinik-kapsamlı sistem context'i kurar (yalnız bus dağıtımı için). */
  buildClinicContext(context: AiToolContext): IGetContext {
    const actor: ActorContext = {
      ...SYSTEM_ACTOR,
      clinicId: context.clinicId,
      organizationId: context.organizationId,
      managedClinics: [{ id: context.clinicId }],
    };
    return {
      actor,
      source: ExecutionSources.INTERNAL_CASCADE,
      ip: '127.0.0.1',
      userAgent: 'AI_AGENT',
    };
  }

  /** Kliniğin IANA zaman dilimini bus üzerinden çözer (yerel saat → UTC çevirimi için). */
  async getClinicTimezone(context: AiToolContext): Promise<TimeZoneType> {
    const { data } = await this.queryBus.execute(
      new GetClinicTimezoneQuery(context.clinicId)
    );
    return data;
  }

  /** Klinik sağlık-turizmi config'ini bus üzerinden çözer; yoksa null. */
  async getHealthTourismConfig(context: AiToolContext) {
    const ctx = this.buildClinicContext(context);
    const { data } = await this.queryBus.execute(
      new GetClinicHealthTourismConfigQuery(context.clinicId, ctx)
    );
    return data;
  }

  /**
   * Randevunun yazışmadaki hastaya ait olduğunu doğrular. Misafir (patientId yok) veya
   * başka hastaya ait randevularda null döner; çağıran işlemi reddeder.
   */
  async loadOwnedAppointment(appointmentId: string, context: AiToolContext) {
    if (!context.patientId) return null;
    const ctx = this.buildClinicContext(context);
    try {
      const { data: detail } = await this.queryBus.execute(
        new GetAppointmentDetailQuery(appointmentId, ctx)
      );
      if (!detail || detail.patientId !== context.patientId) return null;
      return detail;
    } catch {
      return null;
    }
  }

  /** Yazışmaya bağlı kişinin (patientId öncelikli, yoksa leadId) otel rezervasyonlarını çeker. */
  async loadOwnedHotelBookings(context: AiToolContext) {
    const ctx = this.buildClinicContext(context);
    const dto: GetHotelBookingsDto = {
      pagination: { page: 1, limit: 50 },
      patientId: context.patientId ?? undefined,
      leadId: context.patientId ? undefined : (context.leadId ?? undefined),
    } as GetHotelBookingsDto;
    const { data } = await this.queryBus.execute(
      new GetHotelBookingsQuery(dto, ctx)
    );
    return { data };
  }

  /** Yazışmaya bağlı kişinin (patientId öncelikli, yoksa leadId) transfer rezervasyonları. */
  async loadOwnedTransferBookings(context: AiToolContext) {
    const ctx = this.buildClinicContext(context);
    const dto: GetTransferBookingsDto = {
      clinicId: context.clinicId,
      pagination: { page: 1, limit: 50 },
      patientId: context.patientId ?? undefined,
      leadId: context.patientId ? undefined : (context.leadId ?? undefined),
    } as GetTransferBookingsDto;
    const { data } = await this.queryBus.execute(
      new GetTransferBookingsQuery(dto, ctx)
    );
    return data;
  }

  /** Yazışmaya bağlı kişinin (patientId öncelikli, yoksa leadId) uçuş rezervasyonları. */
  async loadOwnedFlightBookings(context: AiToolContext) {
    const ctx = this.buildClinicContext(context);
    const dto: GetFlightBookingsDto = {
      clinicId: context.clinicId,
      pagination: { page: 1, limit: 50 },
      patientId: context.patientId ?? undefined,
      leadId: context.patientId ? undefined : (context.leadId ?? undefined),
    } as GetFlightBookingsDto;
    const { data } = await this.queryBus.execute(
      new GetFlightBookingsQuery(dto, ctx)
    );
    return data;
  }

  /**
   * İptal edilen rezervasyon için ödeme iadesini (varsa) tetikler. Ödeme kaydı yoksa (B7
   * öncesi/ödemesiz rezervasyon) `true` döner (iade edilecek bir şey yok). Sağlayıcı iadeyi
   * reddettiyse, sonuç doğrulanamadıysa ya da çağrı hata verdiyse `false` döner — iptal mesajı
   * yine de döner ama müşteriye "iade edildi" DENMEZ: yalnız `CONFIRMED` iadedir.
   *
   * `retained` **zorunlu**: iptal komutunun döndürdüğü ekonomi buradan geçmezse
   * defter cezasız ters kayıt yazar ve fark sessizce kaybolur. Alanı opsiyonel
   * bırakmak, üç aracın birinde unutulduğunda derleyicinin susması demekti.
   */
  async refundForCancelledBooking(
    props: RefundForCancelledBookingProps
  ): Promise<boolean> {
    try {
      const result = await this.commandBus.execute(
        new RefundBookingPaymentCommand({
          bookingId: props.bookingId,
          // Sağlayıcının alıkoyduğu ceza iptal yanıtından geliyor ve BURADAN
          // geçmek zorunda: platform defteri cezayı zarar olarak tanıyacak,
          // tedarikçi borcunu da yalnız serbest kalan kadar düşecek.
          retained: props.retained,
          reason: 'Rezervasyon iptal edildi.',
        })
      );
      // Komut artık sağlayıcı reddinde/zaman aşımında FIRLATMAZ (kural 18): sonuç durumdadır.
      return result.status === 'CONFIRMED' || result.status === 'SKIPPED';
    } catch (err) {
      this.logger.warn(
        `İptal sonrası iade tetiklenemedi (bookingId=${props.bookingId}): ${
          err instanceof Error ? err.message : err
        }`
      );
      return false;
    }
  }

  /**
   * İki ödeme linkini (iyzico TRY / Stripe EUR-USD) AI'a sunulacak biçimde döner. AI hastaya
   * her iki linki de iletir: Türkiye'den ödeyecekse iyzico (TRY), yurt dışından ödeyecekse Stripe.
   * Ödeme onaylandığında rezervasyon otomatik oluşur.
   */
  renderPaymentLinks(
    payment: InitiateBookingPaymentResponse,
    summary: string
  ): AiToolResult {
    const tryLink = payment.iyzico
      ? {
          url: payment.iyzico.url,
          amount: payment.iyzico.amount,
          currency: Currency.enum.TRY,
          label: "Türkiye'den ödeme (iyzico)",
        }
      : null;
    const fxLink = payment.stripe
      ? {
          url: payment.stripe.url,
          amount: payment.stripe.amount,
          currency: payment.stripe.currency,
          label: 'Yurt dışından ödeme (kredi kartı / Stripe)',
        }
      : null;

    return {
      content: JSON.stringify({
        paymentRequired: true,
        summary,
        tryLink,
        fxLink,
        message:
          'Rezervasyonu kesinleştirmek için ödeme gerekli. TRY için (iyzico) linkini, EUR/USD için (Stripe) linkini kullanabilirsiniz.',
        note: 'Ödemeniz onaylandığında rezervasyonunuz otomatik oluşturulacaktır.',
      }),
    };
  }
}
