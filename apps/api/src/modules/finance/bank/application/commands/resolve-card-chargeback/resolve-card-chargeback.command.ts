import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators/get-context.decorator';
import { ResolveCardChargeback } from '@shared/modules/bank/types/commands';

/**
 * Kart itirazının SONUÇLANDIRILMASI: kazanıldı (para geri geldi) ya da
 * kaybedildi (kesinleşti). Çözüm tek seferliktir.
 */
export class ResolveCardChargebackCommand implements ICommand {
  readonly __responseType!: void;
  constructor(
    public readonly payload: {
      readonly chargebackId: string;
      readonly data: ResolveCardChargeback;
      readonly ctx: IGetContext;
    }
  ) {}
}
