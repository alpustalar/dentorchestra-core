import { ACCOUNTING_RULES } from './accounting-rules.constant';

/**
 * 7/A (fonksiyon esaslı) maliyet hesaplarının yıl sonu **yansıtma eşlemesi** — tek kaynak.
 *
 * 7. sınıf hesaplar dönem içinde gideri FONKSİYONUNA göre biriktirir (hizmet üretim, pazarlama,
 * genel yönetim); dönem sonunda 6. sınıftaki karşılığına yansıtılır (TDHP):
 *
 *   B 622 Satılan Hizmet Maliyeti       / A 741 Hizmet Üretim Maliyeti Yansıtma
 *   B 741                               / A 740.xx
 *
 * (761 → 631 ve 771 → 632 aynı biçimde.) Dönem içinde hiçbir posting kuralı yansıtma hesaplarına
 * ya da 6. sınıf hedeflerine yazmaz; yalnız yıl sonu kapanışı (`CLOSING` fişler) yazar.
 *
 * Bu eşleme eksik olursa 7. sınıf bir hesap yansıtılmadan 690'a kapanırdı: kâr aynı çıkar, ama
 * kapanmış yılın kesin mizanında maliyet 6. sınıfta değil 7. sınıfta kalmış görünür. Bu yüzden
 * şablondaki her 7xx hesabı bu eşlemede bulunmak zorundadır (`year-end-closing.constant.spec.ts`
 * şablona karşı zorlar) ve bakiyesi olan eşlemesiz hesap kapanışı durdurur
 * (`UnmappedCostAccountException`) — sessizce doğrudan 690'a gitmez.
 */
export interface CostReflectionGroup {
  /** Maliyetin biriktiği hesap: kendisi ve `<kod>.xx` alt hesapları. */
  costAccountCode: string;
  /** Yansıtma (kontra) hesabı. Bakiyesi yıl sonunda sıfırlanır. */
  reflectionAccountCode: string;
  /** Yansıtmanın borçlandığı 6. sınıf hesabı. */
  targetAccountCode: string;
}

export const COST_REFLECTION_GROUPS: readonly CostReflectionGroup[] = [
  {
    costAccountCode: '740',
    reflectionAccountCode: '741',
    targetAccountCode: '622',
  },
  {
    costAccountCode: '760',
    reflectionAccountCode: '761',
    targetAccountCode: '631',
  },
  {
    costAccountCode: '770',
    reflectionAccountCode: '771',
    targetAccountCode: '632',
  },
];

/** Kod, grubun maliyet hesabı mı (kendisi ya da `.xx` alt hesabı)? */
export function isCostAccountOfGroup(
  code: string,
  group: CostReflectionGroup
): boolean {
  return (
    code === group.costAccountCode ||
    code.startsWith(`${group.costAccountCode}.`)
  );
}

/** Kodun ait olduğu yansıtma grubu (maliyet hesabı olarak) — yoksa `null`. */
export function findCostReflectionGroup(
  code: string
): CostReflectionGroup | null {
  return (
    COST_REFLECTION_GROUPS.find((group) => isCostAccountOfGroup(code, group)) ??
    null
  );
}

/** Kod bir yansıtma (kontra) hesabı mı? */
export function isReflectionAccount(code: string): boolean {
  return COST_REFLECTION_GROUPS.some(
    (group) => group.reflectionAccountCode === code
  );
}

/**
 * Yıl sonu kapanışının hesap kodu kuralları.
 *
 * Sonuç hesapları: 6 ve 7 sınıfı, **69x özet hariç** (690 havuzun kendisi kapatılmaz).
 */
export function isResultAccountCode(code: string): boolean {
  return (
    ACCOUNTING_RULES.RESULT_ACCOUNT_PREFIXES.some((prefix) =>
      code.startsWith(prefix)
    ) && !code.startsWith(ACCOUNTING_RULES.SUMMARY_ACCOUNT_PREFIX)
  );
}
