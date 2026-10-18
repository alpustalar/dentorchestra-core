import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';
import { EnsurePartyForPatientCommand } from '@modules/finance/party/application/commands/ensure-party-for-patient/ensure-party-for-patient.command';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import { FinancialEventTypeSchema, PartyRoleSchema } from '@shared';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';

/**
 * Köprünün yönü. Alan **zorunlu**: satış ile ters kayıt (iptal/iade) farklı
 * ekonomik olaylara dönüşür (PAYMENT_RECEIVED ↔ PAYMENT_REFUNDED) ve ikisini
 * ayırmayı çağırana bırakmak, iade yolunun sessizce tahsilat yazması demekti.
 */
export type PosBridgeKind = 'SALE' | 'REVERSAL';

export interface PosAccountingBridgeInput {
  kind: PosBridgeKind;
  patientId: string;
  clinicId: string;
  amount: Decimal;
  /**
   * Olayın kaynağı: SATIŞ'ta satış işleminin, ters kayıtta **ters kaydın kendi**
   * id'si. Ters kayıt kendi satırı olduğu için dedupe anahtarı da ondan türer —
   * aksi halde ikinci (kısmi) iade, birincinin anahtarına çarpıp sessizce
   * yazılmadan dönerdi.
   */
  posTransactionId: string;
  /** Ters kayıtta geri alınan orijinal satış — fiş açıklamasına iz olarak geçer. */
  originalPosTransactionId?: string;
}

/**
 * Kart hareketini muhasebe katmanına köprüler: hastanın carisini garanti eder ve
 * ekonomik olayı yazar.
 *
 *   SATIŞ    → `PAYMENT_RECEIVED`  (B 108 / A 120)
 *   TERS KAYIT → `PAYMENT_REFUNDED` (B 120 / A 108)
 *
 * Ters kayıt yarısı **hiç yoktu**: iptal/iade taksiti REFUNDED yapıyor, cari
 * defteri düzeltiyor ve POS satırını damgalıyordu, ama yevmiyede tahsilat olduğu
 * gibi kalıyordu — 108'de hiç gelmeyecek para, 120'de kapanmış görünen bir borç.
 *
 * Köprü üç yerden çağrılıyordu (pax satış, iyzico terminal satış, mutabakat) ve
 * her birinde **kopyalanmıştı**; dedupeKey/sourceModule gibi idempotentlik
 * alanlarının üçünde de aynı kalması tesadüfe bağlıydı. Tek yerde toplandı,
 * telafi komutu (backfill) da aynı gövdeyi kullanır.
 */
@Injectable()
export class PosAccountingBridgeService {
  private readonly logger = new Logger(PosAccountingBridgeService.name);

  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {}

  /**
   * Köprüyü kurar; hata **fırlatır**. Telafi komutu (backfill) satır satır hata
   * toplayabilmek için bunu kullanır.
   */
  async record(input: PosAccountingBridgeInput): Promise<void> {
    const ctx = ExecutionContextFactory.createInternal();

    const { partyId } = await this.commandBus.execute(
      new EnsurePartyForPatientCommand(
        input.patientId,
        input.clinicId,
        PartyRoleSchema.enum.CUSTOMER,
        ctx
      )
    );

    const isRefund = input.kind === 'REVERSAL';

    await this.commandBus.execute(
      new RecordFinancialEventCommand(
        {
          clinicId: input.clinicId,
          type: isRefund
            ? FinancialEventTypeSchema.enum.PAYMENT_REFUNDED
            : FinancialEventTypeSchema.enum.PAYMENT_RECEIVED,
          payload: {
            method: 'POS_CARD',
            amount: input.amount.toFixed(2),
            partyId,
            ...(isRefund && input.originalPosTransactionId
              ? { reference: input.originalPosTransactionId }
              : {}),
          },
          sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.POS,
          sourceRefId: input.posTransactionId,
          dedupeKey: isRefund
            ? FinancialEventDedupeKeys.payment_refunded_pos(
                input.posTransactionId
              )
            : FinancialEventDedupeKeys.payment_received_pos(
                input.posTransactionId
              ),
        },
        ctx
      )
    );
  }

  /**
   * Köprüyü kurar; hata **yutulur** + CRITICAL alarm. Satışta kart çoktan
   * çekilmiştir, iadede para çoktan geri gitmiştir: köprü hatası yüzünden
   * hareketi geri sarmak para ile kaydı ayrıştırırdı.
   *
   * Yutulan iş kalıcı olarak yapılmamış kalmasın diye telafi yolu vardır
   * (CLAUDE.md finans kuralı 4): `GET /pos/transactions/unbridged` eksikleri
   * listeler, `POST /pos/transactions/backfill-accounting` yeniden dener.
   */
  async recordBestEffort(input: PosAccountingBridgeInput): Promise<void> {
    try {
      await this.record(input);
    } catch (error) {
      this.logger.error(
        `Muhasebe köprüsü başarısız: posTransactionId=${input.posTransactionId}`,
        error
      );
      this.criticalFailure.publish({
        operation: 'finance.pos.accounting-bridge',
        severity: 'CRITICAL',
        summary:
          input.kind === 'REVERSAL'
            ? 'POS iadesi yapıldı ancak muhasebe köprüsü çalışmadı.'
            : 'POS tahsilatı alındı ancak muhasebe köprüsü çalışmadı.',
        errorMessage: error instanceof Error ? error.message : String(error),
        context: {
          posTransactionId: input.posTransactionId,
          patientId: input.patientId,
          amount: input.amount.toFixed(2),
          kind: input.kind,
        },
        clinicId: input.clinicId,
        dedupeKey: `pos-bridge-failed:${input.posTransactionId}`,
      });
    }
  }
}
