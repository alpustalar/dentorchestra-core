import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainEvent } from '@common/interfaces';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import {
  OUTBOX_CLAIM_LEASE_MS,
  OUTBOX_MAX_ATTEMPTS,
} from '@src/infrastructure/persistence/prisma/outbox/outbox.constants';

/** Sahiplenilmiş bir outbox kaydı — teslim için gereken asgari alanlar. */
export interface ClaimedOutboxRecord {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  /** Sahiplenme sonrası **artmış** deneme sayısı (bu deneme dahil). */
  attempts: number;
}

export interface MarkOutboxFailedInput {
  id: string;
  error: string;
  /** Deneme hakkı tükendi mi — doluysa kayıt artık sahiplenilmez. */
  deadLetter: boolean;
}

@Injectable()
export class OutboxRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async saveEvents(events: DomainEvent[]): Promise<void> {
    await this.db.outbox.createMany({
      data: events.map((event) => ({
        type: event.name,
        payload: event.payload as Prisma.InputJsonValue,
        id: crypto.randomUUID(),
      })),
    });
  }

  /**
   * İşlenmemiş kayıtları **atomik olarak sahiplenir** ve döndürür.
   *
   * Neden tek UPDATE: eski hâl `findMany({ processedAt: null })` ile okuyordu;
   * iki API örneği (ya da 5 saniyelik tur bir turdan uzun sürdüğünde üst üste
   * binen iki tur) aynı kayıtları okuyup **aynı event'i iki kez** yayınlıyordu.
   * `FOR UPDATE SKIP LOCKED` ile her kayıt tam bir işçiye düşer.
   *
   * `attempts` sahiplenme anında artar: süreç teslim ortasında çökse bile deneme
   * sayılır, yoksa çökerten bir kayıt (poison pill) sonsuz döngüye girer.
   *
   * Sıra `seq` ile verilir — `createdAt` DEĞİL: Postgres'te `CURRENT_TIMESTAMP`
   * transaction boyunca sabittir, dolayısıyla aynı `outboxRun()` ile mühürlenen
   * event'lerin hepsi aynı damgayı taşır ve kendi aralarında sırasızdır.
   */
  claimPending(limit: number): Promise<ClaimedOutboxRecord[]> {
    const leaseCutoff = DateTimeManager.subtractMilliseconds(
      DateTimeManager.create(),
      OUTBOX_CLAIM_LEASE_MS
    );

    return this.db.$queryRaw<ClaimedOutboxRecord[]>(Prisma.sql`
      UPDATE "Outbox"
         SET "claimedAt" = CURRENT_TIMESTAMP,
             "attempts" = "attempts" + 1
       WHERE "id" IN (
               SELECT "id"
                 FROM "Outbox"
                WHERE "processedAt" IS NULL
                  AND "failedAt" IS NULL
                  AND ("claimedAt" IS NULL OR "claimedAt" < ${leaseCutoff})
                ORDER BY "seq" ASC
                LIMIT ${limit}
                FOR UPDATE SKIP LOCKED
             )
      RETURNING "id", "type", "payload", "attempts"
    `);
  }

  /** Teslim edildi: kayıt kapanır, sahiplenme bırakılır. */
  async markProcessed(id: string): Promise<void> {
    await this.db.outbox.update({
      where: { id },
      data: { processedAt: DateTimeManager.create(), claimedAt: null },
    });
  }

  /**
   * Teslim edilemedi. `claimedAt` **bilerek bırakılmaz**: kiralama süresi
   * (`OUTBOX_CLAIM_LEASE_MS`) başarısız denemeler arasındaki beklemeyi verir —
   * aksi hâlde kayıt 5 saniyede bir yeniden denenir ve deneme hakkı bir dakikada
   * tükenir. `deadLetter` dolduğunda kayıt artık sahiplenilmez; **silinmez**,
   * görünür kalır.
   */
  async markFailed({
    id,
    error,
    deadLetter,
  }: MarkOutboxFailedInput): Promise<void> {
    await this.db.outbox.update({
      where: { id },
      data: {
        lastError: error.slice(0, 2000),
        failedAt: deadLetter ? DateTimeManager.create() : null,
      },
    });
  }

  /** Ölü mektuplar — teslim edilmemiş ve artık denenmeyen kayıtlar. */
  findDeadLettered(limit = 100) {
    return this.db.outbox.findMany({
      where: { processedAt: null, failedAt: { not: null } },
      orderBy: { seq: 'asc' },
      take: limit,
      select: {
        id: true,
        type: true,
        attempts: true,
        lastError: true,
        createdAt: true,
        failedAt: true,
      },
    });
  }

  /** Deneme hakkını tüketmiş sayılır mı — sınır tek yerde yaşar. */
  static isExhausted(attempts: number): boolean {
    return attempts >= OUTBOX_MAX_ATTEMPTS;
  }
}
