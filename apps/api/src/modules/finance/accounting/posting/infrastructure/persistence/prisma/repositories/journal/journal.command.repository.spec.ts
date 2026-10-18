/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
// Gerekçe: Prisma delegate'leri gevşek tiplenmiş jest mock'larıyla taklit ediliyor;
// doğrulanan şey dönen kayıt değil, DB'ye giden payload.
import { JournalCommandRepository } from './journal.command.repository';
import { JournalEntry } from '@modules/finance/accounting/posting/domain/entities/journal-entry.entity';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';

describe('JournalCommandRepository', () => {
  const ENTRY_ID = '55555555-5555-4555-8555-555555555555';

  const buildRepo = () => {
    const journalEntry = {
      // Prisma nested create'i taklit eder: satırlar `entryId` kazanarak geri döner
      // (repo dönen kaydı entity'ye hidrate ediyor, satırsız kayıt reddedilir).
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({
          ...data,
          lines: data.lines.create.map((line: any) => ({
            ...line,
            entryId: data.id,
          })),
        })
      ),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = { journalEntry } as unknown as PrismaService;
    return { repo: new JournalCommandRepository(prisma), journalEntry };
  };

  /** Yabancı para fişi: debit/credit fonksiyonel (TRY), original* + kur izi dolu. */
  const buildFxEntry = () => {
    const entry = JournalEntry.createDraft({
      id: ENTRY_ID,
      clinicId: 'clinic-1',
      organizationId: 'org-1',
      periodId: 'period-2026',
      entryDate: new Date('2026-03-15'),
      lines: [
        {
          accountId: 'acc-100',
          debit: '3500',
          currency: 'TRY',
          originalDebit: '100',
          originalCurrency: 'USD',
          fxRate: '35',
        },
        {
          accountId: 'acc-600',
          credit: '3500',
          currency: 'TRY',
          originalCredit: '100',
          originalCurrency: 'USD',
          fxRate: '35',
        },
      ],
    });
    entry.post(100n);
    return entry;
  };

  it('yabancı para izini (original*/fxRate) DB payload’ına yazar', async () => {
    // P0 regresyonu: nested `lines.create` mapping'i alanları tek tek yazdığı için
    // `original*`/`fxRate` listeye eklenmemişti — entity hesaplıyor, kolon DB'de
    // var, veri sessizce düşüyordu. Hangi tutarın hangi kurla çevrildiği geri
    // getirilemez (VUK izlenebilirliği + kur farkı mutabakatı).
    const { repo, journalEntry } = buildRepo();

    await repo.create(buildFxEntry());

    const lines = journalEntry.create.mock.calls[0][0].data.lines.create;
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      accountId: 'acc-100',
      originalCurrency: 'USD',
    });
    expect(lines[0].originalDebit.toString()).toBe('100');
    expect(lines[0].fxRate.toString()).toBe('35');
    expect(lines[1].originalCredit.toString()).toBe('100');
  });

  it('applyReversal yalnız storno linkajını yazar ve olayı sonradan salar', async () => {
    const { repo, journalEntry } = buildRepo();
    const entry = buildFxEntry();
    entry.clearDomainEvents();
    entry.markReversed({ reversalId: 'rev-1', actorId: 'user-9' });

    expect(entry.getDomainEvents()).toHaveLength(1);
    await repo.applyReversal(entry);

    // Defter append-only: tek meşru mutasyon status + reversedById'dir.
    expect(
      Object.keys(journalEntry.update.mock.calls[0][0].data).sort()
    ).toEqual(['reversedById', 'status', 'updatedAt']);
    expect(journalEntry.update.mock.calls[0][0].data.status).toBe('REVERSED');
    // Olay linkaj yazıldıktan sonra salınır; tx geri alınırsa audit kaydı kalmaz.
    expect(entry.getDomainEvents()).toHaveLength(0);
  });
});
