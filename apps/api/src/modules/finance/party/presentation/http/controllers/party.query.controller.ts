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
import type { Party } from '@shared';
import { PaginationDto } from '@shared';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetPartyByIdQuery } from '@modules/finance/party/application/queries/get-party-by-id/get-party-by-id.query';
import { FindPartiesQuery } from '@modules/finance/party/application/queries/find-parties/find-parties.query';
import { PartyRoleType } from '@input-type-schemas/PartyRoleSchema';
import { Serialize } from '@common/decorators/serialize.decorator';
import { PartyResponseDto } from '@modules/finance/party/presentation/http/dto/party-response.dto';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { PARTY } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(PARTY.read)
@Controller()
export class PartyQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @Get()
  @Serialize<Party, PartyResponseDto>(PartyResponseDto, { isArray: true })
  findParties(
    @GetContext() ctx: IGetContext,
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    @Query() pagination: PaginationDto,
    @Query('role') role?: PartyRoleType
  ) {
    return this.queryBus.execute(
      new FindPartiesQuery(clinicId, pagination, ctx, role)
    );
  }

  @Get(':partyId')
  @Serialize<Party, PartyResponseDto>(PartyResponseDto)
  getParty(
    @GetContext() ctx: IGetContext,
    @Param('partyId', ParseUUIDPipe) partyId: string
  ) {
    return this.queryBus.execute(new GetPartyByIdQuery(partyId, ctx));
  }
}
