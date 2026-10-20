import {
  Controller,
  Get,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import type { Product } from '@shared';
import { PaginationDto } from '@shared';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { FindProductsQuery } from '@modules/supply/inventory/application/queries/find-products/find-products.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import { ProductResponseDto } from '@modules/supply/inventory/presentation/http/dto';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { PRODUCT } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@Controller('products')
export class ProductQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @HasCapability(PRODUCT.read)
  @Get()
  @Serialize<Product, ProductResponseDto>(ProductResponseDto, { isArray: true })
  list(
    @Query() pagination: PaginationDto,
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    @GetContext() ctx: IGetContext
  ) {
    // `organizationId` ALINMAZ: kiracı kimliği istemciden gelmez, `clinicId`'den
    // çözülür. Üstelik `ParseUUIDPipe` opsiyonel parametrede `optional: true`
    // olmadan kullanıldığı için parametre gönderilmediğinde istek 400'e
    // düşüyordu — yani liste fiilen org kimliği göndermeye zorluyordu.
    return this.queryBus.execute(
      new FindProductsQuery({ pagination, ctx, clinicId })
    );
  }
}
