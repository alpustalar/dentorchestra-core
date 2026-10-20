import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { HasCapability } from '@common/decorators';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';
import { PaginationDto } from '@shared/common';
import {
  GetContext,
  IGetContext,
} from '@common/decorators/get-context.decorator';
import { FindAllProvidersQuery } from '@modules/clinical/provider/application/queries';
import { FindProviderByIdQuery } from '@modules/clinical/provider/application/queries/find-provider-by-id/find-provider-by-id.query';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { Serialize } from '@common/decorators/serialize.decorator';
import { Provider } from '@shared';
import { ProviderResponseDto } from '@modules/clinical/provider/presentation/http/dto';

const { PROVIDER } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(PROVIDER.read)
@Controller()
export class ProviderQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  //? ====================================================================================
  //! QUERIES
  //? ====================================================================================

  @Get()
  @Serialize<Provider, ProviderResponseDto>(ProviderResponseDto, {
    isArray: true,
  })
  findAll(@Query() pagination: PaginationDto, @GetContext() ctx: IGetContext) {
    return this.queryBus.execute(new FindAllProvidersQuery(ctx, pagination));
  }

  @Get(':id')
  @Serialize<Provider, ProviderResponseDto>(ProviderResponseDto)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new FindProviderByIdQuery(id, ctx));
  }
}
