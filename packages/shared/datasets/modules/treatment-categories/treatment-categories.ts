import { SectorSlug, TranslationHelper } from '@shared/datasets';
import { DENTAL_TREATMENT_CATEGORIES } from '@shared/datasets/modules/treatment-categories/dental-treatments';

export type BaseCategoryItem<C extends string = string> = {
  slug: C;
  translations: {
    name: TranslationHelper;
    description: TranslationHelper;
  };
};

export type BaseTreatmentCategories<K extends string, C extends string> = {
  sectorSlug: SectorSlug;
  categories: Record<K, BaseCategoryItem<C>>;
};

export const treatmentCategories: BaseTreatmentCategories<string, string>[] = [
  DENTAL_TREATMENT_CATEGORIES,
];
