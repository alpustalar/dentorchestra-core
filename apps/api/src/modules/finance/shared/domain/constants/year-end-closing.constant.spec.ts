import {
  COST_REFLECTION_GROUPS,
  findCostReflectionGroup,
  isCostAccountOfGroup,
  isReflectionAccount,
  isResultAccountCode,
} from './year-end-closing.constant';
import { ACCOUNTING_RULES } from './accounting-rules.constant';
import { CLINIC_CHART_OF_ACCOUNTS_TEMPLATE } from '@modules/finance/accounting/chart-of-accounts/domain/constants/clinic-chart-of-accounts.template';

/**
 * Yansıtma eşlemesi ile hesap planı şablonunun sözleşmesi (kural 12: doğrulayan kural ile
 * kullanılan kural aynı kümeden beslenir).
 *
 * Şablona yeni bir 7xx hesap eklenip eşlemeye eklenmezse, o hesabın bakiyesi yıl sonunda
 * yansıtılmadan 690'a kapanırdı — kâr aynı çıkar, kesin mizanda maliyet 6. sınıfta değil 7.
 * sınıfta kalır ve fiş dengeli olduğu için hiçbir kontrol yakalamaz. Bu test o ayrışmayı
 * derleme sonrası yakalar; çalışma anında da bakiyesi olan eşlemesiz hesap kapanışı durdurur.
 */
describe('COST_REFLECTION_GROUPS ↔ hesap planı şablonu', () => {
  const byCode = new Map(
    CLINIC_CHART_OF_ACCOUNTS_TEMPLATE.map((a) => [a.code, a])
  );

  it('şablondaki HER 7xx hesap bir grubun maliyet ya da yansıtma hesabıdır', () => {
    const sevenSeries = CLINIC_CHART_OF_ACCOUNTS_TEMPLATE.filter((a) =>
      a.code.startsWith('7')
    );
    expect(sevenSeries.length).toBeGreaterThan(0);

    const unmapped = sevenSeries
      .filter(
        (a) =>
          findCostReflectionGroup(a.code) === null &&
          !isReflectionAccount(a.code)
      )
      .map((a) => a.code);

    expect(unmapped).toEqual([]);
  });

  it.each(COST_REFLECTION_GROUPS.map((g) => [g.costAccountCode, g]))(
    '%s grubu: maliyet hesabı var, yansıtma hesabı postlanabilir ve alacak karakterli, hedef postlanabilir giderdir',
    (_name, group) => {
      expect(byCode.get(group.costAccountCode)).toBeDefined();

      const reflection = byCode.get(group.reflectionAccountCode);
      expect(reflection).toMatchObject({
        isPostable: true,
        normalSide: 'CREDIT',
        type: 'EXPENSE',
      });

      const target = byCode.get(group.targetAccountCode);
      expect(target).toMatchObject({
        isPostable: true,
        normalSide: 'DEBIT',
        type: 'EXPENSE',
      });
      // Hedefler 6. sınıf, kaynaklar 7. sınıf.
      expect(group.targetAccountCode.startsWith('6')).toBe(true);
      expect(group.costAccountCode.startsWith('7')).toBe(true);
    }
  );

  it('bir hesap iki grupta birden değildir (yansıtma iki kez yazılmaz)', () => {
    const sevenSeries = CLINIC_CHART_OF_ACCOUNTS_TEMPLATE.filter((a) =>
      a.code.startsWith('7')
    );
    for (const account of sevenSeries) {
      const owners = COST_REFLECTION_GROUPS.filter((g) =>
        isCostAccountOfGroup(account.code, g)
      );
      expect(owners.length).toBeLessThanOrEqual(1);
    }
  });

  it('yansıtma hesabı kendi grubunun maliyet hesabı sayılmaz (771, 770 grubuna girmez)', () => {
    expect(findCostReflectionGroup('771')).toBeNull();
    expect(findCostReflectionGroup('741')).toBeNull();
    expect(findCostReflectionGroup('740.03')?.targetAccountCode).toBe('622');
    expect(findCostReflectionGroup('770')?.targetAccountCode).toBe('632');
  });

  it('tüm hedefler 6. sınıf sonuç hesabıdır: 690 kapanışı bunları kapatır', () => {
    for (const group of COST_REFLECTION_GROUPS) {
      expect(isResultAccountCode(group.targetAccountCode)).toBe(true);
    }
  });
});

describe('329 — GRNI tahakkuk hesabı', () => {
  const byCode = new Map(
    CLINIC_CHART_OF_ACCOUNTS_TEMPLATE.map((a) => [a.code, a])
  );

  it('şablonda var: cari istemeyen, postlanabilir, alacak karakterli yükümlülük', () => {
    expect(
      byCode.get(ACCOUNTING_RULES.TARGET_ACCOUNTS.GRNI_ACCRUAL_329)
    ).toMatchObject({
      code: '329',
      isPostable: true,
      normalSide: 'CREDIT',
      type: 'LIABILITY',
    });
    // Cari (tedarikçi) bağlanmaz: 320'ye cariyle yazılan tahakkuk cari ekstrelerde faturada
    // olmayan bir borç gösterirdi. 329 bu yüzden carisiz.
    expect(byCode.get('329')?.requiresParty ?? false).toBe(false);
  });
});
