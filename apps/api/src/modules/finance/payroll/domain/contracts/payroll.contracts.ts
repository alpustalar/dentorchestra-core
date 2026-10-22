/**
 * Bordro modülünün kalıcı tablosu yoktur (bilinçli — doc 05 §2.9): bu kontratlar
 * `FinancialEvent(PAYROLL_ACCRUED)` + `Party` adının birleştirilmiş okuma modelidir.
 */

/** `record-payroll-accrual.handler.ts`'in yazdığı PAYROLL_ACCRUED gövdesi. */
export interface PayrollAccruedPayload {
  readonly partyId: string;
  readonly grossSalary: string;
  readonly employerSgk: string;
  readonly netPayable: string;
  readonly taxWithholding: string;
  readonly employeeSgk: string;
}

/** Bordro tahakkuku okuma modeli — liste/detay query'lerinin ortak dönüşü. */
export interface PayrollAccrual {
  readonly financialEventId: string;
  readonly clinicId: string;
  readonly partyId: string;
  /** Party çözümlenemezse (silinmiş/erişilemez cari) null — maskeli değil, bilinmiyor. */
  readonly employeeUserId: string | null;
  readonly employeeName: string | null;
  readonly monthKey: string;
  readonly accrualDate: Date;
  readonly grossSalary: string;
  readonly employerSgk: string;
  readonly netPayable: string;
  readonly taxWithholding: string;
  readonly employeeSgk: string;
  readonly dedupeKey: string | null;
  readonly createdAt: Date;
}
