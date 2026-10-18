import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ReconcileStatementLineCommand } from './reconcile-statement-line.command';
import {
  BANK_STATEMENT_LINE_COMMAND_REPOSITORY,
  IBankStatementLineCommandRepository,
} from '@modules/finance/bank/domain/repositories/bank-statement-line/bank-statement-line.repository';
import {
  BankStatementLineMatchRefAlreadyUsedException,
  BankStatementLineNotFoundException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import { BankStatementLineMatchStatusSchema } from '@input-type-schemas/BankStatementLineMatchStatusSchema';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@CommandHandler(ReconcileStatementLineCommand)
export class ReconcileStatementLineHandler implements ICommandHandler<
  ReconcileStatementLineCommand,
  void
> {
  constructor(
    @Inject(BANK_STATEMENT_LINE_COMMAND_REPOSITORY)
    private readonly bankStatementLineRepo: IBankStatementLineCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: ReconcileStatementLineCommand): Promise<void> {
    const { lineId, data, ctx } = command.payload;

    // Okuma da yazma da tek transaction içinde ve KİLİTLİ: manuel mutabakat ile
    // oto-eşleştirme taraması aynı satırı hedefleyebilir; kilitsiz okumada ikisi
    // de satırı UNMATCHED görüp aynı defter hareketini iki kez bağlar.
    await this.txManager.run(async () => {
      const line = await this.bankStatementLineRepo.findByIdForUpdate(lineId);
      if (!line) {
        throw new BankStatementLineNotFoundException(lineId);
      }

      this.policyFactory
        .finance(ctx.actor, ctx.source)
        .evaluator.check((p) => p.canAccessClinicFinances(line.clinicId.value))
        .orThrow('bank-statement-line.reconcile');

      // Aynı defter hareketi ikinci bir ekstre satırına bağlanamaz. Oto-eşleştirme
      // bunu zaten engelliyordu (`findUsedMatchRefs`); elle mutabakatta kontrol
      // yoktu — iki satır aynı 102 hareketine bağlanınca mutabakat özeti onu iki
      // kez "mutabık" sayar ve gerçekten mutabık olmayan bir hareket gizlenir.
      // Okuma satır kilidi altında: eşzamanlı iki mutabakat sıraya girer.
      await this.assertMatchRefAvailable({
        clinicId: line.clinicId.value,
        matchStatus: data.matchStatus,
        matchedRef: data.matchedRef,
        currentRef: line.matchedRef,
      });

      line.reconcile({
        matchStatus: data.matchStatus,
        matchedRef: data.matchedRef,
        matchNote: data.matchNote,
        reconciledById: ctx.actor.userId,
      });

      await this.bankStatementLineRepo.update(line);
    });
  }

  /**
   * Hedef referans başka bir satır tarafından kullanılıyor mu? Satırın **kendi**
   * mevcut referansını yeniden yazmak serbesttir (not düzeltme, idempotent
   * tekrar); yalnız referans değişiyorsa kontrol edilir.
   */
  private async assertMatchRefAvailable(input: {
    clinicId: string;
    matchStatus: ReconcileStatementLineCommand['payload']['data']['matchStatus'];
    matchedRef?: string | null;
    currentRef: string | null;
  }): Promise<void> {
    const isMatching =
      input.matchStatus === BankStatementLineMatchStatusSchema.enum.MATCHED;
    if (!isMatching || !input.matchedRef) return;
    if (input.matchedRef === input.currentRef) return;

    const used = await this.bankStatementLineRepo.findUsedMatchRefs(
      input.clinicId,
      [input.matchedRef]
    );
    if (used.length > 0) {
      throw new BankStatementLineMatchRefAlreadyUsedException({
        matchedRef: input.matchedRef,
      });
    }
  }
}
