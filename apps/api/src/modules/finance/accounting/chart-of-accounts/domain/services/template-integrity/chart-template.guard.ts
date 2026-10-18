import { Injectable, Logger } from '@nestjs/common';
import { CLINIC_CHART_OF_ACCOUNTS_TEMPLATE } from '@modules/finance/accounting/chart-of-accounts/domain/constants/clinic-chart-of-accounts.template';
import { ChartTemplateIntegrity } from './chart-template-integrity';

/**
 * Hesap planı şablonunu **açılışta** doğrular (`PostingRuleRegistry` ile aynı
 * gerekçe): şablon yaşayan bir dosya ve bozuk bir düzenleme aksi hâlde ilk klinik
 * kurulumuna kadar — yani canlıda, kayıt açma transaction'ının içinde — gizli
 * kalır. Burada patlarsa hata deploy anında görülür.
 */
@Injectable()
export class ChartTemplateGuard {
  private readonly logger = new Logger(ChartTemplateGuard.name);

  constructor() {
    ChartTemplateIntegrity.assertTemplateIsConsistent();
    this.logger.log(
      `Hesap planı şablonu doğrulandı (${CLINIC_CHART_OF_ACCOUNTS_TEMPLATE.length} hesap)`
    );
  }
}
