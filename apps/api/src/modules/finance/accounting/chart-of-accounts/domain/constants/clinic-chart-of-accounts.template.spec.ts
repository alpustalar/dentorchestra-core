import { CLINIC_CHART_OF_ACCOUNTS_TEMPLATE } from './clinic-chart-of-accounts.template';
import { ACCOUNTING_RULES } from '@modules/finance/shared/domain/constants/accounting-rules.constant';

/**
 * Posting kurallarının yazdığı hedef hesaplar şablonda bulunmak ZORUNDADIR (kural 12: doğrulayan
 * kural ile kullanılan kural aynı olmalı). Şablonda olmayan bir hesaba fiş yazan kural ilk
 * kullanımda (canlıda) `AccountNotFound` ile patlar; bu test o açığı derleme-sonrası yakalar.
 */
describe('Klinik hesap planı şablonu ↔ posting hedef hesapları', () => {
  const byCode = new Map(
    CLINIC_CHART_OF_ACCOUNTS_TEMPLATE.map((a) => [a.code, a])
  );

  it.each(Object.entries(ACCOUNTING_RULES.TARGET_ACCOUNTS))(
    '%s (%s) şablonda vardır ve postlanabilirdir',
    (_name, code) => {
      const account = byCode.get(code);
      expect(account).toBeDefined();
      expect(account?.isPostable).toBe(true);
    }
  );

  describe('659 / 659.01 — platform itiraz zararı', () => {
    it('659 yalnız BAŞLIKTIR (postlanamaz), 659.01 onun altında postlanabilir giderdir', () => {
      const header = byCode.get('659');
      const loss = byCode.get('659.01');

      expect(header).toMatchObject({
        parentCode: null,
        isPostable: false,
        type: 'EXPENSE',
        normalSide: 'DEBIT',
      });
      expect(loss).toMatchObject({
        parentCode: '659',
        isPostable: true,
        type: 'EXPENSE',
        normalSide: 'DEBIT',
      });
    });

    it('689’un altına alt hesap AÇILMAMIŞTIR: 689 postlanabilir, bekçi buna izin vermez', () => {
      expect(byCode.get('689')?.isPostable).toBe(true);
      const underOtherLoss = CLINIC_CHART_OF_ACCOUNTS_TEMPLATE.filter(
        (a) => a.parentCode === '689'
      );
      expect(underOtherLoss).toHaveLength(0);
    });
  });
});
