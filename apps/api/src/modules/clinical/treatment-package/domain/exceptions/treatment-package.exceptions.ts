import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';

export class TreatmentPackageNotFoundException extends DomainException {
  readonly errorCode = ERROR_CODES.TREATMENT_PACKAGE.NOT_FOUND;

  constructor(packageId?: string) {
    super(
      packageId
        ? `Tedavi paketi bulunamadı: packageId=${packageId}`
        : 'Tedavi paketi bulunamadı.'
    );
  }
}

export class TreatmentPackageNameEmptyException extends DomainException {
  public readonly errorCode = ERROR_CODES.TREATMENT_PACKAGE.PACKAGE_NAME_EMPTY;

  constructor() {
    super('Tedavi paketi ismi boş olamaz.');
  }
}

export class TreatmentPackageAlreadyDeletedException extends DomainException {
  public readonly errorCode =
    ERROR_CODES.TREATMENT_PACKAGE.PACKAGE_ALREADY_DELETED;

  constructor() {
    super('Silinmiş tedavi paketi güncellenemez.');
  }
}
