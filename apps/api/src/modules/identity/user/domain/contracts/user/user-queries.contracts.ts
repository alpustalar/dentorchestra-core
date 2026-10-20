import { GlobalStatusType } from '@input-type-schemas/GlobalStatusSchema';
import { RoleWithCapabilities } from '@common/interfaces';
import { Pagination } from '@shared/common';
import { Paginated } from '@common/interfaces/paginated.type';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';

// ==========================================
// 1. SORGULAMA VE PASAPORT SÖZLEŞMELERİ (RESPONSES & DATA)
// ==========================================

export type AuthUserResponse = {
  id: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  status: GlobalStatusType;

  roleId: string | null;
  picture: string | null;
  clinicId: string | null;

  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  // İlişkisel dizi ve nesne haritalamaları:
  /**
   * Aktörün çalıştığı kliniğin kiracı kimliği. `ActorContext.organizationId`
   * buradan türer — kullanıcı tablosunda organizationId kolonu YOKTUR, kiracı
   * bağı her zaman klinik/sahiplik ilişkisinden çözülür.
   */
  workingClinic: { organizationId: string } | null;
  managedClinics: { id: string; organizationId: string }[];
  ownedOrganizations: { id: string }[];
  providerProfile: { id: string } | null;
  role: RoleWithCapabilities | null;
  /**
   * Rolün ÜSTÜNE klinik yöneticisi tarafından kişiye verilmiş ek yetkiler.
   * ActorContext bunları rol yetkileriyle birleştirir.
   */
  grantedCapabilities: {
    capability: { module: string; action: string };
  }[];
} | null;

export interface FindUsersByClinicIdsFilter {
  pagination: Pagination;
  /** Tekil veya dizi halindeki şube ID'leri. */
  clinicId: string | string[];
}

export interface FindUsersByOrganizationIdsFilter {
  pagination: Pagination;
  organizationId: string | string[];
}

// ==========================================
// KULLANICI ÖZET SÖZLEŞMELERİ (USER SUMMARY)
// ==========================================

export interface UserSummary {
  id: string;
  displayName: string;
  email: string;
  picture: string | null;
  status: GlobalStatusType;
  lastLogin: Date;
  createdAt: Date;

  // İlişkisel alt nesneler:
  role: { id: string; name: string } | null;
  workingClinic: { id: string; name: string } | null;
  providerProfile: { id: string } | null;
  managedClinics: { id: string; name: string }[];
}

export type PaginatedUserSummary = Paginated<UserSummary>;

// ==========================================
// SERİLEŞTİRME GRUPLARI (RESPONSE GROUPS)
// ==========================================

export const UserResponseGroups = ResponseGroups;

export type UserResponseGroup =
  (typeof UserResponseGroups)[keyof typeof UserResponseGroups];
