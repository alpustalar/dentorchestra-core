import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { FindPartiesByIdsResponse } from './find-parties-by-ids.response';

export class FindPartiesByIdsQuery implements IQuery {
  readonly __responseType!: FindPartiesByIdsResponse;
  constructor(
    public readonly payload: {
      readonly clinicId: string;
      readonly ids: readonly string[];
      readonly ctx: IGetContext;
    }
  ) {}
}
