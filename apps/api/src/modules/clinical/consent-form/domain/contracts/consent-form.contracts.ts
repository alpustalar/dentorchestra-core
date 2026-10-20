import { ResponseGroups } from '../../../../../../../../packages/shared/common/constants/response-groups.constant';

// ==========================================
// Onam cevaplarının alan görünürlüğü. İmza görseli ve sözleşme metni hassastır;
// grupları ConsentFormPolicy üretir. Modül-geneli (template + submission ortak) —
// tek bir aggregate'e ait olmadığı için kök seviyede kalır.
// ==========================================
export const ConsentFormResponseGroups = ResponseGroups;

export type ConsentFormResponseGroup =
  (typeof ConsentFormResponseGroups)[keyof typeof ConsentFormResponseGroups];
