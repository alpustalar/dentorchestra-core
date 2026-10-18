import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { SyncInstallmentLedgerEntryResponse } from './sync-installment-ledger-entry.response';

/**
 * Bir taksitin cari kaydını kaynağın **nihai** durumuna hizalar: yoksa yazar,
 * varsa durumunu günceller. Tahsilat ve iade olaylarının **tek** yazma yoludur.
 *
 * Neden tek yol: tahsilat kaydı kuyruk üzerinden asenkron yazılıyor, iade ise
 * ayrı bir olayla geliyordu. İade, kayıt henüz yazılmamışken geldiğinde
 * `updateMany` 0 satır güncelleyip "başarılı" dönüyor, ardından kuyruktaki iş
 * kaydı COMPLETED olarak yazıyordu → iade edilen tahsilat defterde **kalıcı
 * olarak gelir** kalıyordu. Bu komut durumu yazdığı anda kaynaktan okuduğu
 * için hangi olayın önce geldiği önemsizdir (sıraya duyarsız / idempotent).
 */
export class SyncInstallmentLedgerEntryCommand implements ICommand {
  readonly __responseType!: SyncInstallmentLedgerEntryResponse;
  constructor(
    public readonly payload: {
      readonly installmentId: string;
      /** Tahsilatı yapan personel — kaydın `performedById` damgası. */
      readonly actorId?: string | null;
      readonly ctx: IGetContext;
    }
  ) {}
}
