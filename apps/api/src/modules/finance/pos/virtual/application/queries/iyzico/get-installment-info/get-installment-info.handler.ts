import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetInstallmentInfoQuery } from './get-installment-info.query';
import { GetInstallmentInfoQueryResponse } from './get-installment-info.response';
import { Inject } from '@nestjs/common';
import { IyzicoInstallmentInfoFailedException } from '@modules/finance/pos/virtual/domain/exceptions/iyzico.exceptions';

import Iyzipay from 'iyzipay';
import {
  IIyzicoProvider,
  IYZICO_PROVIDER,
} from '@src/infrastructure/payment/pos/virtual/providers/iyzico/interfaces/iyzico.provider.interface';
import { InstallmentOption } from '@modules/finance/payment/domain/contracts/payment';
import { UUID } from '@src/domain/value-objects';
import { IyzicoResultGuard } from '@src/domain/value-objects/iyzico-result-guard.vo';

@QueryHandler(GetInstallmentInfoQuery)
export class GetInstallmentInfoHandler implements IQueryHandler<
  GetInstallmentInfoQuery,
  GetInstallmentInfoQueryResponse
> {
  constructor(
    @Inject(IYZICO_PROVIDER)
    private readonly iyzicoProvider: IIyzicoProvider
  ) {}

  async execute(
    query: GetInstallmentInfoQuery
  ): Promise<GetInstallmentInfoQueryResponse> {
    const { binNumber, price } = query.data;

    const generatedConversationUUID = UUID.generate();

    const sdkResult = await this.iyzicoProvider.getInstallmentInfo({
      locale: 'TR',
      conversationId: generatedConversationUUID.value,
      price: price.toFixed(2),
      binNumber,
    });

    IyzicoResultGuard.create(sdkResult)
      .isSuccess()
      .orThrow(
        new IyzicoInstallmentInfoFailedException(sdkResult.errorMessage)
      );

    return {
      data: {
        options: (sdkResult.installmentDetails ?? []).map(
          (
            installmentDetail: Iyzipay.InstallmentDetail
          ): InstallmentOption => ({
            installmentNumber: installmentDetail.installmentNumber,
            totalPrice: Number(installmentDetail.totalPrice),
            installmentPrice: Number(installmentDetail.installmentPrice),
            installmentRate: installmentDetail.installmentRate,
          })
        ),
      },
    };
  }
}
