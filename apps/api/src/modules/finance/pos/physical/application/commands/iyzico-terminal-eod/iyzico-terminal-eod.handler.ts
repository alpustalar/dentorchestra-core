import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { PosDeviceNotFoundException } from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';
import { IyzicoTerminalEodCommand } from './iyzico-terminal-eod.command';
import type { IyzicoTerminalEodResponse } from './iyzico-terminal-eod.response';
import { ResolveIyzicoTerminalCredentialsService } from '@modules/finance/pos/physical/application/services/resolve-iyzico-terminal-credentials.service';
import { IyzicoTerminalService } from '@src/infrastructure/payment/pos/physical/providers/iyzico-terminal/iyzico-terminal.service';
import {
  IyzicoTerminalAuthError,
  IyzicoTerminalOperationError,
} from '@src/infrastructure/payment/pos/physical/providers/iyzico-terminal/iyzico-terminal.errors';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Currency } from '@src/domain/value-objects/currency.vo';
import {
  IPosDeviceCommandRepository,
  POS_DEVICE_COMMAND_REPOSITORY,
} from '@modules/finance/pos/physical/domain/repositories/pos-device/pos-device.command.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { POS_EVENTS } from '@src/domain/constants/events';

@CommandHandler(IyzicoTerminalEodCommand)
export class IyzicoTerminalEodHandler implements ICommandHandler<
  IyzicoTerminalEodCommand,
  IyzicoTerminalEodResponse
> {
  private readonly logger = new Logger(IyzicoTerminalEodHandler.name);

  constructor(
    @Inject(POS_DEVICE_COMMAND_REPOSITORY)
    private readonly posDeviceRepo: IPosDeviceCommandRepository,
    private readonly credentialsResolver: ResolveIyzicoTerminalCredentialsService,
    private readonly iyzicoTerminalService: IyzicoTerminalService,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    command: IyzicoTerminalEodCommand
  ): Promise<IyzicoTerminalEodResponse> {
    const { input, ctx } = command;

    // `clinicId` istek gövdesinden geliyor — aktörün kendi kliniği DEĞİL. Bu
    // kontrol olmadan, POS yetkisi olan herhangi bir personel gövdeye başka bir
    // kliniğin id'sini yazıp o kliniğin terminalinde işlem yürütebilirdi.
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(input.clinicId))
      .orThrow(POS_EVENTS.TRANSACTION_INITIATED);

    const device = await this.posDeviceRepo.findById(input.posDeviceId);
    if (!device) {
      throw new PosDeviceNotFoundException();
    }

    // Yetki `input.clinicId` üzerinden verildi; cihaz AYRI bir alandan geliyor. Bu doğrulama
    // olmadan kendi kliniğinin id'siyle başka kliniğin terminali sürülebilirdi.
    device.assertBelongsToClinic(input.clinicId);

    device.validate.status.isActive.orThrow();

    const deviceUniqueId = device.iyzicoDeviceUniqueId.orThrow();

    const credentials = await this.credentialsResolver.resolve(input.clinicId);

    try {
      const result = await this.iyzicoTerminalService.endOfDay({
        credentials,
        deviceUniqueId,
        conversationId: UUID.generate().value,
        useSummary: input.useSummary,
      });

      this.logger.log(
        `iyzico terminal gün sonu: deviceId=${input.posDeviceId} status=${result.status} batchNo=${result.batchNo ?? '-'}`
      );

      return {
        status: result.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
        batchNo: result.batchNo,
        saleCount: result.saleCount,
        saleAmount: result.saleAmount,
        voidCount: result.voidCount,
        voidAmount: result.voidAmount,
        refundCount: result.refundCount,
        refundAmount: result.refundAmount,
        currency: result.currency
          ? Currency.create(result.currency).orThrow().value
          : undefined,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      };
    } catch (err) {
      if (
        err instanceof IyzicoTerminalOperationError ||
        err instanceof IyzicoTerminalAuthError
      ) {
        this.logger.error(
          `iyzico terminal gün sonu hatası: deviceId=${input.posDeviceId} — ${err.message}`
        );
        return {
          status: 'FAILED',
          errorMessage: err.message,
        };
      }
      throw err;
    }
  }
}
