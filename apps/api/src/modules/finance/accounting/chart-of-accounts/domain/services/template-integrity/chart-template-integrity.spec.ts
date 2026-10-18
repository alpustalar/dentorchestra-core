import {
  Account as IAccount,
  AccountSideSchema,
  AccountTypeSchema,
} from '@shared';
import { ChartTemplateIntegrity } from './chart-template-integrity';
import {
  CLINIC_CHART_OF_ACCOUNTS_TEMPLATE,
  AccountTemplateNode,
} from '@modules/finance/accounting/chart-of-accounts/domain/constants/clinic-chart-of-accounts.template';
import {
  AccountTemplateMismatchException,
  AccountTemplateParentMissingException,
} from '@modules/finance/accounting/chart-of-accounts/domain/exceptions/chart-of-accounts.exceptions';

const { ASSET, REVENUE } = AccountTypeSchema.enum;
const { DEBIT, CREDIT } = AccountSideSchema.enum;

describe('ChartTemplateIntegrity', () => {
  describe('assertTemplateIsConsistent', () => {
    it('gerçek klinik şablonu tutarlıdır', () => {
      // Bu test şablonu düzenleyen herkesin ağını kurar: bozuk bir düzenleme
      // aksi hâlde ilk klinik kurulumuna kadar (canlıda) gizli kalırdı.
      expect(() =>
        ChartTemplateIntegrity.assertTemplateIsConsistent()
      ).not.toThrow();
      expect(CLINIC_CHART_OF_ACCOUNTS_TEMPLATE.length).toBeGreaterThan(0);
    });

    it('şablonda olmayan üst hesaba işaret eden düğümü reddeder', () => {
      const template: AccountTemplateNode[] = [
        {
          code: '600.01',
          name: 'Alt',
          parentCode: '600',
          type: REVENUE,
          normalSide: CREDIT,
          isPostable: true,
        },
      ];

      expect(() =>
        ChartTemplateIntegrity.assertTemplateIsConsistent(template)
      ).toThrow(AccountTemplateParentMissingException);
    });

    it('üst hesapla tip/yön uyuşmazlığını reddeder', () => {
      const template: AccountTemplateNode[] = [
        {
          code: '600',
          name: 'Üst',
          parentCode: null,
          type: REVENUE,
          normalSide: CREDIT,
          isPostable: false,
        },
        {
          code: '600.01',
          name: 'Alt',
          parentCode: '600',
          type: ASSET,
          normalSide: DEBIT,
          isPostable: true,
        },
      ];

      expect(() =>
        ChartTemplateIntegrity.assertTemplateIsConsistent(template)
      ).toThrow(AccountTemplateMismatchException);
    });

    it('kodu üst hesabın kodunu önek olarak taşımayan alt hesabı reddeder', () => {
      // Ağaç ile kod hiyerarşisi ayrışırsa, kod önekine göre toplayan rapor ile
      // ağaca göre toplayan rapor aynı defterde farklı sonuç verir.
      const template: AccountTemplateNode[] = [
        {
          code: '600',
          name: 'Üst',
          parentCode: null,
          type: REVENUE,
          normalSide: CREDIT,
          isPostable: false,
        },
        {
          code: '700.01',
          name: 'Alt',
          parentCode: '600',
          type: REVENUE,
          normalSide: CREDIT,
          isPostable: true,
        },
      ];

      expect(() =>
        ChartTemplateIntegrity.assertTemplateIsConsistent(template)
      ).toThrow(AccountTemplateMismatchException);
    });

    it('alt hesabı olan hesabın fiş kabul etmesini reddeder', () => {
      // Kolektif hesaba doğrudan fiş atılırsa aynı tutar hem üstte hem altta
      // görünür ve roll-up'ta iki kez sayılır.
      const template: AccountTemplateNode[] = [
        {
          code: '600',
          name: 'Üst',
          parentCode: null,
          type: REVENUE,
          normalSide: CREDIT,
          isPostable: true,
        },
        {
          code: '600.01',
          name: 'Alt',
          parentCode: '600',
          type: REVENUE,
          normalSide: CREDIT,
          isPostable: true,
        },
      ];

      expect(() =>
        ChartTemplateIntegrity.assertTemplateIsConsistent(template)
      ).toThrow(AccountTemplateMismatchException);
    });
  });

  describe('detectDrift', () => {
    const template: AccountTemplateNode[] = [
      {
        code: '120',
        name: 'Alıcılar',
        parentCode: null,
        type: ASSET,
        normalSide: DEBIT,
        isPostable: true,
        requiresParty: true,
      },
      {
        code: '100',
        name: 'Kasa',
        parentCode: null,
        type: ASSET,
        normalSide: DEBIT,
        isPostable: true,
      },
    ];

    const account = (over: Partial<IAccount>): IAccount =>
      ({
        id: 'acc-1',
        clinicId: 'clinic-1',
        organizationId: 'org-1',
        parentId: null,
        code: '120',
        name: 'Alıcılar',
        type: ASSET,
        normalSide: DEBIT,
        isPostable: true,
        requiresParty: true,
        currency: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...over,
      }) as IAccount;

    it('şablonla birebir aynı defterde sapma bulmaz', () => {
      const report = ChartTemplateIntegrity.detectDrift({
        clinicId: 'clinic-1',
        accounts: [
          account({}),
          account({
            id: 'acc-2',
            code: '100',
            name: 'Kasa',
            requiresParty: false,
          }),
        ],
        template,
      });

      expect(report.drifted).toEqual([]);
      expect(report.missingCodes).toEqual([]);
      expect(report.extraCodes).toEqual([]);
    });

    it('requiresParty sapmasını alan alan bildirir', () => {
      // Somut senaryo: şablonda 120 için cari zorunlu kılındı, eski defter hâlâ
      // party'siz satır kabul ediyor → cari mutabakatı yapılamaz.
      const report = ChartTemplateIntegrity.detectDrift({
        clinicId: 'clinic-1',
        accounts: [account({ requiresParty: false })],
        template,
      });

      expect(report.drifted).toHaveLength(1);
      expect(report.drifted[0].code).toBe('120');
      expect(report.drifted[0].fields).toEqual([
        { field: 'requiresParty', expected: 'true', actual: 'false' },
      ]);
      // 100 defterde yok → kurulum komutu çalıştırılmalı.
      expect(report.missingCodes).toEqual(['100']);
    });

    it('şablonda olmayan (elle açılmış) hesabı fazlalık olarak bildirir', () => {
      const report = ChartTemplateIntegrity.detectDrift({
        clinicId: 'clinic-1',
        accounts: [
          account({}),
          account({
            id: 'acc-2',
            code: '100',
            name: 'Kasa',
            requiresParty: false,
          }),
          account({ id: 'acc-3', code: '120.01', name: 'Alıcılar - Yurtiçi' }),
        ],
        template,
      });

      // Alt defter hesapları meşru: bu satır "düzelt" değil "bilgi"dir.
      expect(report.extraCodes).toEqual(['120.01']);
      expect(report.drifted).toEqual([]);
    });
  });
});
