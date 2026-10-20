/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
// Gerekçe: Prisma delegate'leri kasıtlı olarak gevşek tiplenmiş jest mock'larıyla
// taklit ediliyor; amaç dönen veri değil, üretilen `where` süzgeci.
import { Prisma } from '@prisma/client';
import { JournalQueryRepository } from './journal.query.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { INCOME_STATEMENT_ENTRY_KINDS } from '@modules/finance/accounting/posting/domain/posting/ledger-entry-kind.constant';

/**
 * Bu suite'in tek amacı bir P0 regresyonunu kilitlemek: **storno edilmiş fişler
 * defterden düşmemelidir.**
 *
 * Çift taraflı muhasebede storno kayıt silmez; orijinal fiş `REVERSED` olarak
 * yerinde kalır ve etkisini ters fiş götürür. Süzgeç yalnız `POSTED` olduğunda
 * orijinal raporlardan düşer, ters fiş kalır ve her hesabın bakiyesi orijinal
 * tutar kadar **ters işaretle** yanlış olur. Hata sessizdir: ters fiş kendi
 * içinde dengeli olduğu için mizanın "Σborç = Σalacak" kontrolü yine tutar.
 *
 * Aynı yanlış mizan yıl sonu kapanış fişini de beslediğinden sapma kalıcı hâle
 * gelir — bu yüzden altı sorgunun **hepsi** burada tek tek doğrulanır.
 */
describe('JournalQueryRepository — defterde etkili fiş süzgeci (P0)', () => {
  const EFFECTIVE = { in: ['POSTED', 'REVERSED'] };
  const DECIMAL_ZERO = new Prisma.Decimal(0);

  const buildRepo = () => {
    const journalLine = {
      groupBy: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({
        _sum: { debit: DECIMAL_ZERO, credit: DECIMAL_ZERO },
      }),
      findMany: jest.fn().mockResolvedValue([]),
    };
    const journalEntry = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const prisma = { journalLine, journalEntry } as unknown as PrismaService;
    return {
      repo: new JournalQueryRepository(prisma),
      journalLine,
      journalEntry,
    };
  };

  /** Fiş süzgeci (`where.entry` ya da doğrudan `where`) hangi durumları kabul ediyor? */
  const entryFilterOf = (call: any) => call.where.entry ?? call.where;

  it('mizan: groupBy POSTED ve REVERSED fişleri sayar', async () => {
    const { repo, journalLine } = buildRepo();
    await repo.trialBalance({ clinicId: 'c1' });

    expect(entryFilterOf(journalLine.groupBy.mock.calls[0][0]).status).toEqual(
      EFFECTIVE
    );
  });

  it('defter-i kebir: hem açılış devri hem hareketler storno edilmiş fişi içerir', async () => {
    const { repo, journalLine } = buildRepo();
    await repo.accountLedger({
      clinicId: 'c1',
      accountId: 'acc-100',
      dateFrom: new Date('2026-01-01'),
    });

    // Açılış devri de aynı süzgeçten geçmeli: aksi halde devir yanlış başlar ve
    // hata rapordaki bütün satırlara taşınır.
    expect(
      entryFilterOf(journalLine.aggregate.mock.calls[0][0]).status
    ).toEqual(EFFECTIVE);
    expect(entryFilterOf(journalLine.findMany.mock.calls[0][0]).status).toEqual(
      EFFECTIVE
    );
  });

  it('yevmiye defteri: storno edilmiş fiş listeden gizlenmez', async () => {
    const { repo, journalEntry } = buildRepo();
    await repo.journalReport({ clinicId: 'c1' }, {
      skip: 0,
      take: 20,
    } as never);

    // Resmî yevmiye defteri kronolojik ve eksiksizdir; iptal edilen kayıt
    // silinmez, `status` alanı iptal edildiğini söyler.
    expect(journalEntry.findMany.mock.calls[0][0].where.status).toEqual(
      EFFECTIVE
    );
    expect(journalEntry.count.mock.calls[0][0].where.status).toEqual(EFFECTIVE);
  });

  it('nakit akışı: açılış pozisyonu ve hareketler storno edilmiş fişi içerir', async () => {
    const { repo, journalLine } = buildRepo();
    await repo.cashFlow({
      clinicId: 'c1',
      accountIds: ['acc-100'],
      dateFrom: new Date('2026-01-01'),
    });

    expect(
      entryFilterOf(journalLine.aggregate.mock.calls[0][0]).status
    ).toEqual(EFFECTIVE);
    expect(entryFilterOf(journalLine.findMany.mock.calls[0][0]).status).toEqual(
      EFFECTIVE
    );
  });

  it('KDV beyanı: 391/191 hareketleri storno edilmiş fişi içerir', async () => {
    const { repo, journalLine } = buildRepo();
    await repo.vatDeclaration({
      clinicId: 'c1',
      outputAccountIds: ['acc-391'],
      inputAccountIds: ['acc-191'],
    });

    for (const call of journalLine.findMany.mock.calls) {
      expect(entryFilterOf(call[0]).status).toEqual(EFFECTIVE);
    }
    expect(journalLine.findMany).toHaveBeenCalledTimes(2);
  });

  it('banka mutabakatı adayları: storno edilmiş fişin satırı da adaydır', async () => {
    const { repo, journalLine } = buildRepo();
    await repo.bankLedgerLines({
      clinicId: 'c1',
      accountIds: ['acc-102'],
      dateFrom: new Date('2026-01-01'),
      dateTo: new Date('2026-01-31'),
    });

    expect(entryFilterOf(journalLine.findMany.mock.calls[0][0]).status).toEqual(
      EFFECTIVE
    );
  });
});

/**
 * İkinci P0 regresyonu: **rapor aralığının son günü düşmemelidir.**
 *
 * `entryDate` tam bir zaman damgasıdır (olayın `occurredAt`'i), rapor isteği ise
 * bir gün taşır (`?dateTo=2026-01-31` → 00:00:00). Ham `lte: dateTo` ile aralığın
 * son günü tamamen rapordan düşüyordu: ayın son günü KDV beyanında görünmüyor
 * (yasal bildirim eksik), banka mutabakatı adayları arasında bulunmuyor (ekstre
 * satırı kalıcı `UNMATCHED` kalıyor), mizan/kebir/yevmiye son günü atlıyordu.
 *
 * Üçüncü iddia **devir ↔ hareket bölüşümü**: açılış devri (`lt: dateFrom`) ile
 * hareketler (`gte: dateFrom`) aynı değerden türemek zorundadır. İki ayrı yerde
 * hesaplanırsa bir fiş ya iki kez sayılır ya hiç sayılmaz — kapanış bakiyesi
 * sessizce kayar.
 */
describe('JournalQueryRepository — rapor aralığı gün sınırları (P0)', () => {
  const DECIMAL_ZERO = new Prisma.Decimal(0);
  const DATE_FROM = DateTimeManager.create('2026-01-01');
  const DATE_TO = DateTimeManager.create('2026-01-31');
  const EXPECTED_FROM = DateTimeManager.startOfDay(DATE_FROM);
  const EXPECTED_TO = DateTimeManager.endOfDay(DATE_TO);

  const buildRepo = () => {
    const journalLine = {
      groupBy: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({
        _sum: { debit: DECIMAL_ZERO, credit: DECIMAL_ZERO },
      }),
      findMany: jest.fn().mockResolvedValue([]),
    };
    const journalEntry = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const prisma = { journalLine, journalEntry } as unknown as PrismaService;
    return {
      repo: new JournalQueryRepository(prisma),
      journalLine,
      journalEntry,
    };
  };

  const entryFilterOf = (call: any) => call.where.entry ?? call.where;
  const rangeOf = (call: any) => entryFilterOf(call).entryDate;

  const expectDayBoundaries = (call: any) => {
    expect(rangeOf(call)).toEqual({ gte: EXPECTED_FROM, lte: EXPECTED_TO });
  };

  it('mizan: aralık gün başı → gün sonu', async () => {
    const { repo, journalLine } = buildRepo();
    await repo.trialBalance({
      clinicId: 'c1',
      dateFrom: DATE_FROM,
      dateTo: DATE_TO,
    });

    expectDayBoundaries(journalLine.groupBy.mock.calls[0][0]);
  });

  it('defter-i kebir: devir `lt`, hareketler `gte` — aynı gün başı değerinden', async () => {
    const { repo, journalLine } = buildRepo();
    await repo.accountLedger({
      clinicId: 'c1',
      accountId: 'acc-100',
      dateFrom: DATE_FROM,
      dateTo: DATE_TO,
    });

    expect(rangeOf(journalLine.aggregate.mock.calls[0][0])).toEqual({
      lt: EXPECTED_FROM,
    });
    expectDayBoundaries(journalLine.findMany.mock.calls[0][0]);
  });

  it('yevmiye defteri: aralık gün başı → gün sonu', async () => {
    const { repo, journalEntry } = buildRepo();
    await repo.journalReport(
      { clinicId: 'c1', dateFrom: DATE_FROM, dateTo: DATE_TO },
      { skip: 0, take: 20 } as never
    );

    expectDayBoundaries(journalEntry.findMany.mock.calls[0][0]);
  });

  it('nakit akışı: açılış pozisyonu `lt`, hareketler gün sonuna kadar', async () => {
    const { repo, journalLine } = buildRepo();
    await repo.cashFlow({
      clinicId: 'c1',
      accountIds: ['acc-100'],
      dateFrom: DATE_FROM,
      dateTo: DATE_TO,
    });

    expect(rangeOf(journalLine.aggregate.mock.calls[0][0])).toEqual({
      lt: EXPECTED_FROM,
    });
    expectDayBoundaries(journalLine.findMany.mock.calls[0][0]);
  });

  it('KDV beyanı: ayın son günü aralığa girer (yasal bildirim eksik çıkmaz)', async () => {
    const { repo, journalLine } = buildRepo();
    await repo.vatDeclaration({
      clinicId: 'c1',
      outputAccountIds: ['acc-391'],
      inputAccountIds: ['acc-191'],
      dateFrom: DATE_FROM,
      dateTo: DATE_TO,
    });

    for (const call of journalLine.findMany.mock.calls) {
      expectDayBoundaries(call[0]);
    }
  });

  it('banka mutabakatı adayları: son günün fişi aday kümesine girer', async () => {
    const { repo, journalLine } = buildRepo();
    await repo.bankLedgerLines({
      clinicId: 'c1',
      accountIds: ['acc-102'],
      dateFrom: DATE_FROM,
      dateTo: DATE_TO,
    });

    expectDayBoundaries(journalLine.findMany.mock.calls[0][0]);
  });

  it('açık uçlu rapor: aralık süzgeci hiç kurulmaz', async () => {
    const { repo, journalLine } = buildRepo();
    await repo.trialBalance({ clinicId: 'c1' });

    expect(rangeOf(journalLine.groupBy.mock.calls[0][0])).toBeUndefined();
  });
});

/**
 * Üçüncü P0 regresyonu: **kapanış fişi gelir tablosuna karışmamalıdır.**
 *
 * Yıl sonu kapanış fişi 6/7 hesaplarını ters kayıtla sıfırlar. Gelir tablosu onu
 * sayarsa kapanmış yılın cirosu **sıfır** görünür — kapanış satırları gerçek
 * satışları birebir götürür ve hata sessizdir (fiş kendi içinde dengeli).
 *
 * Simetrik iddia: mizan ve bilanço `kinds` vermez → kapanış fişi SAYILIR. Bilanço
 * için bu zorunludur, kârı öz kaynağa (590) taşıyan kayıt odur; dışlansaydı aynı
 * kâr iki kez görünürdü (hem 6/7 hem 590).
 */
describe('JournalQueryRepository — fiş niteliği süzgeci (P0)', () => {
  const buildRepo = () => {
    const journalLine = { groupBy: jest.fn().mockResolvedValue([]) };
    const prisma = { journalLine } as unknown as PrismaService;
    return { repo: new JournalQueryRepository(prisma), journalLine };
  };

  it('kinds verilirse süzgeç kurulur (gelir tablosu: OPERATIONAL + ADJUSTING, CLOSING hariç)', async () => {
    const { repo, journalLine } = buildRepo();
    await repo.trialBalance({
      clinicId: 'c1',
      kinds: INCOME_STATEMENT_ENTRY_KINDS,
    });

    // Tahakkuk (ADJUSTING) ekonomiktir ve gelir tablosunda SAYILIR; kapanış (CLOSING) sayılmaz.
    expect(journalLine.groupBy.mock.calls[0][0].where.entry.kind).toEqual({
      in: ['OPERATIONAL', 'ADJUSTING'],
    });
  });

  it('kinds verilmezse süzgeç KURULMAZ (mizan/bilanço kapanışı da sayar)', async () => {
    const { repo, journalLine } = buildRepo();
    await repo.trialBalance({ clinicId: 'c1' });

    expect(journalLine.groupBy.mock.calls[0][0].where.entry).not.toHaveProperty(
      'kind'
    );
  });
});

/**
 * Yevmiye listesi **kliniğin** defteridir. Eskiden yalnız `organizationId` ile
 * süzülüyordu: handler erişimi `clinicId` için doğruluyor ama satırlar organizasyonun
 * TÜM kliniklerinden geliyordu — aynı organizasyondaki başka kliniğin fişi
 * (franchise'da başka bir işletmenin defteri) listede görünüyordu.
 */
describe('JournalQueryRepository — liste klinik defteriyle sınırlı (P1)', () => {
  const buildRepo = () => {
    const journalEntry = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const prisma = { journalEntry } as unknown as PrismaService;
    return { repo: new JournalQueryRepository(prisma), journalEntry };
  };

  it('where hem organizationId hem clinicId taşır', async () => {
    const { repo, journalEntry } = buildRepo();
    await repo.findMany({ clinicId: 'c1', organizationId: 'o1' }, {
      skip: 0,
      take: 20,
    } as never);

    const where = journalEntry.findMany.mock.calls[0][0].where;
    expect(where.clinicId).toBe('c1');
    expect(where.organizationId).toBe('o1');
    // Sayım da aynı süzgeçten geçer: toplam, listelenen kümeyle tutarlı olmalı.
    expect(journalEntry.count.mock.calls[0][0].where.clinicId).toBe('c1');
  });
});
