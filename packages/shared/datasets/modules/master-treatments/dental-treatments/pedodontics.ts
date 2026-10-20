import { slugIt } from '@shared/common/utils/slug-it';
import { dentalTreatmentSlugs } from '@shared/datasets/modules/master-treatments/dental-treatments/dental-treatment-slugs';
import { dentalTreatmentCategorySlugs } from '@shared/datasets/modules/treatment-categories/dental-treatments';
import {
  DENTAL_TREATMENT_CATEGORY,
  translationsHelper,
} from '@shared/datasets';

export const pedodontics = [
  {
    slug: slugIt(dentalTreatmentSlugs.FISSURE_SEALANT_SINGLE_TOOTH),
    defaultDuration: 20,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PEDODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Fissür Örtücü (Tek Diş)',
        en: 'Fissure Sealant (Single Tooth)',
        ar: 'سد الشقوق (سن واحد)',
      }),
      description: translationsHelper({
        tr: 'Azı dişlerinin çiğneyici yüzeylerindeki derin olukların, çürük oluşumunu engellemek amacıyla akışkan bir koruyucu materyal ile kapatıldığı koruyucu diş hekimliği uygulaması.',
        en: 'A preventive dental procedure where deep grooves on the occlusal surfaces of molars are sealed with a fluid protective material to prevent cavity formation.',
        ar: 'إجراء وقائي لطب الأسنان حيث يتم سد الشقوق العميقة على الأسطح الطاحنة للأضراس بمادة واقية سائلة لمنع تكون التسوس.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.FIXED_SPACE_MAINTAINER),
    defaultDuration: 40,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PEDODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Sabit Yer Tutucu',
        en: 'Fixed Space Maintainer',
        ar: 'حافظ المسافة الثابت',
      }),
      description: translationsHelper({
        tr: 'Erken kaybedilen süt dişlerinin yerini korumak, komşu dişlerin boşluğa kaymasını önlemek ve kalıcı dişlerin doğru konumda sürmesini sağlamak amacıyla uygulanan sabit aparey.',
        en: 'A fixed appliance used to preserve the space of prematurely lost primary teeth, preventing neighboring teeth from shifting and ensuring permanent teeth erupt in their correct positions.',
        ar: 'جهاز ثابت يستخدم للحفاظ على مساحة أسنان الحليب المفقودة قبل وقتها، مما يمنع الأسنان المجاورة من الانزياح ويضمن بزوغ الأسنان الدائمة في مواقعها الصحيحة.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.FLUORIDE_APPLICATION_WHOLE_MOUTH),
    defaultDuration: 15,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PEDODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Yerel Flor Uygulaması (Tüm Ağız)',
        en: 'Topical Fluoride Application (Full Mouth)',
        ar: 'تطبيق الفلورايد الموضعي (كامل الفم)',
      }),
      description: translationsHelper({
        tr: 'Diş minesini güçlendirmek ve asit direncini artırarak çürük oluşumunu engellemek amacıyla tüm diş yüzeylerine uygulanan koruyucu flor jeli/verniği.',
        en: 'A protective fluoride gel or varnish applied to all tooth surfaces to strengthen enamel, increase acid resistance, and prevent cavity formation.',
        ar: 'جيل أو ورنيش واقٍ من الفلورايد يوضع على جميع أسطح الأسنان لتقوية المينا وزيادة مقاومة الأحماض ومنع تكون التسوس.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.REMOVABLE_SPACE_MAINTAINER),
    defaultDuration: 30,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PEDODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Hareketli Yer Tutucu',
        en: 'Removable Space Maintainer',
        ar: 'حافظ المسافة المتحرك',
      }),
      description: translationsHelper({
        tr: 'Çoklu diş kayıplarında, çocuğun kendisinin takıp çıkarabildiği, çene gelişimine rehberlik eden ve diş boşluklarını koruyan aparey.',
        en: 'A removable appliance used in cases of multiple tooth loss that the child can insert and remove, guiding jaw development and preserving tooth gaps.',
        ar: 'جهاز متحرك يستخدم في حالات فقدان الأسنان المتعددة يمكن للطفل تركيبه وإزالته، مما يوجه نمو الفك ويحافظ على فراغات الأسنان.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.MILK_TOOTH_AMPUTATION),
    defaultDuration: 40,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PEDODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Amputasyon (Süt Dişi Yarım Kanal Tedavisi)',
        en: 'Pulpotomy (Milk Tooth Amputation)',
        ar: 'بتر اللب (علاج عصب جزئي لأسنان الحليب)',
      }),
      description: translationsHelper({
        tr: 'Süt dişinin canlılığını korumak amacıyla, sadece kuron kısmındaki enfekte sinir dokusunun uzaklaştırılıp kök sinirlerinin korunarak tedavi edilmesi işlemi.',
        en: 'A procedure where only the infected nerve tissue in the crown portion of a primary tooth is removed to preserve its vitality and protect the root nerves.',
        ar: 'إجراء يتم فيه إزالة أنسجة الأعصاب المصابة في جزء التاج فقط من سن الحليب للحفاظ على حيويته وحماية أعصاب الجذور.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.STAINLESS_STEEL_CROWN_PEDO),
    defaultDuration: 45,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PEDODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Paslanmaz Çelik Kuron (Süt Dişi Kaplaması)',
        en: 'Stainless Steel Crown (SSC)',
        ar: 'تاج الفولاذ المقاوم للصدأ (تلبيسة أسنان الحليب)',
      }),
      description: translationsHelper({
        tr: 'Aşırı madde kaybı olan veya kanal tedavisi görmüş süt dişlerini korumak amacıyla kullanılan, prefabrike metal kaplama çözümü.',
        en: 'A prefabricated metal crown solution used to protect primary teeth with extensive decay or those that have undergone root canal treatment.',
        ar: 'حل تاج معدني مسبق الصنع يستخدم لحماية أسنان الحليب التي تعاني من تسوس واسع أو تلك التي خضعت لعلاج عصب.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.MILK_TOOTH_EXTRACTION),
    defaultDuration: 20,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PEDODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Süt Dişi Çekimi',
        en: 'Milk Tooth Extraction',
        ar: 'خلع سن الحليب',
      }),
      description: translationsHelper({
        tr: 'Sürme zamanı gelmiş veya tedavi edilemeyecek durumdaki süt dişinin lokal anestezi altında ağrısız bir şekilde çekilmesi.',
        en: 'The painless removal of a primary tooth that is ready to erupt or is beyond repair, performed under local anesthesia.',
        ar: 'إزالة غير مؤلمة لسن الحليب الجاهز للسقوط أو الذي لا يمكن إصلاحه، ويتم ذلك تحت التخدير الموضعي.',
      }),
    },
  },
];
