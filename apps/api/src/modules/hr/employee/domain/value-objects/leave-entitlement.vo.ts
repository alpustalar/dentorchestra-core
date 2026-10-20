import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { EmployeeInvalidEntitlementException } from '@modules/hr/employee/domain/exceptions/employee.exceptions';

export interface LeaveEntitlementProps {
  /** İşe giriş tarihi — hak edişin hangi yıldan itibaren doğduğunu belirler. */
  hireDate: Date;
  /** Çalışanın kayıtlı yıllık izin gün hakkı (`Employee.annualLeaveEntitlement`). */
  annualDays: number;
}

/**
 * Yıllık izin **hak edişi** (kullanım değil). Çalışanın verisinden türer, bu yüzden
 * `hr/employee` modülüne aittir; kullanılan günlerle birleştirip bakiyeye çevirme işi
 * `hr/leave` modülündeki `LeaveBalance`'ın sorumluluğundadır. Bu ayrım iki modülün
 * birbirinin deposuna uzanmasını gereksiz kılar: çalışan "kaç gün hak ettin", izin
 * modülü "kaç gün kullandın" sorusunu kendi verisinden yanıtlar.
 *
 * **4857/53 — hak ediş bir yıl hizmet dolunca doğar.** İşe giriş yılında yıllık izin
 * hak edişi yoktur; hak, kıdem yıl dönümünde doğar. Kod izin yılını **takvim yılı**
 * olarak modellediği için (bkz. `LeaveBalance.periodOf`) yıl dönümü ay ortasına düşse
 * bile hak, işe giriş yılının **ertesi takvim yılından** itibaren tam sayılır.
 *
 * **Bilinen sınır — hak ediş geçmişi saklanmıyor.** `Employee` tek bir güncel
 * `annualLeaveEntitlement` taşır; geçmiş yılların hak edişi ayrıca kaydedilmez. Kıdeme
 * bağlı artışlar (14 → 20 → 26 gün) geriye dönük olarak bilinemediği için devreden
 * hesabı geçmiş yıllarda da **güncel** hak edişi kullanır. İK bu sayıyı değiştirirse
 * geçmiş yıllar yeni değerle yeniden hesaplanır. Tam doğruluk için yıl-bazlı hak ediş
 * geçmişi (`EmployeeLeaveEntitlementHistory`) gerekir; bu ayrı bir iştir.
 */
export class LeaveEntitlement {
  private constructor(
    private readonly _hireDate: Date,
    private readonly _annualDays: number
  ) {}

  get hireDate(): Date {
    return this._hireDate;
  }

  /** Hak edişin doğduğu yıllarda geçerli olan yıllık gün sayısı. */
  get annualDays(): number {
    return this._annualDays;
  }

  /**
   * Hak edişin ilk kez doğduğu izin yılı: işe giriş yılının ertesi yılı. İşe giriş
   * yılında (kıdem 1 yılı doldurmadan) yıllık izin hak edişi yoktur.
   */
  get firstAccrualYear(): number {
    return DateTimeManager.getYear(this._hireDate) + 1;
  }

  static of(props: LeaveEntitlementProps): LeaveEntitlement {
    if (!Number.isInteger(props.annualDays) || props.annualDays < 0) {
      throw new EmployeeInvalidEntitlementException(props.annualDays);
    }
    return new LeaveEntitlement(props.hireDate, props.annualDays);
  }

  /** Verilen izin yılında doğan hak ediş (kıdem dolmamışsa 0). */
  public daysForYear(year: number): number {
    return year < this.firstAccrualYear ? 0 : this._annualDays;
  }

  /**
   * Devreden hesabının yürütüleceği izin yılları: ilk hak ediş yılından `asOf`'un
   * yılına kadar (dahil). Çalışan henüz hak etmediyse boş dizi.
   */
  public accrualYears(asOf: Date = DateTimeManager.create()): number[] {
    const lastYear = DateTimeManager.getYear(asOf);
    const years: number[] = [];

    for (let year = this.firstAccrualYear; year <= lastYear; year++) {
      years.push(year);
    }

    return years;
  }
}
