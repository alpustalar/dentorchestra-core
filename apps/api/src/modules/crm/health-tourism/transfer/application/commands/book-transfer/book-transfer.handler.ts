import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { BookTransferCommand } from './book-transfer.command';
import { BookTransferResponse } from './book-transfer.response';
import {
  HOTELBEDS_TRANSFER_API_SERVICE,
  IHotelbedsTransferApiService,
} from '@modules/crm/health-tourism/transfer/domain/interfaces/hotelbeds-transfer-api.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { Currency } from '@src/domain/value-objects/currency.vo';
import { HotelbedsTransferBooking } from '@modules/crm/health-tourism/transfer/domain/entities/hotelbeds-transfer-booking.entity';
import {
  HotelbedsTransferBookingStatusSchema,
  ITenantScopeResolver,
} from '@shared';
import { JsonValueType } from '@input-type-schemas/JsonValueSchema';
import {
  HOTELBEDS_TRANSFER_BOOKING_COMMAND_REPOSITORY,
  IHotelbedsTransferBookingCommandRepository,
} from '@modules/crm/health-tourism/transfer/domain/repositories/hotelbeds-transfer-booking/hotelbeds-transfer-booking.command.repository';
import { TENANT_SCOPE_RESOLVER } from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@CommandHandler(BookTransferCommand)
export class BookTransferHandler
  implements ICommandHandler<BookTransferCommand, BookTransferResponse>
{
  constructor(
    @Inject(HOTELBEDS_TRANSFER_API_SERVICE)
    private readonly transferApi: IHotelbedsTransferApiService,
    @Inject(HOTELBEDS_TRANSFER_BOOKING_COMMAND_REPOSITORY)
    private readonly hotelbedsTransferBookingRepo: IHotelbedsTransferBookingCommandRepository,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    private readonly txManager: TransactionManager,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {}

  async execute(command: BookTransferCommand): Promise<BookTransferResponse> {
    const { data } = command;

    // `data.clinicId` istek gövdesinden geliyor: kontrol olmadan personel başka
    // kliniğin adına (ve onun komisyon/muhasebe kayıtlarına) rezervasyon açabilirdi.
    this.policyFactory
      .clinic(command.ctx.actor, command.ctx.source)
      .evaluator.check((p) => p.actorCanAccessTargetClinic(data.clinicId))
      .orThrow('health-tourism.booking');

    const organizationId = await this.tenantScopeResolver.resolve(data);

    const clientReference = `${organizationId.slice(0, 8)}-${randomUUID().slice(0, 8)}`;

    const result = await this.transferApi.createBooking({
      language: data.language,
      holder: {
        name: data.holderName,
        surname: data.holderSurname,
        email: data.holderEmail,
        phone: data.holderPhone,
      },
      transfers: data.transfers,
      clientReference,
      welcomeMessage: data.welcomeMessage,
      remark: data.remark,
    });

    // Buradan sonrası GERİ ALINAMAZ bir yan etkinin ardındadır: transfer
    // sağlayıcıda açıldı. Yerel doğrulamalar (sağlayıcının döndürdüğü `status`
    // ve `currency` bizim enum'larımızda olmak zorunda) ya da DB yazımı patlarsa
    // yalnız KAYIT düşer; hizmet satın alınmış kalır ve ödeme iade edilir.
    try {
      const transferBooking = HotelbedsTransferBooking.create({
        reference: result.reference,
        clientReference,
        status: HotelbedsTransferBookingStatusSchema.parse(result.status),
        holderName: data.holderName,
        holderSurname: data.holderSurname,
        holderEmail: data.holderEmail,
        holderPhone: data.holderPhone,
        transfers: result.transfers as JsonValueType,
        totalAmount: result.totalAmount,
        currency: Currency.create(result.currency).orThrow().value,
        remarks: data.remark,
        clinicId: data.clinicId,
        organizationId,
        patientId: data.patientId,
        leadId: data.leadId,
      });

      const booking = await this.txManager.run(async () => {
        return this.hotelbedsTransferBookingRepo.create(transferBooking);
      });

      return {
        bookingId: booking.id.value,
        supplierAmount: booking.totalAmount.toApiFormat(),
        supplierCurrency: booking.totalAmount.currency,
      };
    } catch (err) {
      this.criticalFailure.publish({
        operation: 'health-tourism.transfer.booking-record',
        severity: 'CRITICAL',
        summary:
          'Transfer sağlayıcıda açıldı ama yerel kayıt yazılamadı — rezervasyon elle iptal edilmeli.',
        errorMessage: err instanceof Error ? err.message : String(err),
        context: {
          providerReference: result.reference,
          clientReference,
        },
        clinicId: data.clinicId,
        dedupeKey: `transfer-booking-record-failed:${result.reference}`,
      });
      throw err;
    }
  }
}
