import type { PartyRoleType } from '@input-type-schemas/PartyRoleSchema';

// ==========================================
// SORGULAMA SÖZLEŞMELERİ (FILTERS)
// ==========================================

/**
 * Cari liste filtresi **şube kapsamlıdır**.
 *
 * Cari, defteri tutan şubeye aittir (`clinicId` source-of-truth; şemadaki
 * `organizationId` yalnız konsolide raporlama için denormalize). Liste
 * `organizationId` ile süzülüyordu ama yetki `clinicId` ile veriliyordu: A
 * şubesinin personeli, aynı organizasyondaki B şubesinin tedarikçilerini,
 * hastalarını ve vergi numaralarını görebiliyordu.
 *
 * Konsolide (org geneli) cari listesi gerektiğinde ayrı bir sorgu + **org
 * seviyesinde** yetki kapısı açılır; bu filtre şubeyi gevşetmez.
 */
export interface FindPartiesFilter {
  clinicId: string;
  role?: PartyRoleType;
  isActive?: boolean;
}
