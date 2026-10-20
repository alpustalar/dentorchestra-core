import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountingPeriodStatusSchema } from '@shared';
import { AccountingPeriodStatusType } from '@input-type-schemas/AccountingPeriodStatusSchema';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { AccountingPeriod } from '@modules/finance/accounting/periods/domain/entities/accounting-period.entity';
import { BaseCommandRepository } from '@src/infrastructure/persistence/prisma/base-command.repository';
import { DateTimeManager } from '@common/utils';
import {
  IAccountingPeriodCommandRepository,
  LedgerScope,
} from '@modules/finance/accounting/periods/domain/repositories/accounting-period/accounting-period.command.repository';
import {
  PeriodAlreadyExistsException,
  PeriodNotFoundException,
  PeriodNotOpenException,
} from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';
import { periodCoveringDateWhere } from './accounting-period-date.query';

const { OPEN, LOCKED, CLOSED } = AccountingPeriodStatusSchema.enum;

@Injectable()
export class AccountingPeriodCommandRepository
  extends BaseCommandRepository<AccountingPeriod>
  implements IAccountingPeriodCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(id: string): Promise<AccountingPeriod | null> {
    const raw = await this.db.accountingPeriod.findUnique({ where: { id } });
    return raw ? new AccountingPeriod(raw) : null;
  }

  async findByYear(
    clinicId: string,
    year: number
  ): Promise<AccountingPeriod | null> {
    const raw = await this.db.accountingPeriod.findUnique({
      where: { clinicId_year: { clinicId, year } },
    });
    return raw ? new AccountingPeriod(raw) : null;
  }

  async findByDate(
    clinicId: string,
    date: Date
  ): Promise<AccountingPeriod | null> {
    const raw = await this.db.accountingPeriod.findFirst({
      where: periodCoveringDateWhere(clinicId, date),
    });
    return raw ? new AccountingPeriod(raw) : null;
  }

  async findNotClosedBefore(
    clinicId: string,
    year: number
  ): Promise<AccountingPeriod[]> {
    const rows = await this.db.accountingPeriod.findMany({
      where: { clinicId, year: { lt: year }, status: { not: CLOSED } },
      orderBy: { year: 'asc' },
    });
    return rows.map((raw) => new AccountingPeriod(raw));
  }

  async findLedgerScopes(): Promise<LedgerScope[]> {
    const rows = await this.db.accountingPeriod.findMany({
      distinct: ['clinicId'],
      select: { clinicId: true, organizationId: true },
      orderBy: { clinicId: 'asc' },
    });
    return rows;
  }

  async create(period: AccountingPeriod): Promise<AccountingPeriod> {
    const data = period.toPersistence();
    try {
      const raw = await this.db.accountingPeriod.create({ data });
      period.flushEvents();
      return new AccountingPeriod(raw);
    } catch (error) {
      // `findByYear` ön kontrolü ile insert arasındaki pencerede ikinci istek
      // gelirse burada P2002 (clinicId_year) alınır; yarışı kaybeden taraf jenerik
      // 409 yerine tipli domain hatası görür.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new PeriodAlreadyExistsException(data.year);
      }
      throw error;
    }
  }

  async update(period: AccountingPeriod): Promise<AccountingPeriod> {
    const data = period.toPersistence();
    const { id, ...update } = data;
    const raw = await this.db.accountingPeriod.update({
      where: { id },
      // `lastEntryNo: undefined` → Prisma bu kolona dokunmaz. Sayaç yalnız
      // `lockAndAllocate*` tarafından, kilit altında ilerletilir; entity'nin anlık
      // görüntüsünden geri yazılırsa araya giren fiş tahsisleri sıfırlanır ve
      // yevmiye numarası mükerrerleşir.
      data: { ...update, lastEntryNo: undefined },
    });
    period.flushEvents();
    return new AccountingPeriod(raw);
  }

  claimForClosing(period: AccountingPeriod): Promise<boolean> {
    return this.claimTransition(period, [OPEN, LOCKED], CLOSED);
  }

  claimForLocking(period: AccountingPeriod): Promise<boolean> {
    return this.claimTransition(period, [OPEN], LOCKED);
  }

  claimForReopening(period: AccountingPeriod): Promise<boolean> {
    return this.claimTransition(period, [LOCKED], OPEN);
  }

  async lockAndAllocateEntryNo(periodId: string): Promise<bigint> {
    const allocated = await this.allocateEntryNo(periodId, OPEN);
    if (allocated === null) {
      // 0 satır: dönem ya yok ya da artık OPEN değil. Hangisi olduğunu yalnız
      // hata yolunda okuyoruz (mutlu yolda ekstra sorgu yok).
      const period = await this.findById(periodId);
      if (!period) throw new PeriodNotFoundException();
      throw new PeriodNotOpenException(periodId, period.status);
    }
    return allocated;
  }

  async lockAndAllocateClosingEntryNo(periodId: string): Promise<bigint> {
    const allocated = await this.allocateEntryNo(periodId);
    if (allocated === null) throw new PeriodNotFoundException();
    return allocated;
  }

  /**
   * Durum geçişini koşullu tek UPDATE ile uygular: satır kilidi eşzamanlı ikinci
   * isteği bekletir, commit sonrası beklenen durum artık tutmadığı için 0 satır
   * etkilenir. Damgalar (kim/ne zaman) entity'nin domain metodundan gelir.
   */
  private async claimTransition(
    period: AccountingPeriod,
    fromStatuses: AccountingPeriodStatusType[],
    toStatus: AccountingPeriodStatusType
  ): Promise<boolean> {
    const data = period.toPersistence();
    const result = await this.db.accountingPeriod.updateMany({
      where: { id: data.id, status: { in: fromStatuses } },
      data: {
        status: toStatus,
        lockedAt: data.lockedAt,
        lockedById: data.lockedById,
        reopenedAt: data.reopenedAt,
        reopenedById: data.reopenedById,
        closedAt: data.closedAt,
        closedById: data.closedById,
        updatedAt: DateTimeManager.create(),
      },
    });

    const claimed = result.count === 1;
    if (claimed) period.flushEvents();
    return claimed;
  }

  /**
   * Sayaç tahsisi. `$queryRaw` + `RETURNING`: Prisma'nın `update` API'si "koşul
   * tutmazsa 0 satır" ile "yeni değeri döndür"ü tek çağrıda birleştiremez
   * (`update` P2025 fırlatır, `updateMany` değeri döndürmez).
   */
  private async allocateEntryNo(
    periodId: string,
    requiredStatus?: AccountingPeriodStatusType
  ): Promise<bigint | null> {
    this.assertInTransaction('allocateEntryNo');

    const statusFilter = requiredStatus
      ? Prisma.sql`AND status = ${requiredStatus}::"AccountingPeriodStatus"`
      : Prisma.empty;

    const rows = await this.db.$queryRaw<{ last_entry_no: bigint }[]>(
      Prisma.sql`UPDATE "accounting_periods"
                    SET last_entry_no = last_entry_no + 1,
                        updated_at = NOW()
                  WHERE id = ${periodId} ${statusFilter}
              RETURNING last_entry_no`
    );

    return rows.length === 1 ? BigInt(rows[0].last_entry_no) : null;
  }
}
