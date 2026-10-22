import { defineEndpoint } from '@shared/common/contracts/endpoint';
import type {
  AgencyRoiReport,
  MetaAdAccountResponse,
  MetaLeadResponse,
  MetaReportResponse,
} from '../interfaces';
import {
  GetMetaLeadsSchema,
  GetMetaReportSchema,
  GetRoiReportSchema,
} from '../schemas/queries';
import {
  InitiateMetaOAuthSchema,
  MatchLeadToPatientSchema,
} from '../schemas/commands';

/**
 * `apps/api` → `MetaAdsQueryController` / `MetaAdsCommandController` /
 * `MetaOAuthController`. Hepsi `meta-ads` önekiyle mount edilmiştir (bkz. canlı
 * OpenAPI'den üretilmiş Orval istemcisi — `/api/v1/meta-ads/clinics/...`).
 *
 * `report`/`leads` sorgu şemaları `clinicId`'yi path'in yanında **query**
 * alanı olarak da ister (backend DTO'ları böyle kurulmuş, iki yerde de
 * gönderilmesi gerekir) — `roiReport` bunu istemez.
 *
 * `get-meta-report`'un `totalLeads`/`convertedLeads`/`costPerLead`/
 * `costPerAppointment` ve kampanya başı `leads`/`conversions` alanları tarih
 * aralığını yok sayıp sabit `0` döner (bkz. frontend-api-endpoint-gaps.md) —
 * bu kontrat yine de tam `MetaReportResponse`'u taşır ama tüketen taraf o
 * alanları **göstermemelidir**.
 */
export const metaAdsEndpoints = {
  accounts: defineEndpoint<MetaAdAccountResponse[]>()({
    method: 'GET',
    path: (p: { clinicId: string }) => `/meta-ads/clinics/${p.clinicId}/accounts`,
  }),

  disconnectAccount: defineEndpoint<void>()({
    method: 'DELETE',
    path: (p: { clinicId: string; accountId: string }) =>
      `/meta-ads/clinics/${p.clinicId}/accounts/${p.accountId}`,
  }),

  report: defineEndpoint<MetaReportResponse>()({
    method: 'GET',
    path: (p: { clinicId: string }) => `/meta-ads/clinics/${p.clinicId}/reports`,
    query: GetMetaReportSchema,
  }),

  roiReport: defineEndpoint<AgencyRoiReport>()({
    method: 'GET',
    path: (p: { clinicId: string }) => `/meta-ads/clinics/${p.clinicId}/roi`,
    query: GetRoiReportSchema,
  }),

  leads: defineEndpoint<MetaLeadResponse[]>()({
    method: 'GET',
    path: (p: { clinicId: string }) => `/meta-ads/clinics/${p.clinicId}/leads`,
    query: GetMetaLeadsSchema,
  }),

  matchLead: defineEndpoint<void>()({
    method: 'PUT',
    path: (p: { leadId: string }) => `/meta-ads/leads/${p.leadId}/match`,
    body: MatchLeadToPatientSchema,
  }),

  oauthAuthorize: defineEndpoint<{ url: string }>()({
    method: 'GET',
    path: '/meta-ads/oauth/authorize',
    query: InitiateMetaOAuthSchema,
  }),
} as const;
