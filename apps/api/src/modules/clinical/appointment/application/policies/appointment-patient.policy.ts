import { PatientActorContext } from '@common/interfaces';
import { PatientBasePolicy } from '@modules/platform/policy/patient/application/patient-base.policy';
import { Appointment } from '@shared';
import { ExecutionSource } from '../../../../../../../../packages/shared/common/constants/execution-source.constant';
import {
  AppointmentResponseGroup,
  AppointmentsResponseGroups,
} from '@shared/modules/appointment/constants';

export class AppointmentPatientPolicy extends PatientBasePolicy {
  constructor(actor: PatientActorContext, source: ExecutionSource) {
    super(actor, source);
  }

  getSerializationOptions(appointment: Appointment): {
    isGroupActive: boolean;
    groups: AppointmentResponseGroup[];
  } {
    const _groups = new Set<AppointmentResponseGroup>();

    if (this.isSelf(appointment)) {
      _groups.add(AppointmentsResponseGroups.PATIENT_DATA_OWNER);
    }

    if (this.isSystem()) {
      Object.values(AppointmentsResponseGroups).forEach((group) =>
        _groups.add(group)
      );
    }

    const groups = Array.from(_groups);

    return {
      isGroupActive: groups.length > 0,
      groups,
    };
  }

  isSelf(appointment: Appointment) {
    if (appointment.patientId && this.actor.patientId) {
      return appointment.patientId === this.actor.patientId;
    }
    if (appointment.patientEmail && this.actor.email) {
      return appointment.patientEmail === this.actor.email;
    }
    if (appointment.patientPhone) {
      return appointment.patientPhone === this.actor.phone;
    }

    return false;
  }

  canCancelOwnBooking(appointment: Appointment): boolean {
    return this.isSelf(appointment);
  }
}
