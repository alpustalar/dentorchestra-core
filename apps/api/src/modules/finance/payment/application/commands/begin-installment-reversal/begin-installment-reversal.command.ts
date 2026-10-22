import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';

/**
 * Parayı kart sahibine geri götürecek bir girişimin (iade/iptal) sağlayıcı çağrısından
 * ÖNCE taksidi kilitleyip damgalar. Çağıran aynı transaction içinde tavan kapısını da
 * çalıştırır; kapı reddederse damga geri sarılır.
 */
export class BeginInstallmentReversalCommand implements ICommand {
  readonly __responseType!: void;
  constructor(
    public readonly installmentId: string,
    public readonly ctx: IGetContext
  ) {}
}
