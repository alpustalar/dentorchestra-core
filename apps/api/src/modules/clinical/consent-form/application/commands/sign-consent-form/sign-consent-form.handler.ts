import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SignConsentFormCommand } from './sign-consent-form.command';
import { ConsentFormSubmission } from '@modules/clinical/consent-form/domain/entities/consent-form-submission.entity';
import {
  ConsentTemplateArchivedException,
  ConsentTemplateNotFoundException,
} from '@modules/clinical/consent-form/domain/exceptions/consent-form.exceptions';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { CONSENT_FORM_EVENTS } from '@src/domain/constants/events/consent-form.constant';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { PatientNotFoundException } from '@modules/crm/patient/domain/exceptions/patient.exceptions';
import {
  CONSENT_FORM_SUBMISSION_COMMAND_REPOSITORY,
  IConsentFormSubmissionCommandRepository,
} from '@modules/clinical/consent-form/domain/repositories/consent-form-submission/consent-form-submission.command.repository';
import {
  CONSENT_TEMPLATE_COMMAND_REPOSITORY,
  IConsentTemplateCommandRepository,
} from '@modules/clinical/consent-form/domain/repositories/consent-template/consent-template.command.repository';
import { TENANT_SCOPE_RESOLVER } from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import { ITenantScopeResolver } from '@shared';
import { GetPatientByIdQuery } from '@modules/crm/patient/application/queries/get-patient-by-id/get-patient-by-id.query';

@CommandHandler(SignConsentFormCommand)
export class SignConsentFormHandler
  implements ICommandHandler<SignConsentFormCommand, string>
{
  constructor(
    @Inject(CONSENT_FORM_SUBMISSION_COMMAND_REPOSITORY)
    private readonly consentFormSubmissionRepo: IConsentFormSubmissionCommandRepository,
    @Inject(CONSENT_TEMPLATE_COMMAND_REPOSITORY)
    private readonly consentTemplateRepo: IConsentTemplateCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    private readonly txManager: TransactionManager,
    private readonly queryBus: TSQueryBus
  ) {}

  async execute(command: SignConsentFormCommand): Promise<string> {
    const { patientId, data, ctx, clinicId } = command.payload;

    const organizationId = await this.tenantScopeResolver.resolve(
      command.payload
    );

    this.policyFactory
      .consentForm(ctx.actor, ctx.source)
      .evaluator.check((p) => p.canSignConsentForm(clinicId))
      .orThrow(CONSENT_FORM_EVENTS.SIGN);

    const { data: patient } = await this.queryBus.execute(
      new GetPatientByIdQuery(patientId, ctx)
    );
    if (!patient) throw new PatientNotFoundException();

    return this.txManager.run(async () => {
      const template = await this.consentTemplateRepo.findById(data.templateId);

      if (!template) {
        throw new ConsentTemplateNotFoundException(data.templateId);
      }
      if (!template.isActive) {
        throw new ConsentTemplateArchivedException(data.templateId);
      }

      const submission = ConsentFormSubmission.sign({
        organizationId,
        clinicId,
        patientId,
        templateId: template.id.value,
        templateVersion: template.version,
        templateTitleSnapshot: template.title,
        templateContentSnapshot: template.content,
        signatureImage: data.signatureImage,
        signedByUserId: ctx.actor.userId,
        appointmentId: data.appointmentId,
        treatmentId: data.treatmentId,
      });

      await this.consentFormSubmissionRepo.create(submission);

      return submission.id.value;
    });
  }
}
