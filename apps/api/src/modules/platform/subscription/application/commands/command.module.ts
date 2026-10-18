import { Module } from '@nestjs/common';
import { SubscribeToPlanHandler } from './subscribe-to-plan/subscribe-to-plan.handler';
import { AddModuleHandler } from './add-module/add-module.handler';
import { HandleSubscriptionCallbackHandler } from './handle-subscription-callback/handle-subscription-callback.handler';
import { CancelSubscriptionHandler } from './cancel-subscription/cancel-subscription.handler';
import { ResumeSubscriptionHandler } from './resume-subscription/resume-subscription.handler';
import { ProcessSubscriptionRenewalsHandler } from './process-subscription-renewals/process-subscription-renewals.handler';
import { ExpirePastDueSubscriptionsHandler } from './expire-past-due-subscriptions/expire-past-due-subscriptions.handler';
import { CreateModuleHandler } from './create-module/create-module.handler';
import { UpdateModuleHandler } from './update-module/update-module.handler';
import { UpsertPlanHandler } from './upsert-plan/upsert-plan.handler';
import { SetPlanModulesHandler } from './set-plan-modules/set-plan-modules.handler';
import { StartTrialHandler } from './start-trial/start-trial.handler';
import { ExpireTrialsHandler } from './expire-trials/expire-trials.handler';
import { BILLING_ADAPTER } from '@modules/platform/subscription/infrastructure/adapters/billing-adapter.interface';
import { IyzicoBillingAdapter } from '@modules/platform/subscription/infrastructure/adapters/iyzico-billing.adapter';
import { PrismaModule } from '@src/infrastructure/persistence/prisma/prisma.module';
import { PosModule } from '@modules/finance/pos/pos.module';
// IyzicoBillingAdapter IYZICO_PROVIDER token'ını istiyor; PosModule bu token'ı
// dışa açmıyor, sağlayan modül doğrudan import edilir.
import { IyzicoModule } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/iyzico.module';
import { SubscriptionInfrastructureModule } from '@modules/platform/subscription/infrastructure/infrastructure.module';

const CommandHandlers = [
  SubscribeToPlanHandler,
  AddModuleHandler,
  HandleSubscriptionCallbackHandler,
  CancelSubscriptionHandler,
  ResumeSubscriptionHandler,
  ProcessSubscriptionRenewalsHandler,
  ExpirePastDueSubscriptionsHandler,
  CreateModuleHandler,
  UpdateModuleHandler,
  UpsertPlanHandler,
  SetPlanModulesHandler,
  StartTrialHandler,
  ExpireTrialsHandler,
];

@Module({
  imports: [
    PosModule,
    IyzicoModule,
    SubscriptionInfrastructureModule,
    PrismaModule,
  ],
  providers: [
    ...CommandHandlers,
    { provide: BILLING_ADAPTER, useClass: IyzicoBillingAdapter },
  ],
})
export class SubscriptionCommandModule {}
