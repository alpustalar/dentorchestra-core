import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Decimal } from 'decimal.js';
import { AddTreatmentChargeCommand } from './add-treatment-charge.command';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  ITreatmentChargeCommandRepository,
  TREATMENT_CHARGE_COMMAND_REPOSITORY,
} from '@modules/finance/treatment-charge/domain/repositories/treatment-charge/treatment-charge.command.repository';
import {
  ITenantScopeResolver,
  TENANT_SCOPE_RESOLVER,
} from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import { TreatmentCharge } from '@modules/finance/treatment-charge/domain/entities/treatment-charge.entity';
import { TreatmentListPriceMissingException } from '@modules/finance/treatment-charge/domain/exceptions/treatment-charge.exceptions';
import { GetAppointmentDetailQuery } from '@modules/clinical/appointment/application/queries/get-appointment-detail/get-appointment-detail.query';
import { GetTreatmentPricingQuery } from '@modules/clinical/treatment/application/queries/get-treatment-pricing/get-treatment-pricing.query';
import { GetClinicFinanceSettingsQuery } from '@modules/organization/clinic/application/queries/get-clinic-finance-settings/get-clinic-finance-settings.query';
import {
  IInvoiceIssuanceService,
  INVOICE_ISSUANCE_SERVICE,
} from '@modules/finance/invoice/domain/services/invoice-issuance/invoice-issuance.service.interface';
import { AppointmentNotFoundException } from '@modules/clinical/appointment/domain/exceptions/appointment.exceptions';
import { TREATMENT_CHARGE_EVENTS } from '@src/domain/constants/events';
import { Money } from '@src/domain/value-objects/money.vo';
import { VatRate } from '@src/domain/value-objects/vat-rate.vo';
import { UUID } from '@src/domain/value-objects/uuid.vo';

/**
 * İşlem satırı ekler.
 *
 * Fiyat istemciden **alınmaz**: tedavinin liste fiyatı sunucuda çözülüp satıra
 * dondurulur. İstemcinin serbest bırakıldığı tek ticari alan indirimdir, o da
 * kliniğin `maxDiscountPercent` tavanına tabidir — tavanı yalnız kliniği yöneten
 * aktör aşabilir ve aştığında satıra onaylayan izi düşer.
 */
@CommandHandler(AddTreatmentChargeCommand)
export class AddTreatmentChargeHandler implements ICommandHandler<
  AddTreatmentChargeCommand,
  string
> {
  constructor(
    @Inject(TREATMENT_CHARGE_COMMAND_REPOSITORY)
    private readonly chargeRepo: ITreatmentChargeCommandRepository,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(INVOICE_ISSUANCE_SERVICE)
    private readonly invoiceIssuance: IInvoiceIssuanceService,
    private readonly queryBus: TSQueryBus,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: AddTreatmentChargeCommand): Promise<string> {
    const { appointmentId, data, ctx } = command.payload;

    const { data: appointment } = await this.queryBus.execute(
      new GetAppointmentDetailQuery(appointmentId, ctx)
    );
    if (!appointment) throw new AppointmentNotFoundException();

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check(
        (p) => p.canAccessClinicFinances(appointment.clinicId),
        'Bu randevuya işlem satırı ekleme yetkiniz yok.'
      )
      .orThrow(TREATMENT_CHARGE_EVENTS.ADDED);

    // Faturası kesilmiş randevunun ticari dayanağı dondu; satır eklenemez.
    // Kontrol QueryBus yerine domain servisinden: yazmayı kapıda durduran
    // invariant Command Repo'dan okunur (bkz. CQRS — Command Repo kuralı).
    await this.invoiceIssuance.assertAppointmentNotInvoiced(appointmentId);

    const listPrice = await this.resolveListPrice({
      treatmentId: data.treatmentId,
      clinicId: appointment.clinicId,
    });

    const settings = await this.resolveFinanceSettings(appointment.clinicId);

    const organizationId = await this.tenantScopeResolver.resolve({
      clinicId: appointment.clinicId,
    });

    // `add` = `create` + denetim olayı (olay entity içinde doğar, repository
    // `flushEvents` ile yayınlar — handler ayrıca publish etmez).
    const charge = TreatmentCharge.add({
      id: UUID.generate().value,
      organizationId,
      clinicId: appointment.clinicId,
      appointmentId,
      patientId: appointment.patientId,
      treatmentId: data.treatmentId,

      description: data.description ?? null,
      quantity: new Decimal(data.quantity),

      listPrice,
      discountRate: new Decimal(data.discountRate),
      discountReason: data.discountReason ?? null,
      vatRate: VatRate.create(
        data.vatRate ?? settings.defaultVatRate
      ).orThrow(),

      maxDiscountPercent: settings.maxDiscountPercent,
      // Tavanı yalnız kliniği yöneten aktör aşabilir.
      canExceedDiscountLimit: policy.actorCanManageTargetClinic(
        appointment.clinicId
      ),

      createdById: ctx.actor.userId,
      logSource: ctx.actor.source,
    });

    const saved = await this.txManager.run(() =>
      this.chargeRepo.create(charge)
    );

    return saved.id.value;
  }

  /**
   * Liste fiyatını tedaviden çözer ve tedavinin randevunun kliniğine ait
   * olduğunu doğrular — başka kliniğin fiyat listesinden satır açılamaz.
   */
  private async resolveListPrice(input: {
    treatmentId: string;
    clinicId: string;
  }): Promise<Money> {
    const { data: pricing } = await this.queryBus.execute(
      new GetTreatmentPricingQuery(input.treatmentId)
    );

    if (!pricing || pricing.clinicId !== input.clinicId) {
      throw new TreatmentListPriceMissingException(input.treatmentId);
    }

    if (pricing.listPrice === null) {
      throw new TreatmentListPriceMissingException(input.treatmentId);
    }

    return Money.create(pricing.listPrice, pricing.currency).orThrow();
  }

  /**
   * İndirim tavanı ve varsayılan KDV oranı klinik ayarından gelir. Satellite
   * satırı henüz yoksa güvenli taraf seçilir: indirim yok, KDV %20.
   */
  private async resolveFinanceSettings(clinicId: string): Promise<{
    maxDiscountPercent: Decimal;
    defaultVatRate: number;
  }> {
    const { data: settings } = await this.queryBus.execute(
      new GetClinicFinanceSettingsQuery(clinicId)
    );

    return {
      maxDiscountPercent: settings
        ? new Decimal(settings.maxDiscountPercent)
        : new Decimal(0),
      defaultVatRate: settings ? Number(settings.defaultVatRate) : 20,
    };
  }
}
