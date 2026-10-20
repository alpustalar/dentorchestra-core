import { ActorContext } from '@common/interfaces';
import { ClinicPolicy } from '@modules/organization/clinic/application/policies';
import { ExecutionSource } from '../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { SerializationOptionsResponse } from '@common/interfaces/serialization-policy.interface';
import {
  ResponseGroup,
  ResponseGroups,
} from '../../../../../../../../packages/shared/common/constants/response-groups.constant';

/**
 * Dış iş emri staff policy'si. İş emri açma, görüntüleme ve tedarikçideki ilerlemeyi
 * işaretleme aynı klinik personeline açıktır (günlük operasyon); iptal, teslim alma
 * (maliyet kesinleşmesi) ve yeniden yapım açma klinik yöneticisi ister.
 */
export class WorkOrderPolicy extends ClinicPolicy {
  constructor(actor: ActorContext, source: ExecutionSource) {
    super(actor, source);
  }

  canAccessClinicWorkOrders(clinicId: string | undefined): boolean {
    return this.actorCanAccessTargetClinic(clinicId);
  }

  override getSerializationOptions(payload: {
    clinicId: string | undefined | null;
  }): SerializationOptionsResponse<ResponseGroup> {
    const canAccess = this.canAccessClinicWorkOrders(
      payload.clinicId ?? undefined
    );
    const isManager = this.actorCanManageTargetClinic(payload.clinicId);
    const isSystem = this.isSystem();

    const { ADMIN, INTERNAL } = ResponseGroups;

    const groups: ResponseGroup[] = [];

    if (canAccess) groups.push(INTERNAL);
    if (isSystem) groups.push(ADMIN);

    return {
      isGroupActive: canAccess || isManager || isSystem,
      groups,
    };
  }
}
