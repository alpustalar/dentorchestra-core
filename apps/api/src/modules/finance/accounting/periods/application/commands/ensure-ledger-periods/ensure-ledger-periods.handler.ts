import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { DateTimeManager } from '@common/utils';
import { SYSTEM_ACTOR } from '@common/constants/system-actor.constant';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import {
  IPlatformTenantProvider,
  PLATFORM_TENANT_PROVIDER,
} from '@modules/finance/accounting/posting/domain/interfaces/platform-tenant.provider.interface';
import { AccountingPeriod } from '@modules/finance/accounting/periods/domain/entities/accounting-period.entity';
import {
  ACCOUNTING_PERIOD_COMMAND_REPOSITORY,
  IAccountingPeriodCommandRepository,
  LedgerScope,
} from '@modules/finance/accounting/periods/domain/repositories/accounting-period/accounting-period.command.repository';
import { PeriodAlreadyExistsException } from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';
import {
  EnsureLedgerPeriodsCommand,
  EnsureLedgerPeriodsResult,
} from './ensure-ledger-periods.command';

@CommandHandler(EnsureLedgerPeriodsCommand)
export class EnsureLedgerPeriodsHandler implements ICommandHandler<
  EnsureLedgerPeriodsCommand,
  EnsureLedgerPeriodsResult
> {
  private readonly logger = new Logger(EnsureLedgerPeriodsHandler.name);

  constructor(
    @Inject(ACCOUNTING_PERIOD_COMMAND_REPOSITORY)
    private readonly accountingPeriodRepo: IAccountingPeriodCommandRepository,
    @Inject(PLATFORM_TENANT_PROVIDER)
    private readonly platformTenant: IPlatformTenantProvider,
    private readonly txManager: TransactionManager,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {}

  async execute(): Promise<EnsureLedgerPeriodsResult> {
    const currentYear = DateTimeManager.currentYear();
    // Cari yıl da hedefte: geçen turda hata alan ya da hiç açılmamış bir dönem
    // bu sayede kendi kendine onarılır (iş idempotent).
    const targetYears = [currentYear, currentYear + 1];

    const scopes = await this.resolveScopes();
    const result: EnsureLedgerPeriodsResult = {
      created: 0,
      skipped: 0,
      failed: 0,
    };

    for (const scope of scopes) {
      for (const year of targetYears) {
        // Klinik başına ayrı transaction: bir kliniğin hatası diğerlerinin
        // dönemini geri sarmaz (yıl dönümünde kısmi başarı > tam başarısızlık).
        await this.ensurePeriod(scope, year, result);
      }
    }

    this.logger.log(
      `Defter dönemleri kontrol edildi: açıldı=${result.created} ` +
        `atlandı=${result.skipped} hata=${result.failed}`
    );

    return result;
  }

  /**
   * Kapsam = dönemi olan defterler ∪ platform defteri.
   *
   * `findLedgerScopes` "zaten dönemi olan kiracıları" döner; platform kiracısı normal
   * kayıt akışından geçmediği için hiç dönemi olmaz ve bu kümeye **hiç girmez** — kapsamı
   * mevcut kayıttan türetmek, kaydı hiç olmayanı sonsuza dek dışarıda bırakır (kural 5).
   */
  private async resolveScopes(): Promise<LedgerScope[]> {
    const scopes = await this.accountingPeriodRepo.findLedgerScopes();

    try {
      const platform = await this.platformTenant.resolve();
      if (!scopes.some((s) => s.clinicId === platform.clinicId)) {
        scopes.push({
          clinicId: platform.clinicId,
          organizationId: platform.organizationId,
        });
      }
    } catch (error) {
      // Platform çözülemezse yalnız onun fişleri durur; diğer kiracılar devam eder.
      this.criticalFailure.publish({
        operation: 'accounting.period.ensure-ledger-periods',
        severity: 'CRITICAL',
        summary:
          'Platform kiracısı çözülemedi; platform defterinin dönemi açılamadı ve platform fişleri duracak.',
        errorMessage: error instanceof Error ? error.message : String(error),
        context: {},
        clinicId: null,
        dedupeKey: 'period-ensure-platform-unresolved',
      });
    }

    return scopes;
  }

  private async ensurePeriod(
    scope: LedgerScope,
    year: number,
    result: EnsureLedgerPeriodsResult
  ): Promise<void> {
    try {
      await this.txManager.run(async () => {
        const existing = await this.accountingPeriodRepo.findByYear(
          scope.clinicId,
          year
        );
        if (existing) {
          result.skipped += 1;
          return;
        }

        const period = AccountingPeriod.create({
          clinicId: scope.clinicId,
          organizationId: scope.organizationId,
          year,
          actorId: SYSTEM_ACTOR.userId,
          source: SYSTEM_ACTOR.source,
        });

        await this.accountingPeriodRepo.create(period);
        result.created += 1;
      });
    } catch (error) {
      // Eşzamanlı çalıştırma (iki worker) unique kısıtta buluşur — hata değil.
      if (error instanceof PeriodAlreadyExistsException) {
        result.skipped += 1;
        return;
      }

      result.failed += 1;
      // Dönemi olmayan klinikte posting tümüyle durur; sessiz kalınamaz.
      this.criticalFailure.publish({
        operation: 'accounting.period.ensure-ledger-periods',
        severity: 'CRITICAL',
        summary:
          'Muhasebe dönemi açılamadı; bu klinikte yeni fiş üretimi duracak.',
        errorMessage: error instanceof Error ? error.message : String(error),
        context: { clinicId: scope.clinicId, year },
        clinicId: scope.clinicId,
        dedupeKey: `period-ensure-failed:${scope.clinicId}:${year}`,
      });
    }
  }
}
