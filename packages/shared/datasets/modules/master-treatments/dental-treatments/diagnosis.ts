import { dentalTreatmentSlugs } from '@shared/datasets/modules/master-treatments/dental-treatments/dental-treatment-slugs';
import { slugIt } from '@shared/common/utils/slug-it';
import { dentalTreatmentCategorySlugs } from '@shared/datasets/modules/treatment-categories/dental-treatments';
import {
  DENTAL_TREATMENT_CATEGORY,
  translationsHelper,
} from '@shared/datasets';

export const diagnosis = [
  {
    slug: slugIt(dentalTreatmentSlugs.DENTAL_EXAMINATION),
    defaultDuration: 15,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.DIAGNOSIS],
    translations: {
      name: translationsHelper({
        tr: 'Diş Hekimi Muayenesi',
        en: 'Dental Examination',
        ar: 'فحص الأسنان',
      }),
      description: translationsHelper({
        tr: 'Dijital görüntüleme ve detaylı analizlerle desteklenen kapsamlı diş sağlığı kontrolü.',
        en: 'A comprehensive dental check-up supported by digital imaging and detailed analysis.',
        ar: 'فحص شامل لصحة الأسنان مدعوم بالتصوير الرقمي والتحليلات التفصيلية.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.SPECIALIST_DENTAL_EXAMINATION),
    defaultDuration: 15,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.DIAGNOSIS],
    translations: {
      name: translationsHelper({
        tr: 'Uzman Diş Hekimi Muayenesi',
        en: 'Specialist Dental Examination',
        ar: 'فحص أسنان متخصص',
      }),
      description: translationsHelper({
        tr: 'Dijital görüntüleme ve detaylı analizlerle desteklenen kapsamlı diş sağlığı kontrolü.',
        en: 'A comprehensive dental check-up supported by digital imaging and detailed analysis.',
        ar: 'فحص شامل لصحة الأسنان مدعوم بالتصوير الرقمي والتحليلات التفصيلية.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.PANORAMIC_XRAY),
    defaultDuration: 15,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.DIAGNOSIS],
    translations: {
      name: translationsHelper({
        tr: 'Panoramik Röntgen',
        en: 'Panoramic X-Ray',
        ar: 'أشعة بانورامية',
      }),
      description: translationsHelper({
        tr: 'Üst ve alt çene yapısının, tüm dişlerin ve çevre dokuların tek bir dijital panelde yüksek çözünürlüklü analizi.',
        en: 'High-resolution digital analysis of the upper and lower jaw structure, all teeth, and surrounding tissues in a single panel.',
        ar: 'تحليل رقمي عالي الدقة لهيكل الفكين العلوي والسفلي وجميع الأسنان والأنسجة المحيطة في لوحة واحدة.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.CBCT_TOMOGRAPHY),
    defaultDuration: 20,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.DIAGNOSIS],
    translations: {
      name: translationsHelper({
        tr: 'CBCT (Üç Boyutlu Çene Tomografisi)',
        en: 'CBCT (3D Dental Tomography)',
        ar: 'التصوير المقطعي المحوسب للأسنان (ثلاثي الأبعاد)',
      }),
      description: translationsHelper({
        tr: 'İmplant planlama ve ileri cerrahi vakalar için çene yapısının üç boyutlu olarak detaylı incelenmesi.',
        en: 'Detailed 3D examination of the jaw structure for implant planning and advanced surgical cases.',
        ar: 'فحص تفصيلي ثلاثي الأبعاد لهيكل الفك لتخطيط زراعة الأسنان وحالات الجراحة المتقدمة.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.DIGITAL_INTRAORAL_SCANNING),
    defaultDuration: 15,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.DIAGNOSIS],
    translations: {
      name: translationsHelper({
        tr: 'Dijital Ağız İçi Tarama',
        en: 'Digital Intraoral Scanning',
        ar: 'المسح الرقمي داخل الفم',
      }),
      description: translationsHelper({
        tr: 'Geleneksel ölçü yöntemleri yerine üç boyutlu ağız içi tarayıcılar ile dijital model oluşturulması.',
        en: 'Creating a digital 3D model of the mouth using intraoral scanners instead of traditional impression materials.',
        ar: 'إنشاء نموذج رقمي ثلاثي الأبعاد للفم باستخدام الماسحات الضوئية بدلاً من مواد الطبع التقليدية.',
      }),
    },
  },
];
