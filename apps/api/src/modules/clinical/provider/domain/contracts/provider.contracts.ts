import { ResponseGroups } from '../../../../../../../../packages/shared/common/constants/response-groups.constant';

// ==========================================
// Modül-geneli serileştirme grupları — provider, provider-availability,
// provider-shift ve provider-exception response DTO'larının hepsi bunu
// kullanır; tek bir aggregate'e ait olmadığı için kök seviyede kalır.
// ==========================================
export const ProviderResponseGroups = {
  ...ResponseGroups,
} as const;

export type ProviderResponseGroup =
  (typeof ProviderResponseGroups)[keyof typeof ProviderResponseGroups];
