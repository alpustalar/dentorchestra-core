import { ResponseGroups } from '../../../common/constants/response-groups.constant';

// Staff tarafındaki hasta cevaplarının alan görünürlüğünü belirler.
// MEDICAL, hasta kaydının tıbbi bağlamını (kan grubu, checkup, klinik notlar)
// yalnızca klinik/tıbbi personele açmak için genel gruplara eklenir.
export const PatientResponseGroups = {
  ...ResponseGroups,
  MEDICAL: 'MEDICAL',
} as const;

export type PatientResponseGroup =
  (typeof PatientResponseGroups)[keyof typeof PatientResponseGroups];
