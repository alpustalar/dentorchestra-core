import {
  checkIyzicoCallbackBinding,
  IyzicoCallbackBindingInput,
} from './iyzico-callback-binding.rule';

const base: IyzicoCallbackBindingInput = {
  claimedConversationId: 'rec-1',
  token: 'token-abc',
};

/**
 * Üç `@Public` callback'in (sanal POS taksiti, rezervasyon, abonelik) ortak
 * kapısı. Kural burada kilitlenir çünkü üçü de **aynı sağlayıcı hesabından**
 * gelen token'ları işliyor: birinde kabul edilen bir token diğerinin kaydını da
 * ilerletebilir.
 */
describe('checkIyzicoCallbackBinding', () => {
  describe('yerel token kanıtı', () => {
    it('kayıttaki token gövdedekiyle aynıysa bağ kanıtlanır', () => {
      expect(
        checkIyzicoCallbackBinding({ ...base, storedToken: 'token-abc' })
      ).toEqual({ bound: true });
    });

    it('kayıttaki token FARKLIYSA reddedilir — başka ödemenin token’ı', () => {
      expect(
        checkIyzicoCallbackBinding({
          ...base,
          storedToken: 'token-of-another-payment',
        })
      ).toEqual({ bound: false, reason: 'TOKEN_MISMATCH' });
    });

    it('token çelişkisi, sağlayıcı yankısı doğru olsa bile reddi kaldırmaz', () => {
      // Bir kanıt "hayır" diyorsa diğerinin "evet" demesi kurtarmaz: saldırgan
      // iki alandan birini kontrol edebiliyor olabilir.
      expect(
        checkIyzicoCallbackBinding({
          ...base,
          storedToken: 'token-of-another-payment',
          retrievedConversationId: 'rec-1',
        })
      ).toEqual({ bound: false, reason: 'TOKEN_MISMATCH' });
    });
  });

  describe('sağlayıcı yankısı kanıtı', () => {
    it('yankılanan conversationId gövdedekiyle aynıysa bağ kanıtlanır', () => {
      expect(
        checkIyzicoCallbackBinding({
          ...base,
          retrievedConversationId: 'rec-1',
        })
      ).toEqual({ bound: true });
    });

    it('yankı FARKLIYSA reddedilir', () => {
      expect(
        checkIyzicoCallbackBinding({
          ...base,
          retrievedConversationId: 'rec-2',
        })
      ).toEqual({ bound: false, reason: 'CONVERSATION_MISMATCH' });
    });

    it('yankı çelişkisi, yerel token doğru olsa bile reddi kaldırmaz', () => {
      expect(
        checkIyzicoCallbackBinding({
          ...base,
          storedToken: 'token-abc',
          retrievedConversationId: 'rec-2',
        })
      ).toEqual({ bound: false, reason: 'CONVERSATION_MISMATCH' });
    });
  });

  describe('fail-closed', () => {
    it('hiçbir kanıt yoksa reddedilir', () => {
      // Kanıtsız kabul, kontrolün hiç olmamasıyla aynı şeydir.
      expect(checkIyzicoCallbackBinding(base)).toEqual({
        bound: false,
        reason: 'NO_BINDING_EVIDENCE',
      });
    });

    it('boş string kanıt sayılmaz', () => {
      expect(
        checkIyzicoCallbackBinding({
          ...base,
          storedToken: '',
          retrievedConversationId: '',
        })
      ).toEqual({ bound: false, reason: 'NO_BINDING_EVIDENCE' });
    });

    it('iki kanıt birlikte doğruysa bağ kanıtlanır', () => {
      expect(
        checkIyzicoCallbackBinding({
          ...base,
          storedToken: 'token-abc',
          retrievedConversationId: 'rec-1',
        })
      ).toEqual({ bound: true });
    });
  });
});
