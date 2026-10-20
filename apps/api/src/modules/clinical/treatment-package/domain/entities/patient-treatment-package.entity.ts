import {
  Patient,
  PatientPackageStatus,
  PatientPackageStatusSchema,
  PatientTreatmentPackage as IPatientTreatmentPackage,
  Payment,
  Provider,
  TreatmentPackage,
} from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import {
  CreatePatientTreatmentPackageProps,
  UpdatePatientTreatmentPackageProps,
} from '@modules/clinical/treatment-package/domain/contracts';
import { DateRange } from '@src/domain/value-objects/date-range.vo';
import { InvalidTreatmentPackageResumeException } from '@modules/clinical/treatment-package/domain/exceptions/patient-treatment-package.exceptions';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { isNotUndefined } from '@common/utils/is-not-undefined';
import { Guard } from '@common/domain/guards';
import { PatientTreatmentPackageRules } from '@modules/clinical/treatment-package/domain/rules/patient-treatment-package.rules';
import { ValidateOptionsType } from '@shared/common/validate-options/validate-options.type';

export class PatientTreatmentPackage extends AggregateRoot {
  constructor(data: IPatientTreatmentPackage) {
    super();

    this._id = UUID.fromTrusted(data.id);
    this._patientId = UUID.fromTrusted(data.patientId);
    this._packageId = UUID.fromTrusted(data.packageId);
    this._providerId = UUID.fromTrusted(data.providerId);
    this._paymentId = data.paymentId ?? null;

    this._dateRange = DateRange.fromTrusted(data.startDate, data.endDate);

    this._notes = data.notes ?? null;
    this._status = data.status;
    this._usedExaminationCount = data.usedExaminationCount;
    this._usedControlCount = data.usedControlCount;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _patientId: UUID;
  get patientId(): UUID {
    return this._patientId;
  }

  private _packageId: UUID;
  get packageId(): UUID {
    return this._packageId;
  }

  private _providerId: UUID;
  get providerId(): UUID {
    return this._providerId;
  }

  private _paymentId: string | null;
  get paymentId(): string | null {
    return this._paymentId;
  }

  private _notes: string | null;
  get notes(): string | null {
    return this._notes;
  }

  private _status: PatientPackageStatus;
  get status(): PatientPackageStatus {
    return this._status;
  }

  private _usedExaminationCount: number;
  get usedExaminationCount(): number {
    return this._usedExaminationCount;
  }

  private _usedControlCount: number;
  get usedControlCount(): number {
    return this._usedControlCount;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  private _patient: Patient | null;
  get patient(): Patient | null {
    return this._patient;
  }

  private _dateRange: DateRange;
  get dateRange(): DateRange {
    return this._dateRange;
  }

  private _package: TreatmentPackage | null;
  get package(): TreatmentPackage | null {
    return this._package;
  }

  private _provider: Provider | null;
  get provider(): Provider | null {
    return this._provider;
  }

  private _payment: Payment | null;
  get payment(): Payment | null {
    return this._payment;
  }

  public get validate() {
    return {
      status: {
        isActive: this.isActive,
        isCompleted: this.isCompleted,
        isCancelled: this.isCancelled,
        isSuspended: this.isSuspended,
        isExpired: this.isExpired,
      },
    };
  }

  private get isExpired() {
    return this._dateRange.validate.expiration(
      () => new Error('Paketin süresi dolmuş.')
    );
  }

  private get isCompleted() {
    const isComplete =
      this._status === PatientPackageStatusSchema.enum.COMPLETED;
    return Guard.monitor(
      isComplete,
      isComplete,
      () => new Error('Paket kapalı değil')
    );
  }

  private get isCancelled() {
    const isCancel = this._status === PatientPackageStatusSchema.enum.CANCELLED;
    return Guard.monitor(
      isCancel,
      isCancel,
      () => new Error('Paket iptal edilmemiş')
    );
  }

  private get isActive() {
    const isActive = this._status === PatientPackageStatusSchema.enum.ACTIVE;
    return Guard.monitor(
      isActive,
      isActive,
      () => new Error('Paket aktif değil')
    );
  }

  private get isSuspended() {
    const isSuspend =
      this._status === PatientPackageStatusSchema.enum.SUSPENDED;
    return Guard.monitor(
      isSuspend,
      isSuspend,
      () => new Error('Paket askıya alınmamış')
    );
  }

  static create(
    props: CreatePatientTreatmentPackageProps
  ): PatientTreatmentPackage {
    const now = DateTimeManager.create();

    const dateRange = DateRange.create(
      props.startDate,
      props.endDate
    ).orThrow();

    return new PatientTreatmentPackage({
      id: UUID.createOrGenerate(props.id).value,
      patientId: UUID.create(props.patientId).orThrow().value,
      packageId: UUID.create(props.packageId).orThrow().value,
      providerId: UUID.create(props.providerId).orThrow().value,
      paymentId: props.paymentId ?? null,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      notes: props.notes ?? null,
      status: PatientPackageStatusSchema.enum.ACTIVE,
      usedExaminationCount: 0,
      usedControlCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  public rules(validateOptions: ValidateOptionsType) {
    return new PatientTreatmentPackageRules(this, validateOptions);
  }

  update(props: UpdatePatientTreatmentPackageProps): void {
    if (isNotUndefined(props.providerId)) {
      this._providerId = UUID.create(props.providerId).orThrow();
    }

    if (isNotUndefined(props.notes)) {
      this._notes = props.notes;
    }

    if (isNotUndefined(props.startDate) || isNotUndefined(props.endDate)) {
      const finalStartDate = props.startDate ?? this._dateRange.startDate;
      const finalEndDate = props.endDate ?? this._dateRange.endDate;

      this._dateRange = DateRange.create(
        finalStartDate,
        finalEndDate
      ).orThrow();
    }

    this._updatedAt = DateTimeManager.create();
  }

  complete(): void {
    this._status = PatientPackageStatusSchema.enum.COMPLETED;
  }

  cancel(): void {
    this._status = PatientPackageStatusSchema.enum.CANCELLED;
  }

  reactivate(): void {
    this._status = PatientPackageStatusSchema.enum.ACTIVE;
    this._updatedAt = DateTimeManager.create();
  }

  suspend(): void {
    this._status = PatientPackageStatusSchema.enum.SUSPENDED;
  }

  resume(): void {
    if (!this.isSuspended.value) {
      throw new InvalidTreatmentPackageResumeException(
        this.status,
        this.id.value
      );
    }
    this._status = PatientPackageStatusSchema.enum.ACTIVE;
  }

  incrementUsedExaminationCount(): void {
    this._usedExaminationCount += 1;
  }

  incrementUsedControlCount(): void {
    this._usedControlCount += 1;
  }

  toPersistence(): IPatientTreatmentPackage {
    return {
      id: this.id.value,
      patientId: this.patientId.value,
      packageId: this.packageId.value,
      providerId: this.providerId.value,
      paymentId: this.paymentId,
      startDate: this.dateRange.startDate,
      endDate: this.dateRange.endDate,
      notes: this.notes,
      status: this.status,
      usedExaminationCount: this.usedExaminationCount,
      usedControlCount: this.usedControlCount,
      createdAt: this.createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }
}
