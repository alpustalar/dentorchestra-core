import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';
import { TreatmentCharge } from '@modules/finance/treatment-charge/domain/entities/treatment-charge.entity';

export const TREATMENT_CHARGE_COMMAND_REPOSITORY = Symbol(
  'ITreatmentChargeCommandRepository'
);

export interface ITreatmentChargeCommandRepository extends IBaseCommandRepository<TreatmentCharge> {
  create(entity: TreatmentCharge): Promise<TreatmentCharge>;

  /**
   * Satırı `FOR UPDATE` kilitleyerek yükler — yalnız aktif transaction içinde.
   * İptal ve indirim güncellemesi aynı satırın parasal durumunu değiştirir;
   * kilitsiz okumada iki eşzamanlı istek birbirinin yazmasını ezer (lost update)
   * ve "faturalanmış mı" kontrolü ile yazma arasındaki pencere açık kalır.
   */
  findByIdForUpdate(id: string): Promise<TreatmentCharge | null>;

  /**
   * Randevunun iptal edilmemiş satırları. Command Context'te okunur çünkü
   * fatura/tahsilat tutarı bu satırlardan türer ve karar besler.
   */
  findActiveByAppointmentId(appointmentId: string): Promise<TreatmentCharge[]>;

  /**
   * Aynı okuma, satırlar `FOR UPDATE` **kilitli** — yalnız aktif transaction
   * içinde. Fatura/tahsilat tutarı bu toplamdan yazıldığı için, okuma ile yazma
   * arasında bir satırın iptal edilmesi ya da indiriminin değişmesi faturayı
   * kendi satırlarıyla uyuşmaz hâle getirir; kilit o pencereyi kapatır
   * (iptal/indirim yolları da aynı satırları kilitliyor → serileşirler).
   */
  findActiveByAppointmentIdForUpdate(
    appointmentId: string
  ): Promise<TreatmentCharge[]>;
}
