import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { AssignPackageToPatientCommand } from './assign-package-to-patient.command';
import type { AssignPackageToPatientResponse } from './assign-package-to-patient.response';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { CreatePaymentCommand } from '@modules/finance/payment/application/commands/create-payment/create-payment.command';
import { TreatmentPackageNotFoundException } from '@modules/clinical/treatment-package/domain/exceptions/treatment-package.exceptions';
import { PatientTreatmentPackage } from '@modules/clinical/treatment-package/domain/entities/patient-treatment-package.entity';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  IPatientTreatmentPackageCommandRepository,
  PATIENT_TREATMENT_PACKAGE_COMMAND_REPO,
} from '@modules/clinical/treatment-package/domain/repositories/patient-treatment-package/patient-treatment-package.command.repository';
import {
  ITreatmentPackageCommandRepository,
  TREATMENT_PACKAGE_COMMAND_REPO,
} from '@modules/clinical/treatment-package/domain/repositories/treatment-package/treatment-package.command.repository';

@CommandHandler(AssignPackageToPatientCommand)
export class AssignPackageToPatientHandler
  implements
    ICommandHandler<
      AssignPackageToPatientCommand,
      AssignPackageToPatientResponse
    >
{
  constructor(
    @Inject(TREATMENT_PACKAGE_COMMAND_REPO)
    private readonly treatmentPackageRepo: ITreatmentPackageCommandRepository,
    @Inject(PATIENT_TREATMENT_PACKAGE_COMMAND_REPO)
    private readonly patientTreatmentPackageRepo: IPatientTreatmentPackageCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager,
    private readonly commandBus: TSCommandBus
  ) {}

  async execute(
    command: AssignPackageToPatientCommand
  ): Promise<AssignPackageToPatientResponse> {
    const { data, ctx } = command;

    const pkg = await this.treatmentPackageRepo.findById(data.packageId);
    if (!pkg) throw new TreatmentPackageNotFoundException();

    this.policyFactory
      .clinic(ctx.actor, ctx.source)
      .evaluator.check((p) => p.actorCanAccessTargetClinic(pkg.clinicId.value))
      .orThrow();

    const endDate = DateTimeManager.addDays(data.startDate, pkg.validityDays);
    const generatedPaymentUUID = UUID.generate();

    return this.txManager.run(async () => {
      await this.commandBus.execute(
        new CreatePaymentCommand(
          {
            clinicId: pkg.clinicId.value,
            patientId: data.patientId,
            amount: Number(pkg.price.value),
            providerId: data.providerId,
            currency: pkg.price.currency,
            method: data.method,
          },
          { paymentId: generatedPaymentUUID.value }
        )
      );

      const patientTreatmentPkg = PatientTreatmentPackage.create({
        patientId: data.patientId,
        packageId: data.packageId,
        providerId: data.providerId,
        startDate: data.startDate,
        endDate,
        notes: data.notes,
        paymentId: generatedPaymentUUID.value,
      });

      await this.patientTreatmentPackageRepo.create(patientTreatmentPkg);

      return {
        id: patientTreatmentPkg.id.value,
        paymentId: generatedPaymentUUID.value,
      };
    });
  }
}
