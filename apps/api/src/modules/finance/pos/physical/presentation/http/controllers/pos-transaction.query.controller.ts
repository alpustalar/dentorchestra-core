import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import {
  GetContext,
  IGetContext,
} from '@common/decorators/get-context.decorator';
import { HasCapability } from '@common/decorators';
import { Serialize } from '@common/decorators/serialize.decorator';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import {
  GetStalePosTransactionsFilterDto,
  GetUnbridgedPosTransactionsFilterDto,
} from '@shared/modules/pos/dto/queries';
import { FindStalePosTransactionsQuery } from '@modules/finance/pos/physical/application/queries/find-stale-pos-transactions/find-stale-pos-transactions.query';
import { FindUnbridgedPosTransactionsQuery } from '@modules/finance/pos/physical/application/queries/find-unbridged-pos-transactions/find-unbridged-pos-transactions.query';
import { GetPosTransactionByIdQuery } from '@modules/finance/pos/physical/application/queries/get-pos-transaction-by-id/get-pos-transaction-by-id.query';
import { PosTransactionSummary } from '@modules/finance/pos/physical/domain/contracts/pos-transaction';
import { PosTransactionStatusResponseDto } from '@modules/finance/pos/physical/presentation/http/dto/pos-transaction-status-response.dto';
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

  @HasCapability(POSTRANSACTION.read)
  @Get(':id')
  @Serialize<PosTransactionSummary, PosTransactionStatusResponseDto>(
    PosTransactionStatusResponseDto
  )
  findById(
    @Param('id', ParseUUIDPipe) id: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetPosTransactionByIdQuery(id, ctx));
  }
}
