import { z } from 'zod';
import { InvalidJournalEntrySequenceException } from '@modules/finance/shared/domain/exceptions';

export class JournalEntrySequence {
  private static readonly schema = z
    .string()
    .min(3, 'Yevmiye fiş numarası en az 3 karakter olmalıdır.')
    .max(30, 'Yevmiye fiş numarası en fazla 30 karakter olabilir.')
    .regex(/^[A-Z0-9-]+$/, 'Sadece büyük harf, rakam ve tire içerebilir.');
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  public get value(): string {
    return this._value;
  }

  /**
   * Ham sıra numarasından (DB'deki bigint) fiş numarası üretir: en az 3 hane
   * (`1n` → `'001'`). Hem fiş mühürlenirken hem de raporlarda aynı biçim kullanılır.
   */
  public static fromSequence(entryNo: bigint): JournalEntrySequence {
    return this.create(entryNo.toString().padStart(3, '0'));
  }

  public static create(value: string): JournalEntrySequence {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new InvalidJournalEntrySequenceException(
        result.error.issues.map((issue) => issue.message).join(' ')
      );
    }

    return new JournalEntrySequence(result.data);
  }
}
