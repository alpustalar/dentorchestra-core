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
import { Serialize } from '@common/decorators/serialize.decorator';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { Lead, PaginationDto } from '@shared';
import { LeadResponseDto } from '@modules/crm/lead/presentation/http/dto';
import { GetLeadsDto } from '@shared/modules/lead/dto/queries';
import { GetLeadsQuery } from '@modules/crm/lead/application/queries/get-leads/get-leads.query';
import { GetLeadByIdQuery } from '@modules/crm/lead/application/queries/get-lead-by-id/get-lead-by-id.query';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { LEAD } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(LEAD.read)
@Controller()
export class LeadQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}
  @Get('clinics/:clinicId/leads')
  @Serialize<Lead, LeadResponseDto>(LeadResponseDto, { isArray: true })
  getLeads(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Query() dto: GetLeadsDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetLeadsQuery({ clinicId, data: dto, pagination, ctx })
    );
  }
  @Get('leads/:leadId')
  @Serialize<Lead, LeadResponseDto>(LeadResponseDto)
  getLeadById(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetLeadByIdQuery(leadId, ctx));
  }
}
