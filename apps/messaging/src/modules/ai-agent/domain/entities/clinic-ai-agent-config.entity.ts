import {
  AiProviderSchema,
  AiProviderType,
  ClinicAiAgentConfig as IClinicAiAgentConfig,
} from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import {
  CreateClinicAiAgentConfigProps,
  UpdateClinicAiAgentConfigProps,
} from '../types/create-clinic-ai-agent-config.props';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { isDefined } from '@common/utils';

/**
 * Kliniğin AI sohbet asistanı config'i (messaging bounded-context). Clinic'ten ayrıştırılmış
 * 1:1 satellite; persona (systemPrompt), model ve (şifreli) Anthropic anahtarını barındırır.
 * Gelen mesajlara otomatik yanıt akışı (AiReplyProcessor) bu kayıttan beslenir.
 */
export class ClinicAiAgentConfig extends AggregateRoot {
  constructor(data: IClinicAiAgentConfig) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._isEnabled = data.isEnabled;
    this._provider = data.provider;
    this._model = data.model;
    this._systemPrompt = data.systemPrompt;
    this._apiKey = data.apiKey;
    this._maxTokens = data.maxTokens;
    this._replyOnlyWithinWindow = data.replyOnlyWithinWindow;
    this._businessHours = data.businessHours;
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _isEnabled: boolean;
  get isEnabled(): boolean {
    return this._isEnabled;
  }

  private _provider: AiProviderType;
  get provider(): AiProviderType {
    return this._provider;
  }

  private _model: string;
  get model(): string {
    return this._model;
  }

  private _systemPrompt: string | null;
  get systemPrompt(): string | null {
    return this._systemPrompt;
  }

  private _apiKey: string | null;
  get apiKey(): string | null {
    return this._apiKey;
  }

  private _maxTokens: number | null;
  get maxTokens(): number | null {
    return this._maxTokens;
  }

  private _replyOnlyWithinWindow: boolean;
  get replyOnlyWithinWindow(): boolean {
    return this._replyOnlyWithinWindow;
  }

  private _businessHours: IClinicAiAgentConfig['businessHours'];
  get businessHours(): IClinicAiAgentConfig['businessHours'] {
    return this._businessHours;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  public static create(
    props: CreateClinicAiAgentConfigProps
  ): ClinicAiAgentConfig {
    const now = DateTimeManager.create();

    const id = UUID.createOrGenerate(props.id);

    return new ClinicAiAgentConfig({
      id: id.value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      isEnabled: props.isEnabled ?? false,
      provider: props.provider ?? AiProviderSchema.enum.ANTHROPIC,
      model: props.model ?? 'claude-haiku-4-5',
      systemPrompt: props.systemPrompt ?? null,
      apiKey: props.apiKey ?? null,
      maxTokens: props.maxTokens ?? null,
      replyOnlyWithinWindow: props.replyOnlyWithinWindow ?? true,
      businessHours: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public updateSettings(props: UpdateClinicAiAgentConfigProps): void {
    if (isDefined(props.isEnabled)) this._isEnabled = props.isEnabled;
    if (isDefined(props.provider)) this._provider = props.provider;
    if (isDefined(props.model)) this._model = props.model;
    if (isDefined(props.systemPrompt)) this._systemPrompt = props.systemPrompt;
    if (isDefined(props.apiKey)) this._apiKey = props.apiKey;
    if (isDefined(props.maxTokens)) this._maxTokens = props.maxTokens;
    if (isDefined(props.replyOnlyWithinWindow))
      this._replyOnlyWithinWindow = props.replyOnlyWithinWindow;
  }

  public enable(): void {
    this._isEnabled = true;
  }

  public disable(): void {
    this._isEnabled = false;
  }

  /** AI yanıt verebilir mi? (etkin + anahtar var ya da platform fallback'i çağıran tarafça karşılanır) */
  public canReply(): boolean {
    return this.isEnabled;
  }

  public toPersistence(): IClinicAiAgentConfig {
    return {
      id: this.id.value,
      isEnabled: this.isEnabled,
      provider: this.provider,
      model: this.model,
      systemPrompt: this.systemPrompt,
      apiKey: this.apiKey,
      maxTokens: this.maxTokens,
      replyOnlyWithinWindow: this.replyOnlyWithinWindow,
      businessHours: this.businessHours,
      clinicId: this.clinicId.value,
      organizationId: this.organizationId.value,
      createdAt: this.createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }
}
