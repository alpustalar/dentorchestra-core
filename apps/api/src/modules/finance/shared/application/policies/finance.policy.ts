import { ActorContext } from '@common/interfaces';
import { ClinicPolicy } from '@modules/organization/clinic/application/policies';
import { OrganizationPolicy } from '@modules/organization/organization/application/policies/organization.policy';
import { ExecutionSource } from '../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { SerializationOptionsResponse } from '@common/interfaces/serialization-policy.interface';
import {
  FinanceResponseGroup,
  FinanceResponseGroups,
} from '@modules/finance/shared/domain/finance.contracts';

/**
 * Finans modülleri için ortak staff policy'si (ledger, invoice, payment,
 * payroll, pos, purchase-invoice). Klinik erişim yardımcılarını ClinicPolicy'den
 * miras alır; finansal alan görünürlüğünü serileştirme gruplarıyla belirler.
 *
 * **İki ayrı eksen:**
 * - **Yetki (capability)** → `finance:read` "para görebilir" demektir. Muhasebeci
 *   rolünün kapısı budur. Rol önceliği (priority) tek boyutlu bir *kıdem* merdiveni
 *   olduğu için burada eşik olarak kullanılamaz: muhasebeci (55) hekimin (70)
 *   altındadır, "≥ 55 finansı görür" kuralı hekime ve hemşireye de tüm tutarları
 *   açardı. Yetki ekseni bu çakışmayı ortadan kaldırır ve kiracının tanımladığı
 *   özel roller de aynı yetkiyle finansa dahil edilebilir.
 * - **Kıdem (priority / yönetilen klinik)** → MANAGEMENT tier'ı. Onay notu, kimin
 *   onayladığı, denetim izi gibi *yönetsel* alanlar buradan açılır.
 *
 * Sonuç: muhasebeci tutarları görür (FINANCIAL) ama yönetsel karar alanlarını
 * görmez (MANAGEMENT); yönetici ikisini birden görür.
 */
export class FinancePolicy extends ClinicPolicy {
  constructor(actor: ActorContext, source: ExecutionSource) {
    super(actor, source);
  }

  /**
   * Aktör bu kliniğin finansal kayıtlarını okuyabilir mi?
   */
  canAccessClinicFinances(clinicId: string | undefined): boolean {
    return this.actorCanAccessTargetClinic(clinicId);
  }

  /**
   * Org-seviye finansal listelerin alan görünürlüğü. Liste birden çok kliniği
   * kapsadığı için tek bir `clinicId` üzerinden çözülemez; bu listeye erişebilen
   * aktör zaten konsolide defteri görüyor demektir — FINANCIAL verilir. MANAGEMENT
   * yalnız yönetim kademesine (sahip / öncelik ≥ 80) açılır: salt muhasebeci
   * tutarları görür, onay/denetim alanlarını görmez.
   */
  getOrganizationSerializationOptions(payload: {
    organizationId: string;
  }): SerializationOptionsResponse<FinanceResponseGroup> {
    const canAccess = new OrganizationPolicy(
      this.actor,
      this.source
    ).actorCanAccessTargetOrganization(payload.organizationId);

    const isManagement = new OrganizationPolicy(
      this.actor,
      this.source
    ).actorCanManageTargetOrganization(payload.organizationId);

    const isSystem = this.isSystem();

    const { ADMIN, INTERNAL, FINANCIAL, MANAGEMENT } = FinanceResponseGroups;

    const groups: FinanceResponseGroup[] = [];

    if (canAccess) groups.push(INTERNAL, FINANCIAL);
    if (canAccess && isManagement) groups.push(MANAGEMENT);
    if (isSystem) groups.push(ADMIN);

    return {
      isGroupActive: canAccess || isSystem,
      groups,
    };
  }

  getSerializationOptions(payload: {
    clinicId: string;
  }): SerializationOptionsResponse<FinanceResponseGroup> {
    const isSameClinic = this.actorCanAccessTargetClinic(payload.clinicId);
    const isManager = this.actorCanManageTargetClinic(payload.clinicId);
    const isSystem = this.isSystem();

    // Muhasebeci: kendi kliniğinin tutarlarını görür, yönetsel alanlarını görmez.

    const { ADMIN, INTERNAL, FINANCIAL, MANAGEMENT } = FinanceResponseGroups;

    const groups: FinanceResponseGroup[] = [];

    if (isSameClinic) groups.push(INTERNAL, FINANCIAL);
    if (isManager) groups.push(MANAGEMENT);
    if (isSystem) groups.push(ADMIN);

    return {
      isGroupActive: isSameClinic || isManager || isSystem,
      groups,
    };
  }
}
