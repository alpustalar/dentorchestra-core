import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model } from 'mongoose';
import { DomainEvent } from '@common/interfaces';
import { emitDetached } from '@common/utils/emit-detached';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import {
  TransactionContext,
  txStorage,
} from '@src/infrastructure/transaction/als-storage';
import { mongoSessionStorage } from './session-storage';
import { MESSAGING_MONGO_CONNECTION } from './mongo.connection';
import { MongoOutbox, MongoOutboxDocument } from './outbox/mongo-outbox.schema';
import { MongoOutboxRelay } from './outbox/mongo-outbox.relay';

/** Mongo'nun yeniden denenebilir işaretlediği geçici transaction hataları. */
const TRANSIENT_LABELS = [
  'TransientTransactionError',
  'UnknownTransactionCommitResult',
];

/** Write-conflict / geçici hata için yeniden deneme sayısı. */
const MAX_TRANSACTION_ATTEMPTS = 3;

interface MongoErrorLike {
  errorLabels?: string[];
}

/**
 * Mongo tarafının transaction + event yöneticisi — Prisma'daki `TransactionManager`'ın
 * karşılığı ve **aynı sözleşmeyi** sunar (`run` / `outboxRun`).
 *
 * Neden ayrı bir sınıf: `TransactionManager` bir Prisma transaction'ı açar ve event'leri
 * Postgres `Outbox` tablosuna yazar. Messaging verisi Mongo'ya taşındığında o transaction
 * artık domain yazmasını kapsamaz — yazma Mongo'da, outbox insert'i Postgres'te olurdu
 * ve atomiklik sessizce kaybolurdu. Bu sınıf ikisini de Mongo'da, tek session'da tutar.
 *
 * Event boru hattı ORTAKTIR: event'ler yine `txStorage` üzerinden birikir
 * (`ContextService.addEvent` / `AggregateRoot.addDomainEvent` değişmez); yalnız
 * kalıcılaştırma hedefi Mongo outbox koleksiyonudur.
 *
 * ⚠️ Çok-dokümanlı transaction **replica set** gerektirir (tek düğüm yeterlidir).
 * Standalone mongod'da `startSession().withTransaction()` hata verir.
 */
@Injectable()
export class MongoTransactionManager implements OnApplicationBootstrap {
  private readonly logger = new Logger(MongoTransactionManager.name);

  constructor(
    @InjectConnection(MESSAGING_MONGO_CONNECTION)
    private readonly connection: Connection,
    @InjectModel(MongoOutbox.name, MESSAGING_MONGO_CONNECTION)
    private readonly outboxModel: Model<MongoOutboxDocument>,
    private readonly eventEmitter: EventEmitter2,
    private readonly outboxRelay: MongoOutboxRelay
  ) {}

  /**
   * Replica set olmadan transaction açılamaz ve messaging'in **her** yazması bu sınıftan
   * geçer. Guard olmasaydı uygulama sorunsuz açılır, sorun ilk gelen mesajda anlaşılmaz
   * bir sürücü hatası olarak patlardı. Burada açılışta, ne yapılması gerektiğini söyleyen
   * bir hatayla durur.
   */
  async onApplicationBootstrap(): Promise<void> {
    const isReplicaSet = await this.supportsTransactions();
    if (isReplicaSet) return;

    throw new Error(
      'MongoDB replica set modunda değil — messaging yazmaları transaction gerektirir. ' +
        'mongod --replSet rs0 ile başlatıp bir kez rs.initiate() çalıştırın ' +
        '(tek düğüm yeterlidir).'
    );
  }

  private async supportsTransactions(): Promise<boolean> {
    try {
      const info = await this.connection.db
        ?.admin()
        .command({ hello: 1 })
        .catch(() => null);
      // `setName` yalnız replica set üyelerinde döner.
      return Boolean(info?.setName);
    } catch {
      return false;
    }
  }

  /**
   * İşi bir Mongo transaction'ında çalıştırır; biriken event'leri **commit'ten sonra**
   * in-memory yayınlar (audit log, bildirim gibi atomik olması gerekmeyen yan etkiler).
   * Bir listener'ın hatası yazmayı geri sarmaz; yalnız loglanır.
   */
  async run<T>(work: () => Promise<T>): Promise<T> {
    if (mongoSessionStorage.getStore()) {
      // İç içe çağrı: event'ler dış bağlama birikir, dıştaki run() yayınlar.
      return work();
    }

    const { result, events } = await this.withTransaction(work);
    this.emitAfterCommit(events);
    return result;
  }

  /**
   * İşi bir Mongo transaction'ında çalıştırır ve biriken event'leri **aynı session
   * içinde** outbox koleksiyonuna mühürler. Yazma geri sarılırsa event de sarılır;
   * event yazılamazsa yazma da geri sarılır.
   *
   * Mühürleme tek başına yetmez: event'i dinleyicilere ulaştıran `MongoOutboxRelay`'dir.
   * Commit'ten sonra relay doğrudan dürtülür (beklemeden — hata relay içinde loglanır),
   * çünkü periyodik taramayı beklemek gelen mesaja verilen yanıtı geciktirirdi.
   */
  async outboxRun<T>(work: () => Promise<T>): Promise<T> {
    if (mongoSessionStorage.getStore()) {
      return work();
    }

    const { result, events } = await this.withTransaction(
      work,
      async (outboxEvents, session) => {
        if (outboxEvents.length === 0) return;
        await this.saveToOutbox(outboxEvents, session);
      }
    );

    if (events.length > 0) {
      void this.outboxRelay.drain();
    }

    return result;
  }

  /**
   * Session'ı açar, ALS bağlamlarını (Mongo session + event toplama) kurar ve işi
   * transaction içinde çalıştırır. `onBeforeCommit` verilirse commit'ten hemen önce,
   * hâlâ session içindeyken çağrılır (outbox mühürleme buradan geçer).
   *
   * Write-conflict gibi geçici hatalarda tüm iş yeniden denenir — Mongo'da eşzamanlı
   * yazma çekişmesi kilitle beklemek yerine transaction'ı iptal ederek çözülür, bu
   * yüzden retry `FOR UPDATE`'in yerini tutan mekanizmanın parçasıdır.
   */
  private async withTransaction<T>(
    work: () => Promise<T>,
    onBeforeCommit?: (
      events: DomainEvent[],
      session: ClientSession
    ) => Promise<void>
  ): Promise<{ result: T; events: DomainEvent[] }> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt++) {
      const session = await this.connection.startSession();
      const context: TransactionContext = {
        events: [],
        correlationId: crypto.randomUUID(),
      };

      try {
        let result!: T;

        await session.withTransaction(async () => {
          // Her denemede event listesi sıfırlanır; yoksa iptal edilen denemenin
          // event'leri bir sonraki denemede mükerrer yazılırdı.
          context.events = [];

          result = await mongoSessionStorage.run({ session }, () =>
            txStorage.run(context, work)
          );

          await onBeforeCommit?.(context.events, session);
        });

        return { result, events: context.events };
      } catch (err) {
        lastError = err;
        if (!this.isTransient(err) || attempt === MAX_TRANSACTION_ATTEMPTS)
          throw err;

        this.logger.warn(
          `Mongo transaction geçici hata aldı, yeniden deneniyor (${attempt}/${MAX_TRANSACTION_ATTEMPTS}).`
        );
      } finally {
        await session.endSession();
      }
    }

    throw lastError;
  }

  private async saveToOutbox(
    events: DomainEvent[],
    session: ClientSession
  ): Promise<void> {
    await this.outboxModel.insertMany(
      events.map((event) => ({
        _id: crypto.randomUUID(),
        type: event.name,
        payload: event.payload as Record<string, unknown>,
        createdAt: DateTimeManager.create(),
        processedAt: null,
      })),
      { session }
    );
  }

  private isTransient(err: unknown): boolean {
    const labels = (err as MongoErrorLike)?.errorLabels;
    return (
      Array.isArray(labels) &&
      labels.some((label) => TRANSIENT_LABELS.includes(label))
    );
  }

  /**
   * Toplanan event'leri yayınlar — **beklemeden** (`emitDetached`). Bir listener'ın
   * hatası ne diğer listener'ları ne de kalıcılaşmış yazmayı etkiler; loglanır.
   * Sıra korunur.
   *
   * Postgres tarafındaki `TransactionManager` ile aynı sözleşme: kritik olmayan
   * kanal beklemez (istek yanıtını bir dış çağrının arkasına koymaz), kritik kanal
   * outbox'tan gider ve orada bekleyen taraf hatayı görür.
   */
  private emitAfterCommit(events: DomainEvent[]): void {
    for (const event of events) {
      emitDetached(this.eventEmitter, event.name, event.payload);
    }
  }
}
