import { ActorContext } from '@common/interfaces';
import { ClinicPolicy } from '@modules/organization/clinic/application/policies';
import { ExecutionSource } from '../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { SerializationOptionsResponse } from '@common/interfaces/serialization-policy.interface';
import {
  ResponseGroup,
  ResponseGroups,
} from '../../../../../../../../packages/shared/common/constants/response-groups.constant';

/**
 * Satın alma staff policy'si. Talep açma/görüntüleme aynı klinik personeline açık;
 * onay/ret + sipariş oluştur/gönder/mal-kabul/iptal klinik yöneticisi ister.
 */
export class PurchasingPolicy extends ClinicPolicy {
  constructor(actor: ActorContext, source: ExecutionSource) {
    super(actor, source);
  }

  /** Talep açma + talep/sipariş görüntüleme (aynı klinik). */
  canAccessClinicPurchasing(clinicId: string | undefined): boolean {
    return this.isSystem() || this.actorCanAccessTargetClinic(clinicId);
  }

  /** Onay/ret + sipariş yaşam döngüsü (yönetici). */
  canManageClinicPurchasing(clinicId: string | undefined | null): boolean {
    return this.isSystem() || this.actorCanManageTargetClinic(clinicId);
  }

  /**
   * Satın alma cevaplarının alan görünürlüğü.
   * - INTERNAL: kliniğin depo/satın alma personeli (kalem, durum, termin)
   * - FINANCIAL + MANAGEMENT: fiyat/tutar görebilen aktör
   * - ADMIN: sistem
   */
  override getSerializationOptions(payload: {
    clinicId: string | undefined | null;
  }): SerializationOptionsResponse<ResponseGroup> {
    const canAccess = this.canAccessClinicPurchasing(
      payload.clinicId ?? undefined
    );
    const isManager = this.actorCanManageTargetClinic(payload.clinicId);
    // Muhasebeci (finance:read) sipariş tutarlarını görür, onay alanlarını görmez.

    const isSystem = this.isSystem();

    const { ADMIN, INTERNAL, FINANCIAL, MANAGEMENT } = ResponseGroups;

    const groups: ResponseGroup[] = [];

    if (canAccess) groups.push(INTERNAL, FINANCIAL);
    if (isManager) groups.push(MANAGEMENT);
    if (isSystem) groups.push(ADMIN);

    return {
      isGroupActive: canAccess || isManager || isSystem,
      groups,
    };
  }
}
