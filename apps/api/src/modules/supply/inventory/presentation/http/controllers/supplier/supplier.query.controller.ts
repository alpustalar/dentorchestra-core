import {
  Controller,
  Get,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import type { Supplier } from '@shared';
import { PaginationDto } from '@shared';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { FindSuppliersQuery } from '@modules/supply/inventory/application/queries/find-suppliers/find-suppliers.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import { SupplierResponseDto } from '@modules/supply/inventory/presentation/http/dto';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { SUPPLIER } = CAPABILITIES;

@UseGuards(AuthGuard, CapabilityGuard)
@Controller('suppliers')
export class SupplierQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @HasCapability(SUPPLIER.update)
  @Get()
  @Serialize<Supplier, SupplierResponseDto>(SupplierResponseDto, {
    isArray: true,
  })
  list(
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext,
    @Query('organizationId', ParseUUIDPipe) organizationId: string
  ) {
    return this.queryBus.execute(
      new FindSuppliersQuery({ ctx, organizationId, pagination })
    );
  }
}
