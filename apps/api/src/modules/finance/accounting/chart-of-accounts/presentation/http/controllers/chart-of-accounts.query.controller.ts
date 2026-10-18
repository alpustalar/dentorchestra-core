import {
  Controller,
  Get,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { Serialize } from '@common/decorators/serialize.decorator';
import { GetChartOfAccountsQuery } from '@modules/finance/accounting/chart-of-accounts/application/queries/get-chart-of-accounts/get-chart-of-accounts.query';
import { GetChartOfAccountsDriftQuery } from '@modules/finance/accounting/chart-of-accounts/application/queries/get-chart-of-accounts-drift/get-chart-of-accounts-drift.query';
import { AccountResponseDto } from '@modules/finance/accounting/chart-of-accounts/presentation/http/dto/account-response.dto';
import type { Account as IAccount } from '@shared';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { ACCOUNT } = CAPABILITIES;

@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(ACCOUNT.read)
@Controller('chart-of-accounts')
export class ChartOfAccountsQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  /**
   * Şubenin hesap planı. Sayfalanmaz: sınırlı ve tam okunması gereken bir referans
   * kümesidir (fiş girişinde hesap seçimi bu listeden yapılır).
   */
  @Get()
  @Serialize<IAccount, AccountResponseDto>(AccountResponseDto)
  list(
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetChartOfAccountsQuery(clinicId, ctx));
  }

  /**
   * Şablon ↔ defter farkı. Kurulum komutu yalnız eklediği için şablonda düzeltilen
   * bir alan eski defterlere yansımaz; bu uç hangi hesapların ayrıştığını gösterir.
   * Serileştirilmiş hesap listesi değil bir mutabakat raporu döner.
   */
  @Get('drift')
  drift(
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetChartOfAccountsDriftQuery(clinicId, ctx)
    );
  }
}
