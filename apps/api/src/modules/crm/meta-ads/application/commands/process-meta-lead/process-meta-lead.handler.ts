import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ProcessMetaLeadCommand } from './process-meta-lead.command';
import { ProcessMetaLeadResponse } from './process-meta-lead.response';
import { CreateLeadCommand } from '@modules/crm/lead/application/commands/create-lead/create-lead.command';
import { CreateLeadDto } from '@shared/modules/lead/dto/commands';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { IGetContext } from '@common/decorators';
import { ActorContext, JsonValue } from '@common/interfaces';
import { SYSTEM_ACTOR } from '@common/constants/system-actor.constant';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { MetaLead } from '@modules/crm/meta-ads/domain/entities/meta-lead.entity';
import {
  IMetaLeadCommandRepository,
  META_LEAD_COMMAND_REPOSITORY,
} from '@modules/crm/meta-ads/domain/repositories/meta-lead.repository';
import {
  IMetaAdAccountCommandRepository,
  META_AD_ACCOUNT_COMMAND_REPOSITORY,
} from '@modules/crm/meta-ads/domain/repositories/meta-ad-account.repository';
import {
  IMetaAdsEventPublisher,
  META_ADS_EVENT_PUBLISHER,
} from '@modules/crm/meta-ads/domain/interfaces/meta-ads-event-publisher.interface';
import { FindPatientByContactQuery } from '@modules/crm/patient/application/queries/find-patient-by-contact/find-patient-by-contact.query';
import {
  LogAction,
  LogSource,
  LogType,
} from '@src/domain/constants/log-action.constant';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';

@CommandHandler(ProcessMetaLeadCommand)
export class ProcessMetaLeadHandler
  implements ICommandHandler<ProcessMetaLeadCommand, ProcessMetaLeadResponse>
{
  private readonly logger = new Logger(ProcessMetaLeadHandler.name);

  constructor(
    @Inject(META_LEAD_COMMAND_REPOSITORY)
    private readonly metaLeadRepo: IMetaLeadCommandRepository,
    @Inject(META_AD_ACCOUNT_COMMAND_REPOSITORY)
    private readonly metaAdAccountRepo: IMetaAdAccountCommandRepository,
    @Inject(META_ADS_EVENT_PUBLISHER)
    private readonly eventPublisher: IMetaAdsEventPublisher,
    private readonly queryBus: TSQueryBus,
    private readonly commandBus: TSCommandBus,
    private readonly txManager: TransactionManager
  ) {}

  async execute(
    command: ProcessMetaLeadCommand
  ): Promise<ProcessMetaLeadResponse> {
    // MetaLead yazması + Lead köprüsü + leadReceived event'i tek transaction'da.
    // Öncesinde txManager yoktu: publisher çağrısı ALS bağlamı bulamadığı için
    // event sessizce düşüyor, MetaLeadReceived listener'ı hiç çalışmıyordu.
    return this.txManager.run(() => this.processLead(command));
  }

  private async processLead(
    command: ProcessMetaLeadCommand
  ): Promise<ProcessMetaLeadResponse> {
    const { payload } = command;

    const existing = await this.metaLeadRepo.findByMetaLeadId(
      payload.metaLeadId
    );
    if (existing) {
      return {
        leadId: existing.id.value,
        status: existing.status,
        matchedPatientId: existing.matchedPatientId,
      };
    }

    const account = await this.metaAdAccountRepo.findById(
      payload.metaAdAccountId
    );

    const metaLead = MetaLead.create({
      metaAdAccountId: payload.metaAdAccountId,
      metaLeadId: payload.metaLeadId,
      formId: payload.formId,
      campaignId: payload.campaignId,
      campaignName: payload.campaignName,
      adsetId: payload.adsetId,
      adId: payload.adId,
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      rawData: payload.rawData as JsonValue,
    });
    let saved = await this.metaLeadRepo.create(metaLead);

    if (account && (payload.phone || payload.email)) {
      const { data: patient } = await this.queryBus.execute(
        new FindPatientByContactQuery({
          clinicId: account.clinicId.value,
          phone: payload.phone,
          email: payload.email,
        })
      );

      if (patient) {
        saved.matchToPatient(patient.id);
        saved = await this.metaLeadRepo.update(saved);
      }
    }

    // MetaLead → birleşik Lead köprüsü. İlk findByMetaLeadId early-return'ü sayesinde
    // MetaLead başına yalnız bir kez çalışır (idempotent). Best-effort — hata mesajı
    // MetaLead işlemeyi bozmaz.
    if (account) {
      await this.bridgeToUnifiedLead(saved, account.clinicId.value);
    }

    this.eventPublisher.leadReceived({
      metaLeadId: saved.id.value,
      clinicId: account?.clinicId.value ?? '',
      campaignId: saved.campaignId,
      status: saved.status,
      actorId: 'system',
      source: LogSource.SYSTEM,
      action: LogAction.META_ADS_LEAD_RECEIVED,
      type: LogType.INFO,
      details: `Meta lead alındı: ${saved.metaLeadId}`,
    });

    return {
      leadId: saved.id.value,
      status: saved.status,
      matchedPatientId: saved.matchedPatientId,
    };
  }

  /**
   * Meta Lead Ads (form) leadini birleşik `Lead` listesine köprüler. Kaynak META_FORM,
   * medium FORM; kampanya/reklam id'leri + form verisi (isim/telefon/e-posta) taşınır.
   * `metaLeadId` = MetaLead.id → Lead.metaLeadId @unique ile çift-üretim engellenir.
   */
  private async bridgeToUnifiedLead(
    lead: MetaLead,
    clinicId: string
  ): Promise<void> {
    const dto: CreateLeadDto = {
      source: 'META_FORM',
      name: lead.name ?? undefined,
      phone: lead.phone?.value ?? undefined,
      email: lead.email?.value ?? undefined,
      medium: 'FORM',
      metaLeadId: lead.id.value,
      campaignId: lead.campaignId ?? undefined,
      campaignName: lead.campaignName ?? undefined,
      adId: lead.adId ?? undefined,
      adsetId: lead.adsetId ?? undefined,
    } as CreateLeadDto;

    try {
      await this.commandBus.execute(
        new CreateLeadCommand({
          data: dto,
          clinicId,
          ctx: this.buildSystemContext(clinicId),
        })
      );
    } catch (err) {
      this.logger.warn(
        `MetaLead → Lead köprüsü başarısız (metaLeadId: ${lead.id.value})`,
        err as Error
      );
    }
  }

  /** Webhook (actor'sız) akışı için sistem yürütme context'i. */
  private buildSystemContext(clinicId: string): IGetContext {
    const actor: ActorContext = {
      ...SYSTEM_ACTOR,
      clinicId,
      managedClinics: [{ id: clinicId }],
    };
    return {
      actor,
      source: ExecutionSources.INTERNAL_CASCADE,
      ip: '127.0.0.1',
      userAgent: 'WEBHOOK',
    };
  }
}
