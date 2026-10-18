import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { StartTrialCommand } from './start-trial.command';
import { Subscription } from '@modules/platform/subscription/domain/entities/subscription.entity';
import { SubscriptionItem } from '@modules/platform/subscription/domain/entities/subscription-item.entity';
import { Money } from '@src/domain/value-objects/money.vo';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { GetOrganizationBillingTargetQuery } from '@modules/organization/organization/application/queries/get-organization-billing-target/get-organization-billing-target.query';
import { BillingTargetSchema } from '@input-type-schemas/BillingTargetSchema';
import { PlanIdSchema } from '@input-type-schemas/PlanIdSchema';
import { CurrencySchema } from '@input-type-schemas/CurrencySchema';
import { DateTimeManager } from '@common/utils';
import { SUBSCRIPTION_TRIAL_DAYS } from '@common/constants';
import {
  ISubscriptionCommandRepository,
  SUBSCRIPTION_COMMAND_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/subscription/subscription.command.repository';
import {
  ISubscriptionItemCommandRepository,
  SUBSCRIPTION_ITEM_COMMAND_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/subscription-item/subscription-item.command.repository';

@CommandHandler(StartTrialCommand)
export class StartTrialHandler implements ICommandHandler<
  StartTrialCommand,
  void
> {
  constructor(
    @Inject(SUBSCRIPTION_COMMAND_REPOSITORY)
    private readonly subscriptionRepo: ISubscriptionCommandRepository,
    @Inject(SUBSCRIPTION_ITEM_COMMAND_REPOSITORY)
    private readonly subscriptionItemRepo: ISubscriptionItemCommandRepository,
    private readonly queryBus: TSQueryBus,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: StartTrialCommand): Promise<void> {
    const { organizationId, clinicId } = command;

    const { data: billingTarget } = await this.queryBus.execute(
      new GetOrganizationBillingTargetQuery(organizationId)
    );
    const isClinicBilled = billingTarget === BillingTargetSchema.enum.CLINIC;
    const ownerClinicId = isClinicBilled ? clinicId : null;

    // Klinik-billed'de deneme belirli bir kliniğe bağlanır; klinik yoksa (org kaydı) atla.
    if (isClinicBilled && !ownerClinicId) return;

    const subscriptionId = randomUUID();
    const trialEndsAt = DateTimeManager.addDays(
      DateTimeManager.create(),
      SUBSCRIPTION_TRIAL_DAYS
    );

    const subscription = Subscription.create({
      id: subscriptionId,
      billingTarget,
      organizationId,
      clinicId: ownerClinicId ?? undefined,
      trialEndsAt,
    });

    const item = SubscriptionItem.create({
      subscriptionId,
      planId: PlanIdSchema.enum.FREE_TRIAL,
      priceAtPurchase: Money.create(0, CurrencySchema.enum.TRY).orThrow(),
    });

    await this.txManager.run(async () => {
      // Mükerrer abonelik guard'ı yazmayla aynı transaction içinde: kayıt akışı
      // (org oluşturma) tekrar tetiklenirse aynı sahibe ikinci bir deneme aboneliği
      // açılmamalı. Okuma command repo'dan — replica gecikmesi guard'ı boşa çıkarırdı.
      const exists = await this.subscriptionRepo.existsByOwner({
        organizationId,
        clinicId: ownerClinicId,
      });
      if (exists) return; // idempotent

      await this.subscriptionRepo.create(subscription);
      await this.subscriptionItemRepo.create(item);
    });
  }
}
