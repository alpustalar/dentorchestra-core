import { Prisma } from '@prisma/client';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import {
  TrialBalanceFilter,
  TrialBalanceRow,
} from '@modules/finance/accounting/posting/domain/repositories/journal.repository';
import { buildLedgerEntryWhere } from './ledger-entry-where.builder';

type JournalDb = PrismaService | Prisma.TransactionClient;

/**
 * Mizan sorgusu tek yerde: raporlama (Query Repo) ve yıl sonu kapanış fişi
 * (Command Repo) aynı toplamı görmek zorunda — iki ayrı kopya zamanla ayrışırdı.
 *
 * `kinds` süzgeci yalnız gelir tablosunun ihtiyacıdır (kapanış fişi dışarıda);
 * mizan, bilanço ve kapanışın kendisi onu vermez → bütün nitelikler sayılır.
 */
export async function queryTrialBalance(
  db: JournalDb,
  filter: TrialBalanceFilter
): Promise<TrialBalanceRow[]> {
  const { entry } = buildLedgerEntryWhere(filter);

  const grouped = await db.journalLine.groupBy({
    by: ['accountId'],
    where: { entry },
    _sum: { debit: true, credit: true },
  });

  return grouped.map((row) => ({
    accountId: row.accountId,
    totalDebit: row._sum.debit ?? new Prisma.Decimal(0),
    totalCredit: row._sum.credit ?? new Prisma.Decimal(0),
  }));
}
