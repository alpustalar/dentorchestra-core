import {
  BadRequestException,
  Controller,
  Get,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { PaginationDto } from '@shared';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetTrialBalanceQuery } from '@modules/finance/accounting/posting/application/queries/get-trial-balance/get-trial-balance.query';
import { GetAccountLedgerQuery } from '@modules/finance/accounting/posting/application/queries/get-account-ledger/get-account-ledger.query';
import { GetJournalReportQuery } from '@modules/finance/accounting/posting/application/queries/get-journal-report/get-journal-report.query';
import { GetIncomeStatementQuery } from '@modules/finance/accounting/posting/application/queries/get-income-statement/get-income-statement.query';
import { GetBalanceSheetQuery } from '@modules/finance/accounting/posting/application/queries/get-balance-sheet/get-balance-sheet.query';
import { GetCashFlowQuery } from '@modules/finance/accounting/posting/application/queries/get-cash-flow/get-cash-flow.query';
import { GetVatDeclarationQuery } from '@modules/finance/accounting/posting/application/queries/get-vat-declaration/get-vat-declaration.query';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { Serialize } from '@common/decorators/serialize.decorator';
import {
  AccountLedgerReportResponseDto,
  BalanceSheetReportResponseDto,
  CashFlowReportResponseDto,
  IncomeStatementReportResponseDto,
  JournalReportEntryResponseDto,
  TrialBalanceReportResponseDto,
  VatDeclarationReportResponseDto,
} from '@modules/finance/accounting/posting/presentation/http/dto/accounting-report-response.dto';
import type { TrialBalanceReport } from '@modules/finance/accounting/posting/application/queries/get-trial-balance/get-trial-balance.response';
import type { AccountLedgerReport } from '@modules/finance/accounting/posting/application/queries/get-account-ledger/get-account-ledger.response';
import type { JournalReportEntry } from '@modules/finance/accounting/posting/application/queries/get-journal-report/get-journal-report.response';
import type { IncomeStatementReport } from '@modules/finance/accounting/posting/application/queries/get-income-statement/get-income-statement.response';
import type { BalanceSheetReport } from '@modules/finance/accounting/posting/application/queries/get-balance-sheet/get-balance-sheet.response';
import type { CashFlowReport } from '@modules/finance/accounting/posting/application/queries/get-cash-flow/get-cash-flow.response';
import type { VatDeclarationReport } from '@modules/finance/accounting/posting/application/queries/get-vat-declaration/get-vat-declaration.response';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

/**
 * Resmî muhasebe raporları (şube/defter bazlı): Mizan, ileride Defter-i Kebir +
 * Yevmiye. Kapsam aktörün clinic bağlamıdır (clinic = source-of-truth).
 */
const { JOURNALENTRY } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(JOURNALENTRY.read)
@Controller('reports')
export class AccountingReportsQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @Get('trial-balance')
  @Serialize<TrialBalanceReport, TrialBalanceReportResponseDto>(
    TrialBalanceReportResponseDto
  )
  trialBalance(
    @GetContext() ctx: IGetContext,
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return this.queryBus.execute(
      new GetTrialBalanceQuery({
        clinicId,
        ctx,
        dateFrom: dateFrom ? DateTimeManager.create(dateFrom) : undefined,
        dateTo: dateTo ? DateTimeManager.create(dateTo) : undefined,
      })
    );
  }

  @Get('ledger')
  @Serialize<AccountLedgerReport, AccountLedgerReportResponseDto>(
    AccountLedgerReportResponseDto
  )
  ledger(
    @GetContext() ctx: IGetContext,
    @Query('accountCode') accountCode: string,
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    if (!accountCode) {
      throw new BadRequestException('accountCode zorunludur.');
    }
    return this.queryBus.execute(
      new GetAccountLedgerQuery({
        clinicId,
        accountCode,
        ctx,
        dateFrom: dateFrom ? DateTimeManager.create(dateFrom) : undefined,
        dateTo: dateTo ? DateTimeManager.create(dateTo) : undefined,
      })
    );
  }

  @Get('journal')
  @Serialize<JournalReportEntry, JournalReportEntryResponseDto>(
    JournalReportEntryResponseDto,
    { isArray: true }
  )
  journal(
    @GetContext() ctx: IGetContext,
    @Query() pagination: PaginationDto,
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return this.queryBus.execute(
      new GetJournalReportQuery({
        clinicId,
        pagination,
        ctx,
        dateFrom: dateFrom ? DateTimeManager.create(dateFrom) : undefined,
        dateTo: dateTo ? DateTimeManager.create(dateTo) : undefined,
      })
    );
  }

  @Get('income-statement')
  @Serialize<IncomeStatementReport, IncomeStatementReportResponseDto>(
    IncomeStatementReportResponseDto
  )
  incomeStatement(
    @GetContext() ctx: IGetContext,
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    /** `compare=true` → önceki eşit uzunluktaki dönemle karşılaştırma eklenir. */
    @Query('compare') compare?: string
  ) {
    return this.queryBus.execute(
      new GetIncomeStatementQuery({
        clinicId,
        ctx,
        dateFrom: dateFrom ? DateTimeManager.create(dateFrom) : undefined,
        dateTo: dateTo ? DateTimeManager.create(dateTo) : undefined,
        compare: compare === 'true',
      })
    );
  }

  @Get('balance-sheet')
  @Serialize<BalanceSheetReport, BalanceSheetReportResponseDto>(
    BalanceSheetReportResponseDto
  )
  balanceSheet(
    @GetContext() ctx: IGetContext,
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    /**
     * Fotoğraf tarihi. Bilanço bir **an** raporudur: tek tarih alır, aralık almaz.
     * `dateFrom` kasıtlı olarak kaldırıldı — alt sınır varlık/kaynak hesaplarının
     * kümülatif bakiyesini keserdi ve hata `isBalanced` totolojik olduğu için
     * sessiz kalırdı.
     */
    @Query('asOf') asOf?: string
  ) {
    return this.queryBus.execute(
      new GetBalanceSheetQuery({
        clinicId,
        ctx,
        asOf: asOf ? DateTimeManager.create(asOf) : undefined,
      })
    );
  }

  @Get('cash-flow')
  @Serialize<CashFlowReport, CashFlowReportResponseDto>(
    CashFlowReportResponseDto
  )
  cashFlow(
    @GetContext() ctx: IGetContext,
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return this.queryBus.execute(
      new GetCashFlowQuery({
        clinicId,
        ctx,
        dateFrom: dateFrom ? DateTimeManager.create(dateFrom) : undefined,
        dateTo: dateTo ? DateTimeManager.create(dateTo) : undefined,
      })
    );
  }

  @Get('vat-declaration')
  @Serialize<VatDeclarationReport, VatDeclarationReportResponseDto>(
    VatDeclarationReportResponseDto
  )
  vatDeclaration(
    @GetContext() ctx: IGetContext,
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return this.queryBus.execute(
      new GetVatDeclarationQuery({
        clinicId,
        ctx,
        dateFrom: dateFrom ? DateTimeManager.create(dateFrom) : undefined,
        dateTo: dateTo ? DateTimeManager.create(dateTo) : undefined,
      })
    );
  }
}
