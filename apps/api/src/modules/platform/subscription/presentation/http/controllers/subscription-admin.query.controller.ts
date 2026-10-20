import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { ListModulesQuery } from '@modules/platform/subscription/application/queries/list-modules/list-modules.query';
import { ListPlansQuery } from '@modules/platform/subscription/application/queries/list-plans/list-plans.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import {
  PlanResponseDto,
  SubscriptionModuleResponseDto,
} from '@modules/platform/subscription/presentation/http/dto/subscription-catalog-response.dto';
import type { Module as SubscriptionModule } from '@shared';
import type { PlanReadModel } from '@modules/platform/subscription/domain/contracts';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { MODULE, PLAN } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@Controller('subscription-admin')
export class SubscriptionAdminQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @HasCapability(MODULE.read)
  @Get('modules')
  @Serialize<SubscriptionModule, SubscriptionModuleResponseDto>(
    SubscriptionModuleResponseDto,
    { isArray: true }
  )
  listModules(@GetContext() ctx: IGetContext) {
    return this.queryBus.execute(new ListModulesQuery(ctx));
  }

  @HasCapability(PLAN.read)
  @Get('plans')
  @Serialize<PlanReadModel, PlanResponseDto>(PlanResponseDto, { isArray: true })
  listPlans(@GetContext() ctx: IGetContext) {
    return this.queryBus.execute(new ListPlansQuery(ctx));
  }
}
