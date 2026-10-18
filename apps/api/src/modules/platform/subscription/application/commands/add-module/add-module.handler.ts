import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { AddModuleCommand } from './add-module.command';
import {
  BILLING_ADAPTER,
  IBillingAdapter,
} from '@modules/platform/subscription/infrastructure/adapters/billing-adapter.interface';
import { Money } from '@src/domain/value-objects/money.vo';
import { SubscriptionItem } from '@modules/platform/subscription/domain/entities/subscription-item.entity';
import {
  SubscriptionBuyerRequiredException,
  SubscriptionModuleNotAvailableException,
  SubscriptionModuleNotFoundException,
  SubscriptionNotFoundException,
} from '@modules/platform/subscription/domain/exceptions/subscription.exceptions';
import {
  ISubscriptionItemCommandRepository,
  SUBSCRIPTION_ITEM_COMMAND_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/subscription-item/subscription-item.command.repository';
import {
  ISubscriptionCommandRepository,
  SUBSCRIPTION_COMMAND_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/subscription/subscription.command.repository';

export interface AddModuleResult {
  checkoutUrl: string;
}

@CommandHandler(AddModuleCommand)
export class AddModuleHandler implements ICommandHandler<
  AddModuleCommand,
  AddModuleResult
> {
  constructor(
    @Inject(SUBSCRIPTION_ITEM_COMMAND_REPOSITORY)
    private readonly subscriptionItemRepo: ISubscriptionItemCommandRepository,
    @Inject(SUBSCRIPTION_COMMAND_REPOSITORY)
    private readonly subscriptionRepo: ISubscriptionCommandRepository,
    @Inject(BILLING_ADAPTER)
    private readonly billingAdapter: IBillingAdapter
  ) {}

  async execute(command: AddModuleCommand): Promise<AddModuleResult> {
    const { organizationId, moduleKey, buyer, externalPriceId } =
      command.payload;

    if (!buyer) {
      throw new SubscriptionBuyerRequiredException();
    }

    const subscription =
      await this.subscriptionRepo.findByOrganizationId(organizationId);
    if (!subscription) {
      throw new SubscriptionNotFoundException();
    }

    const module = await this.subscriptionRepo.findModuleByKey(moduleKey);

    if (!module) {
      throw new SubscriptionModuleNotFoundException(moduleKey);
    }
    if (!module.isActive) {
      throw new SubscriptionModuleNotAvailableException(moduleKey);
    }

    const price = Money.create(module.monthlyPrice, module.currency).orThrow();

    const { checkoutUrl, conversationId } =
      await this.billingAdapter.initializePayment({
        organizationId,
        amount: price,
        label: module.name,
        buyer,
      });

    const subscriptionItem = SubscriptionItem.create({
      subscriptionId: subscription.id.value,
      moduleId: module.id,
      priceAtPurchase: price,
      externalPriceId: externalPriceId ?? conversationId,
    });

    await this.subscriptionItemRepo.create(subscriptionItem);

    return { checkoutUrl };
  }
}
