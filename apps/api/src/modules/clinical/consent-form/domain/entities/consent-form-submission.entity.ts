import { ConsentFormSubmission as IConsentFormSubmission } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { SignConsentFormProps } from '@modules/clinical/consent-form/domain/contracts';

/**
 * Hastanın tablette imzaladığı onam formu kaydı. Şablon sonradan değişse bile
 * imzalanan METİN (templateTitleSnapshot/templateContentSnapshot) burada donmuş kalır.
 * Immutable — mutasyon metodu yok, hatalı imza yeni bir submission ile düzeltilir.
 */
export class ConsentFormSubmission extends AggregateRoot {
  constructor(data: IConsentFormSubmission) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._patientId = UUID.fromTrusted(data.patientId);
    this._templateId = UUID.fromTrusted(data.templateId);
    this._templateVersion = data.templateVersion;
    this._templateTitleSnapshot = data.templateTitleSnapshot;
    this._templateContentSnapshot = data.templateContentSnapshot;
    this._signatureImage = data.signatureImage;
    this._signedAt = data.signedAt;
    this._signedByUserId = data.signedByUserId;
    this._appointmentId = UUID.create(data.appointmentId).instance ?? null;
    this._treatmentId = UUID.create(data.treatmentId)?.instance ?? null;
    this._createdAt = data.createdAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _patientId: UUID;
  get patientId(): UUID {
    return this._patientId;
  }

  private _templateId: UUID;
  get templateId(): UUID {
    return this._templateId;
  }

  private _templateVersion: number;
  get templateVersion(): number {
    return this._templateVersion;
  }

  private _templateTitleSnapshot: string;
  get templateTitleSnapshot(): string {
    return this._templateTitleSnapshot;
  }

  private _templateContentSnapshot: string;
  get templateContentSnapshot(): string {
    return this._templateContentSnapshot;
  }

  private _signatureImage: string;
  get signatureImage(): string {
    return this._signatureImage;
  }

  private _signedAt: Date;
  get signedAt(): Date {
    return this._signedAt;
  }

  private _signedByUserId: string;
  get signedByUserId(): string {
    return this._signedByUserId;
  }

  private _appointmentId: UUID | null;
  get appointmentId(): UUID | null {
    return this._appointmentId;
  }

  private _treatmentId: UUID | null;
  get treatmentId(): UUID | null {
    return this._treatmentId;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  public static sign(props: SignConsentFormProps): ConsentFormSubmission {
    const now = DateTimeManager.create();
    return new ConsentFormSubmission({
      id: UUID.createOrGenerate(props.id).value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      patientId: UUID.create(props.patientId).orThrow().value,
      templateId: UUID.create(props.templateId).orThrow().value,
      templateVersion: props.templateVersion,
      templateTitleSnapshot: props.templateTitleSnapshot,
      templateContentSnapshot: props.templateContentSnapshot,
      signatureImage: props.signatureImage,
      signedAt: now,
      signedByUserId: props.signedByUserId,
      appointmentId: props.appointmentId ?? null,
      treatmentId: props.treatmentId ?? null,
      createdAt: now,
    });
  }

  public toPersistence(): IConsentFormSubmission {
    return {
      id: this.id.value,
      organizationId: this.organizationId.value,
      clinicId: this.clinicId.value,
      patientId: this.patientId.value,
      templateId: this.templateId.value,
      templateVersion: this.templateVersion,
      templateTitleSnapshot: this.templateTitleSnapshot,
      templateContentSnapshot: this.templateContentSnapshot,
      signatureImage: this.signatureImage,
      signedAt: this.signedAt,
      signedByUserId: this.signedByUserId,
      appointmentId: this.appointmentId?.value ?? null,
      treatmentId: this.treatmentId?.value ?? null,
      createdAt: this.createdAt,
    };
  }
}
