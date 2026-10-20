import { slugIt } from '@shared/common/utils/slug-it';
import { dentalTreatmentSlugs } from '@shared/datasets/modules/master-treatments/dental-treatments/dental-treatment-slugs';
import { dentalTreatmentCategorySlugs } from '@shared/datasets/modules/treatment-categories/dental-treatments';
import {
  DENTAL_TREATMENT_CATEGORY,
  translationsHelper,
} from '@shared/datasets';

export const surgery = [
  {
    slug: slugIt(dentalTreatmentSlugs.TOOTH_EXTRACTION),
    defaultDuration: 30,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.SURGERY],
    translations: {
      name: translationsHelper({
        tr: 'Diş Çekimi',
        en: 'Tooth Extraction',
        ar: 'خلع السن',
      }),
      description: translationsHelper({
        tr: 'Kurtarılamayacak durumdaki dişin, lokal anestezi altında çevre dokulara zarar verilmeden, aseptik kurallara uygun olarak cerrahi veya basit yöntemle uzaklaştırılması.',
        en: 'The removal of a non-restorable tooth under local anesthesia, performed via simple or surgical methods following aseptic protocols without damaging surrounding tissues.',
        ar: 'إزالة السن غير القابل للترميم تحت التخدير الموضعي، باستخدام طرق بسيطة أو جراحية وفقاً لبروتوكولات التعقيم، دون إلحاق الضرر بالأنسجة المحيطة.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.COMPLICATED_TOOTH_EXTRACTION),
    defaultDuration: 45,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.SURGERY],
    translations: {
      name: translationsHelper({
        tr: 'Komplikasyonlu Diş Çekimi',
        en: 'Complicated Tooth Extraction',
        ar: 'خلع السن المعقد',
      }),
      description: translationsHelper({
        tr: 'Kök yapısındaki eğrilik, aşırı kemik tutunması veya kırılma riski gibi zorluklar içeren dişlerin, ileri cerrahi teknikler ve minimal invaziv yaklaşımlarla güvenli bir şekilde çekilmesi.',
        en: 'Safe removal of teeth involving challenges such as root curvature, excessive bone attachment, or fracture risks, utilizing advanced surgical techniques and minimally invasive approaches.',
        ar: 'الخلع الآمن للأسنان التي تنطوي على تحديات مثل انحناء الجذور، أو الالتصاق العظمي المفرط، أو مخاطر الكسر، باستخدام تقنيات جراحية متقدمة وأساليب طفيفة التوغل.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.IMPACTED_TOOTH_SURGERY),
    defaultDuration: 60,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.SURGERY],
    translations: {
      name: translationsHelper({
        tr: 'Gömülü Diş Operasyonu',
        en: 'Impacted Tooth Surgery',
        ar: 'جراحة السن المطمور',
      }),
      description: translationsHelper({
        tr: 'Diş eti veya kemik altında kalan gömülü dişlerin, ileri cerrahi teknikler kullanılarak çevre dokulara zarar vermeden, steril koşullarda ve minimal invaziv yöntemlerle çekilmesi.',
        en: 'Surgical extraction of impacted teeth remains beneath the gum or bone, performed under sterile conditions using advanced techniques and minimally invasive methods to protect surrounding tissues.',
        ar: 'الخلع الجراحي للأسنان المطمورة تحت اللثة أو العظام، ويتم إجراؤه في ظروف معقمة باستخدام تقنيات متقدمة وأساليب طفيفة التوغل لحماية الأنسجة المحيطة.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.DENTAL_IMPLANT_APPLICATION_SINGLE_UNIT),
    defaultDuration: 45,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.SURGERY],
    translations: {
      name: translationsHelper({
        tr: 'Dental İmplant Uygulaması (Tek Ünite)',
        en: 'Dental Implant Application (Single Unit)',
        ar: 'زراعة الأسنان (وحدة واحدة)',
      }),
      description: translationsHelper({
        tr: 'Eksik dişin fonksiyon ve estetiğini geri kazandırmak amacıyla, çene kemiğine biyouyumlu titanyum vida yerleştirilmesini içeren ileri cerrahi prosedür.',
        en: 'An advanced surgical procedure involving the placement of a biocompatible titanium screw into the jawbone to restore the function and aesthetics of a missing tooth.',
        ar: 'إجراء جراحي متقدم يتضمن وضع برغي من التيتانيوم المتوافق حيوياً في عظم الفك لاستعادة وظيفة وجمال السن المفقود.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.SINUS_LIFTING),
    defaultDuration: 90,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.SURGERY],
    translations: {
      name: translationsHelper({
        tr: 'Sinüs Lifting (Açık/Kapalı)',
        en: 'Sinus Lifting (Open/Closed)',
        ar: 'رفع الجيوب الأنفية (مفتوح/مغلق)',
      }),
      description: translationsHelper({
        tr: 'Üst çenede kemik hacminin yetersiz olduğu bölgelerde, sinüs tabanının cerrahi olarak yükseltilip kemik grefti ile desteklenmesi işlemi.',
        en: 'A surgical procedure to increase bone volume in the upper jaw by lifting the sinus floor and supporting it with bone grafts.',
        ar: 'إجراء جراحي لزيادة حجم العظم في الفك العلوي عن طريق رفع قاع الجيب الأنفي ودعمه بطعوم عظمية.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.BONE_GRAFTING),
    defaultDuration: 45,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.SURGERY],
    translations: {
      name: translationsHelper({
        tr: 'Kemik Grefti Uygulaması',
        en: 'Bone Grafting Application',
        ar: 'تطبيق زراعة العظم',
      }),
      description: translationsHelper({
        tr: 'İmplant yerleşimi için yeterli kemik hacmi bulunmayan bölgelerin, biyomateryaller kullanılarak güçlendirilmesi ve hacim kazandırılması.',
        en: 'Strengthening and volumizing areas with insufficient bone for implant placement using specialized biomaterials.',
        ar: 'تقوية وتكثيف المناطق التي تفتقر إلى حجم عظم كافٍ لزراعة الأسنان باستخدام مواد حيوية متخصصة.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.APICAL_RESECTION_PER_TOOTH),
    defaultDuration: 60,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.SURGERY],
    translations: {
      name: translationsHelper({
        tr: 'Apikal Rezeksiyon (Kök Ucu Operasyonu)',
        en: 'Apical Resection (Root-End Surgery)',
        ar: 'استئصال قمة الجذر',
      }),
      description: translationsHelper({
        tr: 'Kanal tedavisine rağmen iyileşmeyen kök ucu enfeksiyonlarının ve kistlerinin, diş kökünün ucuyla birlikte cerrahi olarak temizlenmesi işlemi.',
        en: 'The surgical removal of the tip of the tooth root along with infected tissue or cysts that do not heal despite root canal treatment.',
        ar: 'الإزالة الجراحية لطرف جذر السن مع الأنسجة المصابة أو الأكياس التي لا تلتئم رغم علاج القناة.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.FRENECTOMY_LASER_OR_SURGICAL),
    defaultDuration: 30,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.SURGERY],
    translations: {
      name: translationsHelper({
        tr: 'Frenektomi (Dil/Dudak Bağı Operasyonu)',
        en: 'Frenectomy (Laser or Surgical)',
        ar: 'استئصال اللجام',
      }),
      description: translationsHelper({
        tr: 'Konuşmayı, beslenmeyi veya diş eti sağlığını olumsuz etkileyen dil, dudak veya yanak bağlarının cerrahi veya lazer yöntemle serbestleştirilmesi.',
        en: 'The release of tongue, lip, or cheek ties that negatively affect speech, nutrition, or gum health, performed via surgical or laser methods.',
        ar: 'تحرير أربطة اللسان أو الشفة أو الخد التي تؤثر سلباً على النطق أو التغذية أو صحة اللثة، ويتم ذلك عن طريق الجراحة أو الليزر.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.ALVEOLOPLASTY_PER_JAW),
    defaultDuration: 45,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.SURGERY],
    translations: {
      name: translationsHelper({
        tr: 'Alveoloplasti (Kemik Düzeltilmesi)',
        en: 'Alveoloplasty (Bone Contouring)',
        ar: 'تجميل وتبسيط العظم',
      }),
      description: translationsHelper({
        tr: 'Protez veya implant öncesinde çene kemiğindeki keskin çıkıntıların ve düzensizliklerin, doku uyumunu artırmak amacıyla cerrahi olarak düzeltilmesi.',
        en: 'Surgical re-contouring and smoothing of the jawbone ridges to improve tissue fit before prosthetic or implant placement.',
        ar: 'إعادة تشكيل وتنعيم حواف عظم الفك جراحياً لتحسين ملاءمة الأنسجة قبل وضع التركيبات أو الزرعات.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.CYST_ENUCLEATION),
    defaultDuration: 60,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.SURGERY],
    translations: {
      name: translationsHelper({
        tr: 'Kist Enükleasyonu (Çene Kisti Operasyonu)',
        en: 'Cyst Enucleation',
        ar: 'استئصال الكيس',
      }),
      description: translationsHelper({
        tr: 'Çene kemiği içerisinde oluşmuş kistik yapıların, çevre dokular korunarak bütün halinde cerrahi olarak çıkarılması işlemi.',
        en: 'The surgical removal of cystic structures within the jawbone as a whole while preserving surrounding tissues.',
        ar: 'الإزالة الجراحية للهياكل الكيسية داخل عظم الفك ككل مع الحفاظ على الأنسجة المحيطة.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.ALL_ON_FOUR_SIX_SURGERY_PHASE),
    defaultDuration: 120,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.SURGERY],
    translations: {
      name: translationsHelper({
        tr: 'All-on-4 / All-on-6 Cerrahi Uygulaması',
        en: 'All-on-4 / All-on-6 Surgical Phase',
        ar: 'إجراء الجراحة الكل على ٤ أو ٦',
      }),
      description: translationsHelper({
        tr: 'Tam dişsizlik durumunda, belirli açılarla yerleştirilen 4 veya 6 adet implant üzerine sabit protez yapılmasını sağlayan ileri cerrahi protokol.',
        en: 'An advanced surgical protocol involving the placement of 4 or 6 implants at specific angles to support a fixed prosthesis for fully edentulous patients.',
        ar: 'بروتوكول جراحي متقدم يتضمن وضع ٤ أو ٦ غرسات بزوايا محددة لدعم بدلة ثابتة للمرضى الذين يفتقرون للأسنان تماماً.',
      }),
    },
  },

  {
    slug: slugIt(dentalTreatmentSlugs.IMPLANT_UNCOVERING_SURGERY),
    defaultDuration: 30,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.SURGERY],
    translations: {
      name: translationsHelper({
        tr: 'İmplant İkinci Aşama Cerrahisi (İyileşme Başlığı Takılması)',
        en: 'Implant Uncovering (Healing Abutment Placement)',
        ar: 'المرحلة الثانية لزراعة الأسنان (تركيب غطاء الشفاء)',
      }),
      description: translationsHelper({
        tr: 'Kemik ile bütünleşen implantın üzerinin açılarak diş eti şekillendirici iyileşme başlığının yerleştirilmesi.',
        en: 'Uncovering the integrated implant and placing a healing abutment to shape the gum tissue.',
        ar: 'كشف الغرسة المندمجة بالعظم ووضع غطاء الشفاء لتشكيل أنسجة اللثة.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.FREE_GINGIVAL_GRAFT),
    defaultDuration: 60,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.SURGERY],
    translations: {
      name: translationsHelper({
        tr: 'Serbest Diş Eti Grefti',
        en: 'Free Gingival Graft',
        ar: 'طعم لثوي حر',
      }),
      description: translationsHelper({
        tr: 'Diş eti çekilmelerini önlemek veya implant çevresindeki yapışık diş eti miktarını artırmak için yapılan doku nakli operasyonu.',
        en: 'Tissue graft surgery to prevent gum recession or increase the amount of attached gingiva around implants.',
        ar: 'جراحة تطعيم الأنسجة لمنع تراجع اللثة أو زيادة كمية اللثة الملتصقة حول الغرسات.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.PERIODONTAL_FLAP_SURGERY_PER_TOOTH),
    defaultDuration: 45,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.SURGERY],
    translations: {
      name: translationsHelper({
        tr: 'Periodontal Flep Operasyonu (Diş Başına)',
        en: 'Periodontal Flap Surgery (Per Tooth)',
        ar: 'جراحة الفلاب اللثوية (للسن الواحد)',
      }),
      description: translationsHelper({
        tr: 'Derin diş eti ceplerindeki enfeksiyonun ve diş taşlarının cerrahi olarak açılıp temizlenmesi.',
        en: 'Surgical access to deep periodontal pockets for thorough cleaning of infection and calculus.',
        ar: 'الوصول الجراحي لجيوب اللثة العميقة للتنظيف الشامل للعدوى والترسبات.',
      }),
    },
  },
];
