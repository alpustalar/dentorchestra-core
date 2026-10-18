import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { FindOneWithIdOrEmailQuery } from '@modules/identity/user/application/queries/find-one-with-id-or-email/find-one-with-id-or-email.query';
import { EnsurePartyCommand } from '@modules/finance/party/application/commands/ensure-party/ensure-party.command';
import { EnsurePartyForEmployeeCommand } from './ensure-party-for-employee.command';
import {
  ITenantScopeResolver,
  PartyOriginTypeSchema,
  PartyRoleSchema,
  PartyTypeSchema,
} from '@shared';
import { EnsurePartyForEmployeeResponse } from '@modules/finance/party/application/commands/ensure-party-for-employee/ensure-party-for-employee.response';
import { StaffNotFoundException } from '@modules/finance/party/domain/exceptions/party.exceptions';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { Inject } from '@nestjs/common';
import { TENANT_SCOPE_RESOLVER } from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';

@CommandHandler(EnsurePartyForEmployeeCommand)
export class EnsurePartyForEmployeeHandler implements ICommandHandler<
  EnsurePartyForEmployeeCommand,
  EnsurePartyForEmployeeResponse
> {
  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver
  ) {}

  async execute(
    command: EnsurePartyForEmployeeCommand
  ): Promise<EnsurePartyForEmployeeResponse> {
    const { clinicId, userId, ctx } = command.payload;

    const organizationId = await this.tenantScopeResolver.resolve(
      command.payload
    );

    this.policyFactory
      .clinic(ctx.actor, ctx.source)
      .evaluator.check((p) =>
        p.actorCanAccessClinicOrOwnsOrganization(clinicId, organizationId)
      )
      .orThrow();

    const { data: user } = await this.queryBus.execute(
      new FindOneWithIdOrEmailQuery(userId, ctx)
    );

    if (!user) throw new StaffNotFoundException();

    const partyId = await this.commandBus.execute(
      new EnsurePartyCommand(
        {
          clinicId,
          organizationId,
          originType: PartyOriginTypeSchema.enum.USER,
          originId: user.id,
          role: PartyRoleSchema.enum.EMPLOYEE,
          type: PartyTypeSchema.enum.INDIVIDUAL,
          name: user.displayName,
          email: user.email,
          phone: user.phoneNumber,
        },
        ctx
      )
    );

    return { partyId, organizationId };
  }
}
