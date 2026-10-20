import { Injectable, Logger } from '@nestjs/common';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { IGetContext } from '@common/decorators';
import { ActorContext } from '@common/interfaces';
import { SYSTEM_ACTOR } from '@common/constants/system-actor.constant';
import { ExecutionSources } from '../../../../../packages/shared/common/constants/execution-source.constant';
import { MessageChannelSchema } from '@shared';
import { CreateLeadDto } from '@shared/modules/lead/dto/commands';
import {
  FindPatientRequest,
  FindPatientResponse,
  RegisterAdReferralLeadRequest,
  RegisterAdReferralLeadResponse,
} from '@src/transport';
import { FindPatientByContactQuery } from '@modules/crm/patient/application/queries/find-patient-by-contact/find-patient-by-contact.query';
import { CreateLeadCommand } from '@modules/crm/lead/application/commands/create-lead/create-lead.command';

/**
 * Messaging'in kontak sorularını core'un kendi sözleşmeleriyle karşılar.
 *
 * Mantık bilerek **core tarafında**: hasta ve lead core'un aggregate'leri, messaging'in
 * onları tanıması gerekmiyor. Messaging yalnız iki soru sorar ("bu kontak hangi hastaya
 * ait?", "bu reklam yazışması için lead aç") ve cevabı NATS üzerinden alır.
 *
 * İki metot da **best-effort**: hata halinde `null` döner. Kontak çözülemese de gelen
 * mesaj kaydedilmeli — attribution uğruna mesaj kaybedilmez.
 */
@Injectable()
export class ContactRpcService {
  private readonly logger = new Logger(ContactRpcService.name);

  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus
  ) {}

  async findPatientId(
    payload: FindPatientRequest
  ): Promise<FindPatientResponse> {
    // Telegram/Instagram'da contactPhone bir kimlik numarasıdır; telefon olarak
    // sorgulamak yanlış hastayla eşleşmeye yol açardı.
    const phone =
      payload.matchPhone ??
      (payload.channel === MessageChannelSchema.enum.WHATSAPP
        ? payload.contactPhone
        : null);
    if (!phone) return null;

    try {
      const { data: patient } = await this.queryBus.execute(
        new FindPatientByContactQuery({ clinicId: payload.clinicId, phone })
      );
      return patient?.id ?? null;
    } catch {
      // Hasta bulunamadı → misafir olarak devam.
      return null;
    }
  }

  async registerAdReferralLead(
    payload: RegisterAdReferralLeadRequest
  ): Promise<RegisterAdReferralLeadResponse> {
    const { channel, referral } = payload;

    const dto: CreateLeadDto = {
      source: channel, // WHATSAPP | INSTAGRAM | TELEGRAM — LeadSource ile örtüşür
      name: payload.contactName ?? undefined,
      phone:
        channel === MessageChannelSchema.enum.WHATSAPP
          ? payload.contactPhone
          : undefined,
      medium: 'AD',
      adId: referral.adId ?? undefined,
      ctwaClid: referral.ctwaClid ?? undefined,
      sourceUrl: referral.sourceUrl ?? undefined,
    } as CreateLeadDto;

    try {
      return await this.commandBus.execute(
        new CreateLeadCommand({
          data: dto,
          clinicId: payload.clinicId,
          ctx: this.buildSystemContext(
            payload.clinicId,
            payload.organizationId
          ),
        })
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Bilinmeyen hata';
      this.logger.warn(`Reklam referral lead'i üretilemedi: ${reason}`);
      return null;
    }
  }

  /** Webhook (actor'sız) akışı için sistem yürütme context'i. */
  private buildSystemContext(
    clinicId: string,
    organizationId: string
  ): IGetContext {
    const actor: ActorContext = {
      ...SYSTEM_ACTOR,
      clinicId,
      organizationId,
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
