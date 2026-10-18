import { Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { FundsInTransitGate } from './funds-in-transit.gate';
import { IJournalCommandRepository } from '@modules/finance/accounting/posting/domain/repositories/journal.repository';
import { IAccountCommandRepository } from '@modules/finance/accounting/chart-of-accounts/domain/repositories/account/account.command.repository';
import { InsufficientFundsInTransitException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';

/**
 * 108'de bekleyen karttan fazlası kapatılamaz.
 *
 * Fazlası kapatılırsa hesap **alacak bakiyesine** düşer (bir hazır değer hesabı
 * için imkânsız) ve 102'ye hiç gelmemiş para girer. Fiş kendi içinde dengeli
 * olduğu için Σborç = Σalacak kontrolü uyarmaz — §81'deki kasa çekmecesiyle
 * aynı sınıf hata, bu yüzden kontrol kaydın önünde durur.
 */
describe('FundsInTransitGate', () => {
  const CLINIC_ID = randomUUID();
  const ACCOUNT_108 = randomUUID();

  const build = (
    options: {
      balance?: string;
      codeMap?: Record<string, string>;
    } = {}
  ) => {
    const calls: string[] = [];

    const accountCommandRepo = {
      findIdByCodeMap: jest.fn(() => {
        calls.push('codeMap');
        return Promise.resolve(
          options.codeMap ?? { '100': randomUUID(), '108': ACCOUNT_108 }
        );
      }),
    } as unknown as IAccountCommandRepository;

    // Kilitsiz okuma yolu (`trialBalance`) bilerek tanımsız: kapı onu
    // kullanırsa test patlar — kilit altında okumak sözleşmenin parçası.
    const lockAndGetAccountBalance = jest.fn(() => {
      calls.push('lockAndGetBalance');
      return Promise.resolve(new Prisma.Decimal(options.balance ?? '10000.00'));
    });
    const journalCommandRepo = {
      lockAndGetAccountBalance,
    } as unknown as IJournalCommandRepository;

    return {
      gate: new FundsInTransitGate(journalCommandRepo, accountCommandRepo),
      lockAndGetAccountBalance,
      calls,
    };
  };

  it('bakiye yeterliyse geçer', async () => {
    const { gate } = build({ balance: '10000.00' });

    await expect(
      gate.assertCanSettle({
        clinicId: CLINIC_ID,
        grossAmount: new Decimal('9999.99'),
      })
    ).resolves.toBeUndefined();
  });

  it('bakiyenin tamamı kapatılabilir (sınır tutar geçer)', async () => {
    const { gate } = build({ balance: '10000.00' });

    await expect(
      gate.assertCanSettle({
        clinicId: CLINIC_ID,
        grossAmount: new Decimal('10000.00'),
      })
    ).resolves.toBeUndefined();
  });

  it('bir kuruş fazlası reddedilir; hata iki tutarı taşır', async () => {
    const { gate } = build({ balance: '10000.00' });

    await expect(
      gate.assertCanSettle({
        clinicId: CLINIC_ID,
        grossAmount: new Decimal('10000.01'),
      })
    ).rejects.toMatchObject({
      meta: { available: '10000.00', requested: '10000.01' },
    });

    await expect(
      gate.assertCanSettle({
        clinicId: CLINIC_ID,
        grossAmount: new Decimal('10000.01'),
      })
    ).rejects.toBeInstanceOf(InsufficientFundsInTransitException);
  });

  it('bakiye sıfırken hiçbir kapama geçmez', async () => {
    const { gate } = build({ balance: '0' });

    await expect(
      gate.assertCanSettle({
        clinicId: CLINIC_ID,
        grossAmount: new Decimal('0.01'),
      })
    ).rejects.toBeInstanceOf(InsufficientFundsInTransitException);
  });

  it('bakiye kilitli okunur (kilitsiz yol kullanılmaz)', async () => {
    const { gate, lockAndGetAccountBalance, calls } = build();

    await gate.assertCanSettle({
      clinicId: CLINIC_ID,
      grossAmount: new Decimal('100.00'),
    });

    expect(lockAndGetAccountBalance).toHaveBeenCalledWith({
      clinicId: CLINIC_ID,
      accountId: ACCOUNT_108,
    });
    expect(calls).toEqual(['codeMap', 'lockAndGetBalance']);
  });

  it('hesap planı kurulmamışsa kapı GEÇİRİR ve uyarır', async () => {
    // `PeriodGateService` ile aynı tercih: muhasebesi kurulmamış şubede
    // operasyonel kaydı reddetmek kaydın kendisini imkânsız kılar. Korunacak
    // bir 108 bakiyesi de yoktur; fişlenemeyen olay süpürme uyarısıyla görünür.
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { gate, lockAndGetAccountBalance } = build({ codeMap: {} });

    await expect(
      gate.assertCanSettle({
        clinicId: CLINIC_ID,
        grossAmount: new Decimal('100.00'),
      })
    ).resolves.toBeUndefined();

    expect(lockAndGetAccountBalance).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('108'));

    warn.mockRestore();
  });
});
