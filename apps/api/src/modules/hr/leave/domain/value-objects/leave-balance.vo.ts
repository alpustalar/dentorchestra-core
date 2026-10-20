import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  AnnualLeavePeriod,
  LeaveBalance as ILeaveBalance,
} from '@modules/hr/leave/domain/contracts/leave-request';
import { LeaveEntitlement } from '@modules/hr/employee/domain/value-objects/leave-entitlement.vo';

export interface LeaveYearPeriod {
  from: Date;
  to: Date;
}

export interface AccrueLeaveBalanceProps {
  /** Çalışanın hak edişi (`hr/employee` domain'inden — kilitli ya da yetki kontrollü). */
  entitlement: LeaveEntitlement;
  /** Onaylanmış ANNUAL izinler; hak edişin başladığı yıldan itibaren tümü. */
  leaves: AnnualLeavePeriod[];
  /** Hangi ana göre hesaplanıyor (varsayılan: şimdi). */
  asOf?: Date;
}

/**
 * Yıllık izin bakiyesi. Hak ediş, **devreden**, kullanılan ve kalan gün ilişkisi ile
 * izin yılının sınırları burada tanımlıdır — handler'da değil. Entity gerektirmez,
 * bu yüzden hem okuma tarafı (bakiye sorgusu) hem yazma tarafı (onayda bakiye guard'ı)
 * aynı hesabı kullanır.
 *
 * **Devreden hak (4857/53-54).** Kullanılmayan yıllık izin yanmaz. Bakiye yalnız içinde
 * bulunulan yılın hak edişine bakılarak hesaplanırsa çalışanın kazanılmış hakkı silinir.
 * Bu yüzden hesap, hak edişin doğduğu ilk yıldan itibaren yıl yıl yürütülür:
 *
 *     devreden(y) = max(0, devreden(y-1) + hakEdiş(y) − kullanılan(y))
 *
 * Taban 0'da kırpılır: bir yılda hak edişten fazla kullanım (idari izin, avans) ertesi
 * yılın hakkını götürmez.
 *
 * **Yıl aşan izinler.** 28 Aralık – 5 Ocak arası bir izin iki izin yılına yayılır.
 * Talebin tüm günlerini başlangıç yılına yazmak o yılı şişirir, ertesi yılı boş
 * bırakır; `startDate` filtresiyle taramak ise sarkan günleri tamamen kaybeder. Burada
 * her izin, **yıl sınırlarıyla kesiştirilerek** ait olduğu yıllara dağıtılır.
 */
export class LeaveBalance {
  private constructor(
    private readonly _accrued: number,
    private readonly _carriedOver: number,
    private readonly _used: number
  ) {}

  /** İçinde bulunulan izin yılında doğan hak ediş. */
  get accrued(): number {
    return this._accrued;
  }

  /** Önceki yıllardan devreden kullanılmamış gün. */
  get carriedOver(): number {
    return this._carriedOver;
  }

  /** Toplam kullanılabilir gün (bu yılki hak ediş + devreden). */
  get entitlement(): number {
    return this._accrued + this._carriedOver;
  }

  /** İçinde bulunulan izin yılında kullanılmış onaylı ANNUAL gün. */
  get used(): number {
    return this._used;
  }

  /** Kalan gün. Hak edişten fazla kullanım mümkün olduğu için negatif olabilir. */
  get remaining(): number {
    return this.entitlement - this._used;
  }

  /**
   * Verilen anın ait olduğu izin yılı (varsayılan: şimdi). İzin yılı = takvim yılı.
   * Kural burada tekil: "hak ediş hangi dönemin kullanımına karşılık geliyor"
   * cevabı değişirse (ör. işe giriş yıl dönümü) yalnız burası değişir.
   */
  static periodOf(date: Date = DateTimeManager.create()): LeaveYearPeriod {
    const year = DateTimeManager.getYear(date);
    return {
      from: DateTimeManager.startOfYear(year),
      to: DateTimeManager.endOfYear(year),
    };
  }

  /**
   * Bakiyeyi hak ediş + onaylı izinlerden türetir. Devreden hesabı için hak edişin
   * doğduğu ilk yıldan `asOf`'a kadar tüm yıllar yürütülür.
   */
  static accrue(props: AccrueLeaveBalanceProps): LeaveBalance {
    const asOf = props.asOf ?? DateTimeManager.create();
    const currentYear = DateTimeManager.getYear(asOf);
    const years = props.entitlement.accrualYears(asOf);

    const usedByYear = LeaveBalance.splitDaysByYear(props.leaves);
    const usedIn = (year: number) => usedByYear.get(year) ?? 0;

    // Devreden: içinde bulunulan yıl HARİÇ, önceki yılların artığı.
    const carriedOver = years
      .filter((year) => year < currentYear)
      .reduce(
        (carried, year) =>
          Math.max(
            0,
            carried + props.entitlement.daysForYear(year) - usedIn(year)
          ),
        0
      );

    return new LeaveBalance(
      props.entitlement.daysForYear(currentYear),
      carriedOver,
      usedIn(currentYear)
    );
  }

  /**
   * İzinleri takvim yıllarına dağıtır: her izin, kesiştiği her yıla yalnız o yıla
   * düşen gün sayısıyla yazılır. Tek yıl içindeki izinlerde sonuç talebin kendi gün
   * sayısına eşittir; yıl aşanlarda gün sayısı yıllara bölünür.
   */
  private static splitDaysByYear(
    leaves: AnnualLeavePeriod[]
  ): Map<number, number> {
    const usedByYear = new Map<number, number>();

    for (const leave of leaves) {
      const firstYear = DateTimeManager.getYear(leave.startDate);
      const lastYear = DateTimeManager.getYear(leave.endDate);

      for (let year = firstYear; year <= lastYear; year++) {
        const days = LeaveBalance.daysWithinYear(leave, year);
        if (days > 0) usedByYear.set(year, (usedByYear.get(year) ?? 0) + days);
      }
    }

    return usedByYear;
  }

  /** İznin verilen takvim yılına düşen gün sayısı (uçlar dahil). */
  private static daysWithinYear(
    leave: AnnualLeavePeriod,
    year: number
  ): number {
    const yearStart = DateTimeManager.startOfYear(year);
    const yearEnd = DateTimeManager.endOfYear(year);

    const from = DateTimeManager.isAfter(leave.startDate, yearStart)
      ? leave.startDate
      : yearStart;
    const to = DateTimeManager.isBefore(leave.endDate, yearEnd)
      ? leave.endDate
      : yearEnd;

    if (DateTimeManager.isAfter(from, to)) return 0;

    // Gün sınırlarına normalize edilir: saat bileşeni `diffInDays`'i aşağı yuvarlayıp
    // son günü düşürebilirdi. Uçlar dahil olduğu için +1.
    return (
      DateTimeManager.diffInDays(
        DateTimeManager.startOfDay(to),
        DateTimeManager.startOfDay(from)
      ) + 1
    );
  }

  /** Talep edilen gün sayısı bakiyeyi aşıyor mu? */
  public exceeds(requestedDays: number): boolean {
    return requestedDays > this.remaining;
  }

  public toView(): ILeaveBalance {
    return {
      accrued: this._accrued,
      carriedOver: this._carriedOver,
      entitlement: this.entitlement,
      used: this._used,
      remaining: this.remaining,
    };
  }
}
