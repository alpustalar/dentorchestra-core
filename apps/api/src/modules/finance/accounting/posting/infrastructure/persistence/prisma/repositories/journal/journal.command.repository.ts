import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import {
  JournalEntryNumberCollisionException,
  JournalEntryUniqueConstraintException,
} from '@modules/finance/accounting/posting/domain/exceptions/journal-entry.exceptions';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import {
  AccountBalanceLockParams,
  IJournalCommandRepository,
  TrialBalanceFilter,
  TrialBalanceRow,
} from '@modules/finance/accounting/posting/domain/repositories/journal.repository';
import { JournalEntry } from '@modules/finance/accounting/posting/domain/entities/journal-entry.entity';
import { JournalLine } from '@modules/finance/accounting/posting/domain/entities/journal-line.entity';
import { queryTrialBalance } from './journal-trial-balance.query';
import { FinancialEventTypeSchema } from '@shared';
import ChargebackFundsChannelSchema from '@input-type-schemas/ChargebackFundsChannelSchema';

type JournalEntryWithLines = Prisma.JournalEntryGetPayload<{
  include: { lines: true };
}>;

@Injectable()
export class JournalCommandRepository
  extends BaseRepository
  implements IJournalCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findByIdForUpdate(id: string): Promise<JournalEntry | null> {
    await this.lockRowForUpdate('journal_entries', id);
    const raw = await this.db.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });
    return raw ? this.toEntity(raw) : null;
  }

  async findByEventId(eventId: string): Promise<JournalEntry | null> {
    const raw = await this.db.journalEntry.findUnique({
      where: { eventId },
      include: { lines: true },
    });
    return raw ? this.toEntity(raw) : null;
  }

  trialBalance(filter: TrialBalanceFilter): Promise<TrialBalanceRow[]> {
    return queryTrialBalance(this.db, filter);
  }

  async lockAndGetAccountBalance(
    params: AccountBalanceLockParams
  ): Promise<Prisma.Decimal> {
    // Kilit önce: aynı kiracının aynı hesabına eşzamanlı iki hesap kapaması
    // bakiyeyi ikisi de "yeterli" görüp ikisi de yazarsa 108 eksiye düşer.
    await this.lockConcept(
      `account-balance:${params.clinicId}:${params.accountId}`
    );

    const [row] = await queryTrialBalance(this.db, {
      clinicId: params.clinicId,
    }).then((rows) => rows.filter((r) => r.accountId === params.accountId));

    if (!row) return new Prisma.Decimal(0);

    return row.totalDebit.minus(row.totalCredit);
  }

  async lockAndGetSpendableFundsInTransit(
    params: AccountBalanceLockParams
  ): Promise<Prisma.Decimal> {
    // Kilit + fişlenmiş bakiye (tek atomik adım); bekleyen kesintiler AYNI kilit
    // altında okunur — ikinci kapama birincinin olayını mutlaka görür, çünkü
    // birincinin olayı kilidi bırakan transaction'la birlikte commit olur.
    const posted = await this.lockAndGetAccountBalance(params);

    const settlement = FinancialEventTypeSchema.enum.PROVIDER_SETTLEMENT_RECEIVED;
    const opened = FinancialEventTypeSchema.enum.CARD_CHARGEBACK_OPENED;
    const inTransit = ChargebackFundsChannelSchema.enum.FUNDS_IN_TRANSIT;

    // Kesinti = 108'den çıkan brüt: kapamada `grossAmount`, itirazda `amount + feeAmount`
    // (yalnız 108 kanalından kesilenler). Fişi olan olay bakiyeye zaten yansımıştır.
    const [row] = await this.db.$queryRaw<{ pending: Prisma.Decimal }[]>(
      Prisma.sql`
        SELECT COALESCE(SUM(
          CASE e."type"::text
            WHEN ${settlement} THEN (e."payload"->>'grossAmount')::numeric
            WHEN ${opened} THEN
              CASE WHEN e."payload"->>'fundsChannel' = ${inTransit}
                THEN (e."payload"->>'amount')::numeric + (e."payload"->>'feeAmount')::numeric
                ELSE 0 END
            ELSE 0
          END
        ), 0) AS pending
        FROM "financial_events" e
        WHERE e."clinic_id" = ${params.clinicId}
          AND e."type"::text IN (${settlement}, ${opened})
          AND NOT EXISTS (
            SELECT 1 FROM "journal_entries" j WHERE j."event_id" = e."id"
          )
      `
    );

    return posted.minus(row?.pending ?? new Prisma.Decimal(0));
  }

  async create(entry: JournalEntry): Promise<JournalEntry> {
    const data = entry.toPersistence();
    const lines = entry.linesToPersistence();

    try {
      const raw = await this.db.journalEntry.create({
        data: {
          ...data,
          lines: {
            // Alanlar tek tek yazılır (spread değil): `entryId` nested create'te
            // Prisma tarafından kurulur, payload'da bulunamaz. Bu yüzden listeye
            // yeni kolon eklendiğinde buraya da eklenmesi ZORUNLUDUR — aksi halde
            // veri sessizce düşer. `original*`/`fxRate` tam bunun kurbanı olmuştu:
            // entity hesaplıyor, kolon DB'de var, mapping yazmıyordu → yabancı para
            // fişinde hangi tutarın hangi kurla çevrildiği kalıcı olarak kayboluyor
            // (VUK izlenebilirliği ve kur farkı mutabakatı imkânsızlaşır).
            create: lines.map((line) => ({
              id: line.id,
              accountId: line.accountId,
              partyId: line.partyId,
              debit: line.debit,
              credit: line.credit,
              currency: line.currency,
              originalDebit: line.originalDebit,
              originalCredit: line.originalCredit,
              originalCurrency: line.originalCurrency,
              fxRate: line.fxRate,
              lineDesc: line.lineDesc,
            })),
          },
        },
        include: { lines: true },
      });

      entry.flushEvents();
      return this.toEntity(raw);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Tabloda iki ayrı unique kısıt var; ikisini aynı hataya çevirmek teşhisi
        // yanlış yönlendirir. `eventId` çakışması normal bir idempotent tekrardır
        // (çağıran mevcut fişi bulup döner); `entryNo` çakışması ise tahsis
        // yolunun baypas edildiğini gösteren bir bütünlük arızasıdır.
        if (this.isEntryNoConstraint(error)) {
          throw new JournalEntryNumberCollisionException(
            data.periodId,
            entry.entryNo?.value ?? null
          );
        }
        throw new JournalEntryUniqueConstraintException();
      }
      throw error;
    }
  }

  /** P2002 hangi kısıttan geldi? Prisma `meta.target`'ı dizi ya da string verir. */
  private isEntryNoConstraint(
    error: Prisma.PrismaClientKnownRequestError
  ): boolean {
    const target = error.meta?.target;
    const fields = Array.isArray(target)
      ? target.join(',')
      : typeof target === 'string'
        ? target
        : '';
    return fields.includes('entry_no') || fields.includes('entryNo');
  }

  async applyReversal(entry: JournalEntry): Promise<void> {
    const data = entry.toPersistence();
    await this.db.journalEntry.update({
      where: { id: data.id },
      data: {
        status: data.status,
        reversedById: data.reversedById,
        updatedAt: data.updatedAt,
      },
    });
    // Storno denetim olayı yalnız linkaj DB'ye yazıldıktan sonra yayınlanır:
    // transaction geri alınırsa "fiş storno edildi" diye bir audit kaydı kalmaz.
    entry.flushEvents();
  }

  private toEntity(raw: JournalEntryWithLines): JournalEntry {
    const lines = raw.lines.map((line) => new JournalLine(line));
    return new JournalEntry(raw, lines);
  }
}
