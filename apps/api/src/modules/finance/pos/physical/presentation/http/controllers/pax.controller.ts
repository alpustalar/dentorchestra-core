import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import {
  GetContext,
  IGetContext,
} from '@common/decorators/get-context.decorator';
import {
  PaxBatchCloseDto,
  PaxRefundDto,
  PaxSaleDto,
  PaxVoidDto,
} from '@shared/modules/pos/dto/commands';
import { PaxSaleCommand } from '@modules/finance/pos/physical/application/commands/pax-sale/pax-sale.command';
import { PaxVoidCommand } from '@modules/finance/pos/physical/application/commands/pax-void/pax-void.command';
import { PaxRefundCommand } from '@modules/finance/pos/physical/application/commands/pax-refund/pax-refund.command';
import { PaxBatchCloseCommand } from '@modules/finance/pos/physical/application/commands/pax-batch-close/pax-batch-close.command';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { HasCapability } from '@common/decorators';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { POSDEVICE, POSTRANSACTION } = CAPABILITIES;
@Controller('pax')
@UseGuards(AuthGuard, CapabilityGuard)
export class PaxController {
  constructor(private readonly commandBus: TSCommandBus) {}

  @HasCapability(POSTRANSACTION.create)
  @Post('sale')
  sale(@Body() body: PaxSaleDto, @GetContext() ctx: IGetContext) {
    return this.commandBus.execute(new PaxSaleCommand(body, ctx));
  }

  @HasCapability(POSTRANSACTION.update)
  @Post('void')
  void(@Body() body: PaxVoidDto, @GetContext() ctx: IGetContext) {
    return this.commandBus.execute(new PaxVoidCommand(body, ctx));
  }

  @HasCapability(POSTRANSACTION.create)
  @Post('refund')
  refund(@Body() body: PaxRefundDto, @GetContext() ctx: IGetContext) {
    return this.commandBus.execute(new PaxRefundCommand(body, ctx));
  }

  @HasCapability(POSDEVICE.update)
  @Post('devices/:deviceId/batch-close')
  batchClose(
    @Param('deviceId') posDeviceId: string,
    @Body() body: PaxBatchCloseDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new PaxBatchCloseCommand({ ...body, posDeviceId }, ctx)
    );
  }
}
