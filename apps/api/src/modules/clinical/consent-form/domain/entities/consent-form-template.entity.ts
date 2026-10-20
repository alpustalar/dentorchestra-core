import { ConsentFormTemplate as IConsentFormTemplate } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  CreateConsentTemplateProps,
  UpdateConsentTemplateProps,
} from '@modules/clinical/consent-form/domain/contracts';
import { ConsentTemplateAlreadyArchivedException } from '@modules/clinical/consent-form/domain/exceptions/consent-form.exceptions';
import { isDefined } from '@common/utils';
import { isNotUndefined } from '@common/utils/is-not-undefined';

/**
 * Klinik-bazlı onam formu şablonu. İçerik (title/content) değişince version artar;
 * geçmiş metin burada saklanmaz — imzalanmış her Submission kendi snapshot'ını taşır.
 */
export class ConsentFormTemplate extends AggregateRoot {
  constructor(data: IConsentFormTemplate) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._sectorId = data.sectorId ? UUID.fromTrusted(data.sectorId) : null;
    this._title = data.title;
    this._content = data.content;
    this._version = data.version;
    this._isActive = data.isActive;
    this._createdByUserId = data.createdByUserId;
    this._updatedByUserId = data.updatedByUserId;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
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

  private _sectorId: UUID | null;
  get sectorId(): UUID | null {
    return this._sectorId;
  }

  private _title: string;
  get title(): string {
    return this._title;
  }

  private _content: string;
  get content(): string {
    return this._content;
  }

  private _version: number;
  get version(): number {
    return this._version;
  }

  private _isActive: boolean;
  get isActive(): boolean {
    return this._isActive;
  }

  private _createdByUserId: string;
  get createdByUserId(): string {
    return this._createdByUserId;
  }

  private _updatedByUserId: string | null;
  get updatedByUserId(): string | null {
    return this._updatedByUserId;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  public static create(props: CreateConsentTemplateProps): ConsentFormTemplate {
    const now = DateTimeManager.create();
    return new ConsentFormTemplate({
      id: UUID.createOrGenerate(props.id).value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      sectorId: props.sectorId
        ? UUID.create(props.sectorId).orThrow().value
        : null,
      title: props.title,
      content: props.content,
      version: 1,
      isActive: true,
      createdByUserId: props.createdByUserId,
      updatedByUserId: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public isArchived(): boolean {
    return !this._isActive;
  }

  /** Sadece title/content değişirse version artar; sectorId gibi metadata değişikliği artırmaz. */
  public update(props: UpdateConsentTemplateProps): void {
    const contentChanged =
      (isDefined(props.title) && props.title !== this._title) ||
      (isDefined(props.content) && props.content !== this._content);

    if (isDefined(props.title)) this._title = props.title;
    if (isDefined(props.content)) this._content = props.content;
    if (isNotUndefined(props.sectorId)) {
      this._sectorId = props.sectorId
        ? UUID.create(props.sectorId).orThrow()
        : null;
    }

    if (contentChanged) this._version += 1;

    this._updatedByUserId = props.updatedByUserId;
    this._updatedAt = DateTimeManager.create();
  }

  public archive(): void {
    if (this.isArchived()) {
      throw new ConsentTemplateAlreadyArchivedException(this.id.value);
    }
    this._isActive = false;
    this._updatedAt = DateTimeManager.create();
  }

  public toPersistence(): IConsentFormTemplate {
    return {
      id: this.id.value,
      organizationId: this.organizationId.value,
      clinicId: this.clinicId.value,
      sectorId: this.sectorId?.value ?? null,
      title: this.title,
      content: this.content,
      version: this.version,
      isActive: this.isActive,
      createdByUserId: this.createdByUserId,
      updatedByUserId: this.updatedByUserId,
      createdAt: this.createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }
}
