import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetPaymentWithInstallmentsQuery } from '@modules/finance/payment/application/queries/get-payment-with-installments/get-payment-with-installments.query';
import { MarkInstallmentAsPaidCommand } from '@modules/finance/payment/application/commands/mark-installment-as-paid/mark-installment-as-paid.command';
import { MarkInstallmentAsFailedCommand } from '@modules/finance/payment/application/commands/mark-installment-as-failed/mark-installment-as-failed.command';
import { MarkInstallmentAsRefundedCommand } from '@modules/finance/payment/application/commands/mark-installment-as-refunded/mark-installment-as-refunded.command';
import InstallmentStatusSchema, {
  InstallmentStatusType,
} from '@input-type-schemas/InstallmentStatusSchema';
import { IGetContext } from '@common/decorators';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';

interface PosPaymentSyncInput {
  paymentId: string;
  clinicId: string;
  /**
   * POS'ta fiilen hareket eden tutar. Taksit seçimi bu tutara göre yapılır —
   * tutarsız eşleşme sessiz para hatası üretir (aşağıdaki `resolveInstallment`).
   */
  amount: Decimal;
  /** İşlemi yürüten aktör/kanal — tahsilat/iade denetim kaydının sahibi. */
  ctx: IGetContext;
  reason?: string;
}

interface ResolveInstallmentInput {
  paymentId: string;
  statuses: InstallmentStatusType[];
  amount: Decimal;
  /** Tutar eşleşmesi zorunlu mu — para etkisi olan geçişlerde evet. */
  requireAmountMatch: boolean;
}

/**
 * Çözümleme sonucu. "Ödeme yok" ile "uygun taksit yok" ayrı tutulur: ilki veri
 * bağı hiç kurulmamış demektir (sessiz çıkış), ikincisi para hareket etti ama
 * plana yazılamadı demektir (CRITICAL alarm).
 */
type ResolveInstallmentResult =
  | { kind: 'match'; installmentId: string }
  | { kind: 'payment-missing' }
  | { kind: 'no-match' };

/**
 * Physical POS işlemlerinin sonucunu payment modülüne yansıtır.
 *
 * POS modülü ledger'a doğrudan dokunmaz; yalnızca ilgili taksiti
 * COMPLETED / PENDING / REFUNDED olarak işaretlemek için payment command'ini
 * dispatch eder. Payment event'lerinin (PaymentPaid/Failed/Refunded) sahipliği
 * payment modülündedir; event'ler `Payment` entity'si içinde, yalnız gerçek
 * durum geçişinde fırlatılır (tekrarlanan callback mükerrer event üretmez).
 * Ledger kayıtları finance-ledger modülündeki payment listener'ları üzerinden oluşur.
 *
 * KURAL: Bu metodlar mutlaka bir TransactionManager.outboxRun() içinden çağrılır;
 * entity'de fırlatılan payment event'leri aynı transaction'da Outbox'a
 * mühürlenir (nested run/outboxRun mevcut context'i yeniden kullanır).
 */
@Injectable()
export class PosPaymentSyncService {
  private readonly logger = new Logger(PosPaymentSyncService.name);

  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {}

  /** POS tahsilatı başarılı: taksit COMPLETED + PaymentPaidEvent (entity'de). */
  async markPaid(input: PosPaymentSyncInput): Promise<void> {
    const resolved = await this.resolveInstallment({
      paymentId: input.paymentId,
      statuses: [InstallmentStatusSchema.enum.PENDING],
      amount: input.amount,
      requireAmountMatch: true,
    });
    if (resolved.kind !== 'match') {
      this.report(resolved, input, 'tahsilat');
      return;
    }

    await this.commandBus.execute(
      new MarkInstallmentAsPaidCommand({
        installmentId: resolved.installmentId,
        details: input.reason ?? 'POS ödemesi tahsil edildi',
        ctx: input.ctx,
      })
    );
  }

  /**
   * POS tahsilatı reddedildi: taksit PENDING'e döner + PaymentFailedEvent (entity'de).
   * Başarısızlık para hareketi üretmediği için tutar eşleşmesi **zorunlu değil**:
   * eşleşen yoksa ilk bekleyen taksit işaretlenir (durum PENDING→PENDING).
   */
  async markFailed(input: PosPaymentSyncInput): Promise<void> {
    const resolved = await this.resolveInstallment({
      paymentId: input.paymentId,
      statuses: [InstallmentStatusSchema.enum.PENDING],
      amount: input.amount,
      requireAmountMatch: false,
    });
    if (resolved.kind !== 'match') return;

    await this.commandBus.execute(
      new MarkInstallmentAsFailedCommand({
        installmentId: resolved.installmentId,
        details: input.reason ?? 'POS ödemesi reddedildi',
        ctx: input.ctx,
      })
    );
  }

  /** POS iade/void başarılı: tamamlanmış taksit REFUNDED + PaymentRefundedEvent (entity'de). */
  async markRefunded(input: PosPaymentSyncInput): Promise<void> {
    const resolved = await this.resolveInstallment({
      paymentId: input.paymentId,
      statuses: [InstallmentStatusSchema.enum.COMPLETED],
      amount: input.amount,
      requireAmountMatch: true,
    });
    if (resolved.kind !== 'match') {
      this.report(resolved, input, 'iade');
      return;
    }

    await this.commandBus.execute(
      new MarkInstallmentAsRefundedCommand({
        installmentId: resolved.installmentId,
        details: input.reason ?? 'POS işlemi iade edildi',
        ctx: input.ctx,
      })
    );
  }

  /**
   * POS'ta hareket eden tutara **birebir eşit** taksiti seçer.
   *
   * Önceden yalnız duruma bakılıp **ilk** uygun taksit seçiliyordu; tutar hiç
   * kontrol edilmiyordu. İki sessiz para hatası üretiyordu:
   * - 3×1.000 ₺ planı olan bir ödemeye 500 ₺ POS çekimi yapılınca 1.000 ₺'lik
   *   taksit "tahsil edildi" işaretleniyor, 500 ₺ hayalet gelir yazılıyordu;
   * - **kısmi** POS iadesi (300 ₺) 1.000 ₺'lik taksiti tümüyle REFUNDED yapıyor,
   *   muhasebe ters kaydı 1.000 ₺ gelir düşürüyordu.
   *
   * Eşleşme bulunamazsa ödeme tarafına **hiç dokunulmaz** (yanlış taksiti
   * kapatmaktansa açık bırakmak güvenlidir); çağıran CRITICAL alarm üretir.
   */
  private async resolveInstallment(
    input: ResolveInstallmentInput
  ): Promise<ResolveInstallmentResult> {
    const { data: payment } = await this.queryBus.execute(
      new GetPaymentWithInstallmentsQuery(input.paymentId)
    );
    if (!payment) return { kind: 'payment-missing' };

    const candidates = payment.installments.filter((i) =>
      input.statuses.includes(i.status)
    );

    const exact = candidates.find((i) =>
      new Decimal(i.amount.toString()).equals(input.amount)
    );
    if (exact) return { kind: 'match', installmentId: exact.id };

    if (input.requireAmountMatch) return { kind: 'no-match' };

    const fallback = candidates[0];
    return fallback
      ? { kind: 'match', installmentId: fallback.id }
      : { kind: 'no-match' };
  }

  private report(
    resolved: ResolveInstallmentResult,
    input: PosPaymentSyncInput,
    operation: string
  ): void {
    if (resolved.kind === 'payment-missing') {
      // Ödeme kaydı yok: POS işlemi bir plana bağlı değil (hastasız kart
      // çekimi gibi). Para POS kaydında duruyor, yazılacak taksit yok.
      this.logger.warn(
        `POS ${operation} için ödeme kaydı bulunamadı: paymentId=${input.paymentId}`
      );
      return;
    }

    this.logger.error(
      `POS ${operation} tutarına eşit taksit bulunamadı: paymentId=${input.paymentId} tutar=${input.amount.toString()}`
    );
    // Para POS tarafında hareket etti ve işlem kaydı bunu taşıyor; ödeme planı
    // ise güncellenmedi. Yanlış taksiti kapatmak defteri bozacağı için bilinçli
    // olarak dokunulmadı — operasyonun elle eşleştirmesi gerekir.
    this.criticalFailure.publish({
      operation: 'finance.pos.payment-sync',
      severity: 'CRITICAL',
      summary: `POS ${operation} tutarına eşit taksit bulunamadı; ödeme planı elle eşleştirilmeli.`,
      errorMessage: `paymentId=${input.paymentId} amount=${input.amount.toString()}`,
      context: {
        paymentId: input.paymentId,
        amount: input.amount.toString(),
        operation,
      },
      clinicId: input.clinicId,
      dedupeKey: `pos-sync-unmatched:${input.paymentId}:${input.amount.toString()}`,
    });
  }
}
