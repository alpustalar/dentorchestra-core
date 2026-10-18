import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { ReverseJournalEntryCommand } from '@modules/finance/accounting/posting/application/commands/reverse-journal-entry/reverse-journal-entry.command';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { JOURNALENTRY } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@Controller('journal-entries')
export class JournalCommandController {
  constructor(private readonly commandBus: TSCommandBus) {}

  /**
   * Storno: POSTED fişi ters kayıtla iptal eder; dönen değer storno fişinin id'si.
   *
   * Yetki `create` değil **`delete`**: storno, defterdeki bir kaydın etkisini
   * götüren yıkıcı bir düzeltmedir — fiş üretmek (ki normalde sistem yapar) ile
   * aynı yetkiye bağlanmamalıdır (CLAUDE.md finans kuralı 7). Bugün `fullAccess`
   * taşıyan roller ikisine de sahip olduğundan davranış değişmez; ayrım rol
   * matrisinde `fullAccess(...ACCOUNTING)` → `manage(...ACCOUNTING)` yapılınca
   * tek satırda etkinleşir (bkz. `documents/finans/09-guvence-denetimi.md`).
   */
  @HasCapability(JOURNALENTRY.delete)
  @Post(':id/reverse')
  reverse(
    @GetContext() ctx: IGetContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string
  ) {
    return this.commandBus.execute(
      new ReverseJournalEntryCommand({ entryId: id, ctx, reason })
    );
  }
}
