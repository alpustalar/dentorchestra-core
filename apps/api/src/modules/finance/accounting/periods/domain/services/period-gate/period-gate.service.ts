import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNTING_PERIOD_COMMAND_REPOSITORY,
  IAccountingPeriodCommandRepository,
} from '@modules/finance/accounting/periods/domain/repositories/accounting-period/accounting-period.command.repository';
import {
  AssertPeriodNotSealedParams,
  IPeriodGateService,
} from '@modules/finance/accounting/periods/domain/services/period-gate/period-gate.service.interface';
import { isPeriodPostable } from '@modules/finance/accounting/periods/domain/rules/postable-period-statuses.constant';
import { PeriodSealedForDateException } from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';

@Injectable()
export class PeriodGateService implements IPeriodGateService {
  constructor(
    @Inject(ACCOUNTING_PERIOD_COMMAND_REPOSITORY)
    private readonly periodCommandRepo: IAccountingPeriodCommandRepository
  ) {}

  async assertPeriodNotSealedAt(
    params: AssertPeriodNotSealedParams
  ): Promise<void> {
    const period = await this.periodCommandRepo.findByDate(
      params.clinicId,
      params.date
    );

    // Dönem yoksa kapı geçirir (gerekçe: interface notu) — eksik fiş süpürme
    // uyarısıyla görünür kalır.
    if (!period) return;

    if (isPeriodPostable(period.status)) return;

    throw new PeriodSealedForDateException({
      clinicId: params.clinicId,
      date: params.date,
      year: period.year,
      currentStatus: period.status,
    });
  }
}
