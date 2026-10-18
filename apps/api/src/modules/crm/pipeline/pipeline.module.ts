import { Module } from '@nestjs/common';
import { PipelinePresentationModule } from './presentation/presentation.module';
import { PipelineCommandModule } from '@modules/crm/pipeline/application/commands/command.module';
import { PipelineQueryModule } from '@modules/crm/pipeline/application/queries/query.module';

@Module({
  imports: [
    PipelinePresentationModule,
    PipelineCommandModule,
    PipelineQueryModule,
  ],
})
export class PipelineModule {}
