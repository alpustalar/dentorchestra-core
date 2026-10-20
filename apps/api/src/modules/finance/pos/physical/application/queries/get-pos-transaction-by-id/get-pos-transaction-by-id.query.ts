import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { GetPosTransactionByIdResponse } from './get-pos-transaction-by-id.response';

/**
 * POS işleminin **değişmeyen olguları** (hasta, ödeme planı, sağlayıcı, tutar).
 *
 * Diğer modüller (kart itirazı) bir kaydı bu işleme bağlarken kimlik toplamak
 * için kullanır. Para kararını besleyen değişken durum (canlı iadeler, iptal)
 * buradan alınmaz — o okuma kilitli ve Command Repo'dandır
 * (`POS_CARD_COLLECTION_SERVICE`).
 */
export class GetPosTransactionByIdQuery implements IQuery {
  readonly __responseType!: GetPosTransactionByIdResponse;

  constructor(
    public readonly posTransactionId: string,
    public readonly ctx: IGetContext
  ) {}
}
