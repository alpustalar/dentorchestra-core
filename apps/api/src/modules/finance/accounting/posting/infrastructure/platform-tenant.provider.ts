import { Injectable, Logger } from '@nestjs/common';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { IGetContext } from '@common/decorators';
import { ActorContext } from '@common/interfaces';
import { SYSTEM_ACTOR } from '@common/constants/system-actor.constant';
import { ExecutionSources } from '../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { InitializeChartOfAccountsCommand } from '@modules/finance/accounting/chart-of-accounts/application/commands/initialize-chart-of-accounts/initialize-chart-of-accounts.command';
import {
  IPlatformTenantProvider,
  PlatformLedgerTarget,
} from '../domain/interfaces/platform-tenant.provider.interface';
import { PlatformTenantNotConfiguredException } from '../domain/exceptions/posting.exceptions';

/**
 * Platform kiracısını (isPlatform) çözer.
 *
 * Kiracı satırları migration ile kurulur (seed'de değil — entrypoint yalnız
 * `migrate deploy` çalıştırıyor). Burada yalnız okunur; eksikse kurulum
 * eksiktir ve sesli hata verilir.
 *
 * Sonuç süreç ömrü boyunca önbelleklenir: platform kiracısı değişmeyen bir
 * sistem satırıdır, her tahsilatta iki sorgu atmanın anlamı yok.
 */
@Injectable()
export class PlatformTenantProvider implements IPlatformTenantProvider {
  private readonly logger = new Logger(PlatformTenantProvider.name);
  private cached: PlatformLedgerTarget | null = null;
  /** Eşzamanlı ilk çağrıların hesap planını iki kez kurmaya çalışmasını önler. */
  private inflight: Promise<PlatformLedgerTarget> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly commandBus: TSCommandBus
  ) {}

  async resolve(): Promise<PlatformLedgerTarget> {
    if (this.cached) return this.cached;
    if (this.inflight) return this.inflight;

    this.inflight = this.load().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }
  private async load(): Promise<PlatformLedgerTarget> {
    const clinic = await this.prisma.clinic.findFirst({
      where: { isPlatform: true },
      select: { id: true, organizationId: true },
    });

    if (!clinic) throw new PlatformTenantNotConfiguredException();

    const target: PlatformLedgerTarget = {
      clinicId: clinic.id,
      organizationId: clinic.organizationId,
    };

    // Platform kliniği normal kayıt akışından geçmediği için hesap planı
    // kurulmamış olur; komutun kendisi idempotent (existsForClinic kontrolü).
    await this.commandBus.execute(
      new InitializeChartOfAccountsCommand({
        clinicId: target.clinicId,
        organizationId: target.organizationId,
        ctx: this.systemContext(target),
      })
    );

    this.cached = target;
    this.logger.log(`Platform defteri hazır (clinicId=${target.clinicId}).`);
    return target;
  }

  private systemContext(target: PlatformLedgerTarget): IGetContext {
    const actor: ActorContext = {
      ...SYSTEM_ACTOR,
      clinicId: target.clinicId,
      organizationId: target.organizationId,
      managedClinics: [{ id: target.clinicId }],
    };
    return {
      actor,
      source: ExecutionSources.INTERNAL_CASCADE,
      ip: '127.0.0.1',
      userAgent: 'PLATFORM_TENANT_PROVIDER',
    };
  }
}
