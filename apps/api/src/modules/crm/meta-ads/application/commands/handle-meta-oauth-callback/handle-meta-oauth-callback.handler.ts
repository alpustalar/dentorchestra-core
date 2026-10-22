import { Inject, Logger, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { HandleMetaOAuthCallbackCommand } from './handle-meta-oauth-callback.command';
import { HandleMetaOAuthCallbackResponse } from './handle-meta-oauth-callback.response';
import {
  IMetaAdAccountCommandRepository,
  META_AD_ACCOUNT_COMMAND_REPOSITORY,
} from '@modules/crm/meta-ads/domain/repositories/meta-ad-account.repository';
import {
  IMetaMarketingApiService,
  META_MARKETING_API_SERVICE,
} from '@modules/crm/meta-ads/domain/interfaces/meta-marketing-api.interface';
import { TokenCipherService } from '@src/infrastructure/security/crypto/token-cipher.service';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { MetaAdAccount } from '@modules/crm/meta-ads/domain/entities/meta-ad-account.entity';
import { MetaAdsCacheService } from '@modules/crm/meta-ads/infrastructure/cache/meta-ads-cache.service';
import {
  IMetaAdsConfig,
  META_ADS_CONFIG,
} from '@modules/crm/meta-ads/domain/interfaces/meta-ads-config.interface';
import { isOAuthStatePayload } from '@modules/crm/meta-ads/domain/contracts';
import { LogSource } from '@src/domain/constants/log-action.constant';

@CommandHandler(HandleMetaOAuthCallbackCommand)
export class HandleMetaOAuthCallbackHandler
  implements
    ICommandHandler<
      HandleMetaOAuthCallbackCommand,
      HandleMetaOAuthCallbackResponse
    >
{
  private readonly logger = new Logger(HandleMetaOAuthCallbackHandler.name);

  constructor(
    @Inject(META_AD_ACCOUNT_COMMAND_REPOSITORY)
    private readonly metaAdAccountRepo: IMetaAdAccountCommandRepository,
    @Inject(META_MARKETING_API_SERVICE)
    private readonly metaMarketingApi: IMetaMarketingApiService,
    @Inject(META_ADS_CONFIG)
    private readonly metaAdsConfig: IMetaAdsConfig,
    private readonly tokenCipher: TokenCipherService,
    private readonly cacheService: MetaAdsCacheService,
    private readonly txManager: TransactionManager
  ) {}

  async execute(
    command: HandleMetaOAuthCallbackCommand
  ): Promise<HandleMetaOAuthCallbackResponse> {
    const { code, state } = command;

    const raw = await this.cacheService.metaOAuthState.get(state);

    if (!raw)
      throw new UnauthorizedException(
        'Geçersiz veya süresi dolmuş OAuth state.'
      );

    let oAuthState: unknown;
    try {
      oAuthState = JSON.parse(raw);
    } catch {
      throw new UnauthorizedException('OAuth state formatı bozuk.');
    }

    if (!isOAuthStatePayload(oAuthState)) {
      throw new UnauthorizedException(
        'OAuth state veri bütünlüğü doğrulanamadı.'
      );
    }

    const { clinicId, userId, returnPath } = oAuthState;
    const { appSecret, appId, redirectUri } = this.metaAdsConfig;

    const shortLived = await this.metaMarketingApi.exchangeCodeForToken(
      code,
      appId,
      appSecret,
      redirectUri
    );
    const longLived = await this.metaMarketingApi.extendToLongLivedToken(
      shortLived.accessToken,
      appId,
      appSecret
    );

    const [adAccounts, pages] = await Promise.all([
      this.metaMarketingApi.getAdAccounts(longLived.accessToken),
      this.metaMarketingApi.getPages(longLived.accessToken),
    ]);

    const encryptedToken = this.tokenCipher.encrypt(longLived.accessToken);
    const firstPage = pages[0];

    let connectedAccounts = 0;

    for (const adAccount of adAccounts) {
      const existing = await this.metaAdAccountRepo.findByClinicAndAdAccountId(
        clinicId,
        adAccount.id
      );
      if (existing) continue;

      const metaAdAccount = MetaAdAccount.create({
        clinicId,
        adAccountId: adAccount.id,
        accessToken: encryptedToken,
        tokenExpiresAt: longLived.expiresAt,
        pageId: firstPage?.id ?? null,
        businessName: adAccount.name ?? null,
        // OAuth akışında ctx yok; aktör state payload'ında taşınıyor.
        actorId: userId,
        logSource: LogSource.WEB,
      });

      await this.txManager.run(async () => {
        await this.metaAdAccountRepo.create(metaAdAccount);
      });

      connectedAccounts++;
    }

    this.logger.log(
      `OAuth callback: ${connectedAccounts} hesap bağlandı (clinic: ${clinicId})`
    );

    return { connectedAccounts, returnPath };
  }
}
