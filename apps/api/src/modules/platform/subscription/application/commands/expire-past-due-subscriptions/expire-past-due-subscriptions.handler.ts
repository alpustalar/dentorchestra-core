import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { ExpirePastDueSubscriptionsCommand } from './expire-past-due-subscriptions.command';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { DateTimeManager } from '@common/utils';
import { SUBSCRIPTION_GRACE_DAYS } from '@common/constants';
import {
  ISubscriptionCommandRepository,
  SUBSCRIPTION_COMMAND_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/subscription/subscription.command.repository';

@CommandHandler(ExpirePastDueSubscriptionsCommand)
export class ExpirePastDueSubscriptionsHandler implements ICommandHandler<
  ExpirePastDueSubscriptionsCommand,
  void
> {
  private readonly logger = new Logger(ExpirePastDueSubscriptionsHandler.name);

  constructor(
    @Inject(SUBSCRIPTION_COMMAND_REPOSITORY)
    private readonly subscriptionRepo: ISubscriptionCommandRepository,
    private readonly txManager: TransactionManager
  ) {}

  async execute(): Promise<void> {
    const pastDue = await this.subscriptionRepo.findPastDue();
    const now = DateTimeManager.create();

    for (const candidate of pastDue) {
      // Ucuz ön-eleme; bağlayıcı karar aşağıda kilit altında yeniden verilir.
      if (!candidate.isGracePeriodOver(now, SUBSCRIPTION_GRACE_DAYS)) continue;

      await this.txManager
        .run(() => this.expireOne(candidate.id.value))
        .catch((err) =>
          this.logger.error(
            `Süre bitirme hatası (subscriptionId: ${candidate.id.value})`,
            err
          )
        );
    }
  }

  /**
   * Aboneliği kilitli ve taze okuyup grace süresinin dolduğunu YENİDEN doğrular.
   * Tarama ile yazma arasında ödeme gelip abonelik ACTIVE'e dönmüş olabilir; bayat
   * kopyayı geri yazmak ödemesi alınmış müşteriyi EXPIRED yapardı.
   */
  private async expireOne(subscriptionId: string): Promise<void> {
    const subscription =
      await this.subscriptionRepo.findByIdForUpdate(subscriptionId);
    if (!subscription) return;

    if (
      !subscription.isGracePeriodOver(
        DateTimeManager.create(),
        SUBSCRIPTION_GRACE_DAYS
      )
    ) {
      this.logger.verbose(
        `Süre bitirme atlandı, abonelik artık gecikmiş değil: ${subscriptionId}`
      );
      return;
    }

    subscription.expire();
    await this.subscriptionRepo.update(subscription);
  }
}
