import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { FindPatientByIdQuery } from '@modules/crm/patient/application/queries/find-patient-by-id/find-patient-by-id.query';
import { EnsurePartyCommand } from '@modules/finance/party/application/commands/ensure-party/ensure-party.command';
import {
  EnsurePartyForPatientCommand,
  EnsurePartyForPatientResult,
} from './ensure-party-for-patient.command';
import { PartyOriginTypeSchema, PartyTypeSchema } from '@shared';
import { PatientNotFoundForPartyException } from '@modules/finance/party/domain/exceptions/party.exceptions';
import {
  ITenantScopeResolver,
  TENANT_SCOPE_RESOLVER,
} from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';

@CommandHandler(EnsurePartyForPatientCommand)
export class EnsurePartyForPatientHandler implements ICommandHandler<
  EnsurePartyForPatientCommand,
  EnsurePartyForPatientResult
> {
  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver
  ) {}

  async execute(
    command: EnsurePartyForPatientCommand
  ): Promise<EnsurePartyForPatientResult> {
    const { patientId, clinicId, role, ctx } = command;

    const { data: patient } = await this.queryBus.execute(
      new FindPatientByIdQuery(patientId, ctx)
    );
    if (!patient) {
      // `NotFoundException` (HTTP) application katmanında kullanılamaz.
      throw new PatientNotFoundForPartyException(patientId);
    }

    // Cari, işlemin geçtiği ŞUBENİN defterine yazılır; organizasyon da o
    // şubeden çözülür. `patient.organizationId` kullanmak, hastanın kayıtlı
    // olduğu şube farklı bir organizasyona bağlıysa (ortak klinik / sağlık
    // turizmi iş birliği) cariyi başka kiracının konsolide raporuna
    // damgalıyordu — defter satırları ise bu şubede kalıyordu.
    const organizationId = await this.tenantScopeResolver.resolve({ clinicId });

    const partyId = await this.commandBus.execute(
      new EnsurePartyCommand(
        {
          clinicId,
          organizationId,
          originType: PartyOriginTypeSchema.enum.PATIENT,
          originId: patient.id,
          role,
          type: PartyTypeSchema.enum.INDIVIDUAL,
          name:
            [patient.firstName, patient.lastName].filter(Boolean).join(' ') ||
            'İsimsiz Hasta',
          nationalId: patient.tcNo,
          email: patient.email,
          phone: patient.phone,
        },
        ctx
      )
    );

    return { partyId, organizationId };
  }
}
