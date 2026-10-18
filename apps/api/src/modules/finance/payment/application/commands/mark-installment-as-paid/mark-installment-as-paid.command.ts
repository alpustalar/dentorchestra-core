import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';

export class MarkInstallmentAsPaidCommand implements ICommand {
  readonly __responseType!: void;
  constructor(
    public readonly payload: {
      readonly installmentId: string;
      /** Audit log detayı; çağıran bağlama göre geçilir (POS / iyzico vb.). */
      readonly details?: string;
      /**
       * Tahsilatı kim/hangi kanal bildirdi — denetim izi için zorunlu. POS ve
       * webhook akışları `ExecutionContextFactory.createInternal()` geçer.
       */
      readonly ctx: IGetContext;
    }
  ) {}
}
