import { OrganizationFinanceSettings as IOrganizationFinanceSettings } from '@shared';
import {
  BillingTargetSchema,
  BillingTargetType as BillingTarget,
} from '@input-type-schemas/BillingTargetSchema';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { CreateOrganizationFinanceSettingsProps } from '@modules/organization/organization/domain/contracts/organization-finance-settings';
import { UUID } from '@src/domain/value-objects/uuid.vo';

/**
 * Organizasyonun finansal davranış ayarları (1:1 satellite) — ClinicFinanceSettings'in
 * org-seviye karşılığı. `subscriptionBillingTarget` platform aboneliğinin faturalandırma
 * hedefini (org merkezî mi, her klinik mi) belirler.
 */
export class OrganizationFinanceSettings {
  constructor(data: IOrganizationFinanceSettings) {
    this._id = UUID.fromTrusted(data.id);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._subscriptionBillingTarget = data.subscriptionBillingTarget;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _subscriptionBillingTarget: BillingTarget;
  get subscriptionBillingTarget(): BillingTarget {
    return this._subscriptionBillingTarget;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Org için DB default'larıyla (ORGANIZATION hedef) varsayılan finans ayarları. */
  public static createDefault(
    organizationId: string
  ): OrganizationFinanceSettings {
    return OrganizationFinanceSettings.create({ organizationId });
  }

  public static create(
    props: CreateOrganizationFinanceSettingsProps
  ): OrganizationFinanceSettings {
    return new OrganizationFinanceSettings({
      id: UUID.createOrGenerate(props.id).value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      subscriptionBillingTarget:
        props.subscriptionBillingTarget ??
        BillingTargetSchema.enum.ORGANIZATION,
      updatedAt: DateTimeManager.create(),
    });
  }

  /** Faturalandırma hedefini değiştirir (org ayar ekranı). */
  public setBillingTarget(target: BillingTarget): void {
    this._subscriptionBillingTarget = target;
  }

  toPersistence(): IOrganizationFinanceSettings {
    return {
      id: this.id.value,
      organizationId: this.organizationId.value,
      subscriptionBillingTarget: this.subscriptionBillingTarget,
      updatedAt: this.updatedAt,
    };
  }
}
