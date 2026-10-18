import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { RegisterClinicPaymentGatewayCommand } from './register-clinic-payment-gateway.command';
import { ClinicPaymentGateway } from '@modules/finance/payment-gateway/domain/entities/clinic-payment-gateway.entity';
import {
  IIyzicoProvider,
  IYZICO_PROVIDER,
} from '@src/infrastructure/payment/pos/virtual/providers/iyzico/interfaces/iyzico.provider.interface';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { CLINIC_EVENTS } from '@src/domain/constants/events';
import {
  CLINIC_PAYMENT_GATEWAY_COMMAND_REPOSITORY,
  IClinicPaymentGatewayCommandRepository,
} from '@modules/finance/payment-gateway/domain/repositories/clinic-payment-gateway/clinic-payment-gateway.command.repository';
import { UUID } from '@src/domain/value-objects/uuid.vo';

@CommandHandler(RegisterClinicPaymentGatewayCommand)
export class RegisterClinicPaymentGatewayHandler implements ICommandHandler<
  RegisterClinicPaymentGatewayCommand,
  void
> {
  constructor(
    @Inject(CLINIC_PAYMENT_GATEWAY_COMMAND_REPOSITORY)
    private readonly clinicPaymentGatewayRepo: IClinicPaymentGatewayCommandRepository,
    @Inject(IYZICO_PROVIDER)
    private readonly iyzicoProvider: IIyzicoProvider,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: RegisterClinicPaymentGatewayCommand): Promise<void> {
    const { clinicId, dto, ctx } = command;

    const { evaluator } = this.policyFactory.clinic(ctx.actor, ctx.source);
    evaluator
      .check(
        (p) => p.actorCanManageTargetClinic(clinicId),
        'Bu kliniğin ödeme altyapısını yönetme yetkiniz yok.'
      )
      .orThrow(CLINIC_EVENTS.REGISTER_SUBMERCHANT);

    const existing =
      await this.clinicPaymentGatewayRepo.findByClinicId(clinicId);
    const conversationId = UUID.generate().value;

    const subMerchantKey = await this.resolveSubMerchantKey({
      clinicId,
      conversationId,
      localKey: existing?.iyzicoSubMerchantKey ?? null,
      dto,
    });

    // Denetim izi: paranın yatacağı hesap değişiyor; IBAN yerelde saklanmadığı
    // için maskeli hâli event'e konur (tam IBAN/kimlik no bilerek taşınmaz).
    const audit = {
      maskedIban: this.maskIban(dto.iban),
      actorId: ctx.actor.userId,
      source: ctx.actor.source,
    };

    await this.txManager.run(async () => {
      const entity =
        existing ??
        ClinicPaymentGateway.create({
          clinicId,
          iyzicoSubMerchantKey: subMerchantKey,
          ...audit,
        });

      if (existing) {
        entity.updateSubMerchantKey({
          iyzicoSubMerchantKey: subMerchantKey,
          ...audit,
        });
      }

      await this.clinicPaymentGatewayRepo.upsertByClinicId(entity);
    });
  }

  /**
   * Alt üye işyeri anahtarını çözer: yerelde varsa güncelle, yoksa **önce
   * iyzico'ya sor**, yine yoksa oluştur.
   *
   * Ortadaki sorgu bir kurtarma yoludur: dış kayıt açıldıktan sonra yerel yazma
   * başarısız olursa (tx hatası, süreç ölümü) anahtar kaybolur ve ikinci deneme
   * `create` ile "bu dış kimlik zaten kayıtlı" hatası alır — klinik elle
   * müdahale olmadan bir daha kurulamaz. Dış kimlik `clinicId` olduğu için
   * kayıt geri okunabilir ve akış idempotent olur.
   */
  private async resolveSubMerchantKey({
    clinicId,
    conversationId,
    localKey,
    dto,
  }: {
    clinicId: string;
    conversationId: string;
    localKey: string | null;
    dto: RegisterClinicPaymentGatewayCommand['dto'];
  }): Promise<string> {
    const remoteKey =
      localKey ??
      (
        await this.iyzicoProvider.retrieveSubMerchant({
          conversationId,
          subMerchantExternalId: clinicId,
        })
      )?.subMerchantKey ??
      null;

    if (remoteKey) {
      await this.iyzicoProvider.updateSubMerchant({
        conversationId,
        subMerchantKey: remoteKey,
        subMerchantExternalId: clinicId,
        ...dto,
      });
      return remoteKey;
    }

    const result = await this.iyzicoProvider.createSubMerchant({
      conversationId,
      subMerchantExternalId: clinicId,
      ...dto,
    });
    return result.subMerchantKey;
  }

  /** IBAN'ın yalnız son 4 hanesi denetim kaydına girer (KVKK). */
  private maskIban(iban: string): string {
    const normalized = iban.replace(/\s+/g, '');
    return `**** ${normalized.slice(-4)}`;
  }
}
