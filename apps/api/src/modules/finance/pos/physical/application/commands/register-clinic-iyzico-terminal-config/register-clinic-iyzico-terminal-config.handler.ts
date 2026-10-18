import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { RegisterClinicIyzicoTerminalConfigCommand } from './register-clinic-iyzico-terminal-config.command';
import {
  CLINIC_IYZICO_TERMINAL_CONFIG_COMMAND_REPOSITORY,
  IClinicIyzicoTerminalConfigCommandRepository,
} from '@modules/finance/pos/physical/domain/repositories/clinic-iyzico-terminal-config/clinic-iyzico-terminal-config.command.repository';
import { ClinicIyzicoTerminalConfig } from '@modules/finance/pos/physical/domain/entities/clinic-iyzico-terminal-config.entity';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { CLINIC_EVENTS } from '@src/domain/constants/events';

@CommandHandler(RegisterClinicIyzicoTerminalConfigCommand)
export class RegisterClinicIyzicoTerminalConfigHandler implements ICommandHandler<
  RegisterClinicIyzicoTerminalConfigCommand,
  string
> {
  constructor(
    @Inject(CLINIC_IYZICO_TERMINAL_CONFIG_COMMAND_REPOSITORY)
    private readonly configCommandRepo: IClinicIyzicoTerminalConfigCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(
    command: RegisterClinicIyzicoTerminalConfigCommand
  ): Promise<string> {
    const { input, ctx } = command;

    this.policyFactory
      .clinic(ctx.actor, ctx.source)
      .evaluator.check(
        (p) => p.actorCanManageTargetClinic(input.clinicId),
        'Bu kliniğin POS kimlik bilgilerini yönetme yetkiniz yok.'
      )
      .orThrow(CLINIC_EVENTS.REGISTER_SUBMERCHANT);

    return this.txManager.run(async () => {
      // "Var mı → güncelle, yok mu → oluştur" kararı; okuma command repo'dan ve
      // yazmayla aynı transaction içinde. (Yarışın nihai güvencesi upsert'in
      // dayandığı clinicId unique kısıtı.)
      const existing = await this.configCommandRepo.findByClinicId(
        input.clinicId
      );

      if (existing) {
        existing.updateCredentials({
          clientId: input.clientId,
          clientSecret: input.clientSecret,
          username: input.username,
          password: input.password,
        });
        const saved = await this.configCommandRepo.upsertByClinicId(existing);
        return saved.id.value;
      }

      const config = ClinicIyzicoTerminalConfig.create({
        clinicId: input.clinicId,
        clientId: input.clientId,
        clientSecret: input.clientSecret,
        username: input.username,
        password: input.password,
      });
      const saved = await this.configCommandRepo.upsertByClinicId(config);
      return saved.id.value;
    });
  }
}
