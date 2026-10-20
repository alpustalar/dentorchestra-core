import {
  Controller,
  Get,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import type { JournalEntry } from '@shared';
import { PaginationDto } from '@shared';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetJournalEntriesQuery } from '@modules/finance/accounting/posting/application/queries/get-journal-entries/get-journal-entries.query';
import { JournalEntryStatusType } from '@input-type-schemas/JournalEntryStatusSchema';
import { Serialize } from '@common/decorators/serialize.decorator';
import { JournalEntryResponseDto } from '@modules/finance/accounting/posting/presentation/http/dto/journal-entry-response.dto';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { JOURNALENTRY } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(JOURNALENTRY.read)
@Controller('journal-entries')
export class JournalQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}
  @Get()
  @Serialize<JournalEntry, JournalEntryResponseDto>(JournalEntryResponseDto, {
    isArray: true,
  })
  getEntries(
    @GetContext() ctx: IGetContext,
    @Query() pagination: PaginationDto,
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    // Opsiyonel: verilmezse clinicId'den çözülür (TENANT_SCOPE_RESOLVER).
    @Query('organizationId', new ParseUUIDPipe({ optional: true }))
    organizationId?: string | null,
    @Query('status') status?: JournalEntryStatusType,
    @Query('periodId') periodId?: string
  ) {
    return this.queryBus.execute(
      new GetJournalEntriesQuery({
        organizationId,
        clinicId,
        pagination,
        ctx,
        status,
        periodId,
      })
    );
  }
}
