import { Inject, Injectable, Logger } from '@nestjs/common';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { AppointmentCompletedEvent } from '@modules/clinical/appointment/domain/events/complete-appointment.event';
import {
  IMetaLeadCommandRepository,
  META_LEAD_COMMAND_REPOSITORY,
} from '@modules/crm/meta-ads/domain/repositories/meta-lead.repository';
import { OnDomainEvent } from '@common/decorators';

@Injectable()
export class MetaLeadConversionListener {
  private readonly logger = new Logger(MetaLeadConversionListener.name);

  constructor(
    @Inject(META_LEAD_COMMAND_REPOSITORY)
    private readonly leadCommandRepo: IMetaLeadCommandRepository,
    private readonly txManager: TransactionManager
  ) {}

  @OnDomainEvent(AppointmentCompletedEvent.NAME)
  async handle(event: AppointmentCompletedEvent): Promise<void> {
    if (!event.patientId) return;

    try {
      // Okuma da yazma da Command Repo'dan: lead durumu değiştirilecek.
      await this.txManager.run(async () => {
        const lead = await this.leadCommandRepo.findMatchedLeadByPatientId(
          event.patientId!
        );
        if (!lead) return;

        lead.markConverted(event.appointmentId);
        await this.leadCommandRepo.update(lead);
      });
    } catch (err) {
      this.logger.error(
        `Meta lead dönüşüm hatası — patientId: ${event.patientId}`,
        err
      );
    }
  }
}
