import { dentalTreatmentSlugs } from '@shared/datasets/modules/master-treatments/dental-treatments/dental-treatment-slugs';
import { dentalTreatmentCategorySlugs } from '@shared/datasets/modules/treatment-categories/dental-treatments';
import {
  DENTAL_TREATMENT_CATEGORY,
  translationsHelper,
} from '@shared/datasets';
import { slugIt } from '@shared/common/utils/slug-it';

export const cosmetic = [
  {
    slug: slugIt(dentalTreatmentSlugs.TEETH_WHITENING_IN_OFFICE),
    defaultDuration: 60,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.COSMETIC],
    translations: {
      name: translationsHelper({
        tr: 'Diş Beyazlatma (Ofis Tipi)',
        en: 'Teeth Whitening (In-Office)',
        ar: 'تبييض الأسنان (داخل العيادة)',
      }),
      description: translationsHelper({
        tr: 'Klinik ortamında profesyonel beyazlatma jelleri ve özel ışık kaynakları kullanılarak, diş minesindeki renklenmelerin güvenli ve hızlı bir şekilde giderilmesi işlemi.',
        en: 'A professional procedure performed in a clinical setting using high-concentration whitening gels and specialized light sources to safely and rapidly eliminate enamel discoloration.',
        ar: 'إجراء احترافي يتم داخل العيادة باستخدام هلام تبييض عالي التركيز ومصادر ضوئية متخصصة لإزالة تصبغات مينا الأسنان بشكل آمن وسريع.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.PORCELAIN_LAMINATE_VENEER),
    defaultDuration: 60,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.COSMETIC],
    translations: {
      name: translationsHelper({
        tr: 'Porselen Lamina Veneer',
        en: 'Porcelain Laminate Veneer',
        ar: 'قشرة خزفية رقيقة',
      }),
      description: translationsHelper({
        tr: 'Dişlerin ön yüzeylerine uygulanan, minimum aşındırma ile maksimum estetik sonuç veren, yüksek ışık geçirgenliğine sahip ultra ince porselen yaprak restorasyonu.',
        en: 'Ultra-thin porcelain leaf restorations applied to the front surfaces of the teeth with minimal abrasion, providing maximum aesthetic results and high light translucency.',
        ar: 'ترميمات قشرية خزفية فائقة الرقة توضع على الأسطح الأمامية للأسنان مع حد أدنى من البرد، مما يوفر نتائج جمالية قصوى ونفاذية عالية للضوء.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.BONDING_APPLICATION),
    defaultDuration: 60,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.COSMETIC],
    translations: {
      name: translationsHelper({
        tr: 'Bonding Uygulaması',
        en: 'Bonding Application',
        ar: 'تطبيق الترابط (بوندينج)',
      }),
      description: translationsHelper({
        tr: 'Diş yüzeyinde minimal aşındırma ile kompozit materyaller kullanılarak yapılan estetik form ve renk düzenleme işlemi.',
        en: 'A cosmetic procedure using composite materials to reshape or discolor teeth with minimal abrasion for aesthetic improvements.',
        ar: 'إجراء تجميلي يستخدم مواد مركبة لإعادة تشكيل أو تلوين الأسنان مع حد أدنى من البرد لتحسين المظهر الجمالي.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.DIGITAL_SMILE_DESIGN),
    defaultDuration: 45,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.COSMETIC],
    translations: {
      name: translationsHelper({
        tr: 'Dijital Gülüş Tasarımı',
        en: 'Digital Smile Design',
        ar: 'تصميم الابتسامة الرقمي',
      }),
      description: translationsHelper({
        tr: 'Hastanın yüz hatlarına ve dudak yapısına uygun ideal gülüşün, dijital yazılımlar ve simülasyonlar yardımıyla kişiye özel planlanması.',
        en: "Custom planning of the ideal smile compatible with the patient's facial features and lip structure using digital software and simulations.",
        ar: 'التخطيط المخصص للابتسامة المثالية المتوافقة مع ملامح وجه المريض وبنية شفاهه باستخدام البرامج الرقمية والمحاكاة.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.TEETH_WHITENING_HOME_TYPE),
    defaultDuration: 30,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.COSMETIC],
    translations: {
      name: translationsHelper({
        tr: 'Diş Beyazlatma (Ev Tipi)',
        en: 'Teeth Whitening (Home-Type)',
        ar: 'تبييض الأسنان (المنزلي)',
      }),
      description: translationsHelper({
        tr: 'Kişiye özel hazırlanan şeffaf plaklar ve düşük konsantrasyonlu beyazlatma jelleri ile hasta tarafından evde uygulanan profesyonel beyazlatma yöntemi.',
        en: 'A professional whitening method applied at home by the patient using custom-made clear trays and low-concentration whitening gels.',
        ar: 'طريقة تبييض احترافية يطبقها المريض في المنزل باستخدام قوالب شفافة مصممة خصيصاً وهلام تبييض منخفض التركيز.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.GINGIVECTOMY_AESTHETIC),
    defaultDuration: 45,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.COSMETIC],
    translations: {
      name: translationsHelper({
        tr: 'Gingivektomi (Diş Eti Estetiği)',
        en: 'Gingivectomy (Aesthetic Gum Contouring)',
        ar: 'استئصال اللثة (تجميل اللثة)',
      }),
      description: translationsHelper({
        tr: 'Gülüş tasarımı sürecinde diş etlerinin seviyelerini düzenlemek ve "gummy smile" görünümünü iyileştirmek için yapılan estetik diş eti şekillendirme işlemi.',
        en: 'An aesthetic gum contouring procedure performed to align gum levels and improve "gummy smile" appearance during the smile design process.',
        ar: 'إجراء تجميلي لتشكيل اللثة يتم إجراؤه لتنسيق مستويات اللثة وتحسين مظهر "الابتسامة اللثوية" أثناء عملية تصميم الابتسامة.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.COMPOSITE_VENEER_ESTHETIC),
    defaultDuration: 60,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.COSMETIC],
    translations: {
      name: translationsHelper({
        tr: 'Kompozit Lamina (Veneer)',
        en: 'Composite Veneer',
        ar: 'فينير مركب (كومبوزيت لامينا)',
      }),
      description: translationsHelper({
        tr: 'Porselen laminaya alternatif olarak, estetik kompozit materyallerin diş yüzeyine sanatsal bir katmanlama ile uygulanarak form ve renk düzeltilmesi.',
        en: 'An alternative to porcelain veneers, where aesthetic composite materials are applied to the tooth surface with artistic layering for form and color correction.',
        ar: 'بديل لقشور البورسلين، حيث يتم تطبيق مواد مركبة جمالية على سطح السن بطبقات فنية لتصحيح الشكل واللون.',
      }),
    },
  },
];
