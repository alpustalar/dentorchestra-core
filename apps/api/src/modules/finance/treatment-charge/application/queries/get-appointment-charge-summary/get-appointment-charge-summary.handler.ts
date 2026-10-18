import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetAppointmentChargeSummaryQuery } from './get-appointment-charge-summary.query';
import { GetAppointmentChargeSummaryResponse } from './get-appointment-charge-summary.response';
import {
  ITreatmentChargeQueryRepository,
  TREATMENT_CHARGE_QUERY_REPOSITORY,
} from '@modules/finance/treatment-charge/domain/repositories/treatment-charge/treatment-charge.query.repository';
import { TreatmentCharge } from '@modules/finance/treatment-charge/domain/entities/treatment-charge.entity';
import { ChargeTotalsCalculator } from '@modules/finance/treatment-charge/domain/services/charge-totals.calculator';

@QueryHandler(GetAppointmentChargeSummaryQuery)
export class GetAppointmentChargeSummaryHandler implements IQueryHandler<
  GetAppointmentChargeSummaryQuery,
  GetAppointmentChargeSummaryResponse
> {
  constructor(
    @Inject(TREATMENT_CHARGE_QUERY_REPOSITORY)
    private readonly chargeRepo: ITreatmentChargeQueryRepository
  ) {}

  async execute(
    query: GetAppointmentChargeSummaryQuery
  ): Promise<GetAppointmentChargeSummaryResponse> {
    const rows = await this.chargeRepo.findByAppointmentId({
      appointmentId: query.appointmentId,
      includeVoided: false,
    });

    // Satır yoksa `null` döner — çağıran serbest tutarlı akışına devam eder
    // (kapora, tedavi dışı tahsilat gibi satırsız senaryolar meşrudur).
    if (rows.length === 0) return { data: null };

    return {
      data: ChargeTotalsCalculator.summarize(
        query.appointmentId,
        rows.map((raw) => new TreatmentCharge(raw))
      ),
    };
  }
}
