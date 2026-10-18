import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { FinancialEventTypeSchema, PartyRoleSchema } from '@shared';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import { PaymentMadeEventPayload } from '@modules/finance/accounting/posting/domain/posting/event-payloads';
import { GetPartyByIdQuery } from '@modules/finance/party/application/queries/get-party-by-id/get-party-by-id.query';
import {
  SupplierPartyClinicMismatchException,
  SupplierPartyNotSupplierException,
} from '@modules/finance/accounting/financial-events/domain/exceptions';
import { RecordFinancialEventCommand } from '../record-financial-event/record-financial-event.command';
import { RecordSupplierPaymentCommand } from './record-supplier-payment.command';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';
import {
  IPeriodGateService,
  PERIOD_GATE_SERVICE,
} from '@modules/finance/accounting/periods/domain/services/period-gate/period-gate.service.interface';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';

/**
 * Satıcıya ödeme kaydeder. İşin tamamı bir `FinancialEvent` yazmaktır; fişi
 * `PaymentMadeRule` üretir (B 320 cari / A 100|102).
 *
 * `reference` (havale/dekont no) verilirse idempotency anahtarı olur: aynı dekont
 * ikinci kez girilirse borç iki kez kapanmaz. Referans yoksa dedupe edilmez —
 * aynı satıcıya aynı gün aynı tutarda iki ayrı ödeme meşrudur, onları
 * birleştirmek veri kaybı olur.
 */
@CommandHandler(RecordSupplierPaymentCommand)
export class RecordSupplierPaymentHandler implements ICommandHandler<
  RecordSupplierPaymentCommand,
  string
> {
  constructor(
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(PERIOD_GATE_SERVICE)
    private readonly periodGate: IPeriodGateService,
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus
  ) {}

  async execute(command: RecordSupplierPaymentCommand): Promise<string> {
    const { data, ctx } = command.payload;

    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(data.clinicId))
      .orThrow(ACCOUNTING_EVENTS.FINANCIAL_EVENTS_RECORD);

    await this.assertPayableSupplier(command);

    // Ödeme tarihi kullanıcıdan geliyor ve yalnız "gelecekte olamaz" diye
    // sınırlıydı: kapanmış bir yıla tarihli ödeme kabul edilip olay yazılıyor,
    // fişi hiç üretilemiyordu (320 borcu defterde kapanmamış kalır). Olay defteri
    // append-only olduğu için tarih sonradan düzeltilemez → kapıda durdurulur.
    const paidAt = data.paidAt ?? DateTimeManager.create();
    await this.periodGate.assertPeriodNotSealedAt({
      clinicId: data.clinicId,
      date: paidAt,
    });

    const payload: PaymentMadeEventPayload = {
      method: data.method,
      amount: data.amount,
      partyId: data.partyId,
      currency: data.currency,
      reference: data.reference,
    };

    return this.commandBus.execute(
      new RecordFinancialEventCommand(
        {
          clinicId: data.clinicId,
          type: FinancialEventTypeSchema.enum.PAYMENT_MADE,
          occurredAt: paidAt,
          payload: { ...payload },
          sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.SUPPLIER_PAYMENT,
          sourceRefId: data.partyId,
          dedupeKey: data.reference
            ? FinancialEventDedupeKeys.supplier_payment(
                data.clinicId,
                data.reference
              )
            : undefined,
          performedById: ctx.actor.userId,
        },
        ctx
      )
    );
  }

  /**
   * Carinin gerçekten **bu kliniğin** satıcısı olduğunu doğrular.
   *
   * `partyId` istemciden geliyor ve fişteki 320 satırına doğrudan yazılıyor.
   * Doğrulanmazsa: (a) birden çok klinik yöneten bir aktör, B kliniğinin
   * satıcısına yaptığı ödemeyi A kliniğinin defterine işleyebilir — iki şubenin
   * cari bakiyesi de yanlış çıkar; (b) müşteri (120) carisi satıcı ödemesi gibi
   * kaydedilip alacak bakiyesi sessizce eritilebilir.
   */
  private async assertPayableSupplier(
    command: RecordSupplierPaymentCommand
  ): Promise<void> {
    const { data, ctx } = command.payload;

    const { data: party } = await this.queryBus.execute(
      new GetPartyByIdQuery(data.partyId, ctx)
    );

    if (!party || party.clinicId !== data.clinicId) {
      throw new SupplierPartyClinicMismatchException({
        partyId: data.partyId,
        clinicId: data.clinicId,
      });
    }

    if (!party.roles.includes(PartyRoleSchema.enum.SUPPLIER)) {
      throw new SupplierPartyNotSupplierException(data.partyId);
    }
  }
}
