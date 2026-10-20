import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { Activity, PaginationDto } from '@shared';
import { GetMyTasksDto } from '@shared/modules/activity/dto/queries';
import { GetActivitiesByLeadQuery } from '@modules/crm/activity/application/queries/get-activities-by-lead/get-activities-by-lead.query';
import { GetMyTasksQuery } from '@modules/crm/activity/application/queries/get-my-tasks/get-my-tasks.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import { ActivityResponseDto } from '@modules/crm/activity/presentation/http/dto';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { ACTIVITY } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(ACTIVITY.read)
@Controller()
export class ActivityQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}
  @Get('my-tasks')
  @Serialize<Activity, ActivityResponseDto>(ActivityResponseDto, {
    isArray: true,
  })
  getMyTasks(
    @Query() dto: GetMyTasksDto,
    @Query() pagination: PaginationDto,
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetMyTasksQuery({ filter: dto, pagination, ctx, clinicId })
    );
  }
  @Get('lead/:leadId')
  @Serialize<Activity, ActivityResponseDto>(ActivityResponseDto, {
    isArray: true,
  })
  getByLead(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetActivitiesByLeadQuery({ leadId, pagination, clinicId, ctx })
    );
  }
}
