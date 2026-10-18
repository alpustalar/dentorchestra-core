import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { PosDeviceNotFoundException } from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';
import { PaxBatchCloseCommand } from './pax-batch-close.command';
import type { PaxBatchCloseResponse } from './pax-batch-close.response';
import { PaxService } from '@src/infrastructure/payment/pos/physical/providers/pax/pax.service';
import {
  IPosDeviceCommandRepository,
  POS_DEVICE_COMMAND_REPOSITORY,
} from '@modules/finance/pos/physical/domain/repositories/pos-device/pos-device.command.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { POS_EVENTS } from '@src/domain/constants/events';

@CommandHandler(PaxBatchCloseCommand)
export class PaxBatchCloseHandler implements ICommandHandler<
  PaxBatchCloseCommand,
  PaxBatchCloseResponse
> {
  private readonly logger = new Logger(PaxBatchCloseHandler.name);

  constructor(
    @Inject(POS_DEVICE_COMMAND_REPOSITORY)
    private readonly posDeviceRepo: IPosDeviceCommandRepository,
    private readonly paxService: PaxService,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(command: PaxBatchCloseCommand): Promise<PaxBatchCloseResponse> {
    const { input, ctx } = command;

    // `clinicId` istek gövdesinden geliyor — aktörün kendi kliniği DEĞİL. Bu
    // kontrol olmadan, POS yetkisi olan herhangi bir personel gövdeye başka bir
    // kliniğin id'sini yazıp o kliniğin terminalinde işlem yürütebilirdi.
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(input.clinicId))
      .orThrow(POS_EVENTS.TRANSACTION_INITIATED);

    const device = await this.posDeviceRepo.findById(input.posDeviceId);
    if (!device || !device.isActive) {
      throw new PosDeviceNotFoundException();
    }

    // Yetki `input.clinicId` üzerinden verildi; cihaz AYRI bir alandan geliyor.
    device.assertBelongsToClinic(input.clinicId);

    const result = await this.paxService.batchClose({
      device: device.getPaxConnection(),
    });

    this.logger.log(
      `PAX batch close: deviceId=${input.posDeviceId} success=${result.success} code=${result.responseCode}`
    );

    return result;
  }
}
