import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VoidTreatmentChargeCommand } from './void-treatment-charge.command';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  ITreatmentChargeCommandRepository,
  TREATMENT_CHARGE_COMMAND_REPOSITORY,
} from '@modules/finance/treatment-charge/domain/repositories/treatment-charge/treatment-charge.command.repository';
import { TreatmentChargeNotFoundException } from '@modules/finance/treatment-charge/domain/exceptions/treatment-charge.exceptions';
import {
  IInvoiceIssuanceService,
  INVOICE_ISSUANCE_SERVICE,
} from '@modules/finance/invoice/domain/services/invoice-issuance/invoice-issuance.service.interface';
import { TREATMENT_CHARGE_EVENTS } from '@src/domain/constants/events';

/**
 * Satırı iptal eder. Silme yerine iptal: kayıt kalır, toplamlardan düşer —
 * "bu işlem neden faturaya girmedi" sorusunun cevabı kaybolmasın diye.
 */
@CommandHandler(VoidTreatmentChargeCommand)
export class VoidTreatmentChargeHandler implements ICommandHandler<
  VoidTreatmentChargeCommand,
  void
> {
  constructor(
    @Inject(TREATMENT_CHARGE_COMMAND_REPOSITORY)
    private readonly chargeRepo: ITreatmentChargeCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(INVOICE_ISSUANCE_SERVICE)
    private readonly invoiceIssuance: IInvoiceIssuanceService,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: VoidTreatmentChargeCommand): Promise<void> {
    const { chargeId, data, ctx } = command.payload;

    await this.txManager.run(async () => {
      // Kilitli okuma: iptal kararını besleyen durum, eşzamanlı indirim/iptal
      // isteğiyle yarışmasın (lost update + çift iptal).
      const charge = await this.chargeRepo.findByIdForUpdate(chargeId);
      if (!charge) throw new TreatmentChargeNotFoundException(chargeId);

      this.policyFactory
        .finance(ctx.actor, ctx.source)
        .evaluator.check(
          (p) => p.canAccessClinicFinances(charge.clinicId.value),
          'Bu işlem satırını iptal etme yetkiniz yok.'
        )
        .orThrow(TREATMENT_CHARGE_EVENTS.VOIDED);

      // Fatura kontrolü QueryBus yerine domain servisi üzerinden: yazmayı kapıda
      // durduran invariant, aynı transaction kapsamında Command Repo'dan okunur.
      await this.invoiceIssuance.assertAppointmentNotInvoiced(
        charge.appointmentId.value
      );

      charge.void({
        reason: data.reason,
        actorId: ctx.actor.userId,
        logSource: ctx.actor.source,
      });

      await this.chargeRepo.update(charge);
    });
  }
}
