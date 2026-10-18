import { Injectable } from '@nestjs/common';
import { FinancialEvent as IFinancialEvent, Pagination } from '@shared';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { paginate } from '@src/infrastructure/persistence/prisma/helpers/paginate.helper';
import { FindFinancialEventsFilter } from '@modules/finance/accounting/financial-events/domain/contracts/financial-event';
import {
  ExistingDedupeKeyParams,
  ExistingSourceRefParams,
  IFinancialEventQueryRepository,
} from '@modules/finance/accounting/financial-events/domain/repositories/financial-event/financial-event.query.repository';
import {
  UnpostedRangeParams,
  UnpostedScanParams,
} from '@modules/finance/accounting/financial-events/domain/repositories/financial-event/financial-event.command.repository';
import { unpostedFinancialEventWhere } from './financial-event-unposted.query';
import { normalizeReportDateRange } from '@modules/finance/shared/domain/reporting/report-date-range';

@Injectable()
export class FinancialEventQueryRepository
  extends BaseRepository
  implements IFinancialEventQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findById(id: string): Promise<IFinancialEvent | null> {
    return this.db.financialEvent.findUnique({ where: { id } });
  }

  findMany(
    filter: FindFinancialEventsFilter,
    pagination: Pagination
  ): Promise<{ items: IFinancialEvent[]; total: number }> {
    const where = {
      clinicId: filter.clinicId,
      organizationId: filter.organizationId,
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.sourceModule ? { sourceModule: filter.sourceModule } : {}),
      ...(filter.sourceRefId ? { sourceRefId: filter.sourceRefId } : {}),
    };

    return paginate({
      delegate: this.db.financialEvent,
      pagination,
      where,
    });
  }

  /**
   * `paginate` kullanılmaz: dönen küme çağıranın gönderdiği referans sayısıyla
   * sınırlıdır ve bir liste raporu değil, küme çıkarma girdisidir.
   */
  async findExistingSourceRefIds(
    params: ExistingSourceRefParams
  ): Promise<string[]> {
    if (params.sourceRefIds.length === 0) return [];

    const rows = await this.db.financialEvent.findMany({
      where: {
        clinicId: params.clinicId,
        sourceModule: params.sourceModule,
        sourceRefId: { in: params.sourceRefIds },
      },
      select: { sourceRefId: true },
      distinct: ['sourceRefId'],
    });

    return rows
      .map((row) => row.sourceRefId)
      .filter((refId): refId is string => refId !== null);
  }

  /**
   * `paginate` kullanılmaz (aynı gerekçe: küme çıkarma girdisi).
   *
   * `clinicId` süzgeci **güvenlik** içindir, performans değil: anahtar global
   * tekil olduğu için kiracı kapsamı olmadan "bu anahtar var mı" sorusu başka
   * bir kiracının defteri hakkında bilgi sızdırırdı.
   */
  async findExistingDedupeKeys(
    params: ExistingDedupeKeyParams
  ): Promise<string[]> {
    if (params.dedupeKeys.length === 0) return [];

    const rows = await this.db.financialEvent.findMany({
      where: {
        clinicId: params.clinicId,
        dedupeKey: { in: params.dedupeKeys },
      },
      select: { dedupeKey: true },
    });

    return rows
      .map((row) => row.dedupeKey)
      .filter((key): key is string => key !== null);
  }

  findUnpostedInRange(
    params: UnpostedRangeParams,
    pagination: Pagination
  ): Promise<{ items: IFinancialEvent[]; total: number }> {
    // Operatör raporu: pencere HTTP'den bir **gün** olarak gelir, `occurredAt` ise
    // tam zaman damgasıdır → aralık gün sınırlarına genişletilir, yoksa son günün
    // fişlenmemiş olayları listede hiç görünmez.
    //
    // Normalizasyon `unpostedFinancialEventWhere`'in içine değil BURAYA konur:
    // aynı tanımı dönem kapanış kapısı (karar) ve zamanlanmış süpürme de
    // kullanıyor ve onların penceresi hesaplanmış bir **an**dır (`now`, dönem
    // sınırı). Bir raporu düzeltmek için bir kararın penceresini genişletmek
    // yanlış olurdu.
    const { dateFrom, dateTo } = normalizeReportDateRange({
      dateFrom: params.from,
      dateTo: params.to,
    });

    return paginate({
      delegate: this.db.financialEvent,
      pagination,
      where: unpostedFinancialEventWhere({
        ...params,
        from: dateFrom ?? params.from,
        to: dateTo ?? params.to,
      }),
    });
  }

  async findClinicsWithUnposted(params: UnpostedScanParams): Promise<string[]> {
    // `distinct` + tek kolon: dönen küme klinik sayısıyla sınırlı, olay sayısıyla
    // değil. `paginate` kullanılmıyor çünkü bu bir liste raporu değil, süpürme
    // işinin hedef kümesi (skaler kimlikler).
    const rows = await this.db.financialEvent.findMany({
      where: unpostedFinancialEventWhere(params),
      select: { clinicId: true },
      distinct: ['clinicId'],
    });
    return rows.map((row) => row.clinicId);
  }
}
