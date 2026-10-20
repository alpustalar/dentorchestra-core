import { Lead as ILead, LeadStatusSchema } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { LeadSourceType as LeadSource } from '@input-type-schemas/LeadSourceSchema';
import { LeadMediumType as LeadMedium } from '@input-type-schemas/LeadMediumSchema';
import { LeadStatusType as LeadStatus } from '@input-type-schemas/LeadStatusSchema';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Name } from '@src/domain/value-objects/name.vo';
import { Phone } from '@src/domain/value-objects/phone.vo';
import { Email } from '@src/domain/value-objects/email.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { Guard } from '@common/domain/guards';
import {
  AssignLeadStageProps,
  ConvertLeadProps,
  CreateLeadProps,
  LeadAuditProps,
  MarkLeadLostProps,
  MoveLeadToStageProps,
} from '@modules/crm/lead/domain/contracts/lead';
import { PipelineStageTypeSchema } from '@input-type-schemas/PipelineStageTypeSchema';
import {
  LeadConvertedEvent,
  LeadCreatedEvent,
  LeadLostEvent,
  LeadStatusChangedEvent,
} from '@modules/crm/lead/domain/events';
import {
  LogAction,
  LogSource,
  LogType,
} from '@src/domain/constants/log-action.constant';
import { ActorContext } from '@common/interfaces';
import { ValidateOptionsType } from '@shared/common/validate-options/validate-options.type';
import { LeadRules } from '@modules/crm/lead/domain/rules/lead.rules';

export class Lead extends AggregateRoot {
  constructor(data: ILead) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._source = data.source;
    this._status = data.status;
    this._pipelineId = data.pipelineId;
    this._stageId = data.stageId;
    this._name = data.name ? Name.fromTrusted(data.name) : null;
    this._phone = Phone.create(data.phone).instance ?? null;
    this._email = Email.create(data.email).instance ?? null;
    this._notes = data.notes;
    this._assignedToId = data.assignedToId;
    this._patientId = UUID.create(data.patientId).instance ?? null;
    this._appointmentId = UUID.create(data.appointmentId).instance ?? null;
    this._convertedAt = data.convertedAt;
    this._lostReason = data.lostReason;
    this._lostAt = data.lostAt;
    this._whatsAppConversationId = data.whatsAppConversationId;
    this._medium = data.medium;
    this._metaLeadId = data.metaLeadId;
    this._campaignId = data.campaignId;
    this._campaignName = data.campaignName;
    this._adId = data.adId;
    this._adsetId = data.adsetId;
    this._ctwaClid = data.ctwaClid;
    this._sourceUrl = data.sourceUrl;
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

  private _source: LeadSource;
  get source(): LeadSource {
    return this._source;
  }

  private _status: LeadStatus;
  get status(): LeadStatus {
    return this._status;
  }

  private _pipelineId: string | null;
  get pipelineId(): string | null {
    return this._pipelineId;
  }

  private _stageId: string | null;
  get stageId(): string | null {
    return this._stageId;
  }

  private _name: Name | null;
  get name(): Name | null {
    return this._name;
  }

  private _phone: Phone | null;
  get phone(): Phone | null {
    return this._phone;
  }

  private _email: Email | null;
  get email(): Email | null {
    return this._email;
  }

  private _notes: string | null;
  get notes(): string | null {
    return this._notes;
  }

  private _assignedToId: string | null;
  get assignedToId(): string | null {
    return this._assignedToId;
  }

  private _patientId: UUID | null;
  get patientId(): UUID | null {
    return this._patientId;
  }

  private _appointmentId: UUID | null;
  get appointmentId(): UUID | null {
    return this._appointmentId;
  }

  private _convertedAt: Date | null;
  get convertedAt(): Date | null {
    return this._convertedAt;
  }

  private _lostReason: string | null;
  get lostReason(): string | null {
    return this._lostReason;
  }

  private _lostAt: Date | null;
  get lostAt(): Date | null {
    return this._lostAt;
  }

  private _whatsAppConversationId: string | null;
  get whatsAppConversationId(): string | null {
    return this._whatsAppConversationId;
  }

  private _medium: LeadMedium | null;
  get medium(): LeadMedium | null {
    return this._medium;
  }

  private _metaLeadId: string | null;
  get metaLeadId(): string | null {
    return this._metaLeadId;
  }

  private _campaignId: string | null;
  get campaignId(): string | null {
    return this._campaignId;
  }

  private _campaignName: string | null;
  get campaignName(): string | null {
    return this._campaignName;
  }

  private _adId: string | null;
  get adId(): string | null {
    return this._adId;
  }

  private _adsetId: string | null;
  get adsetId(): string | null {
    return this._adsetId;
  }

  private _ctwaClid: string | null;
  get ctwaClid(): string | null {
    return this._ctwaClid;
  }

  private _sourceUrl: string | null;
  get sourceUrl(): string | null {
    return this._sourceUrl;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  public static create(props: CreateLeadProps): Lead {
    const now = DateTimeManager.create();

    const lead = new Lead({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      source: props.source,
      status: LeadStatusSchema.enum.NEW,
      pipelineId: props.pipelineId ?? null,
      stageId: props.stageId ?? null,
      name: props.name ? Name.create(props.name).orThrow().value : null,
      phone: props.phone ? Phone.create(props.phone).orThrow().value : null,
      email: props.email ? Email.create(props.email).orThrow().value : null,
      notes: props.notes ?? null,
      assignedToId: props.assignedToId ?? null,
      patientId: null,
      appointmentId: null,
      convertedAt: null,
      lostReason: null,
      lostAt: null,
      whatsAppConversationId: props.whatsAppConversationId ?? null,
      medium: props.medium ?? null,
      metaLeadId: props.metaLeadId ?? null,
      campaignId: props.campaignId ?? null,
      campaignName: props.campaignName ?? null,
      adId: props.adId ?? null,
      adsetId: props.adsetId ?? null,
      ctwaClid: props.ctwaClid ?? null,
      sourceUrl: props.sourceUrl ?? null,
      createdAt: now,
      updatedAt: now,
    });

    lead.addDomainEvent(
      new LeadCreatedEvent({
        leadId: lead.id.value,
        clinicId: lead.clinicId.value,
        leadSource: lead.source,
        action: LogAction.LEAD_CREATED,
        type: LogType.INFO,
        source: props.logSource ?? LogSource.SYSTEM,
        actorId: props.actorId,
        details: `Lead oluşturuldu: ${lead.source}`,
      })
    );

    return lead;
  }

  /**
   * Event üretimi tek yerde toplanır (bkz. `Appointment` entity'si). Domain
   * metodu "ne oldu"yu söyler, payload kurulumunu burası bilir; audit metni de
   * event'in yanında durur, üç ayrı handler'da kopyalanmaz.
   */
  private get raiseEvent() {
    return {
      statusChanged: ({
        previousStatus,
        actorId,
        logSource,
        details,
      }: LeadAuditProps & {
        previousStatus: LeadStatus;
        details?: string;
      }): void => {
        this.addDomainEvent(
          new LeadStatusChangedEvent({
            leadId: this.id.value,
            clinicId: this.clinicId.value,
            previousStatus,
            newStatus: this._status,
            actorId,
            source: logSource,
            action: LogAction.LEAD_STATUS_CHANGED,
            type: LogType.INFO,
            details:
              details ??
              `Lead durumu güncellendi: ${previousStatus} -> ${this._status}`,
          })
        );
      },
      converted: ({ actorId, logSource }: LeadAuditProps): void => {
        this.addDomainEvent(
          new LeadConvertedEvent({
            leadId: this.id.value,
            clinicId: this.clinicId.value,
            patientId: this.patientId?.value ?? null,
            appointmentId: this.appointmentId?.value ?? null,
            actorId,
            source: logSource,
            action: LogAction.LEAD_CONVERTED,
            type: LogType.INFO,
            details: `Lead dönüştürüldü — hasta: ${this.patientId?.value ?? '-'}, randevu: ${this.appointmentId?.value ?? '-'}`,
          })
        );
      },
      lost: ({ actorId, logSource }: LeadAuditProps): void => {
        this.addDomainEvent(
          new LeadLostEvent({
            leadId: this.id.value,
            clinicId: this.clinicId.value,
            lostReason: this._lostReason,
            actorId,
            source: logSource,
            action: LogAction.LEAD_LOST,
            type: LogType.INFO,
            details: `Lead kaybedildi${this._lostReason ? `: ${this._lostReason}` : ''}`,
          })
        );
      },
    };
  }

  /** Statü geçişi + event; "önceki durum"u entity kendi içinde bilir. */
  private changeStatus(newStatus: LeadStatus, props: LeadAuditProps): void {
    const previousStatus = this._status;
    if (previousStatus === newStatus) return;

    this._status = newStatus;
    this._updatedAt = DateTimeManager.create();

    this.raiseEvent.statusChanged({ previousStatus, ...props });
  }

  public contact(props: LeadAuditProps): void {
    this.changeStatus(LeadStatusSchema.enum.CONTACTED, props);
  }

  public qualify(props: LeadAuditProps): void {
    this.changeStatus(LeadStatusSchema.enum.QUALIFIED, props);
  }

  public convert({
    patientId,
    appointmentId,
    actorId,
    logSource,
  }: ConvertLeadProps): void {
    this._patientId = patientId
      ? UUID.create(patientId).orThrow()
      : this._patientId;

    this._appointmentId = appointmentId
      ? UUID.create(appointmentId).orThrow()
      : this._appointmentId;

    this._status = LeadStatusSchema.enum.CONVERTED;
    this._convertedAt = DateTimeManager.create();

    this.raiseEvent.converted({ actorId, logSource });
  }

  public markLost({ reason, actorId, logSource }: MarkLeadLostProps): void {
    const now = DateTimeManager.create();

    this._status = LeadStatusSchema.enum.LOST;
    this._lostReason = reason ?? null;
    this._updatedAt = now;
    this._lostAt = now;

    this.raiseEvent.lost({ actorId, logSource });
  }

  public rules(validateOptions: ValidateOptionsType) {
    return new LeadRules(this, validateOptions);
  }

  /**
   * Satış hunisi panosunda aşama taşıma. Aşama tipini coarse LeadStatus'e senkronlar:
   * WON→CONVERTED, LOST→LOST, terminalden OPEN'a dönüş→yeniden aktif (QUALIFIED).
   * Pano açık bir yönetim aksiyonu olduğundan finalize guard'ı uygulanmaz.
   */
  public moveToStage(props: MoveLeadToStageProps): void {
    this._pipelineId = props.pipelineId;
    this._stageId = props.stageId;

    const now = DateTimeManager.create();
    const previousStatus = this._status;

    if (props.stageType === PipelineStageTypeSchema.enum.WON) {
      if (this._status !== LeadStatusSchema.enum.CONVERTED) {
        this._status = LeadStatusSchema.enum.CONVERTED;
        this._convertedAt = now;
        this._lostReason = null;
        this._lostAt = null;
      }
    } else if (props.stageType === PipelineStageTypeSchema.enum.LOST) {
      if (this._status !== LeadStatusSchema.enum.LOST) {
        this._status = LeadStatusSchema.enum.LOST;
        this._lostReason = props.reason ?? this._lostReason;
        this._lostAt = now;
        this._convertedAt = null;
      }
    } else if (
      this._status === LeadStatusSchema.enum.CONVERTED ||
      this._status === LeadStatusSchema.enum.LOST
    ) {
      // Terminalden açık bir aşamaya geri taşıma → lead'i yeniden aktive et.
      this._status = LeadStatusSchema.enum.QUALIFIED;
      this._convertedAt = null;
      this._lostReason = null;
      this._lostAt = null;
    }

    this._updatedAt = now;

    // Aşama taşıma statüyü değiştirmemiş olabilir (OPEN→OPEN); o zaman event yok.
    if (this._status !== previousStatus) {
      this.raiseEvent.statusChanged({
        previousStatus,
        actorId: props.actorId,
        logSource: props.logSource,
        details: `Lead aşama taşındı (${props.stageName}): ${previousStatus} -> ${this._status}`,
      });
    }
  }

  /** Yalnız huni + aşama kimliğini atar; LeadStatus'e dokunmaz (convert/lost senkronu, create seed). */
  public assignStage(props: AssignLeadStageProps): void {
    this._pipelineId = props.pipelineId;
    this._stageId = props.stageId;
    this._updatedAt = DateTimeManager.create();
  }

  public updateNotes(notes: string): void {
    this._notes = notes;
  }

  public isActive() {
    const isActive =
      this._status !== LeadStatusSchema.enum.CONVERTED &&
      this._status !== LeadStatusSchema.enum.LOST;
    return Guard.monitor(
      isActive,
      isActive,
      () => new Error('Lead aktif durumda değil')
    );
  }

  public toPersistence(): ILead {
    return {
      id: this.id.value,
      clinicId: this.clinicId.value,
      organizationId: this.organizationId.value,
      source: this.source,
      status: this.status,
      pipelineId: this.pipelineId,
      stageId: this.stageId,
      name: this.name?.value ?? null,
      phone: this.phone?.value ?? null,
      email: this.email?.value ?? null,
      notes: this.notes,
      assignedToId: this.assignedToId,
      patientId: this.patientId?.value ?? null,
      appointmentId: this.appointmentId?.value ?? null,
      convertedAt: this.convertedAt,
      lostReason: this.lostReason,
      lostAt: this.lostAt,
      whatsAppConversationId: this.whatsAppConversationId,
      medium: this.medium,
      metaLeadId: this.metaLeadId,
      campaignId: this.campaignId,
      campaignName: this.campaignName,
      adId: this.adId,
      adsetId: this.adsetId,
      ctwaClid: this.ctwaClid,
      sourceUrl: this.sourceUrl,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
