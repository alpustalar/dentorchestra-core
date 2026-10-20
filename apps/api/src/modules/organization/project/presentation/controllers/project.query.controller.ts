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
import { PaginationDto } from '@shared';
import {
  GetMyProjectTasksFilterDto,
  GetProjectTasksFilterDto,
  GetProjectsFilterDto,
  GetResourceScheduleFilterDto,
} from '@shared/modules/project/dto/queries';
import { GetProjectsQuery } from '@modules/organization/project/application/queries/get-projects/get-projects.query';
import { GetProjectByIdQuery } from '@modules/organization/project/application/queries/get-project-by-id/get-project-by-id.query';
import { GetProjectBoardQuery } from '@modules/organization/project/application/queries/get-project-board/get-project-board.query';
import { GetMyProjectTasksQuery } from '@modules/organization/project/application/queries/get-my-project-tasks/get-my-project-tasks.query';
import { GetProjectBudgetVsActualQuery } from '@modules/organization/project/application/queries/get-project-budget-vs-actual/get-project-budget-vs-actual.query';
import { GetResourceScheduleQuery } from '@modules/organization/project/application/queries/get-resource-schedule/get-resource-schedule.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import {
  ProjectBudgetVsActualResponseDto,
  ProjectDetailResponseDto,
  ProjectResponseDto,
  ProjectTaskResponseDto,
  ResourceScheduleRowResponseDto,
} from '@modules/organization/project/presentation/dto/project-response.dto';
import type { Project, ProjectTask } from '@shared';
import type { ResourceScheduleRow } from '@modules/organization/project/domain/contracts';
import type { ProjectDetailView } from '@modules/organization/project/application/queries/get-project-by-id/get-project-by-id.response';
import type { ProjectBudgetVsActual } from '@modules/organization/project/application/queries/get-project-budget-vs-actual/get-project-budget-vs-actual.response';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { PROJECT, PROJECTCOST, PROJECTRESOURCEALLOCATION, PROJECTTASK } =
  CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@Controller()
export class ProjectQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @HasCapability(PROJECT.read)
  @Get('projects')
  @Serialize<Project, ProjectResponseDto>(ProjectResponseDto, { isArray: true })
  list(
    @Query() dto: GetProjectsFilterDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetProjectsQuery({ filter: dto, pagination, ctx })
    );
  }

  /** Kendi görev listem — proje kırılımı olmadan, klinik geneli. */
  @HasCapability(PROJECTTASK.read)
  @Get('my-tasks')
  @Serialize<ProjectTask, ProjectTaskResponseDto>(ProjectTaskResponseDto, {
    isArray: true,
  })
  myTasks(
    @Query() dto: GetMyProjectTasksFilterDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetMyProjectTasksQuery({ filter: dto, pagination, ctx })
    );
  }

  /** Kaynak takvimi — tahsis öncesi "kim müsait" görünümü. */
  @HasCapability(PROJECTRESOURCEALLOCATION.read)
  @Get('resources/schedule')
  @Serialize<ResourceScheduleRow, ResourceScheduleRowResponseDto>(
    ResourceScheduleRowResponseDto,
    { isArray: true }
  )
  resourceSchedule(
    @Query() dto: GetResourceScheduleFilterDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetResourceScheduleQuery({ filter: dto, ctx })
    );
  }

  @HasCapability(PROJECT.read)
  @Get('projects/:projectId')
  @Serialize<ProjectDetailView, ProjectDetailResponseDto>(
    ProjectDetailResponseDto
  )
  getById(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetProjectByIdQuery(projectId, ctx));
  }

  // ---------- Görev ----------

  @HasCapability(PROJECTTASK.read)
  @Get('projects/:projectId/board')
  @Serialize<ProjectTask, ProjectTaskResponseDto>(ProjectTaskResponseDto, {
    isArray: true,
  })
  board(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() dto: GetProjectTasksFilterDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetProjectBoardQuery({ projectId, filter: dto, ctx })
    );
  }

  @HasCapability(PROJECTCOST.read)
  @Get('projects/:projectId/budget')
  @Serialize<ProjectBudgetVsActual, ProjectBudgetVsActualResponseDto>(
    ProjectBudgetVsActualResponseDto
  )
  budgetVsActual(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetProjectBudgetVsActualQuery(projectId, ctx)
    );
  }
}
