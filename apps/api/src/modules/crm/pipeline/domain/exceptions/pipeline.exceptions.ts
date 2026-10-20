import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { HttpStatus } from '@nestjs/common';

export class PipelineNotFoundException extends DomainException<{
  pipelineId?: string;
}> {
  readonly errorCode = ERROR_CODES.PIPELINE.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(pipelineId?: string) {
    super('Satış hunisi bulunamadı.', { pipelineId });
  }
}

export class PipelineStageNotFoundException extends DomainException<{
  stageId?: string;
}> {
  readonly errorCode = ERROR_CODES.PIPELINE.STAGE_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(stageId?: string) {
    super('Huni aşaması bulunamadı.', { stageId });
  }
}
