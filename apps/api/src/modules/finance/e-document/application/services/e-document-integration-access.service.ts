import { Inject, Injectable } from '@nestjs/common';
import type { IGetContext } from '@common/decorators';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import type { EDocumentIntegrationScope } from '@modules/finance/e-document/domain/contracts/e-document.contracts';

@Injectable()
export class EDocumentIntegrationAccessService {
  constructor(
    @Inject(POLICY_FACTORY) private readonly policyFactory: IPolicyFactory
  ) {}

  assertCanManage(
    scope: EDocumentIntegrationScope,
    sourceId: string,
    ctx: IGetContext
  ): void {
    if (scope === 'CLINIC') {
      this.policyFactory
        .clinic(ctx.actor, ctx.source)
        .evaluator.check(
          (p) => p.actorCanManageTargetClinic(sourceId),
          'Bu kliniğin e-belge entegrasyonunu yönetme yetkiniz yok.'
        )
        .orThrow('e-document.integration.manage');
      return;
    }

    this.policyFactory
      .organization(ctx.actor, ctx.source)
      .evaluator.check(
        (p) => p.actorCanManageTargetOrganization(sourceId),
        'Bu organizasyonun e-belge entegrasyonunu yönetme yetkiniz yok.'
      )
      .orThrow('e-document.integration.manage');
  }
}
