import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { BackfillMissingInvoicesCommand } from './backfill-missing-invoices.command';
import { BackfillMissingInvoicesResponse } from './backfill-missing-invoices.response';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { FindUninvoicedPaymentsQuery } from '@modules/finance/invoice/application/queries/find-uninvoiced-payments/find-uninvoiced-payments.query';
import { IssueInvoiceCommand } from '@modules/finance/invoice/application/commands/issue-invoice/issue-invoice.command';
import { Money } from '@src/domain/value-objects/money.vo';
import { LogAction, LogType } from '@src/domain/constants/log-action.constant';

/**
 * Faturası kesilmemiş tahsilatları yeniden faturalar.
 *
 * Aday listesi okuma tarafından gelir (rapor); **nihai kontrol** telafi edilen her
 * kayıt için `IssueInvoiceCommand`'in kendi içindedir: orada fatura varlığı Command
 * Repo'dan okunur ve son güvence DB'deki unique kısıttır. Yani bu komut yarış
 * durumunda mükerrer fatura üretemez, yalnız gereksiz bir deneme yapar.
 *
 * Tek bir tahsilatın hatası turu durdurmaz: kalanlar denenir, başarısızlar
 * gerekçesiyle birlikte dönülür (operatör neyin elde kaldığını görür).
 */
@CommandHandler(BackfillMissingInvoicesCommand)
export class BackfillMissingInvoicesHandler implements ICommandHandler<
  BackfillMissingInvoicesCommand,
  BackfillMissingInvoicesResponse
> {
  private readonly logger = new Logger(BackfillMissingInvoicesHandler.name);

  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus
  ) {}

  async execute(
    command: BackfillMissingInvoicesCommand
  ): Promise<BackfillMissingInvoicesResponse> {
    const { filter, ctx } = command.payload;

    const { data: missing } = await this.queryBus.execute(
      new FindUninvoicedPaymentsQuery({ filter, ctx })
    );

    const failed: BackfillMissingInvoicesResponse['failed'] = [];
    let issued = 0;

    for (const row of missing) {
      try {
        await this.commandBus.execute(
          new IssueInvoiceCommand({
            clinicId: row.clinicId,
            patientId: row.patientId,
            appointmentId: row.appointmentId,
            paymentId: row.paymentId,
            totalAmount: Money.fromTrusted(row.totalAmount, row.currency),
            action: LogAction.INVOICE_ISSUED,
            type: LogType.INFO,
            source: ctx.actor.source,
            actorId: ctx.actor.userId,
          })
        );
        issued += 1;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Telafi faturası kesilemedi: paymentId=${row.paymentId}`,
          error
        );
        failed.push({ paymentId: row.paymentId, reason });
      }
    }

    return { attempted: missing.length, issued, failed };
  }
}
