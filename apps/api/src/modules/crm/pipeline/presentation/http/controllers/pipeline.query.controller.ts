import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetPipelinesQuery } from '@modules/crm/pipeline/application/queries/get-pipelines/get-pipelines.query';
import { GetPipelineByIdQuery } from '@modules/crm/pipeline/application/queries/get-pipeline-by-id/get-pipeline-by-id.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import { PipelineResponseDto } from '@modules/crm/pipeline/presentation/http/dto';
import type { PipelineResponse } from '@shared/modules/pipeline/interfaces';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { PIPELINE } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(PIPELINE.read)
@Controller()
export class PipelineQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}
  @Get()
  @Serialize<PipelineResponse, PipelineResponseDto>(PipelineResponseDto, {
    isArray: true,
  })
  getPipelines(@GetContext() ctx: IGetContext) {
    return this.queryBus.execute(new GetPipelinesQuery(ctx));
  }
  @Get(':pipelineId')
  @Serialize<PipelineResponse, PipelineResponseDto>(PipelineResponseDto)
  getPipelineById(
    @Param('pipelineId', ParseUUIDPipe) pipelineId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetPipelineByIdQuery(pipelineId, ctx));
  }
}
