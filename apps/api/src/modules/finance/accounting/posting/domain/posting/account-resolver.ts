import { Account } from '@shared';
import {
  AccountCodeNotFoundException,
  AccountInactiveException,
  AccountNotPostableException,
} from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';

/**
 * Hesap kodunu (ör. '120', '600.04') hesap planındaki kayda çözer.
 * Hesap planı tek sorguyla yüklenip bu resolver'a verilir (kod → account).
 */
export class AccountResolver {
  private readonly byCode = new Map<string, Account>();

  constructor(accounts: Account[]) {
    for (const account of accounts) {
      this.byCode.set(account.code, account);
    }
  }

  /**
   * Kodu çözer ve hesabın **kendi** değişmez kurallarını burada zorlar: var olmalı,
   * pasif olmamalı, fiş kabul etmeli (yaprak).
   *
   * Kontroller neden burada, çağıranda değil: `resolve()`'un her sonucu bir yevmiye
   * satırının hesabı olur. `isPostable` kontrolü eskiden yalnız
   * `post-financial-event` içinde, satır döngüsünde yapılıyordu — yıl sonu kapanışı
   * (690/590/591) ve kambiyo farkı satırı (646/656) bu kontrolden hiç geçmiyordu.
   * Tek kapı, kontrolün atlanabileceği yol bırakmaz.
   *
   * `requiresParty` burada değil: o hesabın değil **satırın** özelliğidir (party
   * verilmiş mi?), bu yüzden çağıranda kalır.
   */
  public resolve(code: string): Account {
    const account = this.byCode.get(code);
    if (!account) {
      throw new AccountCodeNotFoundException(code);
    }
    if (!account.isActive) {
      throw new AccountInactiveException(account.code);
    }
    if (!account.isPostable) {
      throw new AccountNotPostableException(account.code);
    }
    return account;
  }
}
