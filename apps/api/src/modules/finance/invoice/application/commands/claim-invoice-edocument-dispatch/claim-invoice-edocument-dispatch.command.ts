import { ICommand } from '@nestjs/cqrs';

/**
 * e-Belge gönderim hakkını sahiplenir (claim). `true` dönerse çağıran belgeyi
 * entegratöre gönderebilir; `false` dönerse başka bir çalıştırma zaten
 * göndermiştir (veya sonucu bilinmiyor) ve gönderim ATLANMALIDIR.
 *
 * Kuyruk işleyicisi (`e-document`) bunu portu çağırmadan hemen önce dispatch eder:
 * job yeniden denendiğinde entegratöre ikinci bir belge gitmesini engelleyen kapı
 * budur (mükerrer yasal belge).
 */
export class ClaimInvoiceEDocumentDispatchCommand implements ICommand {
  readonly __responseType!: boolean;
  constructor(public readonly invoiceId: string) {}
}
