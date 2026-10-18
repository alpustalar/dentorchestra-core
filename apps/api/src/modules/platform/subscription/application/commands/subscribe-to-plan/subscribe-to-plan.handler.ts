import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { SubscribeToPlanCommand } from './subscribe-to-plan.command';
import {
  BILLING_ADAPTER,
  IBillingAdapter,
} from '@modules/platform/subscription/infrastructure/adapters/billing-adapter.interface';
import { PlanIdSchema } from '@shared';
import { BillingTargetSchema } from '@input-type-schemas/BillingTargetSchema';
import { Money } from '@src/domain/value-objects/money.vo';
import { Subscription } from '@modules/platform/subscription/domain/entities/subscription.entity';
import { SubscriptionItem } from '@modules/platform/subscription/domain/entities/subscription-item.entity';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { GetOrganizationBillingTargetQuery } from '@modules/organization/organization/application/queries/get-organization-billing-target/get-organization-billing-target.query';
import {
  SubscriptionAlreadyExistsException,
  SubscriptionBuyerRequiredException,
  SubscriptionClinicRequiredException,
} from '@modules/platform/subscription/domain/exceptions/subscription.exceptions';
import {
  ISubscriptionCommandRepository,
  SUBSCRIPTION_COMMAND_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/subscription/subscription.command.repository';
import {
  ISubscriptionItemCommandRepository,
  SUBSCRIPTION_ITEM_COMMAND_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/subscription-item/subscription-item.command.repository';
import {
  IPlanCommandRepository,
  PLAN_COMMAND_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/plan/plan.command.repository';

export interface SubscribeToPlanResult {
  subscriptionId: string;
  checkoutUrl: string | null; // null = FREE_TRIAL, ödeme gerekmez
}

@CommandHandler(SubscribeToPlanCommand)
export class SubscribeToPlanHandler implements ICommandHandler<
  SubscribeToPlanCommand,
  SubscribeToPlanResult
> {
  constructor(
    @Inject(SUBSCRIPTION_COMMAND_REPOSITORY)
    private readonly subscriptionRepo: ISubscriptionCommandRepository,
    @Inject(SUBSCRIPTION_ITEM_COMMAND_REPOSITORY)
    private readonly subscriptionItemRepo: ISubscriptionItemCommandRepository,
    @Inject(PLAN_COMMAND_REPOSITORY)
    private readonly planRepo: IPlanCommandRepository,
    @Inject(BILLING_ADAPTER)
    private readonly billingAdapter: IBillingAdapter,
    private readonly queryBus: TSQueryBus,
    private readonly txManager: TransactionManager
  ) {}

  async execute(
    command: SubscribeToPlanCommand
  ): Promise<SubscribeToPlanResult> {
    const {
      organizationId,
      planId,
      priceAtPurchase,
      buyer,
      externalPriceId,
      clinicId,
      currency,
    } = command.payload;

    // Faturalandırma hedefini org ayarından çöz (org merkezî mi, klinik mi — franchise).
    const { data: billingTarget } = await this.queryBus.execute(
      new GetOrganizationBillingTargetQuery(organizationId)
    );
    const isClinicBilled = billingTarget === BillingTargetSchema.enum.CLINIC;

    if (isClinicBilled && !clinicId) {
      throw new SubscriptionClinicRequiredException();
    }
    const ownerClinicId = isClinicBilled ? clinicId! : null;

    // Erken çıkış: ödeme sağlayıcısında boşuna checkout açmamak için. Bağlayıcı
    // kontrol aşağıda, yazmayla aynı transaction içinde tekrar yapılır.
    const alreadyExists = await this.subscriptionRepo.existsByOwner({
      organizationId,
      clinicId: ownerClinicId,
    });

    if (alreadyExists) {
      throw new SubscriptionAlreadyExistsException();
    }

    const isFreeTrial = planId === PlanIdSchema.enum.FREE_TRIAL;
    if (!isFreeTrial && !buyer) {
      throw new SubscriptionBuyerRequiredException();
    }

    // Fiyat Plan tablosundan (admin tanımı) çözülür; tanım yoksa command değerine düşülür.
    const plan = await this.planRepo.findByPlanId(planId);
    const price = plan
      ? plan.monthlyMoney
      : Money.create(priceAtPurchase, currency).orThrow();

    let checkoutUrl: string | null = null;
    let externalId: string | undefined;

    if (!isFreeTrial && buyer) {
      const result = await this.billingAdapter.initializePayment({
        organizationId,
        amount: price,
        label: `${planId} Plan`,
        buyer,
      });
      checkoutUrl = result.checkoutUrl;
      externalId = result.conversationId; // callback bunu findByExternalId ile bulur
    }

    const subscriptionId = randomUUID();
    const subscription = Subscription.create({
      id: subscriptionId,
      billingTarget,
      organizationId,
      clinicId: ownerClinicId ?? undefined,
      externalId,
    });

    const item = SubscriptionItem.create({
      subscriptionId,
      planId,
      priceAtPurchase: price,
      externalPriceId,
    });

    await this.txManager.outboxRun(async () => {
      // Yazma anındaki bağlayıcı kontrol: yukarıdaki erken çıkış ile buradaki create
      // arasında ödeme sağlayıcısına gidilip gelindi; o sırada aynı sahibe ikinci bir
      // abonelik açılmış olabilir (çift faturalama). Yarışı kaybeden taraf burada
      // düşer — sağlayıcıda sahipsiz bir checkout linki kalır, tamamlanmazsa zararsız.
      const raced = await this.subscriptionRepo.existsByOwner({
        organizationId,
        clinicId: ownerClinicId,
      });
      if (raced) {
        throw new SubscriptionAlreadyExistsException();
      }

      await this.subscriptionRepo.create(subscription);
      await this.subscriptionItemRepo.create(item);
    });

    return { subscriptionId, checkoutUrl };
  }
}
