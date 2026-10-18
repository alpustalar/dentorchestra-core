import { Decimal } from 'decimal.js';
import { UnbalancedPayrollBreakdownException } from '@modules/finance/shared/domain/exceptions';

export interface PayrollBreakdownProps {
  grossSalary: string | number | Decimal;
  netPayable: string | number | Decimal;
  taxWithholding: string | number | Decimal;
  employeeSgk: string | number | Decimal;
  employerSgk: string | number | Decimal;
}

export class PayrollBreakdown {
  private readonly _grossSalary: Decimal;
  private readonly _netPayable: Decimal;
  private readonly _taxWithholding: Decimal;
  private readonly _employeeSgk: Decimal;
  private readonly _employerSgk: Decimal;

  // Constructor artık doğrudan doğrulanmış temiz Decimal nesnelerini alır
  private constructor(
    grossSalary: Decimal,
    netPayable: Decimal,
    taxWithholding: Decimal,
    employeeSgk: Decimal,
    employerSgk: Decimal
  ) {
    this._grossSalary = grossSalary;
    this._netPayable = netPayable;
    this._taxWithholding = taxWithholding;
    this._employeeSgk = employeeSgk;
    this._employerSgk = employerSgk;
    Object.freeze(this); // Immutability garanti altına alındı
  }

  get grossSalary(): string {
    return this._grossSalary.toFixed(2);
  }
  get netPayable(): string {
    return this._netPayable.toFixed(2);
  }
  get taxWithholding(): string {
    return this._taxWithholding.toFixed(2);
  }
  get employeeSgk(): string {
    return this._employeeSgk.toFixed(2);
  }
  get employerSgk(): string {
    return this._employerSgk.toFixed(2);
  }

  public static create(props: PayrollBreakdownProps) {
    // 1. Tüm girdileri tek seferde Decimal'e çevirip normalize ediyoruz
    const grossSalary = new Decimal(props.grossSalary);
    const netPayable = new Decimal(props.netPayable);
    const taxWithholding = new Decimal(props.taxWithholding);
    const employeeSgk = new Decimal(props.employeeSgk);
    const employerSgk = new Decimal(props.employerSgk);

    // Domain Kuralı: Brüt = net + GV stopajı + işçi SGK
    const decomposed = netPayable.plus(taxWithholding).plus(employeeSgk);

    let error: UnbalancedPayrollBreakdownException | undefined;
    let instance: PayrollBreakdown | undefined;

    if (!grossSalary.equals(decomposed)) {
      // Tipli domain hatası: çıplak `Error` 500'e dönüşüyor ve frontend hangi
      // iki tutarın uyuşmadığını göremiyordu.
      error = new UnbalancedPayrollBreakdownException({
        grossSalary: grossSalary.toFixed(2),
        decomposed: decomposed.toFixed(2),
      });
    } else {
      // Başarılıysa instance SADECE BİR KERE burada oluşturulur
      instance = new PayrollBreakdown(
        grossSalary,
        netPayable,
        taxWithholding,
        employeeSgk,
        employerSgk
      );
    }

    return {
      instance,
      orThrow: (): PayrollBreakdown => {
        if (error) throw error;
        if (!instance) {
          throw new UnbalancedPayrollBreakdownException({
            grossSalary: grossSalary.toFixed(2),
            decomposed: decomposed.toFixed(2),
          });
        }
        return instance; // Aynı instance güvenle dönülür
      },
    };
  }

  public toPlain() {
    return {
      grossSalary: this.grossSalary,
      netPayable: this.netPayable,
      taxWithholding: this.taxWithholding,
      employeeSgk: this.employeeSgk,
      employerSgk: this.employerSgk,
    };
  }
}
