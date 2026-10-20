import { PlanIdSchema, SubscriptionItem as ISubscriptionItem } from '@shared';
import { Decimal } from 'decimal.js';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { PlanIdType as PlanId } from '@input-type-schemas/PlanIdSchema';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Money } from '@src/domain/value-objects/money.vo';
import { Currency } from '@src/domain/value-objects/currency.vo';
import { Guard } from '@common/domain/guards';
import { isDefined } from '@common/utils';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { CreateSubscriptionItemProps } from '@modules/platform/subscription/domain/contracts';

export class SubscriptionItem extends AggregateRoot {
  constructor(data: ISubscriptionItem) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._subscriptionId = UUID.fromTrusted(data.subscriptionId);

    this._planId = data.planId;

    this._moduleId = UUID.create(data.moduleId).instance ?? null;

    this._moneyAtPurchase = Money.fromTrusted(
      data.priceAtPurchase,
      data.currency
    );

    this._externalPriceId = data.externalPriceId;
    this._createdAt = data.createdAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _subscriptionId: UUID;
  get subscriptionId(): UUID {
    return this._subscriptionId;
  }

  private _planId: PlanId | null;
  get planId(): PlanId | null {
    return this._planId;
  }

  private _moduleId: UUID | null;
  get moduleId(): UUID | null {
    return this._moduleId;
  }

  private _moneyAtPurchase: Money;
  get moneyAtPurchase(): Money {
    return this._moneyAtPurchase;
  }

  get priceAtPurchase(): Decimal {
    return this._moneyAtPurchase.value;
  }

  get currency(): Currency {
    return Currency.fromTrusted(this._moneyAtPurchase.currency);
  }

  private _externalPriceId: string | null;
  get externalPriceId(): string | null {
    return this._externalPriceId;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  public get validate() {
    return {
      has: {
        plan: this._hasPlan,
        module: this._hasModule,
        externalPrice: this._hasExternalPrice,
      },
      plan: {
        isFreeTrial: this._isFreeTrial,
        matches: (planId: PlanId) => this.matchesPlan(planId),
      },
    };
  }

  get _hasPlan() {
    const isPlan = isDefined(this.planId);
    return Guard.monitor(
      isPlan,
      isPlan,
      () => new Error('Bu üyelik eki bir plan dahilinde değil.')
    );
  }

  get _hasModule() {
    const is = isDefined(this.moduleId);
    return Guard.monitor(
      is,
      is,
      () => new Error('Bu üyelik ekinde modül mevcut değil')
    );
  }

  get _isFreeTrial() {
    const is = this.planId === PlanIdSchema.enum.FREE_TRIAL;
    return Guard.monitor(
      is,
      is,
      () => new Error('Ücretsiz deneme sürümü değil')
    );
  }

  get _hasExternalPrice() {
    const is = isDefined(this.externalPriceId);
    return Guard.monitor(
      is,
      is,
      () => new Error('Ödeme sistemi kimlik numarası mevcut değil.')
    );
  }

  /** Yeni üyelik eki (plan veya modül). priceAtPurchase Money VO'dan tutar+para ayrıştırılır. */
  public static create(props: CreateSubscriptionItemProps): SubscriptionItem {
    const id = UUID.createOrGenerate(props.id);
    return new SubscriptionItem({
      id: id.value,
      subscriptionId: props.subscriptionId,
      planId: props.planId ?? null,
      moduleId: props.moduleId ?? null,
      priceAtPurchase: props.priceAtPurchase.value,
      currency: props.priceAtPurchase.currency,
      externalPriceId: props.externalPriceId ?? null,
      createdAt: DateTimeManager.create(),
    });
  }

  matchesPlan(planId: PlanId) {
    const is = this.planId === planId;
    return Guard.monitor(is, is, () => new Error('Plan tipleri uyuşmuyor'));
  }

  toPersistence(): ISubscriptionItem {
    return {
      id: this.id.value,
      subscriptionId: this.subscriptionId.value,
      planId: this.planId,
      moduleId: this.moduleId?.value ?? null,
      priceAtPurchase: this.priceAtPurchase,
      externalPriceId: this.externalPriceId,
      currency: this.currency.value,
      createdAt: this.createdAt,
    };
  }
}
