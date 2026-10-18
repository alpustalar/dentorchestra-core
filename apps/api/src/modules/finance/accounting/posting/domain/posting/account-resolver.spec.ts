import {
  Account as IAccount,
  AccountSideSchema,
  AccountTypeSchema,
} from '@shared';
import { AccountResolver } from './account-resolver';
import {
  AccountCodeNotFoundException,
  AccountInactiveException,
  AccountNotPostableException,
} from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';

/**
 * `resolve()`'un her sonucu bir yevmiye satırının hesabı olur; bu yüzden hesabın
 * kendi değişmez kuralları burada zorlanır. Eskiden `isPostable` yalnız
 * `post-financial-event`'in satır döngüsündeydi — yıl sonu kapanışı (690/590/591)
 * ve kambiyo farkı satırı (646/656) bu kontrolden hiç geçmiyordu; `isActive` ise
 * hiçbir yerde okunmuyordu.
 */
describe('AccountResolver', () => {
  const account = (over: Partial<IAccount>): IAccount =>
    ({
      id: 'acc-1',
      clinicId: 'clinic-1',
      organizationId: 'org-1',
      parentId: null,
      code: '100',
      name: 'Kasa',
      type: AccountTypeSchema.enum.ASSET,
      normalSide: AccountSideSchema.enum.DEBIT,
      isPostable: true,
      requiresParty: false,
      currency: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...over,
    }) as IAccount;

  it('aktif ve yaprak hesabı çözer', () => {
    const resolver = new AccountResolver([account({})]);
    expect(resolver.resolve('100').id).toBe('acc-1');
  });

  it('hesap planında olmayan kodu reddeder', () => {
    const resolver = new AccountResolver([account({})]);
    expect(() => resolver.resolve('999')).toThrow(AccountCodeNotFoundException);
  });

  it('pasif hesabı reddeder', () => {
    // `isActive` bir kontrol olmalı, süs değil: pasife alınan hesap fişleri
    // sessizce kabul etmeye devam ediyordu.
    const resolver = new AccountResolver([account({ isActive: false })]);
    expect(() => resolver.resolve('100')).toThrow(AccountInactiveException);
  });

  it('kolektif (yaprak olmayan) hesabı reddeder', () => {
    const resolver = new AccountResolver([
      account({ code: '600', isPostable: false }),
    ]);
    expect(() => resolver.resolve('600')).toThrow(AccountNotPostableException);
  });
});
