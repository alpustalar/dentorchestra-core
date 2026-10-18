import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { FindProviderByIdQuery } from './find-provider-by-id.query';
import { FindProviderByIdQueryResponse } from '@modules/clinical/provider/application/queries/find-provider-by-id/find-provider-by-id.response';
import { ProviderNotFoundException } from '@modules/clinical/provider/domain/exceptions/provider.exceptions';
import {
  IProviderQueryRepository,
  PROVIDER_QUERY_REPOSITORY,
} from '@modules/clinical/provider/domain/repositories/provider/provider.query.repository';

@QueryHandler(FindProviderByIdQuery)
export class FindProviderByIdHandler implements IQueryHandler<
  FindProviderByIdQuery,
  FindProviderByIdQueryResponse
> {
  constructor(
    @Inject(PROVIDER_QUERY_REPOSITORY)
    private readonly providerRepo: IProviderQueryRepository,
    // Sınıf değil token: `PolicyFactory` hiçbir modülde sınıf olarak provider
    // değil; global PolicyModule onu POLICY_FACTORY token'ıyla sağlıyor.
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: FindProviderByIdQuery
  ): Promise<FindProviderByIdQueryResponse> {
    const { providerId, ctx } = query;

    const provider = await this.providerRepo.findById(providerId);

    if (!provider) throw new ProviderNotFoundException();

    const serializationOptions = this.policyFactory
      .provider(ctx.actor, ctx.source)
      .policy.getSerializationOptions(provider.clinicId, provider.id);

    return {
      data: provider,
      meta: {
        serializationOptions,
      },
    };
  }
}
