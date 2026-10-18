import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { BackfillLedgerEntriesCommand } from '@modules/finance/finance-ledger/application/commands/backfill-ledger-entries/backfill-ledger-entries.command';
import { BackfillLedgerEntriesDto } from '@shared/modules/finance-ledger/dto/commands';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

/**
 * Cari defterin tek yazma ucu **telafi** (backfill) işlemidir: normal akışta
 * cari hareket elle girilmez, tahsilat/iade olayından üretilir. Bu uç, olayın
 * kuyruğa hiç girememesi ya da işin kalıcı başarısız olması sonucu eksik kalan
 * kayıtları yazar ve durumu kaynaktan kaymış kayıtları hizalar
 * (CLAUDE.md finans kuralı 4).
 */
const { FINANCELEDGER } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@Controller('finance-ledger')
export class FinanceLedgerCommandController {
  constructor(private readonly commandBus: TSCommandBus) {}

  @HasCapability(FINANCELEDGER.create)
  @Post('reconciliation/backfill')
  backfill(
    @Body() dto: BackfillLedgerEntriesDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new BackfillLedgerEntriesCommand({ filter: dto, ctx })
    );
  }
}
