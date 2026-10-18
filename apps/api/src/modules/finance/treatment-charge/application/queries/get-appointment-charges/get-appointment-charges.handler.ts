import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetAppointmentChargesQuery } from './get-appointment-charges.query';
import { GetAppointmentChargesResponse } from './get-appointment-charges.response';
import {
  ITreatmentChargeQueryRepository,
  TREATMENT_CHARGE_QUERY_REPOSITORY,
} from '@modules/finance/treatment-charge/domain/repositories/treatment-charge/treatment-charge.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TreatmentCharge } from '@modules/finance/treatment-charge/domain/entities/treatment-charge.entity';
import { ChargeTotalsCalculator } from '@modules/finance/treatment-charge/domain/services/charge-totals.calculator';
import { TREATMENT_CHARGE_EVENTS } from '@src/domain/constants/events';

@QueryHandler(GetAppointmentChargesQuery)
export class GetAppointmentChargesHandler implements IQueryHandler<
  GetAppointmentChargesQuery,
  GetAppointmentChargesResponse
> {
  constructor(
    @Inject(TREATMENT_CHARGE_QUERY_REPOSITORY)
    private readonly chargeRepo: ITreatmentChargeQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetAppointmentChargesQuery
  ): Promise<GetAppointmentChargesResponse> {
    const { appointmentId, filter, ctx } = query.payload;

    const items = await this.chargeRepo.findByAppointmentId({
      appointmentId,
      includeVoided: filter.includeVoided,
    });

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    // Satır yoksa doğrulanacak bir kiracı da yok; boş liste dönülür.
    if (items.length === 0) {
      return { data: { items: [], summary: null } };
    }

    const clinicId = items[0].clinicId;

    evaluator
      .check(
        (p) => p.canAccessClinicFinances(clinicId),
        'Bu randevunun işlem satırlarını görüntüleme yetkiniz yok.'
      )
      .orThrow(TREATMENT_CHARGE_EVENTS.LIST);

    // Özet hesabı satırların domain davranışını gerektirdiği için entity'ye
    // hidrate edilip tek hesap noktasından (calculator) geçirilir. Hepsi iptal
    // edilmişse özet yoktur — okuma ucu bunu hata değil, `null` olarak bildirir.
    const entities = items.map((raw) => new TreatmentCharge(raw));
    const hasActive = entities.some((charge) => !charge.isVoided);

    return {
      data: {
        items,
        summary: hasActive
          ? ChargeTotalsCalculator.summarize(appointmentId, entities)
          : null,
      },
      meta: {
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }
}
