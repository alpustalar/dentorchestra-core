import { ResponseGroups } from '../../../../../../../../packages/shared/common/constants/response-groups.constant';

export const ProviderResponseGroups = {
  ...ResponseGroups,
} as const;

export type ProviderResponseGroup =
  (typeof ProviderResponseGroups)[keyof typeof ProviderResponseGroups];
