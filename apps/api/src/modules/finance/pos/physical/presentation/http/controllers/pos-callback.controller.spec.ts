import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { PosCallbackController } from './pos-callback.controller';
import { HandlePosCallbackCommand } from '@modules/finance/pos/physical/application/commands/handle-pos-callback/handle-pos-callback.command';
import { ENV } from '@common/constants';

/**
 * Bu uç kimlik doğrulaması olmadan çağrılır ve bir PENDING POS işlemini
 * SUCCESS'e çevirebilir: para alınmadan tahsilat + gelir + hasta borcu kapatma
 * yazdırabilir. Önceden **hiçbir** doğrulama yoktu (ne guard, ne imza).
 */
describe('PosCallbackController — imza kapısı', () => {
  const SECRET = 'pos-callback-secret';
  const rawBody = Buffer.from(JSON.stringify({ status: 'SUCCESS' }));
  const validSignature = `sha256=${createHmac('sha256', SECRET)
    .update(rawBody)
    .digest('hex')}`;

  const make = (secret?: string) => {
    const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
    const configService = {
      get: jest.fn((key: string) =>
        key === ENV.POS_CALLBACK_SECRET ? secret : undefined
      ),
    };
    const controller = new PosCallbackController(
      commandBus as never,
      configService as never
    );
    return { controller, commandBus };
  };

  const req = (body: Buffer | undefined) =>
    ({ rawBody: body, body: { status: 'SUCCESS' } }) as never;

  it('geçerli imzada komutu dispatch eder', async () => {
    const { controller, commandBus } = make(SECRET);

    await controller.handle('ext-1', req(rawBody), validSignature);

    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.any(HandlePosCallbackCommand)
    );
  });

  it('imza yoksa reddeder', async () => {
    const { controller, commandBus } = make(SECRET);

    await expect(
      controller.handle('ext-1', req(rawBody), undefined)
    ).rejects.toThrow(ForbiddenException);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('imza geçersizse reddeder', async () => {
    const { controller, commandBus } = make(SECRET);

    await expect(
      controller.handle('ext-1', req(rawBody), 'sha256=deadbeef')
    ).rejects.toThrow(ForbiddenException);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('imza anahtarı yapılandırılmamışsa FAIL-CLOSED: isteği kabul etmez', async () => {
    // Sessizce kabul etmek bu ucu açık bir para kapısı yapardı.
    const { controller, commandBus } = make(undefined);

    await expect(
      controller.handle('ext-1', req(rawBody), validSignature)
    ).rejects.toThrow(ServiceUnavailableException);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('ham gövde okunamazsa reddeder (imza byte üzerinden hesaplanır)', async () => {
    const { controller, commandBus } = make(SECRET);

    await expect(
      controller.handle('ext-1', req(undefined), validSignature)
    ).rejects.toThrow(BadRequestException);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
