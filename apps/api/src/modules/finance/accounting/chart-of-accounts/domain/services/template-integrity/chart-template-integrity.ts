import { Account as IAccount } from '@shared';
import {
  AccountTemplateNode,
  CLINIC_CHART_OF_ACCOUNTS_TEMPLATE,
} from '@modules/finance/accounting/chart-of-accounts/domain/constants/clinic-chart-of-accounts.template';
import {
  AccountTemplateMismatchException,
  AccountTemplateParentMissingException,
} from '@modules/finance/accounting/chart-of-accounts/domain/exceptions/chart-of-accounts.exceptions';

/** Şablonla defterdeki hesabın ayrıştığı tek alan. */
export interface ChartDriftField {
  field: 'name' | 'type' | 'normalSide' | 'isPostable' | 'requiresParty';
  expected: string;
  actual: string;
}

export interface ChartDriftRow {
  code: string;
  accountId: string;
  fields: ChartDriftField[];
}

export interface ChartDriftReport {
  clinicId: string;
  /** Şablonda olup defterde hiç olmayan kodlar (kurulum çalıştırılmalı). */
  missingCodes: string[];
  /** Defterde olup şablonda olmayan kodlar (elle açılmış ya da şablondan çıkarılmış). */
  extraCodes: string[];
  /** Kodu aynı ama nitelikleri ayrışmış hesaplar. */
  drifted: ChartDriftRow[];
}

/**
 * Hesap planı şablonu ile bir defterin **fiilî** hesap planını karşılaştırır.
 *
 * Neden gerekli: `initialize-chart-of-accounts` idempotent ve **yalnız ekler** —
 * mevcut hesapların niteliklerine hiç dokunmaz. Şablon yaşayan bir dosya (TDHP
 * genişledikçe düzenleniyor), dolayısıyla bir alan düzeltildiğinde **yeni açılan
 * klinikler yeni davranışı, eski defterler eskisini** taşır ve bu fark hiçbir
 * yerde görünmez. Somut sonuç: `requiresParty` false→true düzeltildiğinde yeni
 * klinikler 120/320'de cari zorunlu tutar, eski defterler party'siz satır yazmaya
 * devam eder → cari mutabakatı yapılamaz. Aynı şekilde `isPostable` sapması aynı
 * fişi bir klinikte kabul edip diğerinde reddeder.
 *
 * Rapor **otomatik düzeltme yapmaz**: `type`/`normalSide` değişikliği geçmiş
 * hareketlerin raporlardaki işaretini geriye dönük çevirir; hangi sapmanın
 * düzeltilip hangisinin defterin gerçeği olarak kabul edileceği muhasebe kararıdır.
 */
export class ChartTemplateIntegrity {
  /**
   * Şablonun kendi tutarlılığı: her `parentCode` şablonda var mı ve alt hesabın
   * tip/yönü üst hesapla uyuşuyor mu? `Account.buildChartFromTemplate` bunu zaten
   * kontrol ediyor ama **yalnız çağrıldığında** — yani bozuk bir şablon düzenlemesi
   * ilk klinik kurulumuna kadar (canlıda, transaction içinde) gizli kalır.
   * Bu metot açılışta çağrılır: hata deploy anında çıkar.
   */
  static assertTemplateIsConsistent(
    template: readonly AccountTemplateNode[] = CLINIC_CHART_OF_ACCOUNTS_TEMPLATE
  ): void {
    const byCode = new Map(template.map((node) => [node.code, node]));

    for (const node of template) {
      if (!node.parentCode) continue;

      const parent = byCode.get(node.parentCode);
      if (!parent) {
        throw new AccountTemplateParentMissingException(
          node.code,
          node.parentCode
        );
      }
      if (parent.type !== node.type || parent.normalSide !== node.normalSide) {
        throw new AccountTemplateMismatchException(node.code, parent.code);
      }
      // Alt hesabın kodu üst hesabın kodunu önek olarak taşımalı: ağaç (`parentId`)
      // ile kod hiyerarşisi ayrışırsa kod önekine göre toplayan rapor ile ağaca
      // göre toplayan rapor farklı sonuç verir.
      if (!node.code.startsWith(`${node.parentCode}.`)) {
        throw new AccountTemplateMismatchException(node.code, parent.code);
      }
      // Alt hesabı olan hesap kolektiftir: doğrudan fiş kabul etmemeli, yoksa
      // aynı tutar hem üstte hem altta görünüp roll-up'ta iki kez sayılır.
      if (parent.isPostable) {
        throw new AccountTemplateMismatchException(node.code, parent.code);
      }
    }
  }

  static detectDrift(params: {
    clinicId: string;
    accounts: IAccount[];
    template?: readonly AccountTemplateNode[];
  }): ChartDriftReport {
    const template = params.template ?? CLINIC_CHART_OF_ACCOUNTS_TEMPLATE;
    const templateByCode = new Map(template.map((node) => [node.code, node]));
    const actualByCode = new Map(
      params.accounts.map((account) => [account.code, account])
    );

    const drifted: ChartDriftRow[] = [];
    for (const [code, node] of templateByCode) {
      const actual = actualByCode.get(code);
      if (!actual) continue;

      const fields: ChartDriftField[] = [];
      const compare = (
        field: ChartDriftField['field'],
        expected: string | boolean,
        value: string | boolean
      ) => {
        if (expected !== value) {
          fields.push({
            field,
            expected: String(expected),
            actual: String(value),
          });
        }
      };

      compare('name', node.name, actual.name);
      compare('type', node.type, actual.type);
      compare('normalSide', node.normalSide, actual.normalSide);
      compare('isPostable', node.isPostable, actual.isPostable);
      compare(
        'requiresParty',
        node.requiresParty ?? false,
        actual.requiresParty
      );

      if (fields.length > 0) {
        drifted.push({ code, accountId: actual.id, fields });
      }
    }

    return {
      clinicId: params.clinicId,
      missingCodes: [...templateByCode.keys()].filter(
        (code) => !actualByCode.has(code)
      ),
      extraCodes: [...actualByCode.keys()].filter(
        (code) => !templateByCode.has(code)
      ),
      drifted,
    };
  }
}
