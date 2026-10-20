import { Inject, Injectable, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import {
  IJournalCommandRepository,
  JOURNAL_COMMAND_REPOSITORY,
} from '@modules/finance/accounting/posting/domain/repositories/journal.repository';
import {
  ACCOUNT_COMMAND_REPOSITORY,
  IAccountCommandRepository,
} from '@modules/finance/accounting/chart-of-accounts/domain/repositories/account/account.command.repository';
import {
  AssertCanSettleParams,
  IFundsInTransitGate,
} from '@modules/finance/accounting/posting/domain/services/funds-in-transit/funds-in-transit.gate.interface';
import { ACCOUNTING_RULES } from '@modules/finance/shared/domain/constants/accounting-rules.constant';
import { InsufficientFundsInTransitException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';
import { Money } from '@src/domain/value-objects/money.vo';

@Injectable()
export class FundsInTransitGate implements IFundsInTransitGate {
  private readonly logger = new Logger(FundsInTransitGate.name);

  constructor(
    @Inject(JOURNAL_COMMAND_REPOSITORY)
    private readonly journalCommandRepo: IJournalCommandRepository,
    @Inject(ACCOUNT_COMMAND_REPOSITORY)
    private readonly accountCommandRepo: IAccountCommandRepository
  ) {}

  async assertCanSettle(params: AssertCanSettleParams): Promise<void> {
    const codeMap = await this.accountCommandRepo.findIdByCodeMap(
      params.clinicId
    );
    const accountId = codeMap[ACCOUNTING_RULES.TARGET_ACCOUNTS.POS_108];

    // Hesap planı hiç kurulmamış şubede 108 diye bir hesap yok: korunacak bakiye
    // de yok. Kapıyı burada **geçiriyoruz** — `PeriodGateService` ile aynı tercih:
    // muhasebesi kurulmamış bir şubede operasyonel kaydı reddetmek, kaydın
    // kendisini imkânsız kılar; fişlenemeyen olay zaten süpürme uyarısıyla
    // görünür kalır (CLAUDE.md finans kuralı 4).
    if (!accountId) {
      this.logger.warn(
        `108 hesabı yok (clinicId=${params.clinicId}); hesap kapaması bakiye kontrolü yapılmadı.`
      );
      return;
    }

    const balance = await this.journalCommandRepo.lockAndGetSpendableFundsInTransit({
      clinicId: params.clinicId,
      accountId,
    });

    const available = new Decimal(balance.toString());

    if (params.grossAmount.greaterThan(available)) {
      throw new InsufficientFundsInTransitException({
        available: available.toFixed(Money.PRECISION),
        requested: params.grossAmount.toFixed(Money.PRECISION),
      });
    }
  }
}
