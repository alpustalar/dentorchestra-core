import { isSensitiveKey, REDACTED, redactSensitive } from './redact-sensitive';

/**
 * Maskelemenin iki tüketicisi var (HTTP gövde log'u ve sağlayıcı ham yanıtı) ve
 * ikisi de aynı listeyi kullanıyor. Bu suite listenin **sınırlarını** kilitler:
 * fazla maskeleme log'u işe yaramaz yapar, az maskeleme credential sızdırır.
 */
describe('redactSensitive', () => {
  describe('anahtar eşleşmesi', () => {
    it('tam eşleşen credential anahtarları', () => {
      ['token', 'cardToken', 'card_user_key', 'cvc', 'iban', 'password'].forEach(
        (key) => expect(isSensitiveKey(key)).toBe(true)
      );
    });

    it('ek bazlı eşleşme: sağlayıcı adı önceden bilinemez', () => {
      ['iyzicoToken', 'fbToken', 'clientSecret', 'stripeApiKey'].forEach((key) =>
        expect(isSensitiveKey(key)).toBe(true)
      );
    });

    it('tanı için gereken maskeli alanlar maskelenMEZ', () => {
      // `card` gibi geniş bir parça eşleştirilseydi bunlar da gidecek ve log
      // tanı değerini kaybedecekti.
      ['maskedCardNumber', 'lastFourDigits', 'binNumber', 'cardAssociation'].forEach(
        (key) => expect(isSensitiveKey(key)).toBe(false)
      );
    });

    it('ek eşleşmesi anahtarın TAMAMI olduğunda tam eşleşmeye düşer', () => {
      expect(isSensitiveKey('secret')).toBe(false); // 'secret' tam listede yok
      expect(isSensitiveKey('webhookSecret')).toBe(true);
    });
  });

  describe('iç içe yapı', () => {
    it('derin anahtarları da maskeler (tek seviyeli liste bunları kaçırıyordu)', () => {
      const result = redactSensitive({
        status: 'success',
        paymentCard: { cardToken: 'ctk', lastFourDigits: '0006' },
        items: [{ token: 'abc' }, { price: '10.00' }],
      });

      expect(result).toEqual({
        status: 'success',
        paymentCard: { cardToken: REDACTED, lastFourDigits: '0006' },
        items: [{ token: REDACTED }, { price: '10.00' }],
      });
    });

    it('girdiyi MUTASYONA uğratmaz', () => {
      // Aynı nesne başka amaçla hâlâ okunuyor olabilir (kart token'larını
      // çıkarmak gibi) — maskeleme kopya üretir.
      const original = { cardToken: 'ctk', nested: { token: 't' } };
      redactSensitive(original);

      expect(original.cardToken).toBe('ctk');
      expect(original.nested.token).toBe('t');
    });

    it('sınıf örneklerinin içine girmez (Date olduğu gibi geçer)', () => {
      const date = new Date('2026-01-01T00:00:00Z');
      const result = redactSensitive({ createdAt: date, token: 'x' });

      expect(result.createdAt).toBe(date);
      expect(result.token).toBe(REDACTED);
    });

    it('ilkel değerler ve null olduğu gibi döner', () => {
      expect(redactSensitive('metin')).toBe('metin');
      expect(redactSensitive(42)).toBe(42);
      expect(redactSensitive(null)).toBeNull();
      expect(redactSensitive(undefined)).toBeUndefined();
    });

    it('aşırı derin yapıda durur (sonsuz iş yapmaz)', () => {
      // 10 seviye: sınır 8 → en derindeki maskelenmez ama çağrı patlamaz.
      let deep: Record<string, unknown> = { token: 'en-derin' };
      for (let i = 0; i < 10; i++) deep = { nested: deep };

      expect(() => redactSensitive(deep)).not.toThrow();
    });
  });
});
