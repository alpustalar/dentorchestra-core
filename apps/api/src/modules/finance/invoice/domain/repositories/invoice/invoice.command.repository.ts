import { Invoice } from '@modules/finance/invoice/domain/entities/invoice.entity';
import { CreateInvoiceProps } from '@modules/finance/invoice/domain/contracts/invoice';

export const INVOICE_COMMAND_REPOSITORY = Symbol('IInvoiceCommandRepository');

export interface IInvoiceCommandRepository {
  create(props: CreateInvoiceProps): Promise<Invoice>;
  update(entity: Invoice): Promise<Invoice>;

  /** e-Belge sonucu işlenecek fatura (mutasyon okuması). */
  findById(id: string): Promise<Invoice | null>;

  /**
   * e-Belge sonucu uygulanacak faturayı `FOR UPDATE` ile kilitler.
   *
   * Sıcak satır: aynı faturaya iki sonuç yarışabilir (job retry + elle yeniden
   * tetikleme). Kilitsiz okunursa ikisi de faturayı PENDING görür, ikisi de
   * numara basar ve son yazan kazanır — belge numarası sessizce değişir.
   * Yalnız aktif transaction içinde çağrılır.
   */
  findByIdForUpdate(id: string): Promise<Invoice | null>;

  /**
   * Aynı randevu/ödeme için fatura zaten kesilmiş mi? Yeni fatura üretilip
   * üretilmeyeceğini belirlediği için Command Context'te okunur.
   */
  findByAppointmentId(appointmentId: string): Promise<Invoice | null>;
  findByPaymentId(paymentId: string): Promise<Invoice | null>;

  /**
   * e-Belge gönderim hakkını atomik olarak sahiplenir: `einvoiceStatus` yalnız
   * `DRAFT` ise `QUEUED`'a çekilir ve `true` döner.
   *
   * Entegratöre belge göndermek **geri alınamaz** bir dış yan etkidir; "önce oku,
   * sonra gönder" kalıbı job retry'ı ile mükerrer yasal belge üretir. Koşullu tek
   * UPDATE bu pencereyi kapatır: yarışı kazanan tek istek gönderir, diğerleri
   * `false` alıp atlar. `DRAFT` dışı hiçbir durum yeniden sahiplenilemez (SENT/
   * ACCEPTED/INTERNAL = gönderildi, FAILED/QUEUED = sonucu bilinmiyor) — bu
   * durumlardan çıkış bilinçli bir insan kararıdır.
   */
  claimForEDocumentDispatch(invoiceId: string): Promise<boolean>;
}
