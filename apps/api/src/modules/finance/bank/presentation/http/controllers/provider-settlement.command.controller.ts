import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { RecordProviderSettlementDto } from '@shared/modules/bank/dto/commands';
import { RecordProviderSettlementCommand } from '@modules/finance/bank/application/commands/record-provider-settlement/record-provider-settlement.command';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { PROVIDERSETTLEMENT } = CAPABILITIES;

/**
 * Sağlayıcı hesap kapaması (settlement/payout) kaydı.
 *
 * Kartla tahsil edilen paranın komisyon kesilerek bankaya geçtiğini deftere
 * yazar (`B 102 + B 653 / A 108`). Kendi yetkisi vardır (`providersettlement`):
 * yüksek etkili bir finansal işlemdir — 108'de bekleyen tutarı azaltır ve gider
 * yazar (CLAUDE.md finans kuralı 7).
 */
@UseGuards(AuthGuard, CapabilityGuard)
@Controller('provider-settlements')
export class ProviderSettlementCommandController {
  constructor(private readonly commandBus: TSCommandBus) {}

  @HasCapability(PROVIDERSETTLEMENT.create)
  @Post()
  record(
    @Body() dto: RecordProviderSettlementDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new RecordProviderSettlementCommand(dto, ctx)
    );
  }
}
