import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { paymentLinkChannelsFactory } from './payment-link-channels';

const config = (values: Record<string, string | undefined>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('paymentLinkChannelsFactory', () => {
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('bayrak yoksa Stripe KAPALI ve seçim duyurulur (sessiz değil)', () => {
    expect(paymentLinkChannelsFactory(config({}))).toEqual({
      stripeEnabled: false,
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('KAPALI'));
  });

  it('anahtar tanımlı olsa bile bayrak yoksa KAPALI (anahtarın varlığı kapı değildir)', () => {
    expect(
      paymentLinkChannelsFactory(config({ STRIPE_SECRET_KEY: 'sk_live_x' }))
    ).toEqual({ stripeEnabled: false });
  });

  it("yalnız 'true' açar: 'false' / '1' / 'TRUE' kapalı kalır", () => {
    for (const value of ['false', '1', 'TRUE', 'yes']) {
      expect(
        paymentLinkChannelsFactory(
          config({
            STRIPE_PAYMENT_LINKS_ENABLED: value,
            STRIPE_SECRET_KEY: 'sk_live_x',
          })
        ).stripeEnabled
      ).toBe(false);
    }
  });

  it('bayrak true ama anahtar yok / none → KAPALI sayılır ve error basılır', () => {
    for (const key of [undefined, 'none']) {
      error.mockClear();
      expect(
        paymentLinkChannelsFactory(
          config({
            STRIPE_PAYMENT_LINKS_ENABLED: 'true',
            STRIPE_SECRET_KEY: key,
          })
        ).stripeEnabled
      ).toBe(false);
      expect(error).toHaveBeenCalled();
    }
  });

  it('bayrak true + anahtar → AÇIK; üretimde error, başka ortamda warn ile duyurulur', () => {
    const open = (mode: string) =>
      paymentLinkChannelsFactory(
        config({
          MODE: mode,
          STRIPE_PAYMENT_LINKS_ENABLED: 'true',
          STRIPE_SECRET_KEY: 'sk_live_x',
        })
      );

    expect(open('PRODUCTION')).toEqual({ stripeEnabled: true });
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('KAPANIŞ AKIŞI YOK')
    );

    error.mockClear();
    expect(open('DEVELOPMENT')).toEqual({ stripeEnabled: true });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('KAPANIŞ AKIŞI YOK')
    );
    expect(error).not.toHaveBeenCalled();
  });
});
