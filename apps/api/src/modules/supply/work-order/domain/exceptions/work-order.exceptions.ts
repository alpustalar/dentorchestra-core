import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { HttpStatus } from '@nestjs/common';
import type { WorkOrderStateMeta } from '@shared/modules/work-order/interfaces';

export class WorkOrderNotFoundException extends DomainException<{
  workOrderId?: string;
}> {
  readonly errorCode = ERROR_CODES.WORK_ORDER.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(workOrderId?: string) {
    super('Dış iş emri bulunamadı.', { workOrderId });
  }
}

export class WorkOrderEmptyItemsException extends DomainException {
  readonly errorCode = ERROR_CODES.WORK_ORDER.EMPTY_ITEMS;

  constructor(message = 'İş emri en az bir kalem içermelidir.') {
    super(message);
  }
}

/**
 * Geçersiz durum geçişi. `meta` frontend'e hangi eylemin hangi durumda reddedildiğini
 * ve hangi durumlarda mümkün olduğunu taşır (@shared'teki WorkOrderStateMeta).
 */
export class WorkOrderInvalidStateException extends DomainException<WorkOrderStateMeta> {
  readonly errorCode = ERROR_CODES.WORK_ORDER.INVALID_STATE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(message: string, meta: WorkOrderStateMeta) {
    super(message, meta);
  }
}

export class WorkOrderDueDateRequiredException extends DomainException {
  readonly errorCode = ERROR_CODES.WORK_ORDER.DUE_DATE_REQUIRED;

  constructor(
    message = 'Tedarikçiye gönderilen iş emrinde termin tarihi zorunludur.'
  ) {
    super(message);
  }
}
