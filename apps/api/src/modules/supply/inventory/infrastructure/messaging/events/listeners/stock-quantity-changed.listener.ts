import { Inject, Injectable, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { StockQuantityChangedEvent } from '@modules/supply/inventory/domain/events';
import { StockMovement } from '@modules/supply/inventory/domain/entities/stock-movement.entity';
import { Money } from '@src/domain/value-objects/money.vo';
import {
  IStockMovementCommandRepository,
  STOCK_MOVEMENT_COMMAND_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/stock-movement/stock-movement.command.repository';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import {
  FinancialEventTypeSchema,
  StockMovementDirectionSchema,
} from '@shared';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import { isLedgerBridgedStockMovement } from '@modules/finance/shared/domain/constants/stock-movement-ledger.constant';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';
import { OnDomainEvent } from '@common/decorators';

/**
 * Stok miktarı değiştiğinde hareket (StockMovement) kaydını yazar ve hareketi
 * **deftere köprüler** (tüketim/zayi maliyeti, sayım fazlası geliri).
 *
 * Olay outbox'tan geldiği için teslim at-least-once'tır: aynı olay iki kez düşerse
 * ne hareket ne ekonomik olay iki kez yazılır — hareketin id'si olayla gelir,
 * ekonomik olay da aynı id'den türeyen `dedupeKey` ile idempotenttir.
 * Hata bilinçli olarak yutulmaz; outbox kaydı "işlendi" işaretlenmesin ve yeniden
 * denensin diye yukarı fırlatılır (CLAUDE.md finans kuralı 4 — yutulan hata retry
 * değildir; burada yutma yok, telafi yolu retry'ın kendisi).
 */
@Injectable()
export class StockQuantityChangedListener {
  private readonly logger = new Logger(StockQuantityChangedListener.name);

  constructor(
    @Inject(STOCK_MOVEMENT_COMMAND_REPOSITORY)
    private readonly stockMovementRepo: IStockMovementCommandRepository,
    private readonly commandBus: TSCommandBus
  ) {}

  @OnDomainEvent(StockQuantityChangedEvent.NAME)
  async handle(event: StockQuantityChangedEvent): Promise<void> {
    try {
      // Hareket zaten yazılmışsa köprüye **devam edilir**: tekrar teslimin sebebi
      // tam olarak köprünün ilk denemede patlamış olması olabilir. Erken
      // dönülürse hareket kalır, defter kaydı sonsuza dek eksik kalırdı.
      const existing = await this.stockMovementRepo.findById(event.movementId);

      const movement = existing ?? (await this.writeMovement(event));

      await this.bridgeToLedger(event, movement);
    } catch (error) {
      this.logger.error(
        `Stok hareketi yazılamadı: movement=${event.movementId} product=${event.productId}`,
        error
      );
      throw error;
    }
  }

  private async writeMovement(
    event: StockQuantityChangedEvent
  ): Promise<StockMovement> {
    const movement = StockMovement.create({
      id: event.movementId,
      productId: event.productId,
      clinicId: event.clinicId,
      batchId: event.batchId,
      type: event.type,
      direction: event.direction,
      quantity: new Decimal(event.quantity),
      // Maliyet temeli olayla gelir (partinin alış fiyatı). KDV geçmez:
      // bu bir vergi değil **maliyet** kaydı — çıkan malın değeri.
      unitPrice: event.unitPrice
        ? Money.create(event.unitPrice, event.currency).orThrow()
        : null,
      performedById: event.performedById,
      notes: event.notes,
    });

    return this.stockMovementRepo.create(movement);
  }

  /**
   * Hareketi ekonomik olaya çevirir. Üç durumda köprü kurulmaz:
   *  - tipin defter eşlemesi yok (satın alma girişi → borç kaydı faturadan gelir;
   *    transfer/iade → ilgili belgenin kaydıyla yürür),
   *  - maliyet temeli yok (parti bağımsız hareket),
   *  - tutar sıfır (bedelsiz numune) — sıfır tutarlı fiş satırı geçersizdir.
   */
  private async bridgeToLedger(
    event: StockQuantityChangedEvent,
    movement: StockMovement
  ): Promise<void> {
    if (!isLedgerBridgedStockMovement(event.type)) return;

    const unitCost = movement.unitPrice?.value ?? null;
    const amount = movement.totalAmount?.value ?? null;
    if (!unitCost || !amount || amount.lessThanOrEqualTo(0)) return;

    const isInbound = event.direction === StockMovementDirectionSchema.enum.IN;

    await this.commandBus.execute(
      new RecordFinancialEventCommand(
        {
          clinicId: event.clinicId,
          type: isInbound
            ? FinancialEventTypeSchema.enum.STOCK_IN
            : FinancialEventTypeSchema.enum.STOCK_OUT,
          occurredAt: movement.createdAt,
          payload: {
            movementId: movement.id.value,
            productId: movement.productId.value,
            movementType: event.type,
            quantity: movement.quantity.value.toFixed(3),
            unitCost: unitCost.toFixed(2),
            amount: amount.toFixed(2),
            currency: movement.currency.value,
          },
          sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.INVENTORY,
          sourceRefId: movement.id.value,
          dedupeKey: FinancialEventDedupeKeys.stock_movement(movement.id.value),
          performedById: event.performedById ?? undefined,
        },
        // Dinleyici bir kullanıcı isteğinin içinde değil: kapsam kontrolü
        // sistem bağlamıyla geçilir, defter sahibi `clinicId` ile sabittir.
        ExecutionContextFactory.createInternal()
      )
    );
  }
}
