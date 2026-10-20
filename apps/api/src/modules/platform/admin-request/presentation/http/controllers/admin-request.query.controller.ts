import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { PaginationDto } from '@shared';
import { FindAdminRequestsDto } from '@shared/modules/admin-request/dto/queries';
import { FindAdminRequestsQuery } from '@modules/platform/admin-request/application/queries/find-admin-requests/find-admin-requests.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import { AdminRequestResponseDto } from '@modules/platform/admin-request/presentation/http/dto/admin-request-response.dto';
import type { AdminRequest } from '@shared';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { ADMINREQUEST } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(ADMINREQUEST.read)
@Controller()
export class AdminRequestQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}
  @Get()
  @Serialize<AdminRequest, AdminRequestResponseDto>(AdminRequestResponseDto, {
    isArray: true,
  })
  findMany(
    @Query() dto: FindAdminRequestsDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new FindAdminRequestsQuery({ filter: dto, pagination, ctx })
    );
  }
}
