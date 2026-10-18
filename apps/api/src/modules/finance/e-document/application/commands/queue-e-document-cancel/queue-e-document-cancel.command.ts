/**
 * İptal edilmiş bir faturanın entegratör iptal bildirimini kuyruğa alır
 * (doc 07 §5). Fatura iptali **yerel** bir muhasebe kararıdır ve bu adımı
 * beklemez; bildirim async işlenir, hatası iptali geri almaz (kuyruk yeniden
 * dener, tükenirse CRITICAL alarm düşer).
 */
export class QueueEDocumentCancelCommand {
  readonly __responseType!: void;

  constructor(
    public readonly payload: {
      readonly invoiceId: string;
      /** Entegratördeki belge referansı (ETTN/UUID). */
      readonly uuid: string;
      readonly reason: string;
      readonly clinicId: string;
    }
  ) {}
}
