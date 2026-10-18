import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { GetInstallmentForLedgerResponse } from './get-installment-for-ledger.response';

/**
 * Tek taksitin cari defteri besleyen hâli (durum süzgeci yok).
 *
 * Cari kaydını yazan taraf, tahsilat ve iade olaylarının sırasız teslim
 * edilebilmesi nedeniyle kaydı yazdığı anda taksitin NİHAİ durumunu okumak
 * zorundadır — sabit "tahsil edildi" varsayımı, önce gelen iadeyi sessizce
 * yutuyordu.
 */
export class GetInstallmentForLedgerQuery implements IQuery {
  readonly __responseType!: GetInstallmentForLedgerResponse;
  constructor(
    public readonly installmentId: string,
    public readonly ctx: IGetContext
  ) {}
}
