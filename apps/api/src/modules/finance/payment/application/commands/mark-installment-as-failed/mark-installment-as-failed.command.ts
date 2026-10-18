import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';

export class MarkInstallmentAsFailedCommand implements ICommand {
  readonly __responseType!: void;
  constructor(
    public readonly payload: {
      readonly installmentId: string;
      /** Hata nedeni / audit log detayı; çağıran bağlama göre geçilir. */
      readonly details?: string;
      /** Başarısızlığı kim/hangi kanal bildirdi — denetim izi için zorunlu. */
      readonly ctx: IGetContext;
    }
  ) {}
}
