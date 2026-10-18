import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { opsAlertPortFactory } from './notification-event.module';
import { SlackOpsAlertAdapter } from '@modules/platform/notification/infrastructure/delivery/slack-ops-alert.adapter';
import { LogOpsAlertAdapter } from '@modules/platform/notification/infrastructure/delivery/log-ops-alert.adapter';
import { ENV } from '@common/constants/env.constant';

/**
 * Yanlış dallanma "uyarılar sessizce log'da kalıyor" demek olurdu ve bunu ancak
 * bir olay kaçtığında fark ederdik; seçim bu yüzden testle sabitlenir.
 */
describe('opsAlertPortFactory', () => {
  const slack = {} as SlackOpsAlertAdapter;
  const log = {} as LogOpsAlertAdapter;

  const config = (env: Record<string, string | undefined>) =>
    ({ get: (key: string) => env[key] }) as unknown as ConfigService;

  it('webhook tanımlıysa Slack adaptörü seçilir', () => {
    const port = opsAlertPortFactory(
      config({ [ENV.SLACK_OPS_WEBHOOK_URL]: 'https://hooks.slack.com/x' }),
      slack,
      log
    );

    expect(port).toBe(slack);
  });

  it('yalnız CRITICAL kanalı tanımlıysa da Slack seçilir', () => {
    const port = opsAlertPortFactory(
      config({
        [ENV.SLACK_OPS_WEBHOOK_URL_CRITICAL]: 'https://hooks.slack.com/crit',
      }),
      slack,
      log
    );

    expect(port).toBe(slack);
  });

  it('hiçbir webhook yoksa log adaptörüne düşülür', () => {
    const port = opsAlertPortFactory(config({}), slack, log);

    expect(port).toBe(log);
  });

  /**
   * Log'a düşmek **sessiz** olmaz. Ölçüldü: `SLACK_OPS_WEBHOOK_URL` hiçbir ortam
   * dosyasında tanımlı değildi ve `.env.example`'da bile yazılı değildi — yani
   * 40'tan fazla "CRITICAL uyarı çıkar" güvencesi yalnız bir log satırına
   * dayanıyordu ve kimse eksiğin farkına varamıyordu.
   */
  describe('eksik kanal duyurulur', () => {
    let warnSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.spyOn(Logger.prototype, 'log').mockImplementation();
      warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    });

    afterEach(() => jest.restoreAllMocks());

    it('geliştirmede uyarı (warn) seviyesinde', () => {
      opsAlertPortFactory(config({ [ENV.MODE]: 'DEVELOPMENT' }), slack, log);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('YAPILANDIRILMADI')
      );
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('üretimde hata (error) seviyesinde', () => {
      opsAlertPortFactory(config({ [ENV.MODE]: 'PRODUCTION' }), slack, log);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('YAPILANDIRILMADI')
      );
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
