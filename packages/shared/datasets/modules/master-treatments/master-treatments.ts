import { LanguageCode } from '@shared/datasets';
import { dentalMasterTreatments } from '@shared/datasets/modules/master-treatments/dental-treatments/dental-treatments';

export type MasterTreatmentsCreateManyInputs = {
  defaultDuration: number;
  slug: string;
  treatmentCategorySlug: string;
  translations: {
    name: Partial<Record<LanguageCode, string>>;
    description: Partial<Record<LanguageCode, string>>;
  };
};
export const masterTreatmentsCreateManyInputs: MasterTreatmentsCreateManyInputs[] =
  [...dentalMasterTreatments];
