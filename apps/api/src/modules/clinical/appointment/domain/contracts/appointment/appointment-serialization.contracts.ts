import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';

// eslint-disable-next-line
const { DATA_OWNER, ...Groups } = ResponseGroups;

export const AppointmentsResponseGroups = {
  ...Groups,
  PROVIDER_DATA_OWNER: 'PROVIDER_DATA_OWNER',
  PATIENT_DATA_OWNER: 'PATIENT_DATA_OWNER',
} as const;

export type AppointmentResponseGroup =
  (typeof AppointmentsResponseGroups)[keyof typeof AppointmentsResponseGroups];
