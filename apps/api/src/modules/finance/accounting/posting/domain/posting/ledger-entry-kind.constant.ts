import { JournalEntryKind } from '@prisma/client';

/**
 * **Gelir tablosunun** saydığı fiş nitelikleri.
 *
 * Yıl sonu kapanış fişi 6/7 hesaplarını ters kayıtla sıfırlar (kârı 690 → 590'a
 * taşır). Bu teknik bir kayıttır, ekonomik bir olay değildir: gelir tablosu onu
 * sayarsa kapanmış yılın **cirosu sıfır** görünür — kapanış satırları gerçek
 * satışları birebir götürür. Hata sessizdir, çünkü kapanış fişi kendi içinde
 * dengelidir: mizanın "Σborç = Σalacak" kontrolü de, bilançonun "Aktif = Pasif"
 * kontrolü de tutmaya devam eder.
 *
 * **Bilanço bu kümeyi kullanmaz** ve kullanmamalıdır: kapanış fişi kârı öz kaynağa
 * taşıyan kayıttır. Kapanışı dışlayan bir bilanço, kapanmış yılda hem 6/7'yi hem
 * 590'ı sayar ve dönem sonucunu **iki kez** gösterir. İki raporun aynı veriye zıt
 * süzgeçlerle bakması tasarımın kendisidir, tutarsızlık değil.
 */
export const INCOME_STATEMENT_ENTRY_KINDS: readonly JournalEntryKind[] = [
  JournalEntryKind.OPERATIONAL,
  // Tahakkuk ekonomiktir: gider satırı (ör. 770) ait olduğu yılın gelir tablosunda
  // görünür, 1 Ocak'taki ters kaydı yeni yılda faturayla birlikte sıfırlanır. `CLOSING`'in
  // tersine dışlanırsa o yılın gideri eksik, ertesi yılın gideri fazla çıkar.
  JournalEntryKind.ADJUSTING,
];
