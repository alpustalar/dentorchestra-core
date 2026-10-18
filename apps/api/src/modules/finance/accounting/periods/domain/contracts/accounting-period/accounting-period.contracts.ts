import { LogSource } from '@src/domain/constants/log-action.constant';

// ==========================================
// ACCOUNTING PERIOD (MUHASEBE DÖNEMİ) SÖZLEŞMELERİ
// ==========================================

export interface CreateAccountingPeriodProps {
  id?: string;
  clinicId: string;
  organizationId: string;

  // Yıl bilgisi 2000-2100 aralığında olmalıdır — AccountingPeriod.create() doğrular.
  year: number;

  // Denetim izi: dönemi kim açtı, nereden. Event entity içinde raise edilir.
  actorId: string;
  source?: LogSource;
}

/**
 * Durum geçişlerinin (kilitle / yeniden aç / kapat) ortak girdisi. `actorId`
 * zorunludur: mali yılın kapatılması/açılması denetim izi olmadan yapılamaz.
 */
export interface AccountingPeriodTransitionProps {
  actorId: string;
  source?: LogSource;
}
