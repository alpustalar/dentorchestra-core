import { Module } from '@nestjs/common';
import { GetPartyByIdHandler } from './get-party-by-id/get-party-by-id.handler';
import { FindPartiesHandler } from './find-parties/find-parties.handler';
import { FindPartiesByIdsHandler } from './find-parties-by-ids/find-parties-by-ids.handler';
import { PartyRepositoryModule } from '@modules/finance/party/infrastructure/persistence/prisma/repositories/party/party.repository.module';

const QueryHandlers = [
  GetPartyByIdHandler,
  FindPartiesHandler,
  FindPartiesByIdsHandler,
];

@Module({
  imports: [PartyRepositoryModule],
  providers: [...QueryHandlers],
})
export class PartyQueryModule {}
