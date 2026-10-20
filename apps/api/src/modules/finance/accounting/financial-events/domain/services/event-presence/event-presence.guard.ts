import { Inject, Injectable } from '@nestjs/common';
import {
  FINANCIAL_EVENT_COMMAND_REPOSITORY,
  IFinancialEventCommandRepository,
} from '@modules/finance/accounting/financial-events/domain/repositories/financial-event/financial-event.command.repository';
import {
  AssertEventRecordedParams,
  IFinancialEventPresenceGuard,
} from '@modules/finance/accounting/financial-events/domain/services/event-presence/event-presence.guard.interface';
import { FinancialEventNotRecordedException } from '@modules/finance/accounting/financial-events/domain/exceptions';

@Injectable()
export class FinancialEventPresenceGuard implements IFinancialEventPresenceGuard {
  constructor(
    @Inject(FINANCIAL_EVENT_COMMAND_REPOSITORY)
    private readonly financialEventCommandRepo: IFinancialEventCommandRepository
  ) {}

  async assertRecorded(
    params: AssertEventRecordedParams,
    error?: Error
  ): Promise<void> {
    const event = await this.financialEventCommandRepo.findByDedupeKey(
      params.dedupeKey
    );

    // Başka kliniğin olayı bu kliniğin kanıtı sayılamaz (`dedupeKey` global
    // tekildir): kiracı eşleşmiyorsa olay "yok" hükmündedir.
    if (!event || event.clinicId.value !== params.clinicId) {
      throw error ?? new FinancialEventNotRecordedException(params.dedupeKey);
    }
  }

  async isRecorded(params: AssertEventRecordedParams): Promise<boolean> {
    const event = await this.financialEventCommandRepo.findByDedupeKey(
      params.dedupeKey
    );
    return !!event && event.clinicId.value === params.clinicId;
  }
}
