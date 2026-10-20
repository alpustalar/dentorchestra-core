import { DomainException } from '@src/domain/exceptions/domain.exception';
import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';

export class MetaAdsNotFoundException extends DomainException {
  readonly errorCode = ERROR_CODES.META_ADS.NOT_FOUND;
  public override httpStatus = HttpStatus.NOT_FOUND;
  constructor() {
    super('MetaAds bulunamadı.');
  }
}
