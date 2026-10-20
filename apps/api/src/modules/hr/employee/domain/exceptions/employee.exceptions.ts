import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { HttpStatus } from '@nestjs/common';

export class EmployeeNotFoundException extends DomainException<{
  employeeId?: string;
}> {
  readonly errorCode = ERROR_CODES.EMPLOYEE.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(employeeId?: string) {
    super('Çalışan bulunamadı.', { employeeId });
  }
}

export class EmployeeAlreadyTerminatedException extends DomainException<{
  employeeId?: string;
}> {
  readonly errorCode = ERROR_CODES.EMPLOYEE.ALREADY_TERMINATED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(employeeId?: string) {
    super('Çalışan zaten işten çıkarılmış.', { employeeId });
  }
}

export class EmployeeInvalidEntitlementException extends DomainException<{
  annualDays?: number;
}> {
  readonly errorCode = ERROR_CODES.EMPLOYEE.INVALID_ENTITLEMENT;

  constructor(annualDays?: number) {
    super('Yıllık izin hak edişi negatif olmayan bir tam sayı olmalıdır.', {
      annualDays,
    });
  }
}

export class EmployeeContractNotFoundException extends DomainException<{
  contractId?: string;
}> {
  readonly errorCode = ERROR_CODES.EMPLOYEE.CONTRACT_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(contractId?: string) {
    super('Sözleşme bulunamadı.', { contractId });
  }
}
