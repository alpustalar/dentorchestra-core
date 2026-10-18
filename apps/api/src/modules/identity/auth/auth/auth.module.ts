import { Global, Logger, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { FirebaseModule } from '@src/infrastructure/firebase/firebase.module';
import { PrismaModule } from '@src/infrastructure/persistence/prisma/prisma.module';
import { AuthGuard } from '@modules/identity/auth/auth/guards';
import { UserModule } from '@modules/identity/user/user.module';
import { AuthCacheService } from '@modules/identity/auth/auth/infrastructure/cache/auth-cache.service';
import {
  ACTOR_CONTEXT_RESOLVER,
  KernelAuthModule,
  TOKEN_VERIFIER,
} from '@src/auth';
import { FirebaseTokenVerifier } from '@modules/identity/auth/auth/infrastructure/adapters/firebase-token-verifier.adapter';
import { DbActorContextResolver } from '@modules/identity/auth/auth/infrastructure/adapters/db-actor-context.resolver';
import { CleanAuthCacheOnUserUpdatedListener } from '@modules/identity/auth/auth/infrastructure/events/listeners/clean-auth-cache-on-user-updated.listener';

/**
 * Çekirdeğin auth mantığını (`KernelAuthModule`) bu app'in kimlik kaynaklarına bağlar:
 * token doğrulaması Firebase'e, cache-miss'te `ActorContext` çözümlemesi kullanıcı/rol
 * tablolarına. `apps/messaging` aynı çekirdeği farklı adapter'larla (NATS) bağlayacak.
 *
 * `TokenAuthGuard` de dışa açılır — messaging'in kullandığı guard'ın aynısı; api'nin
 * kendi `AuthGuard`'ı 65 dosyada kullanıldığı için imzası korunuyor.
 */
@Global()
@Module({
  imports: [
    FirebaseModule,
    PrismaModule,
    UserModule,
    KernelAuthModule.forRoot({
      // Adapter'ların bağımlılıkları: FirebaseService ve kullanıcı sorgusu.
      imports: [FirebaseModule, PrismaModule, UserModule],
      tokenVerifier: {
        provide: TOKEN_VERIFIER,
        useClass: FirebaseTokenVerifier,
      },
      actorContextResolver: {
        provide: ACTOR_CONTEXT_RESOLVER,
        useClass: DbActorContextResolver,
      },
    }),
  ],
  providers: [
    AuthService,
    AuthGuard,
    Logger,
    AuthCacheService,
    // Kullanıcı güncellenince/pasifleşince actor-context cache'i düşer. Kayıtlı
    // olmazsa yetkisi alınmış kullanıcı TTL boyunca yetkili kalırdı.
    CleanAuthCacheOnUserUpdatedListener,
  ],
  // `TokenAuthGuard` doğrudan export edilemez (bu modülün sağlayıcısı değil);
  // onu sağlayan modül yeniden dışa açılır.
  exports: [AuthGuard, AuthService, KernelAuthModule],
})
export class AuthModule {}
