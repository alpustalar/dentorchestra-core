import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import PosProviderSchema from '@input-type-schemas/PosProviderSchema';
import { RegisterPosDeviceCommand } from './register-pos-device.command';
import { RegisterPosDeviceResponse } from './register-pos-device.response';
import { PosDevice } from '@modules/finance/pos/physical/domain/entities/pos-device.entity';
import {
  IPosDeviceCommandRepository,
  POS_DEVICE_COMMAND_REPOSITORY,
} from '@modules/finance/pos/physical/domain/repositories/pos-device/pos-device.command.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { POS_EVENTS } from '@src/domain/constants/events';

@CommandHandler(RegisterPosDeviceCommand)
export class RegisterPosDeviceHandler implements ICommandHandler<
  RegisterPosDeviceCommand,
  RegisterPosDeviceResponse
> {
  constructor(
    @Inject(POS_DEVICE_COMMAND_REPOSITORY)
    private readonly posDeviceRepo: IPosDeviceCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    command: RegisterPosDeviceCommand
  ): Promise<RegisterPosDeviceResponse> {
    const { input, ctx } = command;

    // `clinicId` istek gövdesinden geliyor — aktörün kendi kliniği DEĞİL. Bu
    // kontrol olmadan, POS yetkisi olan herhangi bir personel gövdeye başka bir
    // kliniğin id'sini yazıp o kliniğin terminalinde işlem yürütebilirdi.
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(input.clinicId))
      .orThrow(POS_EVENTS.TRANSACTION_INITIATED);

    // DTO superRefine ile sağlayıcıya göre zorunlu alanları garanti eder; burada düz DTO,
    // entity'nin katı discriminated CreatePosDeviceProps koluna daraltılır (alanlar doğrulanmış).
    const device =
      input.provider === PosProviderSchema.enum.IYZICO_TERMINAL
        ? PosDevice.create({
            clinicId: input.clinicId,
            label: input.label,
            provider: PosProviderSchema.enum.IYZICO_TERMINAL,
            deviceUniqueId: input.deviceUniqueId!,
          })
        : PosDevice.create({
            clinicId: input.clinicId,
            label: input.label,
            provider: PosProviderSchema.enum.PAX,
            terminalId: input.terminalId!,
            merchantId: input.merchantId!,
            host: input.host!,
            port: input.port!,
          });

    const saved = await this.posDeviceRepo.create(device);

    return {
      id: saved.id.value,
      clinicId: saved.clinicId.value,
      label: saved.label.value,
      terminalId: saved.terminalId,
    };
  }
}
