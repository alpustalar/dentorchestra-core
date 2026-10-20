// Barrel'dan DEĞİL, doğrudan als-storage'dan: barrel Prisma'nın `TransactionManager`'ını
// da dışa açıyor ve onun üzerinden PrismaService/BaseRepository zinciri buraya bağlanıyordu.
// Event mekanizması veritabanı-bağımsız kalmalı (messaging Mongo kullanıyor).
import { txStorage } from '@src/infrastructure/transaction/als-storage';
import { IAuditLog } from '@common/interfaces/audit-log.interface';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

export interface EventMetadata {
  eventId: string;
  correlationId: string;
  occurredAt: Date;
  version: number; // Yarın bir gün event yapısı değişirse hayat kurtarır
}

const getContextCorrelationId = (): string => {
  const store = txStorage.getStore();
  return store?.correlationId ?? crypto.randomUUID();
};

export abstract class BaseEvent {
  static readonly NAME: string;

  public readonly metadata: EventMetadata;
  public readonly log?: IAuditLog;

  constructor(log?: IAuditLog) {
    this.metadata = {
      eventId: crypto.randomUUID(),
      correlationId: getContextCorrelationId(),
      occurredAt: DateTimeManager.create(),
      version: 1,
    };
    this.log = log;
  }
}
