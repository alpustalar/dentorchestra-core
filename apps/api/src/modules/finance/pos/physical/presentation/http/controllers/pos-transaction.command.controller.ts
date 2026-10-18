import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import {
  GetContext,
  IGetContext,
} from '@common/decorators/get-context.decorator';
import { HasCapability } from '@common/decorators';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { BackfillPosAccountingEventsDto } from '@shared/modules/pos/dto/commands';
import { BackfillPosAccountingEventsCommand } from '@modules/finance/pos/physical/application/commands/backfill-pos-accounting-events/backfill-pos-accounting-events.command';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { POSTRANSACTION } = CAPABILITIES;

@Controller('transactions')
@UseGuards(AuthGuard, CapabilityGuard)
export class PosTransactionCommandController {
  constructor(private readonly commandBus: TSCommandBus) {}

  /**
   * Köprüsü kurulamamış POS tahsilatlarını muhasebeye işler (telafi turu).
   * İdempotent: `dedupeKey` sayesinde tekrar çalıştırmak mükerrer olay üretmez.
   */
  @HasCapability(POSTRANSACTION.create)
  @Post('backfill-accounting')
  backfillAccounting(
    @Body() data: BackfillPosAccountingEventsDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new BackfillPosAccountingEventsCommand({ data, ctx })
    );
  }
}
