import { Module } from '@nestjs/common';

// Query Handlers
import { FindAllProvidersHandler } from './find-all-providers/find-all-providers.handler';
import { GetProviderScheduleHandler } from './get-provider-schedule/get-provider-schedule.handler';

import { FindProvidersDirectoryHandler } from './find-providers-directory/find-providers-directory.handler';
import { FindProviderByIdHandler } from './find-provider-by-id/find-provider-by-id.handler';
import { ProviderRepositoriesModule } from '@modules/clinical/provider/infrastructure/persistence/prisma/repositories/repositories.module';

const QueryHandlers = [
  FindAllProvidersHandler,
  GetProviderScheduleHandler,
  FindProvidersDirectoryHandler,
  FindProviderByIdHandler,
];

@Module({
  imports: [ProviderRepositoriesModule],
  providers: QueryHandlers,
  exports: QueryHandlers,
})
export class ProviderQueriesModule {}
