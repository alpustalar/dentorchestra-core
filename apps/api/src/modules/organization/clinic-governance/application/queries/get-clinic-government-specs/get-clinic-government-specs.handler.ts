import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetClinicGovernmentSpecsQuery } from './get-clinic-government-specs.query';
import { GetClinicGovernmentSpecsResponse } from './get-clinic-government-specs.response';
import {
  CLINIC_GOVERNMENT_SPECS_QUERY_REPOSITORY,
  IClinicGovernmentSpecsQueryRepository,
} from '@modules/organization/clinic-governance/domain/repositories/clinic-government-specs.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@QueryHandler(GetClinicGovernmentSpecsQuery)
export class GetClinicGovernmentSpecsHandler implements IQueryHandler<
  GetClinicGovernmentSpecsQuery,
  GetClinicGovernmentSpecsResponse
> {
  constructor(
    @Inject(CLINIC_GOVERNMENT_SPECS_QUERY_REPOSITORY)
    private readonly specsQueryRepo: IClinicGovernmentSpecsQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetClinicGovernmentSpecsQuery
  ): Promise<GetClinicGovernmentSpecsResponse> {
    const { clinicId, ctx } = query;

    // USS şifresi + vergi no burada tutulur — klinik sınırı zorunlu.
    const { evaluator, policy } = this.policyFactory.clinic(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check(
        (p) => p.actorCanManageTargetClinic(clinicId),
        'Bu kliniğin resmî kurum bilgilerine erişim yetkiniz yok.'
      )
      .orThrow('clinic-governance.detail');

    const serializationOptions = policy.getSerializationOptions({ clinicId });

    const specs = await this.specsQueryRepo.findByClinicId(clinicId);
    if (!specs) return { data: null, meta: { serializationOptions } };

    return {
      data: {
        clinicId: specs.clinicId,
        healthFacilityCode: specs.healthFacilityCode,
        // Şifrenin kendisi değil, varlığı taşınır (bkz. okuma modeli).
        ussPasswordConfigured: Boolean(specs.ussPassword),
        companyTaxNumber: specs.companyTaxNumber,
        legalType: specs.legalType,
        createdAt: specs.createdAt,
        updatedAt: specs.updatedAt,
      },
      meta: { serializationOptions },
    };
  }
}
