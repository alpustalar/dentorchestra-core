import { Inject, Injectable } from '@nestjs/common';
import { Money } from '@src/domain/value-objects/money.vo';
import {
  CARD_CHARGEBACK_COMMAND_REPOSITORY,
  ICardChargebackCommandRepository,
} from '@modules/finance/bank/domain/repositories/card-chargeback/card-chargeback.repository';
import {
  AssertReversalWithinCollectionParams,
  ICardChargebackExposureGuard,
} from '@modules/finance/bank/domain/services/card-chargeback-exposure/card-chargeback-exposure.guard.interface';
import { CollectionUnderChargebackException } from '@modules/finance/bank/domain/exceptions/bank.exceptions';

@Injectable()
export class CardChargebackExposureGuard implements ICardChargebackExposureGuard {
  constructor(
    @Inject(CARD_CHARGEBACK_COMMAND_REPOSITORY)
    private readonly chargebackRepo: ICardChargebackCommandRepository
  ) {}

  async assertReversalWithinCollection(
    params: AssertReversalWithinCollectionParams
  ): Promise<void> {
    const active = await this.chargebackRepo.sumActiveBySource({
      sourceType: params.sourceType,
      sourceId: params.sourceId,
    });

    // İtiraz yoksa bu kapı hiçbir şeyi değiştirmez: çağıranın kendi tavanı
    // (iade ≤ satış) zaten yeterlidir.
    if (active.isZero()) return;

    const total = params.alreadyReversedAmount
      .plus(active)
      .plus(params.requestedAmount);

    if (total.greaterThan(params.collectedAmount)) {
      throw new CollectionUnderChargebackException({
        collected: params.collectedAmount.toFixed(Money.PRECISION),
        alreadyReversed: params.alreadyReversedAmount.toFixed(Money.PRECISION),
        activeChargebacks: active.toFixed(Money.PRECISION),
        requested: params.requestedAmount.toFixed(Money.PRECISION),
      });
    }
  }
}
