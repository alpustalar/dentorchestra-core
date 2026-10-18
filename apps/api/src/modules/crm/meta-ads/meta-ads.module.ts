import { Module } from '@nestjs/common';
import { MetaAdsPresentationModule } from './presentation/presentation.module';
import { MetaAdsCommandModule } from '@modules/crm/meta-ads/application/commands/command.module';
import { MetaAdsQueryModule } from '@modules/crm/meta-ads/application/queries/query.module';

@Module({
  imports: [
    MetaAdsPresentationModule,
    MetaAdsCommandModule,
    MetaAdsQueryModule,
  ],
})
export class MetaAdsModule {}
