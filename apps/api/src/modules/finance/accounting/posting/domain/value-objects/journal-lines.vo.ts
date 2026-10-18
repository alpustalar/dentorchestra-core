import { JournalLine } from '@modules/finance/accounting/posting/domain/entities/journal-line.entity';
import { JournalLine as IJournalLine } from '@shared';
import { JournalEntryInsufficientLinesException } from '@modules/finance/accounting/posting/domain/exceptions/journal-entry.exceptions';
import { UnbalancedJournalEntryException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';
import { Decimal } from 'decimal.js';

export class JournalLines {
  private readonly _items: JournalLine[];

  constructor(items: JournalLine[]) {
    // Toplam satır sayısı en az 2 olmalı - muhasebe kuralı
    if (items.length < 2)
      throw new JournalEntryInsufficientLinesException(items.length);
    this._items = items;
  }

  public get totalDebit(): Decimal {
    return this._items.reduce(
      (acc, line) => acc.plus(line.debit),
      new Decimal(0)
    );
  }

  public get isBalanced(): boolean {
    return this.totalDebit.equals(this.totalCredit);
  }

  public get totalCredit(): Decimal {
    return this._items.reduce(
      (acc, line) => acc.plus(line.credit),
      new Decimal(0)
    );
  }

  // Eğer koleksiyonu dışarıdan okumak gerekirse ( döngü için)
  public get items(): JournalLine[] {
    return [...this._items]; // Immutable koruması için kopya
  }

  /**
   * Çift taraflı kaydın tek değişmez kuralı: Σborç = Σalacak.
   *
   * Hata tutarları da taşır (`UnbalancedJournalEntryException.meta`). Önceki hâli
   * gövdesiz bir `BadRequestException('Fiş dengesiz.')` idi: modülün en kritik
   * invariant'ı tipsiz 400 dönüyor, farkın ne kadar olduğunu söylemiyordu — hem
   * arayüz hem log teşhis edemiyordu.
   */
  public validateBalance(): void {
    if (!this.totalDebit.equals(this.totalCredit)) {
      throw new UnbalancedJournalEntryException(
        this.totalDebit.toString(),
        this.totalCredit.toString()
      );
    }
  }

  public toPersistence(): IJournalLine[] {
    return this._items.map((line) => line.toPersistence());
  }
}
