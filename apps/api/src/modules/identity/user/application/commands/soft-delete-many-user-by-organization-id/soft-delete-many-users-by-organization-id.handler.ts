import { SoftDeleteManyUserByOrganizationIdCommand } from '@modules/identity/user/application/commands/soft-delete-many-user-by-organization-id/soft-delete-many-users-by-organization-id.command';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { InternalOnly } from '@common/decorators/internal-only.decorator';
import { SoftDeleteManyUserByOrganizationIdResponse } from '@modules/identity/user/application/commands/soft-delete-many-user-by-organization-id/soft-delete-many-user-by-organization-id.response';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { FindManyByOrganizationIdQuery } from '@modules/organization/clinic/application/queries/find-many-by-organization-id/find-many-by-organization-id.query';
import {
  IUserCommandRepository,
  USER_COMMAND_REPOSITORY,
} from '@modules/identity/user/domain/repositories/user/user.command.repository';
import { SYSTEM_ACTOR } from '@common/constants/system-actor.constant';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';

@CommandHandler(SoftDeleteManyUserByOrganizationIdCommand)
export class SoftDeleteManyUsersByOrganizationIdHandler implements ICommandHandler<
  SoftDeleteManyUserByOrganizationIdCommand,
  SoftDeleteManyUserByOrganizationIdResponse
> {
  constructor(
    @Inject(USER_COMMAND_REPOSITORY)
    private readonly userRepo: IUserCommandRepository,
    private readonly queryBus: TSQueryBus
  ) {}

  @InternalOnly()
  async execute(
    command: SoftDeleteManyUserByOrganizationIdCommand
  ): Promise<SoftDeleteManyUserByOrganizationIdResponse> {
    const { organizationId } = command;

    const { data: clinics } = await this.queryBus.execute(
      new FindManyByOrganizationIdQuery(organizationId, {
        actor: SYSTEM_ACTOR,
        source: ExecutionSources.INTERNAL_CASCADE,
      })
    );
    const clinicIds = clinics.map((clinic) => clinic.id);

    await this.userRepo.softDeleteAllByClinicIds(clinicIds);
  }
}
