import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';

/**
 * Sağlayıcı iade/iptali AÇIKÇA reddettiğinde damgayı kaldırır. Sonucu bilinmeyen
 * (zaman aşımı) girişimde ÇAĞRILMAZ — damga kalır ve itirazı engellemeye devam eder.
 */
export class ReleaseInstallmentReversalCommand implements ICommand {
  readonly __responseType!: void;
  constructor(
    public readonly installmentId: string,
    public readonly ctx: IGetContext
  ) {}
}
