import { IGetContext } from '@common/decorators';

/**
 * `organizationId` **istemciden alınmaz**: kiracı kimliği `clinicId`'den
 * `TenantScopeResolver` ile çözülür (bkz. CLAUDE.md — kimlik/kapsam çözümlemesi).
 */
export class OpenPeriodCommand {
  readonly __responseType!: string;
  constructor(
    public readonly payload: {
      readonly clinicId: string;
      readonly year: number;
      readonly ctx: IGetContext;
    }
  ) {}
}
