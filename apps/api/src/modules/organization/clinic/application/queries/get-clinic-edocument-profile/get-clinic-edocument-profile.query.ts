import { IQuery } from '@nestjs/cqrs';
import type { IGetContext } from '@common/decorators';
import type { GetClinicEDocumentProfileResponse } from './get-clinic-edocument-profile.response';

export class GetClinicEDocumentProfileQuery implements IQuery {
  readonly __responseType!: GetClinicEDocumentProfileResponse;

  constructor(
    public readonly clinicId: string,
    public readonly ctx: IGetContext
  ) {}
}
