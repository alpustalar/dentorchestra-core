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
import {
  OpenCardChargebackDto,
  ResolveCardChargebackDto,
} from '@shared/modules/bank/dto/commands';
import { OpenCardChargebackCommand } from '@modules/finance/bank/application/commands/open-card-chargeback/open-card-chargeback.command';
import { ResolveCardChargebackCommand } from '@modules/finance/bank/application/commands/resolve-card-chargeback/resolve-card-chargeback.command';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { CARDCHARGEBACK } = CAPABILITIES;

/**
 * Kart itirazı (chargeback / ters ibraz).
 *
 * Kart sahibinin itirazı üzerine sağlayıcının parayı geri kesmesini deftere
 * yazar (açılış: `B 127 / A 108|102`) ve sonucu (kazanıldı: `B 108|102 / A 127`,
 * kaybedildi: `B 120 / A 127`) kapatır. Kendi yetkisi vardır (`cardchargeback`):
 * yüksek etkili bir finansal işlemdir — 108'den para düşer, hasta borcu yeniden
 * doğar ve ödeme planı değişir (CLAUDE.md finans kuralı 7).
 */
@UseGuards(AuthGuard, CapabilityGuard)
@Controller('card-chargebacks')
export class CardChargebackCommandController {
  constructor(private readonly commandBus: TSCommandBus) {}

  @HasCapability(CARDCHARGEBACK.create)
  @Post()
  open(@Body() dto: OpenCardChargebackDto, @GetContext() ctx: IGetContext) {
    return this.commandBus.execute(new OpenCardChargebackCommand(dto, ctx));
  }

  @HasCapability(CARDCHARGEBACK.update)
  @Post(':chargebackId/resolve')
  resolve(
    @Param('chargebackId', ParseUUIDPipe) chargebackId: string,
    @Body() dto: ResolveCardChargebackDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new ResolveCardChargebackCommand({ chargebackId, data: dto, ctx })
    );
  }
}
