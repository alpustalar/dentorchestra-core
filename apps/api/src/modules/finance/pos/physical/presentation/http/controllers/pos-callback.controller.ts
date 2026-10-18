import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Headers,
  Logger,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { HandlePosCallbackCommand } from '@modules/finance/pos/physical/application/commands/handle-pos-callback/handle-pos-callback.command';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { Public } from '@common/decorators/public.decorator';
import { ENV, THROTTLE_CONFIG } from '@common/constants';
import { CryptoManager } from '@src/infrastructure/security/crypto/crypto.manager';

/**
 * Fiziksel POS sağlayıcısının işlem sonucunu bildirdiği uç.
 *
 * ⚠️ Bu uç **kimliği doğrulanmış bir kullanıcı olmadan** çağrılır (cihaz/banka
 * sunucusu çağırır) ve çağrı bir PENDING işlemi SUCCESS'e çevirebilir — yani
 * para alınmadan tahsilat, gelir ve hasta borcu kapatma yazdırabilir. Bu yüzden
 * gövde **HMAC-SHA256 imzasıyla** doğrulanır ve kapı **fail-closed**'dur:
 * imza anahtarı tanımlı değilse istek kabul EDİLMEZ (önceden hiçbir doğrulama
 * yoktu; uç yalnız sağlayıcı adapter'ı henüz yazılmadığı için sömürülemiyordu).
 */
@Controller('callback')
export class PosCallbackController {
  private readonly logger = new Logger(PosCallbackController.name);

  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly configService: ConfigService
  ) {}

  @Post(':externalRef')
  @Public()
  @Throttle(THROTTLE_CONFIG.SENSITIVE_ENDPOINT)
  async handle(
    @Param('externalRef') externalRef: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-pos-signature') signature?: string
  ) {
    // Ham gövde şart: imza, JSON'un yeniden serileştirilmiş hâli üzerinden değil
    // byte'ları üzerinden hesaplanır (alan sırası/boşluk farkı imzayı bozar).
    if (!req.rawBody) {
      throw new BadRequestException('Ham gövde okunamadı.');
    }

    const secret = this.configService.get<string>(ENV.POS_CALLBACK_SECRET);
    if (!secret) {
      // Fail-closed: anahtar yoksa imza doğrulanamaz, dolayısıyla çağrı da
      // kabul edilemez. Sessizce kabul etmek bu ucu açık bir para kapısı yapar.
      this.logger.error(
        `POS callback reddedildi: ${ENV.POS_CALLBACK_SECRET} tanımlı değil. externalRef=${externalRef}`
      );
      throw new ServiceUnavailableException(
        'POS callback imza anahtarı yapılandırılmamış.'
      );
    }

    if (
      !CryptoManager.verifyWebhookSignature(
        req.rawBody,
        signature ?? '',
        secret
      )
    ) {
      this.logger.warn(
        `POS callback imzası geçersiz: externalRef=${externalRef}`
      );
      throw new ForbiddenException('Geçersiz callback imzası.');
    }

    this.logger.log(`POS callback alındı: externalRef=${externalRef}`);

    return this.commandBus.execute(
      new HandlePosCallbackCommand({ externalRef, rawPayload: req.body })
    );
  }
}
