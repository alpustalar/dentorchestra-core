import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InitiateMetaOAuthCommand } from './initiate-meta-oauth.command';
import { InitiateMetaOAuthResponse } from './initiate-meta-oauth.response';
import {
  IMetaMarketingApiService,
  META_MARKETING_API_SERVICE,
} from '@modules/crm/meta-ads/domain/interfaces/meta-marketing-api.interface';
import { MetaAdsCacheService } from '@modules/crm/meta-ads/infrastructure/cache/meta-ads-cache.service';
import {
  IMetaAdsConfig,
  META_ADS_CONFIG,
} from '@modules/crm/meta-ads/domain/interfaces/meta-ads-config.interface';
import { UUID } from '@src/domain/value-objects';
import {
  ITenantScopeResolver,
  TENANT_SCOPE_RESOLVER,
} from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@CommandHandler(InitiateMetaOAuthCommand)
export class InitiateMetaOAuthHandler implements ICommandHandler<
  InitiateMetaOAuthCommand,
  InitiateMetaOAuthResponse
> {
  constructor(
    @Inject(META_MARKETING_API_SERVICE)
    private readonly metaApi: IMetaMarketingApiService,
    @Inject(META_ADS_CONFIG)
    private readonly metaAdsConfig: IMetaAdsConfig,
    private readonly cacheService: MetaAdsCacheService,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(command: InitiateMetaOAuthCommand): Promise<string> {
    const { clinicId, returnPath, ctx } = command.payload;

    // Kapsam kontrolünün TEK yeri burasıdır: callback aktörsüz çalışır (Meta'dan
    // gelen yönlendirme) ve kliniği state'ten okur. Burada doğrulanmazsa herhangi
    // bir oturum sahibi, başka bir kiracının kliniğine kendi Meta reklam hesabını
    // bağlayacak bir authorize bağlantısı üretebilirdi.
    const organizationId = await this.tenantScopeResolver.resolve({ clinicId });

    this.policyFactory
      .clinic(ctx.actor, ctx.source)
      .evaluator.check((p) =>
        p.actorCanAccessClinicOrOwnsOrganization(clinicId, organizationId)
      )
      .orThrow('meta-ads.oauth.authorize');

    const generatedStateUUID = UUID.generate();

    await this.cacheService.metaOAuthState.set(
      generatedStateUUID.value,
      JSON.stringify({ clinicId, userId: ctx.actor.userId, returnPath })
    );

    const appId = this.metaAdsConfig.appId;
    const redirectUri = this.metaAdsConfig.redirectUri;

    return this.metaApi.buildOAuthUrl(
      appId,
      redirectUri,
      generatedStateUUID.value
    );
  }
}
