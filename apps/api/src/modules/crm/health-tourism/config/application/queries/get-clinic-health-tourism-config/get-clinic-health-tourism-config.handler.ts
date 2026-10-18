import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetClinicHealthTourismConfigQuery } from './get-clinic-health-tourism-config.query';
import { GetClinicHealthTourismConfigResponse } from './get-clinic-health-tourism-config.response';
import {
  CLINIC_HEALTH_TOURISM_CONFIG_QUERY_REPOSITORY,
  IClinicHealthTourismConfigQueryRepository,
} from '@modules/crm/health-tourism/config/domain/repositories/clinic-health-tourism-config/clinic-health-tourism-config.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { HEALTH_TOURISM_CONFIG_EVENTS } from '@src/domain/constants/events';

@QueryHandler(GetClinicHealthTourismConfigQuery)
export class GetClinicHealthTourismConfigHandler
  implements
    IQueryHandler<
      GetClinicHealthTourismConfigQuery,
      GetClinicHealthTourismConfigResponse
    >
{
  constructor(
    @Inject(CLINIC_HEALTH_TOURISM_CONFIG_QUERY_REPOSITORY)
    private readonly clinicHealthTourismConfigRepo: IClinicHealthTourismConfigQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetClinicHealthTourismConfigQuery
  ): Promise<GetClinicHealthTourismConfigResponse> {
    const { clinicId, ctx } = query;

    // AI runtime bu sorguyu internal (SYSTEM) bağlamla çağırır — evaluator
    // isSystem() aktörlerini baypas eder, o yol etkilenmez.
    const { evaluator, policy } = this.policyFactory.clinic(
      ctx.actor,
      ctx.source
    );

    // TODO: REDIS CACHE EKLENECEK

    evaluator
      .check(
        (p) => p.actorCanAccessTargetClinic(clinicId),
        'Bu kliniğin sağlık turizmi ayarlarına erişim yetkiniz yok.'
      )
      .orThrow(HEALTH_TOURISM_CONFIG_EVENTS.CONFIG);

    const serializationOptions = policy.getSerializationOptions({ clinicId });

    const config =
      await this.clinicHealthTourismConfigRepo.findByClinicId(clinicId);
    if (!config) return { data: null, meta: { serializationOptions } };

    return {
      data: {
        id: config.id,
        clinicId: config.clinicId,
        isEnabled: config.isEnabled,
        destinationCode: config.destinationCode,
        nearbyHotelCodes: config.nearbyHotelCodes,
        airportIata: config.airportIata,
        clinicLocationType: config.clinicLocationType,
        clinicLocationCode: config.clinicLocationCode,
        pickupAddress: config.pickupAddress,
        defaultCurrency: config.defaultCurrency,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
      meta: { serializationOptions },
    };
  }
}
