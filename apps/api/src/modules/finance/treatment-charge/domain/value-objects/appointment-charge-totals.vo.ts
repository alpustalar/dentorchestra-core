import { CurrencyType } from '@input-type-schemas/CurrencySchema';
import { Money } from '@src/domain/value-objects/money.vo';
import { TreatmentCharge } from '@modules/finance/treatment-charge/domain/entities/treatment-charge.entity';
import { ChargeTotalsCalculator } from '@modules/finance/treatment-charge/domain/services/charge-totals.calculator';
import { AppointmentChargeSummary } from '@modules/finance/treatment-charge/domain/contracts/treatment-charge';

/**
 * Bir randevunun satır toplamları — **domain nesnesi** (read-model/DTO değil).
 *
 * Fatura ve tahsilat tutarı buradan türer; bu yüzden kilitli okumayı yapan
 * domain servisi (`lockAndGetAppointmentTotals`) bunu döner. Modüller arası
 * sözleşmede DTO dolaştırmak yasak (CLAUDE.md — domain servisleri yalnız
 * skaler/VO döndürür); tutarlar `Money` olarak taşınır ki çağıran yanlış para
 * birimiyle toplama yapamasın.
 */
export class AppointmentChargeTotals {
  private constructor(
    public readonly appointmentId: string,
    public readonly clinicId: string,
    public readonly patientId: string,
    public readonly listTotal: Money,
    public readonly discountTotal: Money,
    public readonly netTotal: Money,
    public readonly vatTotal: Money,
    public readonly grandTotal: Money,
    public readonly vatRate: number,
    public readonly lineCount: number
  ) {
    Object.freeze(this);
  }

  get currency(): CurrencyType {
    return this.grandTotal.currency;
  }

  /**
   * Hesap **tek noktadan** (`ChargeTotalsCalculator`) geçer; VO yalnız sonucu
   * para nesnelerine sarar. İkinci bir toplama yolu açmak kuruş farkı üretir.
   */
  public static fromCharges(
    appointmentId: string,
    charges: TreatmentCharge[]
  ): AppointmentChargeTotals {
    return AppointmentChargeTotals.fromSummary(
      ChargeTotalsCalculator.summarize(appointmentId, charges)
    );
  }

  public static fromSummary(
    summary: AppointmentChargeSummary
  ): AppointmentChargeTotals {
    const money = (amount: string) =>
      Money.fromTrusted(amount, summary.currency);

    return new AppointmentChargeTotals(
      summary.appointmentId,
      summary.clinicId,
      summary.patientId,
      money(summary.listTotal),
      money(summary.discountTotal),
      money(summary.netTotal),
      money(summary.vatTotal),
      money(summary.grandTotal),
      summary.vatRate,
      summary.lineCount
    );
  }
}
