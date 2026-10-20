import { dentalTreatmentSlugs } from '@shared/datasets/modules/master-treatments/dental-treatments/dental-treatment-slugs';
import { slugIt } from '@shared/common/utils/slug-it';
import { dentalTreatmentCategorySlugs } from '@shared/datasets/modules/treatment-categories/dental-treatments';
import {
  DENTAL_TREATMENT_CATEGORY,
  translationsHelper,
} from '@shared/datasets';

export const periodontology = [
  {
    slug: slugIt(dentalTreatmentSlugs.SCALING_AND_POLISHING_SINGLE_JAW),
    defaultDuration: 30,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PERIODONTOLOGY],
    translations: {
      name: translationsHelper({
        tr: 'Detertraj ve Polisaj (Tek Çene)',
        en: 'Scaling and Polishing (Single Jaw)',
        ar: 'تنظيف وتلميع الأسنان (فك واحد)',
      }),
      description: translationsHelper({
        tr: 'Tek çenedeki diş yüzeylerinin ve diş eti sınırının biyofilm, tartar ve lekelerden ultrasonik yöntemlerle arındırılması, ardından polisaj ile pürüzsüzleştirilerek parlatılması.',
        en: 'The removal of biofilm, tartar, and stains from tooth surfaces and the gumline of a single jaw using ultrasonic methods, followed by polishing for a smooth and shiny finish.',
        ar: 'إزالة الغشاء الحيوي والجير والبقع من أسطح الأسنان وخط اللثة لفك واحد باستخدام طرق الموجات فوق الصوتية، يليها التلميع للحصول على ملمس ناعم ولامع.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.SUBGINGIVAL_CURETTAGE_GUM_TREATMENT),
    defaultDuration: 45,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PERIODONTOLOGY],
    translations: {
      name: translationsHelper({
        tr: 'Subgingival Küretaj (Diş Eti Tedavisi)',
        en: 'Subgingival Curettage (Gum Treatment)',
        ar: 'الكيريتاج تحت اللثة (علاج اللثة)',
      }),
      description: translationsHelper({
        tr: 'Diş eti cebindeki iltihaplı dokuların ve derin tartar birikimlerinin cerrahi yöntemlerle temizlenerek, diş eti dokusunun kök yüzeyine sağlıklı bir şekilde yeniden tutunmasının sağlanması.',
        en: 'Surgical cleaning of inflamed tissues and deep tartar deposits within the periodontal pockets to facilitate the healthy reattachment of gum tissue to the root surface.',
        ar: 'التنظيف الجراحي للأنسجة الملتهبة ورواسب الجير العميقة داخل جيوب اللثة لتسهيل إعادة التئام أنسجة اللثة بسطح الجذر بشكل صحي.',
      }),
    },
  },
];
