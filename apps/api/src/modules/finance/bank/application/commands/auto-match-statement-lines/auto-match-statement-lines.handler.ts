import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Decimal } from 'decimal.js';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  BANK_STATEMENT_LINE_COMMAND_REPOSITORY,
  IBankStatementLineCommandRepository,
} from '@modules/finance/bank/domain/repositories/bank-statement-line/bank-statement-line.repository';
import {
  BANK_STATEMENT_COMMAND_REPOSITORY,
  IBankStatementCommandRepository,
} from '@modules/finance/bank/domain/repositories/bank-statement/bank-statement.repository';
import { BankStatementNotFoundException } from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import { BankStatementLine } from '@modules/finance/bank/domain/entities/bank-statement-line.entity';
import {
  DEFAULT_MATCH_OPTIONS,
  describeMatch,
  findBestMatch,
  LedgerCandidate,
} from '@modules/finance/bank/domain/rules/statement-line-matcher';
import { GetBankLedgerLinesQuery } from '@modules/finance/accounting/posting/application/queries/get-bank-ledger-lines/get-bank-ledger-lines.query';
import { AutoMatchStatementLinesCommand } from './auto-match-statement-lines.command';
import { AutoMatchStatementLinesResponse } from './auto-match-statement-lines.response';

/**
 * Ekstre satırlarını 102 (Bankalar) defteriyle otomatik mutabık eder.
 *
 * Muhasebe fişi ÜRETMEZ — bu modül postlamaz, yalnız mutabakat kurar
 * (102 zaten payment/kasa köprüsünden besleniyor; postlamak mükerrer olurdu).
 */
@CommandHandler(AutoMatchStatementLinesCommand)
export class AutoMatchStatementLinesHandler implements ICommandHandler<
  AutoMatchStatementLinesCommand,
  AutoMatchStatementLinesResponse
> {
  private readonly logger = new Logger(AutoMatchStatementLinesHandler.name);

  constructor(
    @Inject(BANK_STATEMENT_LINE_COMMAND_REPOSITORY)
    private readonly bankStatementLineRepo: IBankStatementLineCommandRepository,
    // Ekstre dönemi taramanın kapsamını belirliyor (hangi satırlar hangi
    // adaylarla eşleşecek) → yazma kararını besleyen okuma, Command Repo'dan.
    @Inject(BANK_STATEMENT_COMMAND_REPOSITORY)
    private readonly bankStatementRepo: IBankStatementCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly queryBus: TSQueryBus,
    private readonly txManager: TransactionManager
  ) {}

  async execute(
    command: AutoMatchStatementLinesCommand
  ): Promise<AutoMatchStatementLinesResponse> {
    const { bankStatementId, data, ctx } = command.payload;

    const statement = await this.bankStatementRepo.findById(bankStatementId);
    if (!statement) {
      throw new BankStatementNotFoundException(bankStatementId);
    }

    const clinicId = statement.clinicId.value;

    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(clinicId))
      .orThrow('bank-statement.auto-match');

    const options = {
      dateToleranceDays:
        data.dateToleranceDays ?? DEFAULT_MATCH_OPTIONS.dateToleranceDays,
    };

    // Adaylar POSTED (değişmez) fiş satırları; bu okuma bir mutasyon kararını
    // beslese de defter append-only olduğu için replica gecikmesi yanlış eşleşme
    // üretmez — en kötü ihtimalle aday görünmez ve satır UNMATCHED kalır.
    const candidates = await this.loadCandidates({
      clinicId,
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      toleranceDays: options.dateToleranceDays,
      ctx,
    });

    return this.txManager.run(async () => {
      const lines =
        await this.bankStatementLineRepo.findUnmatchedByStatementId(
          bankStatementId
        );

      // Aynı 102 hareketinin iki ekstre satırına bağlanmasını engelle: hem daha
      // önce mutabık edilenler (DB) hem bu tur içinde tüketilenler (bellek).
      const alreadyUsed = new Set(
        await this.bankStatementLineRepo.findUsedMatchRefs(
          clinicId,
          candidates.map((c) => c.lineId)
        )
      );

      const touched: BankStatementLine[] = [];
      let matchedCount = 0;
      let ambiguousCount = 0;

      for (const line of lines) {
        const available = candidates.filter((c) => !alreadyUsed.has(c.lineId));
        const outcome = findBestMatch(line.toMatchable(), available, options);

        if (outcome.kind === 'AMBIGUOUS') {
          ambiguousCount++;
          continue;
        }
        if (outcome.kind === 'NONE') continue;

        const applied = line.autoMatch({
          matchedRef: outcome.best.candidate.lineId,
          matchNote: describeMatch(outcome.best),
          reconciledById: ctx.actor.userId,
        });
        if (!applied) continue;

        alreadyUsed.add(outcome.best.candidate.lineId);
        touched.push(line);
        matchedCount++;
      }

      await this.bankStatementLineRepo.updateMany(touched);

      const result: AutoMatchStatementLinesResponse = {
        bankStatementId,
        scannedCount: lines.length,
        matchedCount,
        ambiguousCount,
        unmatchedCount: lines.length - matchedCount - ambiguousCount,
      };

      this.logger.log(
        `Oto-eşleştirme (ekstre=${bankStatementId}): ${result.scannedCount} satır tarandı, ` +
          `${result.matchedCount} eşleşti, ${result.ambiguousCount} belirsiz, ${result.unmatchedCount} açık.`
      );

      return result;
    });
  }

  /**
   * 102 hareketlerini ekstre dönemi + tolerans kadar genişletilmiş aralıkta
   * çeker. Muhasebe modülüne QueryBus üzerinden gidilir (bounded context).
   */
  private async loadCandidates(
    input: LoadCandidatesInput
  ): Promise<LedgerCandidate[]> {
    const { data: rows } = await this.queryBus.execute(
      new GetBankLedgerLinesQuery({
        clinicId: input.clinicId,
        dateFrom: DateTimeManager.addDays(
          input.periodStart,
          -input.toleranceDays
        ),
        dateTo: DateTimeManager.addDays(input.periodEnd, input.toleranceDays),
        ctx: input.ctx,
      })
    );

    return rows.map((row) => ({
      lineId: row.lineId,
      entryId: row.entryId,
      entryNo: row.entryNo !== null ? BigInt(row.entryNo) : null,
      entryDate: row.entryDate,
      entryDescription: row.entryDescription,
      lineDesc: row.lineDesc,
      debit: new Decimal(row.debit),
      credit: new Decimal(row.credit),
    }));
  }
}

interface LoadCandidatesInput {
  clinicId: string;
  periodStart: Date;
  periodEnd: Date;
  toleranceDays: number;
  ctx: AutoMatchStatementLinesCommand['payload']['ctx'];
}
