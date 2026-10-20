import {
  BadRequestException,
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetTaxParametersQuery } from '@modules/finance/accounting/tax-parameters/application/queries/get-tax-parameters/get-tax-parameters.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import { TaxParameterResponseDto } from '@modules/finance/accounting/tax-parameters/presentation/http/dto/tax-parameter-response.dto';
import type { TaxParameter } from '@shared';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { TAXPARAMETER } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(TAXPARAMETER.read)
@Controller('tax-parameters')
export class TaxParameterQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}
  @Get()
  @Serialize<TaxParameter, TaxParameterResponseDto>(TaxParameterResponseDto, {
    isArray: true,
  })
  list(@GetContext() ctx: IGetContext) {
    return this.queryBus.execute(
      new GetTaxParametersQuery(this.resolveClinicId(ctx), ctx)
    );
  }

  private resolveClinicId(ctx: IGetContext): string {
    if (!ctx.actor.clinicId) {
      throw new BadRequestException('Aktörün şube (clinic) bağlamı yok.');
    }
    return ctx.actor.clinicId;
  }
}
