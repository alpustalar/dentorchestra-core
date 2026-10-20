// @modules/treatment/domain/exceptions/invalid-treatment-package-resume.exception.ts
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

export class PatientTreatmentPackageNotFoundException extends DomainException {
  readonly errorCode = ERROR_CODES.PATIENT_TREATMENT_PACKAGE.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(packageId?: string) {
    super('Müşteri tedavi paketi bulunamadı.', { packageId });
  }
}

export class InvalidTreatmentPackageStatusException extends DomainException<{
  packageId?: string;
  currentStatus?: string;
}> {
  readonly errorCode = ERROR_CODES.PATIENT_TREATMENT_PACKAGE.INVALID_STATUS;

  constructor(currentStatus?: string, packageId?: string) {
    super(
      'Paket askıya alınamaz. Yalnızca aktif olan tedavi paketleri askıya alınabilir.',
      { currentStatus, packageId }
    );
  }
}

export class InvalidTreatmentPackageCancelException extends DomainException<{
  packageId?: string;
  currentStatus?: string;
}> {
  readonly errorCode =
    ERROR_CODES.PATIENT_TREATMENT_PACKAGE.INVALID_CANCEL_STATUS;

  constructor(currentStatus?: string, packageId?: string) {
    super(
      'Tamamlanan veya zaten iptal edilmiş tedavi paketleri tekrar iptal edilemez.',
      { currentStatus, packageId }
    );
  }
}

export class InvalidTreatmentPackageCompletionException extends DomainException<{
  packageId?: string;
  currentStatus?: string;
}> {
  readonly errorCode =
    ERROR_CODES.PATIENT_TREATMENT_PACKAGE.INVALID_COMPLETION_STATUS;

  constructor(currentStatus?: string, packageId?: string) {
    super(
      'Tedavi paketi tamamlanamaz. Yalnızca aktif olan paketler tamamlanabilir.',
      { currentStatus, packageId }
    );
  }
}

export class InvalidTreatmentPackageResumeException extends DomainException<{
  packageId?: string;
  currentStatus?: string;
}> {
  readonly errorCode =
    ERROR_CODES.PATIENT_TREATMENT_PACKAGE.INVALID_RESUME_STATUS;

  constructor(currentStatus?: string, packageId?: string) {
    super(
      'Tedavi paketi yeniden aktive edilemedi. Yalnızca askıya alınmış paketler tekrar aktif hale getirilebilir.',
      { currentStatus, packageId }
    );
  }
}

export class InvalidTreatmentPackageBulkUpdateException extends DomainException<{
  packageId?: string;
  currentStatus?: string;
  targetStatus?: string;
}> {
  readonly errorCode =
    ERROR_CODES.PATIENT_TREATMENT_PACKAGE.INVALID_BULK_UPDATE;

  constructor(
    currentStatus?: string,
    targetStatus?: string,
    packageId?: string
  ) {
    super(
      'Tamamlanmış veya iptal edilmiş bir tedavi paketinin durumu toplu güncellemeyle değiştirilemez.',
      { currentStatus, targetStatus, packageId }
    );
  }
}
