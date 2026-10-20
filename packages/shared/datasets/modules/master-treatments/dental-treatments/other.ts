import { dentalTreatmentSlugs } from '@shared/datasets/modules/master-treatments/dental-treatments/dental-treatment-slugs';
import { slugIt } from '@shared/common/utils/slug-it';
import { dentalTreatmentCategorySlugs } from '@shared/datasets/modules/treatment-categories/dental-treatments';
import {
  DENTAL_TREATMENT_CATEGORY,
  translationsHelper,
} from '@shared/datasets';

export const other = [
  {
    slug: slugIt(dentalTreatmentSlugs.NIGHT_GUARD),
    defaultDuration: 30,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.OTHER],
    translations: {
      name: translationsHelper({
        tr: 'Gece Plağı (Bruksizm Tedavisi)',
        en: 'Night Guard (Bruxism Treatment)',
        ar: 'حارس لليلي (علاج صرير الأسنان)',
      }),
      description: translationsHelper({
        tr: 'Diş sıkma ve gıcırdatmanın (bruksizm) dişlere ve çene eklemine verdiği zararı önlemek amacıyla hazırlanan koruyucu aparey.',
        en: 'A protective appliance designed to prevent damage to teeth and the jaw joint caused by teeth grinding and clenching (bruxism).',
        ar: 'جهاز وقائي مصمم لمنع تلف الأسنان ومفصل الفك الناتج عن صرير الأسنان وطحنها.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.MASSETER_BOTOX),
    defaultDuration: 20,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.OTHER],
    translations: {
      name: translationsHelper({
        tr: 'Masseter Botoksu',
        en: 'Masseter Botox',
        ar: 'بوتوكس العضلة الماضغة',
      }),
      description: translationsHelper({
        tr: 'Çiğneme kasına (masseter) uygulanan enjeksiyon ile kasın aşırı gücünün azaltılması ve diş sıkma semptomlarının hafifletilmesi işlemi.',
        en: 'An injection procedure into the chewing muscle (masseter) to reduce excessive force and alleviate symptoms of teeth clenching.',
        ar: 'إجراء حقن في عضلة المضغ (العضلة الماضغة) لتقليل القوة المفرطة وتخفيف أعراض صرير الأسنان.',
      }),
    },
  },
];
