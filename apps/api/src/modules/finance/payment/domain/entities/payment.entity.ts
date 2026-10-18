import { Payment as IPayment } from '@shared/generated-zod';
import { PaymentInstallment } from '@shared/generated-zod/modelSchema/PaymentInstallmentSchema';
import PaymentStatusSchema, {
  PaymentStatusType as PaymentStatus,
} from '@input-type-schemas/PaymentStatusSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import PaymentMethodSchema from '@input-type-schemas/PaymentMethodSchema';
import InstallmentStatusSchema from '@input-type-schemas/InstallmentStatusSchema';
import { Money } from '@src/domain/value-objects/money.vo';
import {
  InstallmentNotCancellableException,
  InstallmentNotCollectibleException,
  InstallmentNotFailableException,
  InstallmentNotFoundException,
  InstallmentNotRefundableException,
  InstallmentTotalMismatchException,
  InvalidInstallmentPlanException,
  PaymentInvalidPrecisionException,
} from '@modules/finance/payment/domain/exceptions/payment.exceptions';
import {
  CompleteInstallmentProps,
  CreatePaymentProps,
  FailInstallmentProps,
  RefundInstallmentProps,
} from '@modules/finance/payment/domain/contracts/payment';
import { PaymentRefundedEvent } from '@modules/finance/payment/domain/events/payment-refunded.event';
import { PaymentPaidEvent } from '@modules/finance/payment/domain/events/payment-paid.event';
import { PaymentFailedEvent } from '@modules/finance/payment/domain/events/payment-failed.event';
import { LogAction, LogType } from '@src/domain/constants/log-action.constant';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Guard } from '@common/domain/guards';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { PaymentRules } from '@modules/finance/payment/domain/rules/payment.rules';
import { ValidateOptionsType } from '@shared/common/validate-options/validate-options.type';

export type PaymentWithInstallmentsData = IPayment & {
  installments: PaymentInstallment[];
};

export class Payment extends AggregateRoot {
  constructor(data: PaymentWithInstallmentsData) {
    super();
    this._id = UUID.create(data.id).orThrow();
    this._clinicId = UUID.create(data.clinicId).orThrow();
    this._patientId = UUID.create(data.patientId).orThrow();
    this._appointmentId = UUID.create(data.appointmentId).instance ?? null;
    this._providerId = UUID.create(data.providerId).instance ?? null;
    this._totalAmount = Money.create(data.totalAmount, data.currency).orThrow();
    this._status = data.status;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
    this._installments = [...data.installments];
  }

  private _id: UUID;

  get id(): UUID {
    return this._id;
  }

  private _clinicId: UUID;

  get clinicId(): UUID {
    return this._clinicId;
  }

  private _patientId: UUID;

  get patientId(): UUID {
    return this._patientId;
  }

  private _appointmentId: UUID | null;

  get appointmentId(): UUID | null {
    return this._appointmentId;
  }

  private _providerId: UUID | null;

  get providerId(): UUID | null {
    return this._providerId;
  }

  private _totalAmount: Money;

  get totalAmount(): Money {
    return this._totalAmount;
  }

  private _status: PaymentStatus;

  get status(): PaymentStatus {
    return this._status;
  }

  private _createdAt: Date;

  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;

  get updatedAt(): Date {
    return this._updatedAt;
  }

  private _installments: PaymentInstallment[];

  get installments(): readonly PaymentInstallment[] {
    return this._installments;
  }

  private _dirtyInstallmentIds: Set<string> = new Set();

  get dirtyInstallmentIds(): ReadonlySet<string> {
    return this._dirtyInstallmentIds;
  }

  /**
   * Durum yüklemleri **düz boolean** döner.
   *
   * Önceden `Guard<boolean>` dönüyorlardı; `PaymentRules` içinde `!guard`
   * yazıldığı için koşul **her zaman** false'a düşüyor, iade/iptal kuralı
   * sessizce "asla geçerli değil" oluyordu (tipler uyduğu için derleyici
   * görmüyordu). Boolean dönmek bu hata sınıfını kapatır.
   */
  public get validate() {
    return {
      andFind: {
        installmentWithAnId: (installmentId: string) =>
          this.validateAndFindInstallment(installmentId),
      },
      status: {
        isRefunded: this._status === PaymentStatusSchema.enum.REFUNDED,
        isCompleted: this._status === PaymentStatusSchema.enum.COMPLETED,
        isCancelled: this._status === PaymentStatusSchema.enum.CANCELLED,
        isPending: this._status === PaymentStatusSchema.enum.PENDING,
        isPartial: this._status === PaymentStatusSchema.enum.PARTIAL,
      },
    };
  }

  static create(props: CreatePaymentProps): Payment {
    const now = DateTimeManager.create();

    if (!props.installments || props.installments.length === 0) {
      throw new InvalidInstallmentPlanException();
    }

    // Kuruştan ince tutar DB'de (`Decimal(10,2)`) sessizce yuvarlanır ve
    // "taksitler toplamı = ana tutar" invariant'ı diskte bozulur.
    Payment.assertKurusPrecision(props.totalAmount);
    props.installments.forEach((inst) =>
      Payment.assertKurusPrecision(inst.money)
    );

    const totalInstallmentMoney = props.installments
      .map((inst) => inst.money)
      .reduce((total, current) => total.add(current));

    if (!props.totalAmount.equals(totalInstallmentMoney)) {
      throw new InstallmentTotalMismatchException(
        'Finansal Tutarsızlık: Taksitlerin toplamı ana ödeme tutarı ile eşleşmiyor!',
        {
          propsCurrency: props.totalAmount.currency,
          propsTotalAmount: props.totalAmount.toApiFormat(),
          totalInstallmentAmount: totalInstallmentMoney.toApiFormat(),
          totalInstallmentCurrency: totalInstallmentMoney.currency,
        }
      );
    }

    const paymentId = UUID.createOrGenerate(props.id).value;

    return new Payment({
      id: paymentId,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      patientId: UUID.create(props.patientId).orThrow().value,
      // `props.clinicId` yazılıyordu: randevu kimliği kliniğin kimliğiyle
      // doldurulduğu için kayıt yanlış randevuya bağlanıyor, `appointment_id`
      // tekil + FK olduğu için ilk kayıttan sonrası hiç yazılamıyordu.
      appointmentId: UUID.create(props.appointmentId).instance?.value ?? null,
      providerId: UUID.create(props.providerId).instance?.value ?? null,
      totalAmount: props.totalAmount.value,
      currency: props.totalAmount.currency,
      status: PaymentStatusSchema.enum.PENDING,
      createdAt: now,
      updatedAt: now,
      installments: props.installments.map((inst) => {
        return {
          id: inst.id,
          paymentId,
          installmentNo: inst.installmentNo,
          amount: inst.money.value,
          currency: inst.money.currency,
          method: inst.method ?? PaymentMethodSchema.enum.CREDIT_CARD,
          status: InstallmentStatusSchema.enum.PENDING,
          dueDate: inst.dueDate ?? null,
          paidAt: null,
          note: inst.note ?? null,
          createdAt: now,
          updatedAt: now,
        };
      }),
    });
  }

  public rules(validateOptions: ValidateOptionsType) {
    return new PaymentRules(this, validateOptions);
  }

  /**
   * Taksiti tahsil edilmiş olarak işaretler ve **yalnız gerçek geçişte**
   * `PaymentPaidEvent` fırlatır.
   *
   * Event'i önceden handler koşulsuz yayınlıyordu: aynı POS callback'i iki kez
   * geldiğinde taksit zaten COMPLETED olduğu için durum değişmiyor ama event
   * tekrar çıkıyor, cari kayıt kuyruğuna ikinci iş + ikinci faturalama denemesi
   * düşüyordu. Olayın tek kaynağı artık bu metot.
   */
  completeInstallment(props: CompleteInstallmentProps): void {
    const installment = this.getInstallmentOrThrow(props.installmentId);

    // Tekrarlanan tahsilat bildirimi: sessiz ve event'siz no-op (idempotent).
    if (installment.status === InstallmentStatusSchema.enum.COMPLETED) return;

    if (
      installment.status === InstallmentStatusSchema.enum.CANCELLED ||
      installment.status === InstallmentStatusSchema.enum.REFUNDED
    ) {
      throw new InstallmentNotCollectibleException({
        installmentId: props.installmentId,
        status: installment.status,
      });
    }

    this.mutateInstallment(props.installmentId, {
      status: InstallmentStatusSchema.enum.COMPLETED,
      paidAt: DateTimeManager.create(),
    });
    this.recalculateStatusAfterInstallmentChange();

    this.addDomainEvent(
      new PaymentPaidEvent({
        installmentId: props.installmentId,
        paymentId: this._id.value,
        appointmentId: this._appointmentId?.value ?? null,
        clinicId: this._clinicId.value,
        actorId: props.actorId,
        source: props.logSource,
        action: LogAction.PAYMENT_SUCCESS,
        type: LogType.INFO,
        details: props.details ?? 'Ödeme tahsil edildi',
      })
    );
  }

  /** Taksiti iptal eder (tahsil edilmemiş taksit için; tahsil edilmişte iade yolu). */
  cancelInstallment(installmentId: string): void {
    const installment = this.getInstallmentOrThrow(installmentId);

    if (installment.status === InstallmentStatusSchema.enum.CANCELLED) return;

    if (
      installment.status === InstallmentStatusSchema.enum.COMPLETED ||
      installment.status === InstallmentStatusSchema.enum.REFUNDED
    ) {
      throw new InstallmentNotCancellableException({
        installmentId,
        status: installment.status,
      });
    }

    this.mutateInstallment(installmentId, {
      status: InstallmentStatusSchema.enum.CANCELLED,
    });
    this.recalculateStatusAfterInstallmentChange();
  }

  refundInstallment(props: RefundInstallmentProps): void {
    const installment = this.getInstallmentOrThrow(props.installmentId);

    // Tekrarlanan iade bildirimi (webhook/retry): para çoktan geri gitti,
    // ikinci kez ters kayıt atılmaması için event'siz no-op.
    if (installment.status === InstallmentStatusSchema.enum.REFUNDED) return;

    // Tahsil edilmemiş taksit iade EDİLEMEZ: alınmamış parayı geri vermek
    // defterde karşılığı olmayan bir ters kayıt üretir. Bu bir invariant'tır,
    // politika değil — `systemOverride` ile atlanamaz.
    if (installment.status !== InstallmentStatusSchema.enum.COMPLETED) {
      throw new InstallmentNotRefundableException({
        installmentId: props.installmentId,
        status: installment.status,
      });
    }

    this.mutateInstallment(props.installmentId, {
      status: InstallmentStatusSchema.enum.REFUNDED,
    });

    // Ödeme durumu TÜM taksitlerden türetilir — kardeş geçişlerle aynı mantık.
    // Önceden tek taksitin iadesi ödemenin tamamını REFUNDED yapıyordu:
    // 3 taksitli planda 1 taksit iade edilince diğer ikisi hâlâ tahsil edilmiş
    // olduğu halde ödeme "tamamen iade" görünüyor, buna bağlı cari/rapor
    // sorguları geliri sıfırlıyordu.
    this.recalculateStatusAfterInstallmentChange();

    // Event burada raise edilir; muhasebe ters kaydını (RefundLedgerEntries)
    // tetikleyen tek kaynak budur. Handler'ların ayrıca publish etmesi ters
    // kaydın iki kez çalışmasına yol açıyordu.
    this.addDomainEvent(
      new PaymentRefundedEvent({
        installmentId: props.installmentId,
        paymentId: this._id.value,
        appointmentId: this._appointmentId?.value ?? null,
        clinicId: this._clinicId.value,
        actorId: props.actorId,
        source: props.logSource,
        action: LogAction.PAYMENT_REFUNDED,
        type: LogType.INFO,
        details: props.details ?? 'Ödeme iade edildi',
      })
    );
  }

  /**
   * Tahsilat denemesi başarısız: taksit yeniden denenebilir olsun diye PENDING'e
   * döner ve `paidAt` **temizlenir**.
   *
   * Tahsil edilmiş taksit bu yoldan geçemez: durum PENDING'e çekilirken
   * tahsilatın cari/defter kaydı yerinde kalacağı için rapor ile defter kalıcı
   * olarak çelişirdi (taksit "açık alacak", defterde tahsilat var).
   */
  failInstallment(props: FailInstallmentProps): void {
    const installment = this.getInstallmentOrThrow(props.installmentId);

    if (
      installment.status === InstallmentStatusSchema.enum.COMPLETED ||
      installment.status === InstallmentStatusSchema.enum.REFUNDED
    ) {
      throw new InstallmentNotFailableException({
        installmentId: props.installmentId,
        status: installment.status,
      });
    }

    this.mutateInstallment(props.installmentId, {
      status: InstallmentStatusSchema.enum.PENDING,
      paidAt: null,
    });
    this.recalculateStatusAfterInstallmentChange();

    this.addDomainEvent(
      new PaymentFailedEvent({
        installmentId: props.installmentId,
        paymentId: this._id.value,
        appointmentId: this._appointmentId?.value ?? null,
        clinicId: this._clinicId.value,
        actorId: props.actorId,
        source: props.logSource,
        action: LogAction.PAYMENT_FAILED,
        type: LogType.ERROR,
        details: props.details ?? 'Ödeme başarısız',
      })
    );
  }

  toPersistence(): IPayment {
    return {
      id: this._id.value,
      clinicId: this._clinicId.value,
      patientId: this._patientId.value,
      appointmentId: this._appointmentId?.value ?? null,
      providerId: this._providerId?.value ?? null,

      totalAmount: this._totalAmount.value,
      currency: this._totalAmount.currency,

      status: this._status,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  private mutateInstallment(
    installmentId: string,
    patch: Partial<PaymentInstallment>
  ): void {
    const now = DateTimeManager.create();
    this._installments = this._installments.map((i) =>
      i.id === installmentId ? { ...i, ...patch, updatedAt: now } : i
    );
    this._dirtyInstallmentIds.add(installmentId);
    this._updatedAt = now; // Ana aggregate'in de güncellenme tarihini tetikle
  }

  /**
   * Ödeme durumunu taksitlerin tamamından türetir — **tek kaynak**. Her geçiş
   * (tahsil/iptal/iade/başarısız) bu metodu çağırır; metod başına kopyalanmış
   * sayaç mantıkları birbirinden sapıyordu (ör. iade ödemeyi koşulsuz REFUNDED
   * yapıyordu).
   *
   * İptal edilmiş taksitler karar dışıdır: iptal, planın o satırının hiç
   * olmadığı anlamına gelir.
   */
  private recalculateStatusAfterInstallmentChange(): void {
    const active = this._installments.filter(
      (i) => i.status !== InstallmentStatusSchema.enum.CANCELLED
    );

    if (active.length === 0) {
      this._status = PaymentStatusSchema.enum.CANCELLED;
      return;
    }

    const isRefunded = (i: PaymentInstallment) =>
      i.status === InstallmentStatusSchema.enum.REFUNDED;
    const isCompleted = (i: PaymentInstallment) =>
      i.status === InstallmentStatusSchema.enum.COMPLETED;

    if (active.every(isRefunded)) {
      this._status = PaymentStatusSchema.enum.REFUNDED;
      return;
    }
    if (active.every(isCompleted)) {
      this._status = PaymentStatusSchema.enum.COMPLETED;
      return;
    }
    this._status = active.some((i) => isCompleted(i) || isRefunded(i))
      ? PaymentStatusSchema.enum.PARTIAL
      : PaymentStatusSchema.enum.PENDING;
  }

  /** Taksit yoksa tipli domain hatası — ham `Error` 500'e dönüşüyordu. */
  private getInstallmentOrThrow(installmentId: string): PaymentInstallment {
    return this.validateAndFindInstallment(installmentId).orThrow();
  }

  private static assertKurusPrecision(money: Money): void {
    if (money.value.decimalPlaces() > Money.PRECISION) {
      throw new PaymentInvalidPrecisionException(money.value.toString());
    }
  }

  private validateAndFindInstallment(
    installmentId: string
  ): Guard<PaymentInstallment | undefined> {
    const installment = this._installments.find((i) => i.id === installmentId);

    return Guard.monitor(
      installment,
      !!installment,
      () => new InstallmentNotFoundException(installmentId)
    );
  }
}
