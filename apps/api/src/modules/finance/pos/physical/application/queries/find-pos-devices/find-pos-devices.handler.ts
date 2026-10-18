import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { FindPosDevicesQuery } from './find-pos-devices.query';
import { FindPosDevicesResponse } from './find-pos-devices.response';
import {
  IPosDeviceQueryRepository,
  POS_DEVICE_QUERY_REPOSITORY,
} from '@modules/finance/pos/physical/domain/repositories/pos-device/pos-device.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@QueryHandler(FindPosDevicesQuery)
export class FindPosDevicesHandler implements IQueryHandler<
  FindPosDevicesQuery,
  FindPosDevicesResponse
> {
  constructor(
    @Inject(POS_DEVICE_QUERY_REPOSITORY)
    private readonly posDeviceRepo: IPosDeviceQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(query: FindPosDevicesQuery): Promise<FindPosDevicesResponse> {
    const { clinicId, ctx } = query;

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    // Terminal/merchant kimlikleri ödeme altyapısı kimlik bilgisidir.
    evaluator
      .check(
        (p) => p.canAccessClinicFinances(clinicId),
        'Bu kliniğin POS cihazlarına erişim yetkiniz yok.'
      )
      .orThrow('pos-device.list');

    const devices = await this.posDeviceRepo.findByClinicId(clinicId);
    return {
      data: devices.map((d) => ({
        id: d.id,
        clinicId: d.clinicId,
        label: d.label,
        provider: d.provider,
        terminalId: d.terminalId,
        merchantId: d.merchantId,
        deviceUniqueId: d.deviceUniqueId,
        isActive: d.isActive,
      })),
      meta: {
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }
}
