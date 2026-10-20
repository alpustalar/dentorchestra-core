import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { ExpireTrialsCommand } from './expire-trials.command';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  ISubscriptionCommandRepository,
  SUBSCRIPTION_COMMAND_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/subscription/subscription.command.repository';

@CommandHandler(ExpireTrialsCommand)
export class ExpireTrialsHandler
  implements ICommandHandler<ExpireTrialsCommand, void>
{
  private readonly logger = new Logger(ExpireTrialsHandler.name);

  constructor(
    @Inject(SUBSCRIPTION_COMMAND_REPOSITORY)
    private readonly subscriptionRepo: ISubscriptionCommandRepository,
    private readonly txManager: TransactionManager
  ) {}

  async execute(): Promise<void> {
    const trials = await this.subscriptionRepo.findExpiredTrials(
      DateTimeManager.create()
    );
    if (trials.length === 0) return;

    this.logger.log(`Deneme bitişi: ${trials.length} abonelik kilitleniyor`);

    for (const candidate of trials) {
      await this.txManager
        .run(() => this.expireOne(candidate.id.value))
        .catch((err) =>
          this.logger.error(
            `Deneme bitirme hatası (subscriptionId: ${candidate.id.value})`,
            err
          )
        );
    }
  }

  /**
   * Aboneliği kilitli ve taze okuyup deneme bitişini YENİDEN doğrular.
   *
   * Neden: tarama ile yazma arasında müşteri ödemeyi tamamlamış olabilir. Taramadan
   * gelen bayat kopyayı geri yazmak — `update()` tüm alanları yazdığı için — yeni
   * başlamış aboneliği EXPIRED'a çevirip ödeme yapmış müşteriyi sistem dışında
   * bırakırdı.
   */
  private async expireOne(subscriptionId: string): Promise<void> {
    const subscription =
      await this.subscriptionRepo.findByIdForUpdate(subscriptionId);
    if (!subscription) return;

    if (!subscription.isTrialOver(DateTimeManager.create())) {
      this.logger.verbose(
        `Deneme bitişi atlandı, abonelik artık deneme durumunda değil: ${subscriptionId}`
      );
      return;
    }

    subscription.expire();
    await this.subscriptionRepo.update(subscription);
  }
}
