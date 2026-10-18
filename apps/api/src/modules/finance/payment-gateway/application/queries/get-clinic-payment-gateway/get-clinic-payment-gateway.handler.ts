import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetClinicPaymentGatewayQuery } from './get-clinic-payment-gateway.query';
import { GetClinicPaymentGatewayResponse } from './get-clinic-payment-gateway.response';
import {
  CLINIC_PAYMENT_GATEWAY_QUERY_REPOSITORY,
  IClinicPaymentGatewayQueryRepository,
} from '@modules/finance/payment-gateway/domain/repositories/clinic-payment-gateway/clinic-payment-gateway.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@QueryHandler(GetClinicPaymentGatewayQuery)
export class GetClinicPaymentGatewayHandler implements IQueryHandler<
  GetClinicPaymentGatewayQuery,
  GetClinicPaymentGatewayResponse
> {
  constructor(
    @Inject(CLINIC_PAYMENT_GATEWAY_QUERY_REPOSITORY)
    private readonly clinicPaymentGatewayRepo: IClinicPaymentGatewayQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetClinicPaymentGatewayQuery
  ): Promise<GetClinicPaymentGatewayResponse> {
    const { clinicId, ctx } = query;

    // iyzico alt-üye kimliği ödeme sağlayıcı kimlik bilgisidir — klinik sınırı şart.
    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check(
        (p) => p.canAccessClinicFinances(clinicId),
        'Bu kliniğin ödeme sağlayıcı ayarlarına erişim yetkiniz yok.'
      )
      .orThrow('payment-gateway.detail');

    const serializationOptions = policy.getSerializationOptions({ clinicId });

    const gateway =
      await this.clinicPaymentGatewayRepo.findByClinicId(clinicId);
    if (!gateway) return { data: null, meta: { serializationOptions } };

    return {
      data: {
        clinicId: gateway.clinicId,
        iyzicoSubMerchantKey: gateway.iyzicoSubMerchantKey,
        createdAt: gateway.createdAt,
        updatedAt: gateway.updatedAt,
      },
      meta: { serializationOptions },
    };
  }
}
