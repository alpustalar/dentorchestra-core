import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import {
  ConnectMetaAccountDto,
  MatchLeadToPatientDto,
} from '@shared/modules/meta-ads/dto/commands';
import { ConnectMetaAccountCommand } from '@modules/crm/meta-ads/application/commands/connect-meta-account/connect-meta-account.command';
import { MatchLeadToPatientCommand } from '@modules/crm/meta-ads/application/commands/match-lead-to-patient/match-lead-to-patient.command';
import { DisconnectMetaAccountCommand } from '@modules/crm/meta-ads/application/commands/disconnect-meta-account/disconnect-meta-account.command';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { METAADACCOUNT, METALEAD } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@Controller()
export class MetaAdsCommandController {
  constructor(private readonly commandBus: TSCommandBus) {}

  @HasCapability(METAADACCOUNT.create)
  @Post('clinics/:clinicId/accounts')
  connectAccount(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Body() dto: ConnectMetaAccountDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new ConnectMetaAccountCommand({ data: dto, ctx, clinicId })
    );
  }

  /** Meta reklam hesabı bağlantısını keser (kayıt silinmez, senkron durur). */
  @HasCapability(METAADACCOUNT.delete)
  @Delete('clinics/:clinicId/accounts/:accountId')
  disconnectAccount(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new DisconnectMetaAccountCommand({ clinicId, accountId, ctx })
    );
  }

  @HasCapability(METALEAD.update)
  @Put('leads/:leadId/match')
  matchLead(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() dto: MatchLeadToPatientDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new MatchLeadToPatientCommand({
        leadId,
        patientId: dto.patientId,
        ctx,
      })
    );
  }
}
