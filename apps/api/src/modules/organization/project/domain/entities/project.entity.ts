import { Decimal } from 'decimal.js';
import { Project as IProject } from '@model-schema/ProjectSchema';
import {
  ProjectStatusSchema,
  ProjectStatusType as ProjectStatus,
} from '@input-type-schemas/ProjectStatusSchema';
import {
  CurrencySchema,
  CurrencyType as Currency,
} from '@input-type-schemas/CurrencySchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { isNotUndefined } from '@common/utils/is-not-undefined';
import {
  CreateProjectProps,
  UpdateProjectDetailsProps,
} from '@modules/organization/project/domain/contracts';
import { ProjectInvalidStateException } from '@modules/organization/project/domain/exceptions/project.exceptions';

/** Terminal durumlar — buradan çıkış yoktur. */
const TERMINAL_STATUSES: ProjectStatus[] = [
  ProjectStatusSchema.enum.COMPLETED,
  ProjectStatusSchema.enum.CANCELLED,
];

/**
 * İzin verilen durum geçişleri. Tablo tek kaynaktır; her geçiş metodu buradan
 * doğrular, böylece "hangi durumdan nereye gidilir" tek yerde okunur.
 */
const ALLOWED_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  PLANNING: [
    ProjectStatusSchema.enum.ACTIVE,
    ProjectStatusSchema.enum.CANCELLED,
  ],
  ACTIVE: [
    ProjectStatusSchema.enum.ON_HOLD,
    ProjectStatusSchema.enum.COMPLETED,
    ProjectStatusSchema.enum.CANCELLED,
  ],
  ON_HOLD: [
    ProjectStatusSchema.enum.ACTIVE,
    ProjectStatusSchema.enum.CANCELLED,
  ],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * Proje (aggregate root) — klinik içi iş/yatırım projesi.
 * Durum akışı: PLANNING → ACTIVE ⇄ ON_HOLD → COMPLETED; iptal terminal olmayan
 * her durumdan mümkündür.
 *
 * Aşama/görev/maliyet/tahsis ayrı aggregate'lerdir (proje ömrü boyunca yüzlerce
 * satır olabilir; tek aggregate'e toplamak yükleme maliyetini kabul edilemez yapar).
 * Bu entity yalnız projenin kendi künyesini ve durum makinesini taşır.
 */
export class Project extends AggregateRoot {
  constructor(data: IProject) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._code = data.code;
    this._name = data.name;
    this._description = data.description;
    this._status = data.status;
    this._ownerId = UUID.fromTrusted(data.ownerId);
    this._startDate = data.startDate;
    this._dueDate = data.dueDate;
    this._budget = data.budget ? new Decimal(data.budget.toString()) : null;
    this._currency = data.currency;
    this._completedAt = data.completedAt;
    this._cancelledAt = data.cancelledAt;
    this._cancelReason = data.cancelReason;
    this._createdById = data.createdById;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _code: string | null;
  get code(): string | null {
    return this._code;
  }

  private _name: string;
  get name(): string {
    return this._name;
  }

  private _description: string | null;
  get description(): string | null {
    return this._description;
  }

  private _status: ProjectStatus;
  get status(): ProjectStatus {
    return this._status;
  }

  private _ownerId: UUID;
  get ownerId(): UUID {
    return this._ownerId;
  }

  private _startDate: Date | null;
  get startDate(): Date | null {
    return this._startDate;
  }

  private _dueDate: Date | null;
  get dueDate(): Date | null {
    return this._dueDate;
  }

  private _budget: Decimal | null;
  get budget(): Decimal | null {
    return this._budget;
  }

  private _currency: Currency;
  get currency(): Currency {
    return this._currency;
  }

  private _completedAt: Date | null;
  get completedAt(): Date | null {
    return this._completedAt;
  }

  private _cancelledAt: Date | null;
  get cancelledAt(): Date | null {
    return this._cancelledAt;
  }

  private _cancelReason: string | null;
  get cancelReason(): string | null {
    return this._cancelReason;
  }

  private _createdById: string;
  get createdById(): string {
    return this._createdById;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Terminal projeye görev/maliyet/tahsis eklenemez. */
  get isTerminal(): boolean {
    return TERMINAL_STATUSES.includes(this._status);
  }

  public static create(props: CreateProjectProps): Project {
    const now = DateTimeManager.create();

    return new Project({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      code: props.code ?? null,
      name: props.name,
      description: props.description ?? null,
      status: ProjectStatusSchema.enum.PLANNING,
      ownerId: UUID.create(props.ownerId).orThrow().value,
      startDate: props.startDate ?? null,
      dueDate: props.dueDate ?? null,
      budget: props.budget ?? null,
      currency: props.currency ?? CurrencySchema.enum.TRY,
      completedAt: null,
      cancelledAt: null,
      cancelReason: null,
      createdById: props.createdById,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Künye güncelleme. Durum ve tarihçe alanlarına DOKUNMAZ — onlar yalnız
   * geçiş metotlarıyla değişir. undefined alan atlanır; null nullable alanı temizler.
   */
  public updateDetails(props: UpdateProjectDetailsProps): void {
    this.assertNotTerminal('güncelleme');

    if (isNotUndefined(props.code)) this._code = props.code;
    if (isNotUndefined(props.name)) this._name = props.name;
    if (isNotUndefined(props.description))
      this._description = props.description;
    if (isNotUndefined(props.ownerId)) {
      this._ownerId = UUID.create(props.ownerId).orThrow();
    }
    if (isNotUndefined(props.startDate)) this._startDate = props.startDate;
    if (isNotUndefined(props.dueDate)) this._dueDate = props.dueDate;
    if (isNotUndefined(props.budget)) this._budget = props.budget;

    this._updatedAt = DateTimeManager.create();
  }

  public activate(): void {
    this.transitionTo(ProjectStatusSchema.enum.ACTIVE);
  }

  public putOnHold(): void {
    this.transitionTo(ProjectStatusSchema.enum.ON_HOLD);
  }

  public complete(): void {
    this.transitionTo(ProjectStatusSchema.enum.COMPLETED);
    this._completedAt = DateTimeManager.create();
  }

  public cancel(reason: string): void {
    this.transitionTo(ProjectStatusSchema.enum.CANCELLED);
    this._cancelledAt = DateTimeManager.create();
    this._cancelReason = reason;
  }

  /** Durum geçişini hedefe göre doğru metoda yönlendirir (tek uçlu API). */
  public changeStatus(target: ProjectStatus, reason?: string | null): void {
    switch (target) {
      case ProjectStatusSchema.enum.ACTIVE:
        return this.activate();
      case ProjectStatusSchema.enum.ON_HOLD:
        return this.putOnHold();
      case ProjectStatusSchema.enum.COMPLETED:
        return this.complete();
      case ProjectStatusSchema.enum.CANCELLED:
        return this.cancel(reason ?? '');
      default:
        // PLANNING'e geri dönüş yok — tablo da buna izin vermez.
        throw new ProjectInvalidStateException(
          this._id.value,
          this._status,
          target
        );
    }
  }

  /** Görev/maliyet/tahsis eklemeden önce çağrılır. */
  public assertAcceptsWork(operation: string): void {
    this.assertNotTerminal(operation);
  }

  public toPersistence(): IProject {
    return {
      id: this.id.value,
      clinicId: this.clinicId.value,
      organizationId: this.organizationId.value,
      code: this.code,
      name: this.name,
      description: this.description,
      status: this.status,
      ownerId: this.ownerId.value,
      startDate: this.startDate,
      dueDate: this.dueDate,
      budget: this.budget,
      currency: this.currency,
      completedAt: this.completedAt,
      cancelledAt: this.cancelledAt,
      cancelReason: this.cancelReason,
      createdById: this.createdById,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  private transitionTo(target: ProjectStatus): void {
    if (!ALLOWED_TRANSITIONS[this._status].includes(target)) {
      throw new ProjectInvalidStateException(
        this._id.value,
        this._status,
        target
      );
    }
    this._status = target;
    this._updatedAt = DateTimeManager.create();
  }

  private assertNotTerminal(operation: string): void {
    if (this.isTerminal) {
      throw new ProjectInvalidStateException(
        this._id.value,
        this._status,
        operation
      );
    }
  }
}
