import { LeaveBalance } from './leave-balance.vo';
import { LeaveEntitlement } from '@modules/hr/employee/domain/value-objects/leave-entitlement.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { AnnualLeavePeriod } from '@modules/hr/leave/domain/contracts/leave-request';

/** Tarihler klinik saat diliminde kurulur — takvim yılı sınırları tz'e duyarlı. */
const day = (iso: string): Date =>
  DateTimeManager.fromLocalDateTime(iso, '09:00');

const leave = (from: string, to: string): AnnualLeavePeriod => ({
  startDate: day(from),
  endDate: day(to),
});

describe('LeaveBalance VO — devreden hak ve yıl aşan izinler', () => {
  /** İşe giriş 2024 → hak ediş 2025'te doğar. Bugün 15 Haziran 2026. */
  const entitlement = LeaveEntitlement.of({
    hireDate: day('2024-03-01'),
    annualDays: 14,
  });
  const asOf = day('2026-06-15');

  const accrue = (leaves: AnnualLeavePeriod[] = []) =>
    LeaveBalance.accrue({ entitlement, leaves, asOf });

  describe('devreden hak (4857/53 — yıllık izin yanmaz)', () => {
    it('geçmiş yılın kullanılmayan günleri devreder', () => {
      // 2025: 14 hak, 4 gün kullanıldı → 10 devreder. 2026: 14 hak.
      const balance = accrue([leave('2025-07-01', '2025-07-04')]);

      expect(balance.carriedOver).toBe(10);
      expect(balance.accrued).toBe(14);
      expect(balance.entitlement).toBe(24);
      expect(balance.remaining).toBe(24);
    });

    it('hiç izin kullanılmadıysa geçmiş yılların hakkı tümüyle devreder', () => {
      expect(accrue().carriedOver).toBe(14);
      expect(accrue().entitlement).toBe(28);
    });

    it('bir yılda hak edişten fazla kullanım ertesi yılın hakkını götürmez', () => {
      // 2025'te 20 gün kullanıldı (hak 14) → devreden −6 değil, 0'da kırpılır.
      const balance = accrue([leave('2025-02-01', '2025-02-20')]);

      expect(balance.carriedOver).toBe(0);
      expect(balance.entitlement).toBe(14);
    });

    it('işe giriş yılında hak ediş doğmaz (kıdem 1 yılı dolmadan)', () => {
      const fresh = LeaveEntitlement.of({
        hireDate: day('2026-01-10'),
        annualDays: 14,
      });

      const balance = LeaveBalance.accrue({
        entitlement: fresh,
        leaves: [],
        asOf,
      });

      expect(balance.accrued).toBe(0);
      expect(balance.carriedOver).toBe(0);
      expect(balance.entitlement).toBe(0);
    });
  });

  describe('yıl aşan izinler', () => {
    it('izin günleri kesiştiği yıllara bölünür', () => {
      // 28 Aralık 2025 – 5 Ocak 2026 → 2025'e 4 gün, 2026'ya 5 gün.
      const balance = accrue([leave('2025-12-28', '2026-01-05')]);

      expect(balance.used).toBe(5); // yalnız 2026'ya düşen kısım
      expect(balance.carriedOver).toBe(10); // 2025: 14 − 4
    });

    it('önceki yıldan sarkan izin bu yılın kullanımına yazılır', () => {
      // Eski `startDate` filtresi bu izni 2026 sorgusunda hiç görmüyordu:
      // talep 2025'te başladığı için sarkan 5 gün kaybolup bakiye şişiyordu.
      const balance = accrue([leave('2025-12-30', '2026-01-04')]);

      expect(balance.used).toBe(4);
    });

    it('bu yıl başlayıp gelecek yıla sarkan iznin yalnız bu yılki günleri sayılır', () => {
      // 30 Aralık 2026 – 3 Ocak 2027 → 2026'ya 2 gün. Tüm talebi (5 gün) bu yıla
      // yazmak çalışanın hakkını fazladan yerdi.
      const balance = accrue([leave('2026-12-30', '2027-01-03')]);

      expect(balance.used).toBe(2);
    });

    it('tek yıl içindeki izin talebin kendi gün sayısına eşittir', () => {
      const balance = accrue([leave('2026-03-02', '2026-03-06')]);

      expect(balance.used).toBe(5);
    });
  });

  describe('bakiye aritmetiği', () => {
    it('kalan, devreden dahil toplamdan düşülür', () => {
      const balance = accrue([leave('2026-04-01', '2026-04-10')]);

      expect(balance.used).toBe(10);
      expect(balance.remaining).toBe(18); // (14 devreden + 14 hak) − 10
    });

    it('exceeds: talep kalandan büyükse true', () => {
      const balance = accrue([leave('2026-04-01', '2026-04-10')]);

      expect(balance.exceeds(18)).toBe(false);
      expect(balance.exceeds(19)).toBe(true);
    });

    it('kalan negatife düşebilir (hak edişten fazla kullanım mümkün)', () => {
      const balance = accrue([leave('2026-01-05', '2026-03-05')]);

      expect(balance.remaining).toBeLessThan(0);
    });

    it('toView devreden alanlarını da taşır', () => {
      expect(accrue([leave('2026-04-01', '2026-04-04')]).toView()).toEqual({
        accrued: 14,
        carriedOver: 14,
        entitlement: 28,
        used: 4,
        remaining: 24,
      });
    });
  });

  describe('periodOf', () => {
    it('izin yılı takvim yılıdır', () => {
      const period = LeaveBalance.periodOf(day('2026-06-15'));

      expect(DateTimeManager.getYear(period.from)).toBe(2026);
      expect(DateTimeManager.getYear(period.to)).toBe(2026);
      expect(period.from.getTime()).toBeLessThan(period.to.getTime());
    });

    it('argümansız çağrıda içinde bulunulan yılı verir', () => {
      const period = LeaveBalance.periodOf();

      expect(DateTimeManager.getYear(period.from)).toBe(
        DateTimeManager.currentYear()
      );
    });
  });
});
