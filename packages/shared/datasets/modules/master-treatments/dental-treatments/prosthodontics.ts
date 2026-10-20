import { dentalTreatmentSlugs } from '@shared/datasets/modules/master-treatments/dental-treatments/dental-treatment-slugs';
import { dentalTreatmentCategorySlugs } from '@shared/datasets/modules/treatment-categories/dental-treatments';
import {
  DENTAL_TREATMENT_CATEGORY,
  translationsHelper,
} from '@shared/datasets';
import { slugIt } from '@shared/common/utils/slug-it';

export const prosthodontics = [
  {
    slug: slugIt(dentalTreatmentSlugs.ZIRCONIUM_CROWN_SINGLE_UNIT),
    defaultDuration: 45,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PROSTHODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Zirkonyum Kaplama (Tek Ünite)',
        en: 'Zirconium Crown (Single Unit)',
        ar: 'تاج الزركونيوم (وحدة واحدة)',
      }),
      description: translationsHelper({
        tr: 'Yüksek dayanıklılık ve doğal ışık geçirgenliğine sahip metal desteksiz zirkonyum materyali ile dişin estetik ve fonksiyonel olarak tam kaplanması restorasyonu.',
        en: 'A full-coverage restoration using metal-free zirconium material, known for its high durability and natural light translucency, to enhance both dental aesthetics and function.',
        ar: 'ترميم كامل للسن باستخدام مادة الزركونيوم الخالية من المعادن، والمعروفة بمتانتها العالية ونفاذيتها الطبيعية للضوء، لتعزيز جمال ووظيفة الأسنان.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.PORCELAIN_CROWN_METAL_SUPPORTED),
    defaultDuration: 45,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PROSTHODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Metal Destekli Porselen Kaplama',
        en: 'Porcelain Crown (Metal Supported)',
        ar: 'تاج خزفي (بدعم معدني)',
      }),
      description: translationsHelper({
        tr: 'Dişin yapısal bütünlüğünü korumak için metal alaşım üzerine uygulanan porselen katman ile hem dayanıklılık hem de estetik görünüm sağlayan restorasyon yöntemi.',
        en: 'A restoration method providing both durability and aesthetic appearance with a porcelain layer applied over a metal alloy to preserve the structural integrity of the tooth.',
        ar: 'طريقة ترميم توفر المتانة والمظهر الجمالي من خلال طبقة من الخزف توضع فوق سبيكة معدنية للحفاظ على السلامة الهيكلية للسن.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.FULL_DENTURE_SINGLE_JAW),
    defaultDuration: 60,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PROSTHODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Tam Protez (Tek Çene)',
        en: 'Full Denture (Single Jaw)',
        ar: 'طقم أسنان كامل (فك واحد)',
      }),
      description: translationsHelper({
        tr: 'Tek çenedeki tüm diş eksikliklerini gideren, doku destekli, yüksek uyumlu ve estetik dikey boyut stabilitesi sağlayan hareketli protez çözümü.',
        en: 'A tissue-supported removable prosthetic solution for complete tooth loss in a single jaw, providing high biocompatibility and aesthetic vertical dimension stability.',
        ar: 'حل تعويضي متحرك مدعوم بالأنسجة لفقدان الأسنان الكامل في فك واحد، مما يوفر توافقاً حيوياً عالياً واستقراراً جمالياً في البعد العمودي.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.EMAX_CROWN_SINGLE_UNIT),
    defaultDuration: 45,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PROSTHODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'E-Max (Tam Seramik) Kaplama',
        en: 'E-Max (Full Ceramic) Crown',
        ar: 'تاج إي-ماكس (سيراميك كامل)',
      }),
      description: translationsHelper({
        tr: 'Maksimum ışık geçirgenliği ve doğal diş estetiği sunan, lityum disilikat esaslı güçlendirilmiş tam seramik restorasyon.',
        en: 'A lithium disilicate-based reinforced full-ceramic restoration offering maximum translucency and natural tooth aesthetics.',
        ar: 'ترميم سيراميك كامل معزز بقاعدة ثنائي سيليكات الليثيوم، يوفر أقصى درجات الشفافية وجمالية الأسنان الطبيعية.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.IMPLANT_SUPPORTED_ZIRCONIUM_CROWN),
    defaultDuration: 60,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PROSTHODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'İmplant Üstü Zirkonyum Kaplama',
        en: 'Implant-Supported Zirconium Crown',
        ar: 'تاج زركونيوم مدعوم بزراعة الأسنان',
      }),
      description: translationsHelper({
        tr: 'Yerleştirilen implant üzerine özel abutmentlar aracılığıyla sabitlenen, yüksek dayanımlı ve estetik zirkonyum restorasyon.',
        en: 'A high-durability, aesthetic zirconium restoration fixed onto a dental implant via specialized abutments.',
        ar: 'ترميم زركونيوم جمالي وعالي المتانة يتم تثبيته على غرسة الأسنان عبر دعامات متخصصة.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.TEMPORARY_CROWN_SINGLE_UNIT),
    defaultDuration: 30,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PROSTHODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Geçici Kaplama (Tek Ünite)',
        en: 'Temporary Crown (Single Unit)',
        ar: 'تاج مؤقت (وحدة واحدة)',
      }),
      description: translationsHelper({
        tr: 'Kalıcı protez hazırlanana kadar dişin korunmasını, estetiğin sağlanmasını ve diş eti formunun şekillendirilmesini sağlayan geçici restorasyon.',
        en: 'A short-term restoration to protect the tooth, maintain aesthetics, and shape the gum contour until the permanent prosthesis is ready.',
        ar: 'ترميم قصير المدى لحماية السن والحفاظ على الجمالية وتشكيل محيط اللثة حتى يصبح التعويض الدائم جاهزاً.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.PARTIAL_DENTURE_SKELETON),
    defaultDuration: 60,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PROSTHODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Bölümlü (İskelet) Protez',
        en: 'Partial Denture (Skeleton)',
        ar: 'طقم أسنان جزئي (هيكلي)',
      }),
      description: translationsHelper({
        tr: 'Kısmi diş eksikliklerinde metal iskelet yapısı ile desteklenen, kanca veya hassas tutucularla ağızda duran dayanıklı hareketli protez.',
        en: 'A durable removable prosthesis supported by a metal framework, held in place by clasps or precision attachments for partial tooth loss.',
        ar: 'تعويض متحرك متين مدعوم بإطار معدني، يتم تثبيته في مكانه بواسطة مشابك أو ملحقات دقيقة لحالات فقدان الأسنان الجزئي.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.CROWN_BRIDGE_REMOVAL),
    defaultDuration: 20,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PROSTHODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Kron/Köprü Sökümü (Tek Diş)',
        en: 'Crown/Bridge Removal (Per Tooth)',
        ar: 'إزالة التاج/الجسر (لكل سن)',
      }),
      description: translationsHelper({
        tr: 'Yeni tedavi planı doğrultusunda ağızdaki eski veya deforme olmuş kaplama ve köprülerin zarar vermeden çıkarılması işlemi.',
        en: 'The procedure of safely removing old or deformed crowns and bridges from the mouth in line with a new treatment plan.',
        ar: 'إجراء إزالة التيجان والجسور القديمة أو المشوهة بأمان من الفم بما يتماشى مع خطة علاجية جديدة.',
      }),
    },
  },

  {
    slug: slugIt(dentalTreatmentSlugs.HYBRID_DENTURE_ALL_ON_X),
    defaultDuration: 90,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PROSTHODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Hibrit Protez (All-on-4/6 Üst Yapısı)',
        en: 'Hybrid Denture (All-on-X Superstructure)',
        ar: 'تركيبة هجينة (فوق غرسات الكل على ٤ أو ٦)',
      }),
      description: translationsHelper({
        tr: 'Tam dişsizlik durumunda implantlar üzerine vidalanan, hem diş hem de doku kaybını telafi eden sabit hibrit restorasyon.',
        en: 'A fixed hybrid restoration screwed onto implants to compensate for both tooth and tissue loss in edentulous cases.',
        ar: 'تعويض هجين ثابت يتم تثبيته ببراغي على الغرسات لتعويض فقدان الأسنان والأنسجة في حالات فقدان الأسنان الكامل.',
      }),
    },
  },

  {
    slug: slugIt(dentalTreatmentSlugs.DENTURE_REBASE_RELINE),
    defaultDuration: 45,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PROSTHODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Protez Besleme / Astar Uygulaması',
        en: 'Denture Rebase / Relining',
        ar: 'إعادة تبطين الطقم',
      }),
      description: translationsHelper({
        tr: 'Zamanla uyumu bozulan hareketli protezlerin doku yüzeyinin yenilenerek stabilize edilmesi.',
        en: 'The process of resurfacing the tissue side of a denture to improve its fit and stability over time.',
        ar: 'عملية تجديد سطح طقم الأسنان الملامس للأنسجة لتحسين ملاءمته واستقراره بمرور الوقت.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.POST_CORE_CAST),
    defaultDuration: 45,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.PROSTHODONTICS],
    translations: {
      name: translationsHelper({
        tr: 'Döküm Post-Core',
        en: 'Cast Post-Core',
        ar: 'وتد ولب مصبوب',
      }),
      description: translationsHelper({
        tr: 'Aşırı madde kaybı olan kanal tedavili dişlerde, laboratuvarda hazırlanan metal destekli yapı.',
        en: 'A laboratory-fabricated metal structure used to restore endodontically treated teeth with extensive tissue loss.',
        ar: 'هيكل معدني مصنع مخبرياً يستخدم لترميم الأسنان المعالجة لبياً والتي تعاني من فقدان واسع في الأنسجة.',
      }),
    },
  },
];
