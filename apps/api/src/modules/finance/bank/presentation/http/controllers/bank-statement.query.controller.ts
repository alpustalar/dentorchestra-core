import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { PaginationDto } from '@shared';
import { GetBankStatementsFilterDto } from '@shared/modules/bank/dto/queries';
import { GetBankStatementsQuery } from '@modules/finance/bank/application/queries/get-bank-statements/get-bank-statements.query';
import { GetBankStatementByIdQuery } from '@modules/finance/bank/application/queries/get-bank-statement-by-id/get-bank-statement-by-id.query';
import { GetReconciliationSummaryQuery } from '@modules/finance/bank/application/queries/get-reconciliation-summary/get-reconciliation-summary.query';
import { GetLineMatchSuggestionsQuery } from '@modules/finance/bank/application/queries/get-line-match-suggestions/get-line-match-suggestions.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import {
  BankStatementResponseDto,
  LineMatchSuggestionResponseDto,
  ReconciliationSummaryResponseDto,
} from '@modules/finance/bank/presentation/http/dto/bank-response.dto';
import type { BankStatement as IBankStatement } from '@shared';
import type {
  BankStatementWithLines,
  LineMatchSuggestion,
  ReconciliationSummary,
} from '@modules/finance/bank/domain/contracts';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { BANKSTATEMENT, BANKSTATEMENTLINE } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@Controller('statements')
export class BankStatementQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @HasCapability(BANKSTATEMENT.read)
  @Get()
  @Serialize<IBankStatement, BankStatementResponseDto>(
    BankStatementResponseDto,
    { isArray: true }
  )
  list(
    @Query() dto: GetBankStatementsFilterDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetBankStatementsQuery({ filter: dto, pagination, ctx })
    );
  }

  @HasCapability(BANKSTATEMENT.read)
  @Get(':statementId')
  @Serialize<BankStatementWithLines, BankStatementResponseDto>(
    BankStatementResponseDto
  )
  getById(
    @Param('statementId', ParseUUIDPipe) statementId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetBankStatementByIdQuery(statementId, ctx)
    );
  }

  @HasCapability(BANKSTATEMENT.read)
  @Get(':statementId/reconciliation')
  @Serialize<ReconciliationSummary, ReconciliationSummaryResponseDto>(
    ReconciliationSummaryResponseDto
  )
  reconciliationSummary(
    @Param('statementId', ParseUUIDPipe) statementId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetReconciliationSummaryQuery(statementId, ctx)
    );
  }

  /** Elle mutabakat için aday öneri listesi (puan sıralı). */
  @HasCapability(BANKSTATEMENTLINE.read)
  @Get('lines/:lineId/suggestions')
  @Serialize<LineMatchSuggestion, LineMatchSuggestionResponseDto>(
    LineMatchSuggestionResponseDto,
    { isArray: true }
  )
  lineSuggestions(
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetLineMatchSuggestionsQuery(lineId, ctx));
  }
}
