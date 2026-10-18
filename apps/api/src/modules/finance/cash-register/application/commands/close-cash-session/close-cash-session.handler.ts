import { Inject } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FinancialEventTypeSchema } from '@shared';
import { IGetContext } from '@common/decorators/get-context.decorator';
import { CloseCashSessionCommand } from './close-cash-session.command';
import { CloseCashSessionResponse } from './close-cash-session.response';
import { CashSession } from '@modules/finance/cash-register/domain/entities/cash-session.entity';
import { CashSessionNotFoundException } from '@modules/finance/cash-register/domain/exceptions/cash-register.exceptions';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';
import { CASH_REGISTER_EVENTS } from '@src/domain/constants/events/cash-register.constant';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import {
  CASH_SESSION_COMMAND_REPOSITORY,
  ICashSessionCommandRepository,
} from '@modules/finance/cash-register/domain/repositories/cash-session/cash-session.command.repository';

@CommandHandler(CloseCashSessionCommand)
export class CloseCashSessionHandler implements ICommandHandler<
  CloseCashSessionCommand,
  CloseCashSessionResponse
> {
  constructor(
    @Inject(CASH_SESSION_COMMAND_REPOSITORY)
    private readonly cashSessionRepo: ICashSessionCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly commandBus: TSCommandBus,
    private readonly criticalFailure: CriticalFailurePublisher,
    private readonly txManager: TransactionManager
  ) {}

  async execute(
    command: CloseCashSessionCommand
  ): Promise<CloseCashSessionResponse> {
    const { sessionId, data, ctx } = command.payload;

    // Kritik finansal işlem → outboxRun (kapanış kaydı + muhasebe köprüsü atomik).
    // Oturum FOR UPDATE ile kilitlenerek yüklenir: eşzamanlı ikinci kapanış (veya
    // kapanış-sırasında-hareket) ilk tx commit olana kadar bloklanır, sonra CLOSED
    // okuyup close()→assertOpen()'da patlar (mükerrer kapanış/posting engellenir).
    return this.txManager.outboxRun(async () => {
      const session = await this.cashSessionRepo.findByIdForUpdate(sessionId);
      if (!session) throw new CashSessionNotFoundException(sessionId);

      this.policyFactory
        .finance(ctx.actor, ctx.source)
        .evaluator.check((p) =>
          p.canAccessClinicFinances(session.clinicId.value)
        )
        .orThrow(CASH_REGISTER_EVENTS.CLOSED);

      const { totalIn, totalOut } = await this.cashSessionRepo.sumMovements(
        session.id.value
      );

      session.close({
        totalIn,
        totalOut,
        countedAmount: new Decimal(data.countedAmount),
        closedById: ctx.actor.userId,
      });

      this.alarmOnNegativeDrawer(session);

      await this.postClosingToAccounting(session, ctx);
      await this.cashSessionRepo.update(session);

      return {
        sessionId: session.id.value,
        status: session.status,
        expectedAmount: (session.expectedAmount ?? new Decimal(0)).toFixed(2),
        countedAmount: (session.countedAmount ?? new Decimal(0)).toFixed(2),
        difference: (session.difference ?? new Decimal(0)).toFixed(2),
      };
    });
  }

  /**
   * Beklenen tutar negatifse çekmece bir noktada eksiye düşmüştür.
   *
   * Çıkış kapısı (`assertCanWithdraw`) bunu artık kaydın önünde durduruyor; geriye
   * yalnız kapı yokken yazılmış **eski** hareketler kalıyor. Bu durumda `fark =
   * sayım − beklenen` pozitif çıkar ve köprü onu "sayım fazlası" → 679 Diğer
   * Olağandışı Gelir olarak fişler; yani uydurma bir gelir. Kapanış bloke
   * EDİLMEZ (kasanın kapanabilmesi gerekir) ama sessiz de geçilmez: fiş atılmadan
   * önce uyarı çıkar, insanın bakması gerekir.
   */
  private alarmOnNegativeDrawer(session: CashSession): void {
    const expected = session.expectedAmount ?? new Decimal(0);
    if (!expected.isNegative()) return;

    this.criticalFailure.publish({
      operation: 'finance.cash-register.close-session',
      severity: 'CRITICAL',
      summary:
        'Kasa oturumu negatif beklenen tutarla kapandı: çıkışlar çekmecedeki ' +
        'nakdi aşmış. Sayım farkı gerçek bir fazla DEĞİL, eksi kasanın izidir.',
      errorMessage: null,
      context: {
        sessionId: session.id.value,
        expectedAmount: expected.toFixed(2),
        countedAmount: (session.countedAmount ?? new Decimal(0)).toFixed(2),
        difference: (session.difference ?? new Decimal(0)).toFixed(2),
      },
      clinicId: session.clinicId.value,
      dedupeKey: `cash-session-negative-drawer:${session.id.value}`,
    });
  }

  /**
   * Kasa→muhasebe köprüsü: kapanışta çakışmayan olayları (BANK_DEPOSIT + EXPENSE +
   * sayım farkı) tek FinancialEvent olarak yazar. SALE_COLLECTION postlanmaz —
   * Payment modülü zaten 100 Kasa'ya işliyor. dedupeKey ile idempotent; session
   * markAsPostedToAccounting ile iz bırakır (mükerrer/yarıda-kalma koruması).
   */
  private async postClosingToAccounting(
    session: CashSession,
    ctx: IGetContext
  ): Promise<void> {
    if (session.isPostedToAccounting()) return;

    const { bankDepositTotal, expenseTotal } =
      await this.cashSessionRepo.sumBridgeMovements(session.id.value);
    const difference = session.difference ?? new Decimal(0);

    const hasPostable =
      bankDepositTotal.gt(0) || expenseTotal.gt(0) || !difference.isZero();
    if (!hasPostable) return;

    const eventId = await this.commandBus.execute(
      new RecordFinancialEventCommand(
        {
          clinicId: session.clinicId.value,
          type: FinancialEventTypeSchema.enum.CASH_SESSION_CLOSED,
          payload: {
            bankDepositTotal: bankDepositTotal.toFixed(2),
            expenseTotal: expenseTotal.toFixed(2),
            difference: difference.toFixed(2),
            currency: session.currency,
          },
          sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.CASH_REGISTER,
          sourceRefId: session.id.value,
          dedupeKey: FinancialEventDedupeKeys.cash_session_closed(
            session.id.value
          ),
          performedById: ctx.actor.userId,
        },
        ctx
      )
    );

    session.markAsPostedToAccounting({ accountingEventId: eventId });
  }
}
