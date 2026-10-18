import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { BackfillPosAccountingEventsCommand } from './backfill-pos-accounting-events.command';
import { BackfillPosAccountingEventsResponse } from './backfill-pos-accounting-events.response';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { FindUnbridgedPosTransactionsQuery } from '@modules/finance/pos/physical/application/queries/find-unbridged-pos-transactions/find-unbridged-pos-transactions.query';
import { PosAccountingBridgeService } from '@modules/finance/pos/physical/application/services/pos-accounting-bridge.service';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@CommandHandler(BackfillPosAccountingEventsCommand)
export class BackfillPosAccountingEventsHandler implements ICommandHandler<
  BackfillPosAccountingEventsCommand,
  BackfillPosAccountingEventsResponse
> {
  private readonly logger = new Logger(BackfillPosAccountingEventsHandler.name);

  constructor(
    private readonly queryBus: TSQueryBus,
    private readonly accountingBridge: PosAccountingBridgeService,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    command: BackfillPosAccountingEventsCommand
  ): Promise<BackfillPosAccountingEventsResponse> {
    const { data, ctx } = command.payload;

    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check(
        (p) => p.canAccessClinicFinances(data.clinicId),
        'Bu kliniğin POS tahsilatlarını muhasebeye işleme yetkiniz yok.'
      )
      .orThrow('pos.backfill-accounting');

    const { data: missing } = await this.queryBus.execute(
      new FindUnbridgedPosTransactionsQuery({
        filter: {
          clinicId: data.clinicId,
          from: data.from,
          to: data.to,
        },
        ctx,
      })
    );

    const failed: BackfillPosAccountingEventsResponse['failed'] = [];
    let recorded = 0;

    for (const row of missing) {
      try {
        // Her hareket kendi başına köprülenir: biri patlarsa tur durmaz,
        // kalanlar yazılır ve başarısızlar gerekçesiyle dönülür.
        //
        // Yön satırdan okunur: telafi listesi artık ters kayıtları da taşıyor ve
        // hepsini "tahsilat" olarak yazmak, iade edilen parayı deftere ikinci
        // kez gelir gibi geçirirdi.
        await this.accountingBridge.record({
          kind: row.kind === 'SALE' ? 'SALE' : 'REVERSAL',
          patientId: row.patientId,
          clinicId: row.clinicId,
          amount: new Decimal(row.amount),
          posTransactionId: row.posTransactionId,
          originalPosTransactionId: row.originalPosTransactionId ?? undefined,
        });
        recorded += 1;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `POS köprü telafisi başarısız: posTransactionId=${row.posTransactionId}`,
          error
        );
        failed.push({ posTransactionId: row.posTransactionId, reason });
      }
    }

    return { attempted: missing.length, recorded, failed };
  }
}
