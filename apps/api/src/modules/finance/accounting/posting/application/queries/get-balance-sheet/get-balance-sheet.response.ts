import { QueryResponse } from '@shared/common/response/response.interface';

export interface BalanceSheetReportLine {
  code: string;
  name: string;
  amount: string;
}

export interface BalanceSheetReportSection {
  lines: BalanceSheetReportLine[];
  total: string;
}

/** Bilanço — Aktif (1+2) = Pasif (3+4) + Öz Kaynaklar (5) + Dönem Sonucu. */
export interface BalanceSheetReport {
  clinicId: string;
  /** Fotoğrafın çekildiği an (gün sonuna genişletilmiş). Verilmezse tüm defter. */
  asOf: Date | null;

  currentAssets: BalanceSheetReportSection; // dönen varlıklar (1)
  nonCurrentAssets: BalanceSheetReportSection; // duran varlıklar (2)
  totalAssets: string; // AKTİF

  shortTermLiabilities: BalanceSheetReportSection; // kısa vadeli yabancı kaynaklar (3)
  longTermLiabilities: BalanceSheetReportSection; // uzun vadeli yabancı kaynaklar (4)
  equity: BalanceSheetReportSection; // öz kaynaklar (5)
  periodResult: string; // dönem net kârı/zararı
  totalLiabilitiesAndEquity: string; // PASİF

  isBalanced: boolean; // Aktif = Pasif
}

export type GetBalanceSheetResponse = QueryResponse<BalanceSheetReport>;
