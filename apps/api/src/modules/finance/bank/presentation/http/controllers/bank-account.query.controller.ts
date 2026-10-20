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
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { PaginationDto } from '@shared';
import { GetBankAccountsFilterDto } from '@shared/modules/bank/dto/queries';
import { GetBankAccountsQuery } from '@modules/finance/bank/application/queries/get-bank-accounts/get-bank-accounts.query';
import { GetBankAccountByIdQuery } from '@modules/finance/bank/application/queries/get-bank-account-by-id/get-bank-account-by-id.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import { BankAccountResponseDto } from '@modules/finance/bank/presentation/http/dto/bank-response.dto';
import type { BankAccount as IBankAccount } from '@shared';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { BANKACCOUNT } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(BANKACCOUNT.read)
@Controller('accounts')
export class BankAccountQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}
  @Get()
  @Serialize<IBankAccount, BankAccountResponseDto>(BankAccountResponseDto, {
    isArray: true,
  })
  list(
    @Query() dto: GetBankAccountsFilterDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetBankAccountsQuery({ filter: dto, pagination, ctx })
    );
  }
  @Get(':accountId')
  @Serialize<IBankAccount, BankAccountResponseDto>(BankAccountResponseDto)
  getById(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetBankAccountByIdQuery(accountId, ctx));
  }
}
