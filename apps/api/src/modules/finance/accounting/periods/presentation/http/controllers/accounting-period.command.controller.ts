import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { OpenPeriodDto } from '@shared/modules/accounting-period/dto/commands';
import { OpenPeriodCommand } from '@modules/finance/accounting/periods/application/commands/open-period/open-period.command';
import { LockPeriodCommand } from '@modules/finance/accounting/periods/application/commands/lock-period/lock-period.command';
import { ReopenPeriodCommand } from '@modules/finance/accounting/periods/application/commands/reopen-period/reopen-period.command';
import { ClosePeriodCommand } from '@modules/finance/accounting/periods/application/commands/close-period/close-period.command';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { ACCOUNTINGPERIOD } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@Controller('periods')
export class AccountingPeriodCommandController {
  constructor(private readonly commandBus: TSCommandBus) {}

  /**
   * Dönem açar. `organizationId` **alınmaz**: kiracı kimliği `clinicId`'den
   * çözülür — istemciden gelen bir org değeri başka kiracının defterine kayıt
   * enjekte etmenin yolu olurdu.
   */
  @HasCapability(ACCOUNTINGPERIOD.create)
  @Post()
  openPeriod(@GetContext() ctx: IGetContext, @Body() dto: OpenPeriodDto) {
    return this.commandBus.execute(
      new OpenPeriodCommand({ clinicId: dto.clinicId, year: dto.year, ctx })
    );
  }

  @HasCapability(ACCOUNTINGPERIOD.update)
  @Post(':id/lock')
  lockPeriod(
    @GetContext() ctx: IGetContext,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.commandBus.execute(new LockPeriodCommand(id, ctx));
  }

  @HasCapability(ACCOUNTINGPERIOD.update)
  @Post(':id/reopen')
  reopenPeriod(
    @GetContext() ctx: IGetContext,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.commandBus.execute(new ReopenPeriodCommand(id, ctx));
  }

  /** Dönemi kapatır: yıl sonu kapanış fişlerini üretir + CLOSED'a alır. */
  @HasCapability(ACCOUNTINGPERIOD.update)
  @Post(':id/close')
  closePeriod(
    @GetContext() ctx: IGetContext,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.commandBus.execute(new ClosePeriodCommand(id, ctx));
  }
}
