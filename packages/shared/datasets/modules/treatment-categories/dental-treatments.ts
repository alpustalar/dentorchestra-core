import { DENTAL_TREATMENT_CATEGORY } from '@shared/datasets/treatment-categories/dental';
import { BaseTreatmentCategories } from '@shared/datasets/modules/treatment-categories/treatment-categories';
import { EnumToSlug, enumToSlug } from '@shared/datasets/utils/enum-to-slug';
import { sectorSlugs } from '@shared/datasets/modules/sectors';
import { translationsHelper } from '@shared/datasets/utils/translations-helper';

export const dentalTreatmentCategorySlugs: EnumToSlug<
  typeof DENTAL_TREATMENT_CATEGORY
> = enumToSlug(DENTAL_TREATMENT_CATEGORY);

export type DentalTreatmentCategorySlug =
  (typeof dentalTreatmentCategorySlugs)[keyof typeof dentalTreatmentCategorySlugs];

type DentalCategoryKey = keyof typeof DENTAL_TREATMENT_CATEGORY;

export type DentalTreatmentCategories = BaseTreatmentCategories<
  DentalCategoryKey,
  DentalTreatmentCategorySlug
>;
export const DENTAL_TREATMENT_CATEGORIES: DentalTreatmentCategories = {
  categories: {
    DIAGNOSIS: {
      slug: dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.DIAGNOSIS],
      translations: {
        name: translationsHelper({
          tr: 'Teşhis ve Planlama',
          en: 'Diagnosis and Planning',
          ar: 'التشخيص والتخطيط',
        }),
        description: translationsHelper({
          tr: 'Muayene, röntgen ve tedavi planlamasını kapsayan tanısal işlemler',
          en: 'Diagnostic procedures including examination, X-rays and treatment planning',
          ar: 'الإجراءات التشخيصية تشمل الفحص والأشعة والتخطيط للعلاج',
        }),
      },
    },

    RESTORATIVE: {
      slug: dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.RESTORATIVE],
      translations: {
        name: translationsHelper({
          tr: 'Restoratif Diş Tedavisi ve Endodonti',
          en: 'Restorative and Endodontics',
          ar: 'علاج الأسنان الترميمي وعلاج الجذور',
        }),
        description: translationsHelper({
          tr: 'Dolgular, kanal tedavileri ve diş dokusunu onaran tüm restoratif işlemler',
          en: 'Fillings, root canal treatments and all restorative procedures that repair tooth structure',
          ar: 'الحشوات وعلاج قنوات الجذر وجميع الإجراءات الترميمية التي تُصلح بنية الأسنان',
        }),
      },
    },

    SURGERY: {
      slug: dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.SURGERY],
      translations: {
        name: translationsHelper({
          tr: 'Cerrahi',
          en: 'Surgery',
          ar: 'الجراحة',
        }),
        description: translationsHelper({
          tr: 'Diş çekimi, implant uygulaması ve ağız cerrahisi işlemleri',
          en: 'Tooth extractions, implant placement and oral surgery procedures',
          ar: 'خلع الأسنان وزراعة الأسنان وإجراءات جراحة الفم',
        }),
      },
    },

    PEDODONTICS: {
      slug: dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PEDODONTICS],
      translations: {
        name: translationsHelper({
          tr: 'Çocuk Diş Hekimliği',
          en: 'Pedodontics',
          ar: 'طب أسنان الأطفال',
        }),
        description: translationsHelper({
          tr: 'Çocuklara yönelik koruyucu ve tedavi edici diş hekimliği uygulamaları',
          en: 'Preventive and therapeutic dental procedures for children',
          ar: 'إجراءات طب الأسنان الوقائية والعلاجية للأطفال',
        }),
      },
    },

    PERIODONTOLOGY: {
      slug: dentalTreatmentCategorySlugs[
        DENTAL_TREATMENT_CATEGORY.PERIODONTOLOGY
      ],
      translations: {
        name: translationsHelper({
          tr: 'Diş Eti Hastalıkları ve Tedavisi',
          en: 'Periodontology',
          ar: 'أمراض اللثة وعلاجها',
        }),
        description: translationsHelper({
          tr: 'Diş eti iltihabı, detertraj ve diş destek dokularına yönelik tedaviler',
          en: 'Gum inflammation, scaling and treatments targeting tooth-supporting tissues',
          ar: 'التهاب اللثة والتنظيف والعلاجات التي تستهدف أنسجة دعم الأسنان',
        }),
      },
    },

    PROSTHODONTICS: {
      slug: dentalTreatmentCategorySlugs[
        DENTAL_TREATMENT_CATEGORY.PROSTHODONTICS
      ],
      translations: {
        name: translationsHelper({
          tr: 'Protetik Diş Tedavisi (Protez ve Kaplamalar)',
          en: 'Prosthodontics',
          ar: 'طب الأسنان التعويضي (التيجان والأطراف الاصطناعية)',
        }),
        description: translationsHelper({
          tr: 'Zirkonyum, porselen kaplama, tam ve parsiyel protez uygulamaları',
          en: 'Zirconium, porcelain crowns, full and partial denture applications',
          ar: 'تطبيقات تيجان الزركونيوم والخزف وأطقم الأسنان الكاملة والجزئية',
        }),
      },
    },

    ORTHODONTICS: {
      slug: dentalTreatmentCategorySlugs[
        DENTAL_TREATMENT_CATEGORY.ORTHODONTICS
      ],
      translations: {
        name: translationsHelper({
          tr: 'Ortodonti',
          en: 'Orthodontics',
          ar: 'تقويم الأسنان',
        }),
        description: translationsHelper({
          tr: 'Diş teli, şeffaf plak ve diş-çene düzensizliklerinin düzeltilmesine yönelik tedaviler',
          en: 'Braces, clear aligners and treatments for correcting dental and jaw irregularities',
          ar: 'تقويم الأسنان والمحاذيات الشفافة وعلاجات تصحيح تشوهات الأسنان والفكين',
        }),
      },
    },

    COSMETIC: {
      slug: dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.COSMETIC],
      translations: {
        name: translationsHelper({
          tr: 'Estetik',
          en: 'Cosmetic',
          ar: 'طب الأسنان التجميلي',
        }),
        description: translationsHelper({
          tr: 'Diş beyazlatma, lamina veneer ve gülüş estetiğini iyileştiren uygulamalar',
          en: 'Teeth whitening, laminate veneers and procedures enhancing smile aesthetics',
          ar: 'تبييض الأسنان والقشور الخزفية والإجراءات التي تحسّن جماليات الابتسامة',
        }),
      },
    },

    OTHER: {
      slug: dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.OTHER],
      translations: {
        name: translationsHelper({
          tr: 'Diğer',
          en: 'Other',
          ar: 'أخرى',
        }),
        description: translationsHelper({
          tr: 'Diğer kategorilere girmeyen ek diş hekimliği hizmetleri',
          en: 'Additional dental services not covered by other categories',
          ar: 'خدمات طب الأسنان الإضافية غير المشمولة بالفئات الأخرى',
        }),
      },
    },
  },
  sectorSlug: sectorSlugs.DENTAL,
};
