import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FindManyByOrganizationIdQuery } from './find-many-by-organization-id.query';
import { Inject } from '@nestjs/common';

import { FindManyByOrganizationIdQueryResponse } from '@modules/organization/clinic/application/queries/find-many-by-organization-id/find-many-by-organization-id.response';
import {
  CLINIC_QUERY_REPOSITORY,
  IClinicQueryRepository,
} from '@modules/organization/clinic/domain/repositories/clinic/clinic.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { OrganizationScopeRequiredException } from '@common/domain/exceptions/organization-scope-required.exception';

@QueryHandler(FindManyByOrganizationIdQuery)
export class FindManyByOrganizationIdHandler implements IQueryHandler<
  FindManyByOrganizationIdQuery,
  FindManyByOrganizationIdQueryResponse
> {
  constructor(
    @Inject(CLINIC_QUERY_REPOSITORY)
    private readonly clinicRepo: IClinicQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: FindManyByOrganizationIdQuery
  ): Promise<FindManyByOrganizationIdQueryResponse> {
    const { ctx } = query;
    const organizationId = query.organizationId ?? ctx.actor.organizationId;

    if (!organizationId) {
      throw new OrganizationScopeRequiredException(
        'clinic.find-many-by-organization-id'
      );
    }

    const { evaluator, policy } = this.policyFactory.organization(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check(
        (p) => p.actorCanAccessTargetOrganization(organizationId),
        'Bu organizasyonun klinik dizinine erişim yetkiniz yok.'
      )
      .orThrow('clinic.find-many-by-organization-id');

    const clinics =
      await this.clinicRepo.findManyByOrganizationId(organizationId);

    return {
      data: clinics
        .filter((clinic) => !clinic.isPlatform)
        .map((clinic) => ({
          id: clinic.id,
          organizationId: clinic.organizationId,
          name: clinic.name,
          slug: clinic.slug,
          timezone: clinic.timezone,
          status: clinic.status,
        })),
      meta: {
        serializationOptions: policy.getSerializationOptions(),
      },
    };
  }
}
