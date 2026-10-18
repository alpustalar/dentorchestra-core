/** Kampanya-başı ROI kırılımı (reklam harcaması vs. kazanılan hasta geliri). */
export interface RoiCampaignBreakdown {
  campaignId: string;
  campaignName: string;
  spend: number;
  attributedLeads: number; // dönemde bu kampanyadan gelen, hastaya dönüşmüş lead sayısı
  convertedPatients: number; // distinct hasta
  revenue: number; // bu hastaların dönem içi geliri
  roas: number; // revenue / spend
  roiPercent: number; // (revenue - spend) / spend * 100
}

/** Bir dönemin ROI toplamları. */
export interface RoiPeriodTotals {
  spend: number;
  revenue: number;
  netProfit: number; // revenue - spend
  roas: number;
  roiPercent: number;
  attributedLeads: number;
  convertedPatients: number;
  /**
   * `revenue` ve `roas` bu para biriminde hesaplanır (kliniğin fonksiyonel
   * para birimi). Cari defter geliri para birimi başına tutulduğu için tek bir
   * orana ancak tek para birimi girebilir — kur uydurulmaz.
   */
  revenueCurrency: string;
  /**
   * Dönemde görülen ama orana **dahil edilmeyen** para birimleri. Boş değilse
   * gerçek gelir rapordaki `revenue`den yüksektir; arayüz bunu göstermelidir.
   */
  excludedRevenueCurrencies: string[];
}

/** Ajans ROI raporu — cari dönem + önceki eşit dönem + değişim yüzdeleri + kampanya kırılımı. */
export interface AgencyRoiReport {
  period: { from: Date; to: Date };
  current: RoiPeriodTotals;
  previous: RoiPeriodTotals;
  deltas: {
    spendPct: number; // önceki döneme göre % değişim
    revenuePct: number;
    roasPct: number;
  };
  campaigns: RoiCampaignBreakdown[];
}
