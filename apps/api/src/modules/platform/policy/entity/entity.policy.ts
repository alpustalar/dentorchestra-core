import { Injectable } from '@nestjs/common';
import { ValidateOptionsType } from '@shared/common/validate-options/validate-options.type';
import { BasePolicy } from '@modules/platform/policy/staff/application/base.policy';
import { IEntityPolicy } from '@modules/platform/policy/entity/entity-policy.interface';
import { SerializationOptionsResponse } from '@common/interfaces/serialization-policy.interface';
import {
  ResponseGroup,
  ResponseGroups,
} from '../../../../../../../packages/shared/common/constants/response-groups.constant';

@Injectable()
export class EntityPolicy extends BasePolicy implements IEntityPolicy {
  public getValidateOptions(businessRulesEnabled = true): ValidateOptionsType {
    return {
      systemOverride: this.isSystem(),
      businessRulesEnabled,
    };
  }

  /**
   * Platform-seviye (kiracıdan bağımsız) kayıtların alan görünürlüğü —
   * yönetici talepleri, plan/modül kataloğu gibi. Klinik/organizasyon bağı
   * olmadığı için tek ayrım sistem yöneticiliğidir: ADMIN ya da hiçbir grup.
   */
  public getSerializationOptions(): SerializationOptionsResponse<ResponseGroup> {
    const isSystem = this.isSystem();

    return {
      isGroupActive: isSystem,
      groups: isSystem ? [ResponseGroups.ADMIN] : [],
    };
  }
}
