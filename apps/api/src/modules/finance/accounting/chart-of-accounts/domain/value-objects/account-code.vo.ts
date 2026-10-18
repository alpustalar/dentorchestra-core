import { InvalidAccountCodeException } from '@modules/finance/accounting/chart-of-accounts/domain/exceptions/chart-of-accounts.exceptions';

/** Hesap kodu biçimi: nokta ile ayrılmış rakam grupları (120, 600.04, 120.01.0001). */
const ACCOUNT_CODE_PATTERN = /^\d+(?:\.\d+)*$/;

export class AccountCode {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  public get value(): string {
    return this._value;
  }

  public get level(): number {
    return this._value.split('.').length;
  }

  public get parentCode(): string | null {
    if (this.isMainAccount()) {
      return null;
    }
    const segments = this.value.split('.');
    segments.pop();
    return segments.join('.');
  }

  /** Kullanıcı/şablon girdisi — doğrulanır. */
  public static create(codeStr: string): AccountCode {
    const cleanedCode = (codeStr ?? '').trim().replace(/\s+/g, '');

    if (!cleanedCode || !ACCOUNT_CODE_PATTERN.test(cleanedCode)) {
      throw new InvalidAccountCodeException(codeStr);
    }

    return new AccountCode(cleanedCode);
  }

  /**
   * DB'den okunan değer — doğrulama atlanır. Hidrasyon yolunda `create` çağırmak,
   * geçmişte yazılmış bir satır bugünkü biçimi tutmuyorsa okumayı tamamen
   * imkânsız kılardı (ve hatayı istek doğrulama hatası gibi gösterirdi).
   */
  public static fromTrusted(value: string): AccountCode {
    return new AccountCode(value);
  }

  public isMainAccount(): boolean {
    return !this._value.includes('.');
  }

  public equals(other: AccountCode): boolean {
    if (!other) return false;
    return this.value === other.value;
  }
}
