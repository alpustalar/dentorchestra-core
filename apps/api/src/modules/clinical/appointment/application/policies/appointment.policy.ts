import { ClinicPolicy } from '@modules/organization/clinic/application/policies';
import { ActorContext } from '@common/interfaces';
import { ExecutionSource } from '../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { SerializationOptionsResponse } from '@common/interfaces/serialization-policy.interface';
import {
  AppointmentResponseGroup,
  AppointmentsResponseGroups,
} from '@shared/modules/appointment/constants';

export class AppointmentPolicy extends ClinicPolicy {
  constructor(actor: ActorContext, source: ExecutionSource) {
    super(actor, source);
  }

  canScheduleAppointmentInClinic(clinicId: string | undefined): boolean {
    return this.actorCanAccessTargetClinic(clinicId);
  }

  public getSerializationOptions(payload: {
    clinicId: string;
    providerId?: string;
  }): SerializationOptionsResponse<AppointmentResponseGroup> {
    const isProviderDataOwner = !!(
      this.actor.providerId && payload.providerId === this.actor.providerId
    );
    const isSystem = this.isSystem();
    const isSameClinic = this.actorCanAccessTargetClinic(payload.clinicId);
    const isManager = this.actorCanManageTargetClinic(payload.clinicId);

    const { ADMIN, INTERNAL, PROVIDER_DATA_OWNER, MANAGEMENT } =
      AppointmentsResponseGroups;

    const _groups = new Set<AppointmentResponseGroup>();

    if (isSameClinic) _groups.add(INTERNAL);
    if (isProviderDataOwner) _groups.add(PROVIDER_DATA_OWNER);
    if (isManager) _groups.add(MANAGEMENT);
    if (isSystem) _groups.add(ADMIN);

    const groups = Array.from(_groups);

    return {
      isGroupActive: groups.length > 0,
      groups,
    };
  }
}
