import { z } from 'zod';
import { InvoiceNumberInvalidException } from '@modules/finance/invoice/domain/exceptions/invoice.exceptions';

export class InvoiceNumber {
  private readonly _value: string;

  // GİB standardı: 3 harf/rakam seri + 4 yıl + 9 sıra numarası = 16 karakter
  private static readonly SCHEMA = z
    .string()
    .length(16, 'Fatura numarası tam 16 karakter olmalıdır (AAA2026000000001).')
    .regex(
      /^[A-Z0-9]{3}\d{4}\d{9}$/,
      'Geçersiz fatura numarası formatı. Örnek: ABC2026000000001'
    );

  private constructor(value: string) {
    this._value = value;
  }

  public static create(value: string): InvoiceNumber {
    const normalized = value.trim().toUpperCase();
    const result = this.SCHEMA.safeParse(normalized);

    if (!result.success) {
      // Domain katmanı HTTP'den habersiz kalır: bu VO hem controller yolundan hem
      // e-belge kuyruk işleyicisinden (HTTP yok) çağrılıyor.
      throw new InvoiceNumberInvalidException({
        value: normalized,
        reason: result.error.issues[0].message,
      });
    }

    return new InvoiceNumber(result.data);
  }

  public get value(): string {
    return this._value;
  }

  public equals(other: InvoiceNumber): boolean {
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }
}
