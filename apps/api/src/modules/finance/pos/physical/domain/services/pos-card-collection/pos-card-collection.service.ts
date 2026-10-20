import { Inject, Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import PosTransactionKindSchema from '@input-type-schemas/PosTransactionKindSchema';
import PosTransactionStatusSchema from '@input-type-schemas/PosTransactionStatusSchema';
import {
  IPosTransactionCommandRepository,
  POS_TRANSACTION_COMMAND_REPOSITORY,
} from '@modules/finance/pos/physical/domain/repositories/pos-transaction/pos-transaction.command.repository';
import {
  IPosCardCollectionService,
  LockReversibleAmountParams,
} from '@modules/finance/pos/physical/domain/services/pos-card-collection/pos-card-collection.service.interface';
import {
  OriginalPosTransactionNotFoundException,
  PosTransactionAlreadyReversedException,
  PosTransactionNotRefundableException,
} from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';

@Injectable()
export class PosCardCollectionService implements IPosCardCollectionService {
  constructor(
    @Inject(POS_TRANSACTION_COMMAND_REPOSITORY)
    private readonly posTransactionRepo: IPosTransactionCommandRepository
  ) {}

  async lockAndGetReversibleAmount(
    params: LockReversibleAmountParams
  ): Promise<Decimal> {
    // Kilit önce, okuma sonra (aynı metotta): iade/iptal handler'ları da
    // satırı aynı yoldan kilitler, yani iki yol sıraya girer.
    const sale = await this.posTransactionRepo.findByIdForUpdate(
      params.posTransactionId
    );
    if (!sale) {
      throw new OriginalPosTransactionNotFoundException();
    }

    if (
      sale.kind !== PosTransactionKindSchema.enum.SALE ||
      sale.status !== PosTransactionStatusSchema.enum.SUCCESS
    ) {
      throw new PosTransactionNotRefundableException(
        'Kart itirazı yalnız başarılı bir SATIŞ işlemi için kaydedilebilir.'
      );
    }

    // Canlı iade/iptal özeti satır kilitliyken okunur (bkz. refund handler'ları).
    const reversal = await this.posTransactionRepo.findLiveReversalSummary(
      sale.id.value
    );
    if (reversal.hasActiveVoid) {
      throw new PosTransactionAlreadyReversedException();
    }

    return sale.amount.value.minus(reversal.refundedAmount);
  }
}
