import { Organization } from '@shared';
import { GlobalStatusType as GlobalStatus } from '@input-type-schemas/GlobalStatusSchema';

// ==========================================
// 1. KLİNİK DETAY VE METRİK SÖZLEŞMELERİ (DETAILS)
// ==========================================

/** Klinik detay ekranı için yönetici özeti (findByIdWithDetails select alanları). */
export interface ClinicManagerSummary {
  id: string;
  displayName: string;
  email: string;
}

/**
 * Yetkili klinik dizini satırı (organizasyon-bazlı klinik seçici, grafik
 * serisi etiketleri). `isPlatform` klinikleri çağıran tarafından zaten
 * elenmiştir — bu read-model platformun kendi defter-sahibi şubesini hiç
 * taşımaz.
 */
export interface ClinicDirectoryItem {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  timezone: string;
  status: GlobalStatus;
}

/** Dış e-belge sağlayıcısına taşınabilecek klinik iletişim kimliği. */
export interface ClinicEDocumentProfile {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
}

/** Klinik detay okuma-modeli — organizasyon + yönetici listesi + Prisma sayaçları. */
export interface ClinicDetails {
  id: string;
  name: string;
  slug: string;
  sectorId: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  consultationSlotDuration: number;
  status: GlobalStatus;
  timezone: string;
  logo: string | null;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  organization: Organization | null;

  managers: ClinicManagerSummary[];

  // Prisma aggregation sayaçları:
  _count: {
    providers: number;
    patients: number;
    appointments: number;
  };
}
