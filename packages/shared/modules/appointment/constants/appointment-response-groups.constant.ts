import { ResponseGroups } from '../../../common/constants/response-groups.constant';

// Randevu cevaplarında hasta/doktor kendi kaydını ayrı gruplarla görür; genel
// DATA_OWNER burada kullanılmaz. Backend policy'leri grupları seçer, frontend
// hangi alanların hangi grupta geldiğini bilmek için aynı sözlüğü import eder.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { DATA_OWNER, ...Groups } = ResponseGroups;

export const AppointmentsResponseGroups = {
  ...Groups,
  PROVIDER_DATA_OWNER: 'PROVIDER_DATA_OWNER',
  PATIENT_DATA_OWNER: 'PATIENT_DATA_OWNER',
} as const;

export type AppointmentResponseGroup =
  (typeof AppointmentsResponseGroups)[keyof typeof AppointmentsResponseGroups];
