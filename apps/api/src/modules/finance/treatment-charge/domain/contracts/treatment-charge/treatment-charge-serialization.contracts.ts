import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';

/**
 * İşlem satırı, finans modülleriyle aynı serileştirme vokabülerini paylaşır:
 * satırın "ne yapıldı" tarafı klinik personeline (INTERNAL), fiyat/indirim
 * tarafı finansal tier'a açıktır.
 */
export const TreatmentChargeResponseGroups = ResponseGroups;

export type TreatmentChargeResponseGroup =
  (typeof TreatmentChargeResponseGroups)[keyof typeof TreatmentChargeResponseGroups];
