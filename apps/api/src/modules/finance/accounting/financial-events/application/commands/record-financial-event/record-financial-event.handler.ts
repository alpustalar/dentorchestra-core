import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  FinancialEventDedupeKeyCollisionException,
  FinancialEventUniqueConstraintException,
} from '@modules/finance/accounting/financial-events/domain/exceptions';
import { FinancialEvent } from '@modules/finance/accounting/financial-events/domain/entities/financial-event.entity';
import { RecordFinancialEventCommand } from './record-financial-event.command';
import {
  ITenantScopeResolver,
  TENANT_SCOPE_RESOLVER,
} from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import { RecordFinancialEventProps } from '@modules/finance/accounting/financial-events/domain/contracts/financial-event';
import {
  FINANCIAL_EVENT_COMMAND_REPOSITORY,
  IFinancialEventCommandRepository,
} from '@modules/finance/accounting/financial-events/domain/repositories/financial-event/financial-event.command.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { SYSTEM_ACTOR } from '@common/constants/system-actor.constant';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';

/**
 * Ekonomik olayı kalıcı olay defterine yazar (append-only).
 *
 * Üç garanti taşır:
 *  1. **Kapsam** — olay yalnız aktörün erişebildiği kliniğin defterine yazılır.
 *  2. **İdempotentlik** — `dedupeKey` varsa aynı olay ikinci kez yazılmaz ve
 *     mükerrer istek, çağıranın transaction'ını bozmadan mevcut id ile döner.
 *  3. **Teslim** — kaydı fişe çeviren `RECORDED` event'i Outbox'a mühürlenir.
 */
@CommandHandler(RecordFinancialEventCommand)
export class RecordFinancialEventHandler implements ICommandHandler<
  RecordFinancialEventCommand,
  string
> {
  constructor(
    @Inject(FINANCIAL_EVENT_COMMAND_REPOSITORY)
    private readonly financialEventRepo: IFinancialEventCommandRepository,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: RecordFinancialEventCommand): Promise<string> {
    const { data, ctx } = command;

    // Komut bus üzerinden her modülden çağrılabiliyor; kapsam kontrolü burada da
    // yapılır ki tek bir çağıranın unutması başka bir kliniğin defterine yazmaya
    // dönüşmesin. Sistem kaynaklı yürütmelerde evaluator zaten devre dışı kalır.
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(data.clinicId))
      .orThrow(ACCOUNTING_EVENTS.FINANCIAL_EVENTS_RECORD);

    if (data.dedupeKey) {
      const existing = await this.financialEventRepo.findByDedupeKey(
        data.dedupeKey
      );
      if (existing) {
        return this.resolveExisting(existing, data.dedupeKey, data.clinicId);
      }
    }

    const organizationId = await this.tenantScopeResolver.resolve(data);

    const recordData: RecordFinancialEventProps = {
      ...data,
      organizationId,
      // İşlemi kimin yaptığı yasal iz kaydıdır; istemcinin gönderdiği değere
      // bırakılırsa başkasının adına kayıt düşürülebilir. Gerçek bir kullanıcı
      // varsa daima context'ten damgalanır; sistem akışlarında (webhook, cron)
      // çağıranın verdiği değer korunur.
      performedById: this.resolvePerformedBy(command),
    };

    const event = FinancialEvent.record(recordData);

    // Kritik finansal kayıt: `RECORDED` event'i fişi üreten tek tetikleyici.
    // In-memory yayında (run) süreç commit ile emit arasında ölürse event
    // kaybolur ve dedupe nedeniyle yeniden denemede de üretilmez — olay defterde,
    // fiş hiç yok. Outbox teslim garantisi bu deliği kapatır.
    return this.txManager.outboxRun(async () => {
      const appended = await this.financialEventRepo.appendIfAbsent(event);
      if (appended) return appended.id.value;

      // Yarışı kaybettik: kazanan aynı anahtarla yazmış. Satır artık commit
      // edilmiş ve görünür olmak zorundadır (aksi hâlde çakışma olmazdı).
      if (!data.dedupeKey) {
        throw new FinancialEventUniqueConstraintException(event.id.value);
      }

      const winner = await this.financialEventRepo.findByDedupeKey(
        data.dedupeKey
      );
      if (!winner) {
        throw new FinancialEventUniqueConstraintException(data.dedupeKey);
      }

      return this.resolveExisting(winner, data.dedupeKey, data.clinicId);
    });
  }

  /**
   * Mevcut kaydı idempotent cevap olarak kabul etmeden önce aynı kliniğe ait
   * olduğunu doğrular.
   *
   * `dedupeKey` global tekildir. İki kiracının anahtarı çakışırsa — anahtar
   * üreticilerinden biri kiracı kapsamı taşımayı unuttuğunda bu mümkün — sessizce
   * "zaten var" demek, bu kliniğin ekonomik olayının **hiç yazılmadan** başarı
   * dönmesi olurdu: para defterden düşerdi. Bu yüzden çakışma hata olarak çıkar.
   */
  private resolveExisting(
    existing: FinancialEvent,
    dedupeKey: string,
    requestedClinicId: string
  ): string {
    if (existing.clinicId.value !== requestedClinicId) {
      throw new FinancialEventDedupeKeyCollisionException({
        dedupeKey,
        requestedClinicId,
        existingClinicId: existing.clinicId.value,
      });
    }
    return existing.id.value;
  }

  private resolvePerformedBy(
    command: RecordFinancialEventCommand
  ): string | null {
    const { data, ctx } = command;
    const actorId = ctx.actor.userId;
    const isRealUser = !!actorId && actorId !== SYSTEM_ACTOR.userId;

    return isRealUser ? actorId : (data.performedById ?? null);
  }
}
