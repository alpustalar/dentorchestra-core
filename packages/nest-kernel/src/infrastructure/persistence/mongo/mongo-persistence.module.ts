import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoTransactionManager } from './mongo-transaction.manager';
import { MESSAGING_MONGO_CONNECTION } from './mongo.connection';
import { MongoOutbox, MongoOutboxSchema } from './outbox/mongo-outbox.schema';
import { MongoOutboxRelay } from './outbox/mongo-outbox.relay';

/**
 * Mongo tarafının transaction + outbox altyapısı. `MongoTransactionManager` handler'lara ek modül importu olmadan
 * inject edilir.
 *
 * `MongoOutboxRelay` outbox'ı boşaltan taraftır ve manager ile birlikte sağlanır:
 * ikisi ayrılırsa `outboxRun` sessizce yarım kalır (event yazılır, dinleyici
 * tetiklenmez).
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: MongoOutbox.name, schema: MongoOutboxSchema }],
      MESSAGING_MONGO_CONNECTION
    ),
  ],
  providers: [MongoTransactionManager, MongoOutboxRelay],
  exports: [MongoTransactionManager, MongoOutboxRelay],
})
export class MongoPersistenceModule {}
