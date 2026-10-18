import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecordCashMovementCommand } from './record-cash-movement.command';
import {
  CASH_MOVEMENT_COMMAND_REPOSITORY,
  ICashMovementCommandRepository,
} from '@modules/finance/cash-register/domain/repositories/cash-movement/cash-movement.command.repository';
import { CashMovement } from '@modules/finance/cash-register/domain/entities/cash-movement.entity';
import { CashMovementDirectionSchema } from '@input-type-schemas/CashMovementDirectionSchema';
import { CashSessionNotFoundException } from '@modules/finance/cash-register/domain/exceptions/cash-register.exceptions';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { CASH_REGISTER_EVENTS } from '@src/domain/constants/events/cash-register.constant';
import {
  CASH_SESSION_COMMAND_REPOSITORY,
  ICashSessionCommandRepository,
} from '@modules/finance/cash-register/domain/repositories/cash-session/cash-session.command.repository';

@CommandHandler(RecordCashMovementCommand)
export class RecordCashMovementHandler implements ICommandHandler<
  RecordCashMovementCommand,
  void
> {
  constructor(
    @Inject(CASH_SESSION_COMMAND_REPOSITORY)
    private readonly cashSessionRepo: ICashSessionCommandRepository,
    @Inject(CASH_MOVEMENT_COMMAND_REPOSITORY)
    private readonly cashMovementRepo: ICashMovementCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: RecordCashMovementCommand): Promise<void> {
    const { sessionId, data, ctx } = command.payload;

    // Oturumu FOR UPDATE ile kilitle: hareket kaydı ile eşzamanlı kapanışı
    // serialize eder — kapanış-anında-hareket (kapanış sayımını bozan yarış) önlenir.
    await this.txManager.run(async () => {
      const session = await this.cashSessionRepo.findByIdForUpdate(sessionId);
      if (!session) throw new CashSessionNotFoundException(sessionId);

      this.policyFactory
        .finance(ctx.actor, ctx.source)
        .evaluator.check((p) =>
          p.canAccessClinicFinances(session.clinicId.value)
        )
        .orThrow(CASH_REGISTER_EVENTS.MOVEMENT_RECORD);

      // Yalnızca açık oturuma hareket kaydedilebilir (domain invariantı).
      session.assertOpen();

      const movement = CashMovement.record({
        cashSessionId: session.id.value,
        clinicId: session.clinicId.value,
        organizationId: session.organizationId.value,
        type: data.type,
        amount: data.amount,
        currency: session.currency,
        description: data.description,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        performedById: ctx.actor.userId,
      });

      // Çıkış, çekmecedeki nakitle sınırlıdır. Yön, hareketin **kendi**
      // türetmesinden okunur (IN/OUT eşlemesinin ikinci bir kopyası burada
      // tutulmaz); toplamlar oturum satırı kilitliyken aynı transaction içinde
      // Command Repo'dan okunur — kilitsiz okuma iki eşzamanlı çıkışın aynı
      // parayı iki kez harcamasına izin verirdi.
      if (movement.direction === CashMovementDirectionSchema.enum.OUT) {
        const totals = await this.cashSessionRepo.sumMovements(
          session.id.value
        );
        session.assertCanWithdraw({
          totalIn: totals.totalIn,
          totalOut: totals.totalOut,
          requested: movement.amount,
        });
      }

      await this.cashMovementRepo.create(movement);
    });
  }
}
