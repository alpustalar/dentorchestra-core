import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TaxParameter } from '@modules/finance/accounting/tax-parameters/domain/entities/tax-parameter.entity';
import { SetTaxParameterCommand } from './set-tax-parameter.command';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  ITaxParameterCommandRepository,
  TAX_PARAMETER_COMMAND_REPOSITORY,
} from '@modules/finance/accounting/tax-parameters/domain/repositories/tax-parameter/tax-parameter.command.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';
import { InvalidTaxValidityRangeException } from '@modules/finance/accounting/tax-parameters/domain/exceptions';

@CommandHandler(SetTaxParameterCommand)
export class SetTaxParameterHandler
  implements ICommandHandler<SetTaxParameterCommand, string>
{
  constructor(
    @Inject(TAX_PARAMETER_COMMAND_REPOSITORY)
    private readonly taxParameterRepo: ITaxParameterCommandRepository,
    private readonly txManager: TransactionManager,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(command: SetTaxParameterCommand): Promise<string> {
    const { input } = command;

    // Vergi parametresi klinik-seviye; `input.clinicId` istek gövdesinden geliyor.
    this.policyFactory
      .finance(command.ctx.actor, command.ctx.source)
      .evaluator.check((p) => p.actorCanManageTargetClinic(input.clinicId))
      .orThrow(ACCOUNTING_EVENTS.TAX_PARAMETER_SET);
    const validFrom = input.validFrom ?? DateTimeManager.create();

    return this.txManager.run(async () => {
      // Mevcut açık sürümü yeni geçerlilik tarihinde kapat (ileriye dönük versiyonlama).
      // Kilitli okunur: satır kapatılacağı ve yerine yenisi açılacağı için eşzamanlı
      // ikinci istek bu tx commit olmadan aynı açık sürümü göremez.
      const open = await this.taxParameterRepo.findOpenForUpdate(
        input.clinicId,
        input.key
      );
      if (open) {
        if (validFrom <= open.validFrom) {
          throw new InvalidTaxValidityRangeException(open.validFrom, validFrom);
        }
        // `close()` zaten kapatılmış bir sürümde sesli hata verir: kilit alındıktan
        // sonra satırı kapalı görmek, araya eşzamanlı bir güncelleme girdiği
        // anlamına gelir (409). Sessiz geri dönüş, yeni sürümü yine açıp aynı
        // anahtar için iki açık sürüm bırakıyordu.
        open.close(validFrom);
        await this.taxParameterRepo.update(open);
      }

      const parameter = TaxParameter.create({
        clinicId: input.clinicId,
        organizationId: input.organizationId,
        key: input.key,
        rate: input.rate,
        validFrom,
      });
      const saved = await this.taxParameterRepo.create(parameter);
      return saved.id;
    });
  }
}
