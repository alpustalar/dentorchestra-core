import { Inject, Injectable } from '@nestjs/common';
import { IChargeTotalsService } from './charge-totals.service.interface';
import {
  ITreatmentChargeCommandRepository,
  TREATMENT_CHARGE_COMMAND_REPOSITORY,
} from '@modules/finance/treatment-charge/domain/repositories/treatment-charge/treatment-charge.command.repository';
import { AppointmentChargeTotals } from '@modules/finance/treatment-charge/domain/value-objects/appointment-charge-totals.vo';

/**
 * Okuma **Command Repo**'dan yapılır: bu servis bir yazmayı (fatura/tahsilat
 * tutarını) besler, dolayısıyla Command Context'e aittir.
 */
@Injectable()
export class LocalChargeTotalsService implements IChargeTotalsService {
  constructor(
    @Inject(TREATMENT_CHARGE_COMMAND_REPOSITORY)
    private readonly chargeRepo: ITreatmentChargeCommandRepository
  ) {}

  async lockAndGetAppointmentTotals(
    appointmentId: string
  ): Promise<AppointmentChargeTotals | null> {
    const charges =
      await this.chargeRepo.findActiveByAppointmentIdForUpdate(appointmentId);

    if (charges.length === 0) return null;

    return AppointmentChargeTotals.fromCharges(appointmentId, charges);
  }
}
