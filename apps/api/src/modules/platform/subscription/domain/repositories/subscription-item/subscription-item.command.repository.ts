import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';
import { SubscriptionItem } from '@modules/platform/subscription/domain/entities/subscription-item.entity';

export const SUBSCRIPTION_ITEM_COMMAND_REPOSITORY = Symbol(
  'ISubscriptionItemCommandRepository'
);

export interface ISubscriptionItemCommandRepository extends IBaseCommandRepository<SubscriptionItem> {
  sync(subscriptionItem: SubscriptionItem): Promise<SubscriptionItem | null>;
  syncMany(subscriptionItems: SubscriptionItem[]): Promise<void>;
}
