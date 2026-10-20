import { dentalTreatmentSlugs } from '@shared/datasets/modules/master-treatments/dental-treatments/dental-treatment-slugs';
import { dentalTreatmentCategorySlugs } from '@shared/datasets/modules/treatment-categories/dental-treatments';
import {
  DENTAL_TREATMENT_CATEGORY,
  translationsHelper,
} from '@shared/datasets';
import { slugIt } from '@shared/common/utils/slug-it';

export const orthodontics = [
  {
    slug: slugIt(dentalTreatmentSlugs.CLEAR_ALIGNERS),
    defaultDuration: 30,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.ORTHODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Şeffaf Plak Tedavisi',
        en: 'Clear Aligner Treatment',
        ar: 'العلاج بالتقويم الشفاف',
      }),
      description: translationsHelper({
        tr: 'Diş çapraşıklıklarının, metal teller yerine kişiye özel üretilen şeffaf ve hareketli plaklar (telsiz ortodonti) ile düzeltilmesi.',
        en: 'Correction of dental crowding using custom-made, transparent, and removable aligners instead of traditional metal braces.',
        ar: 'تصحيح تزاحم الأسنان باستخدام تقويم شفاف ومتحرك مصمم خصيصاً بدلاً من المشدات المعدنية التقليدية.',
      }),
    },
  },

  {
    slug: slugIt(dentalTreatmentSlugs.METAL_BRACES),
    defaultDuration: 45,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.ORTHODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Metal Braket Tedavisi (Klasik Tel)',
        en: 'Metal Braces Treatment',
        ar: 'علاج الأقواس المعدنية',
      }),
      description: translationsHelper({
        tr: 'Dişlerdeki dizilim bozukluklarını düzeltmek amacıyla diş yüzeylerine metal braketlerin ve tellerin uygulandığı geleneksel ortodontik tedavi.',
        en: 'Traditional orthodontic treatment where metal brackets and wires are applied to the tooth surfaces to correct alignment issues.',
        ar: 'علاج تقويم الأسنان التقليدي حيث يتم وضع أقواس وأسلاك معدنية على أسطح الأسنان لتصحيح مشاكل الاصطفاف.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.PORCELAIN_BRACES),
    defaultDuration: 45,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.ORTHODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Porselen (Şeffaf) Braket Tedavisi',
        en: 'Porcelain (Ceramic) Braces',
        ar: 'الأقواس الخزفية (الشفافة)',
      }),
      description: translationsHelper({
        tr: 'Diş rengine yakın porselen materyalden üretilen braketler kullanılarak, estetik kaygıları minimize eden sabit ortodontik tedavi yöntemi.',
        en: 'A fixed orthodontic treatment method using brackets made of tooth-colored porcelain material to minimize aesthetic concerns.',
        ar: 'طريقة علاج تقويم الأسanan ثابتة تستخدم أقواس مصنوعة من مادة الخزف بلون الأسنان لتقليل المخاوف الجمالية.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.ORTHODONTIC_CONTROL),
    defaultDuration: 20,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.ORTHODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Ortodontik Kontrol Muayenesi',
        en: 'Orthodontic Check-up',
        ar: 'فحص تقويم الأسنان الدوري',
      }),
      description: translationsHelper({
        tr: 'Devam eden ortodontik tedavilerde tellerin sıkılanması, lastik değişimi ve tedavi sürecinin takibi için yapılan rutin kontrol randevusu.',
        en: 'A routine check-up appointment for tightening wires, changing elastics, and monitoring the progress of ongoing orthodontic treatment.',
        ar: 'موعد فحص روتيني لشد الأسلاك وتغيير الأربطة المطاطية ومتابعة تقدم علاج تقويم الأسنان المستمر.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.RETAINER_APPLICATION),
    defaultDuration: 30,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.ORTHODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Retainer (Pekiştirme) Uygulaması',
        en: 'Retainer Application',
        ar: 'تطبيق التثبيت (الريتينر)',
      }),
      description: translationsHelper({
        tr: 'Ortodontik tedavi bitiminde dişlerin yeni yerlerini korumak amacıyla dişlerin iç kısmına takılan sabit tel veya hareketli plak uygulaması.',
        en: 'Application of a fixed wire or removable plate placed on the inside of the teeth to maintain their new positions after orthodontic treatment.',
        ar: 'تطبيق سلك ثابت أو لوحة متحركة توضع على الجزء الداخلي من الأسنان للحفاظ على مواقعها الجديدة بعد انتهاء علاج تقويم الأسنان.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.LINGUAL_ORTHODONTICS),
    defaultDuration: 60,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.ORTHODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Lingual (Görünmez) Ortodonti',
        en: 'Lingual Orthodontics',
        ar: 'تقويم الأسنان اللساني',
      }),
      description: translationsHelper({
        tr: 'Braketlerin dişlerin ön yüzeyi yerine arka (dil tarafı) yüzeyine uygulanmasıyla yapılan, dışarıdan görünmeyen tel tedavisi.',
        en: 'Orthodontic treatment where brackets are applied to the inner (lingual) surfaces of the teeth, making the braces invisible from the outside.',
        ar: 'علاج تقويم الأسنان حيث يتم وضع الأقواس على الأسطح الداخلية (اللسانية) للأسنان، مما يجعل التقويم غير مرئي من الخارج.',
      }),
    },
  },
];
