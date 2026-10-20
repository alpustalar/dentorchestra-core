import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../../../packages/shared/common/constants/error-codes.constant';

export class IyzicoTransactionNotFoundException extends DomainException<{
  conversationId?: string;
}> {
  public readonly errorCode = ERROR_CODES.IYZICO.TRANSACTION_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(conversationId?: string) {
    super(`Ödeme kaydı bulunamadı`, { conversationId });
  }
}

export class IyzicoPaymentRecordNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.IYZICO.PAYMENT_RECORD_NOT_FOUND;

  constructor(message = 'Bu ödeme için iyzico işlem kaydı bulunamadı.') {
    super(message);
  }
}

export class IyzicoInstallmentInfoFailedException extends DomainException<{
  sdkErrorMessage?: string;
}> {
  public readonly errorCode = ERROR_CODES.IYZICO.INSTALLMENT_INFO_FAILED;

  constructor(sdkErrorMessage?: string) {
    super('Taksit bilgisi alınamadı', { errorMessage: sdkErrorMessage });
  }
}
