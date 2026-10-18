import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import {
  GetContext,
  IGetContext,
} from '@common/decorators/get-context.decorator';
import { HasCapability } from '@common/decorators';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import {
  GetStalePosTransactionsFilterDto,
  GetUnbridgedPosTransactionsFilterDto,
} from '@shared/modules/pos/dto/queries';
import { FindStalePosTransactionsQuery } from '@modules/finance/pos/physical/application/queries/find-stale-pos-transactions/find-stale-pos-transactions.query';
import { FindUnbridgedPosTransactionsQuery } from '@modules/finance/pos/physical/application/queries/find-unbridged-pos-transactions/find-unbridged-pos-transactions.query';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { POSTRANSACTION } = CAPABILITIES;

/**
 * POS mutabakat ekranları.
 *
 * İki listenin de karşılığı bir "sessiz kayıp" senaryosudur: askıda kalan
 * işlemde kart çekilmiş olabilir ama sonuç hiç doğrulanmamıştır; köprüsü
 * kurulmamış tahsilatta para alınmış ama deftere hiç düşmemiştir.
 */
@Controller('transactions')
@UseGuards(AuthGuard, CapabilityGuard)
export class PosTransactionQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @HasCapability(POSTRANSACTION.read)
  @Get('stale-pending')
  stalePending(
    @Query() filter: GetStalePosTransactionsFilterDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new FindStalePosTransactionsQuery({ filter, ctx })
    );
  }

  @HasCapability(POSTRANSACTION.read)
  @Get('unbridged')
  unbridged(
    @Query() filter: GetUnbridgedPosTransactionsFilterDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new FindUnbridgedPosTransactionsQuery({ filter, ctx })
    );
  }
}
