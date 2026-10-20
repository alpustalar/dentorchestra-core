import { dentalTreatmentSlugs } from '@shared/datasets/modules/master-treatments/dental-treatments/dental-treatment-slugs';
import { slugIt } from '@shared/common/utils/slug-it';
import { dentalTreatmentCategorySlugs } from '@shared/datasets/modules/treatment-categories/dental-treatments';
import {
  DENTAL_TREATMENT_CATEGORY,
  translationsHelper,
} from '@shared/datasets';

export const restorative = [
  // --- RESTORATIVE ---
  {
    slug: slugIt(dentalTreatmentSlugs.COMPOSITE_FILLING_SINGLE_SURFACE),
    defaultDuration: 40,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.RESTORATIVE],
    translations: {
      name: translationsHelper({
        tr: 'Kompozit Dolgu (Tek Yüzey)',
        en: 'Composite Filling (Single Surface)',
        ar: 'حشوة مركبة (سطح واحد)',
      }),
      description: translationsHelper({
        tr: 'Dişin tek yüzeyindeki çürük veya hasarın, doğal diş rengiyle uyumlu, yüksek dayanımlı estetik reçine materyali ile restore edilmesi.',
        en: 'Restoration of decay or damage on a single tooth surface using a high-durability, aesthetic resin material that matches natural tooth color.',
        ar: 'ترميم التسوس أو التلف في سطح واحد من السن باستخدام مادة راتينج جمالية عالية المتانة تتناسب مع لون الأسنان الطبيعي.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.COMPOSITE_FILLING_TWO_SURFACES),
    defaultDuration: 50,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.RESTORATIVE],
    translations: {
      name: translationsHelper({
        tr: 'Kompozit Dolgu (İki Yüzey)',
        en: 'Composite Filling (Two Surfaces)',
        ar: 'حشوة مركبة (سطحان)',
      }),
      description: translationsHelper({
        tr: 'Dişin iki farklı yüzeyini kapsayan madde kaybının, modern bonding teknikleri ve doğal diş formuna uygun estetik kompozit materyali ile restorasyonu.',
        en: 'Restoration of tooth structure involving two surfaces using modern bonding techniques and aesthetic composite materials tailored to natural tooth anatomy.',
        ar: 'ترميم بنية السن التي تشمل سطحين باستخدام تقنيات الترابط الحديثة ومواد الحشو المركبة الجمالية المصممة لتناسب التشريح الطبيعي للسن.',
      }),
    },
  },
  {
    slug: slugIt(
      dentalTreatmentSlugs.ROOT_CANAL_TREATMENT_SINGLE_CANAL_EXCLUDING_FILLING
    ),
    defaultDuration: 60,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.RESTORATIVE],
    translations: {
      name: translationsHelper({
        tr: 'Kanal Tedavisi (Tek Kanal - Dolgu Hariç)',
        en: 'Root Canal Treatment (Single Canal - Excluding Filling)',
        ar: 'علاج قناة الجذر (قناة واحدة - بدون الحشو)',
      }),
      description: translationsHelper({
        tr: 'Dişin iç kısmındaki enfekte sinir dokusunun temizlenmesi, genişletilmesi ve sterilize edilerek sızdırmaz bir şekilde doldurulmasını kapsayan endodontik prosedür.',
        en: 'An endodontic procedure involving the cleaning, shaping, and sterilization of infected nerve tissue within a single canal, followed by a hermetic seal.',
        ar: 'إجراء علاج عصب يتضمن تنظيف وتوسيع وتعقيم أنسجة الأعصاب المصابة داخل قناة واحدة، متبوعاً بحشو القناة وإغلاقها بإحكام.',
      }),
    },
  },
  {
    slug: slugIt(
      dentalTreatmentSlugs.ROOT_CANAL_TREATMENT_TWO_CANALS_EXCLUDING_FILLING
    ),
    defaultDuration: 90,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.RESTORATIVE],
    translations: {
      name: translationsHelper({
        tr: 'Kanal Tedavisi (İki Kanal - Dolgu Hariç)',
        en: 'Root Canal Treatment (Two Canals - Excluding Filling)',
        ar: 'علاج قناة الجذر (قناتان - بدون الحشو)',
      }),
      description: translationsHelper({
        tr: 'İki kanallı dişlerde enfekte pulpa dokusunun titizlikle temizlenmesi, dezenfekte edilmesi ve kanalların biyoyumlu materyallerle sızdırmaz şekilde kapatılması işlemi.',
        en: 'Meticulous cleaning and disinfection of infected pulp tissue in teeth with two canals, followed by hermetic sealing of the canals with biocompatible materials.',
        ar: 'تنظيف وتطهير أنسجة اللب المصابة في الأسنان ذات القناتين بدقة، يليه إغلاق القنوات بإحكام باستخدام مواد متوافقة حيوياً.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.ROOT_CANAL_RETREATMENT),
    defaultDuration: 75,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.RESTORATIVE],
    translations: {
      name: translationsHelper({
        tr: 'Kanal Tedavisi Yenilemesi (Retreatment)',
        en: 'Root Canal Retreatment',
        ar: 'إعادة معالجة قناة الجذر',
      }),
      description: translationsHelper({
        tr: 'Daha önce yapılmış ancak başarısız olmuş kanal tedavisinin, mevcut kanal dolgusunun sökülerek enfeksiyonun temizlenmesi ve kanalların yeniden doldurulması işlemi.',
        en: 'A procedure to treat a failed root canal by removing the previous filling, cleaning the infection, and refilling the canals.',
        ar: 'إجراء لمعالجة قناة جذر فاشلة عن طريق إزالة الحشوة السابقة وتنظيف العدوى وإعادة حشو القنوات.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.FIBER_POST_APPLICATION),
    defaultDuration: 40,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.RESTORATIVE],
    translations: {
      name: translationsHelper({
        tr: 'Fiber Post Uygulaması',
        en: 'Fiber Post Application',
        ar: 'تطبيق وتد الألياف (فايبر بوست)',
      }),
      description: translationsHelper({
        tr: 'Aşırı madde kaybı olan kanal tedavili dişlerde, kök kanalından destek alarak dişin direncini artıran ve üzerine yapılacak restorasyona tutuculuk sağlayan yapı.',
        en: 'A structure placed within the root canal of a treated tooth with extensive damage to enhance resistance and provide retention for the final restoration.',
        ar: 'هيكل يتم وضعه داخل قناة الجذر لسن معالج يعاني من تلف واسع لتعزيز المقاومة وتوفير الثبات للترميم النهائي.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.INLAY_ONLAY_RESTORATION),
    defaultDuration: 45,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.RESTORATIVE],
    translations: {
      name: translationsHelper({
        tr: 'İnley / Onley Restorasyon (Dijital Dolgu)',
        en: 'Inlay / Onlay Restoration',
        ar: 'ترميم إنلي وأونلي (الحشوات المصبوبة)',
      }),
      description: translationsHelper({
        tr: 'Geleneksel dolgu ile restore edilemeyecek kadar büyük madde kayıplarında, dijital ölçü ile laboratuvarda hazırlanan porselen veya kompozit blok dolgular.',
        en: 'Laboratory-fabricated porcelain or composite block fillings prepared using digital impressions for cavities too large for traditional restoration.',
        ar: 'حشوات من البورسلين أو الراتنج المركب يتم تصنيعها في المختبر باستخدام طبعات رقمية للفجوات الكبيرة جداً التي لا يمكن ترميمها تقليدياً.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.COMPOSITE_VENEER),
    defaultDuration: 60,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.RESTORATIVE],
    translations: {
      name: translationsHelper({
        tr: 'Kompozit Lamina (Veneer)',
        en: 'Composite Veneer',
        ar: 'فينير مركب (كومبوزيت لامينا)',
      }),
      description: translationsHelper({
        tr: 'Dişlerin ön yüzeyine estetik kompozit materyaller uygulanarak renk ve form bozukluklarının tek seansta düzeltildiği estetik restorasyon.',
        en: 'An aesthetic restoration where composite materials are applied to the front surfaces of teeth to correct color and shape discrepancies in a single visit.',
        ar: 'ترميم جمالي حيث يتم تطبيق مواد مركبة على الأسطح الأمامية للأسنان لتصحيح عيوب اللون والشكل في زيارة واحدة.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.VITALITY_TEST),
    defaultDuration: 15,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.RESTORATIVE],
    translations: {
      name: translationsHelper({
        tr: 'Vitalite (Canlılık) Testi',
        en: 'Vitality Test',
        ar: 'اختبار حيوية السن',
      }),
      description: translationsHelper({
        tr: 'Dişin sinir dokusunun canlı olup olmadığını belirlemek amacıyla uygulanan termal veya elektriksel tanı yöntemi.',
        en: "A diagnostic method using thermal or electrical stimuli to determine whether the tooth's nerve tissue is vital.",
        ar: 'طريقة تشخيصية تستخدم محفزات حرارية أو كهربائية لتحديد ما إذا كانت أنسجة عصب السن حيوية.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.ENDODONTIC_PALLIATIVE_TREATMENT),
    defaultDuration: 30,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.RESTORATIVE],
    translations: {
      name: translationsHelper({
        tr: 'Endodontik Pansuman / Acil Müdahale',
        en: 'Endodontic Palliative Treatment',
        ar: 'العلاج اللبي المسكن / الطوارئ',
      }),
      description: translationsHelper({
        tr: 'Akut ağrı veya enfeksiyon durumunda, asıl tedaviden önce ağrıyı kesmek amacıyla yapılan acil kanal müdahalesi.',
        en: 'Emergency canal intervention to alleviate acute pain or infection before the definitive treatment.',
        ar: 'تدخل طارئ في القناة اللبية لتخفيف الألم الحاد أو العدوى قبل العلاج النهائي.',
      }),
    },
  },
  {
    slug: slugIt(dentalTreatmentSlugs.COMPOSITE_FILLING_THREE_PLUS_SURFACES),
    defaultDuration: 60,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.RESTORATIVE],
    translations: {
      name: translationsHelper({
        tr: 'Kompozit Dolgu (3+ Yüzey / Büyük Restorasyon)',
        en: 'Composite Filling (3+ Surfaces / Complex)',
        ar: 'حشوة ضوئية (٣ أسطح فأكثر)',
      }),
      description: translationsHelper({
        tr: 'Dişin üç veya daha fazla yüzeyini kapsayan geniş madde kayıplarının estetik dolgu ile restorasyonu.',
        en: 'Restoration of extensive tooth loss covering three or more surfaces using aesthetic composite resin.',
        ar: 'ترميم فقدان الأسنان الواسع الذي يغطي ثلاثة أسطح أو أكثر باستخدام حشوة الكومبوزيت التجميلية.',
      }),
    },
  },
  {
    slug: slugIt(
      dentalTreatmentSlugs.ROOT_CANAL_TREATMENT_THREE_PLUS_CANALS_EXCLUDING_FILLING
    ),
    defaultDuration: 90,
    treatmentCategorySlug:
      dentalTreatmentCategorySlugs[DENTAL_TREATMENT_CATEGORY.RESTORATIVE],
    translations: {
      name: translationsHelper({
        tr: 'Kanal Tedavisi (3+ Kanal - Dolgu Hariç)',
        en: 'Root Canal Treatment (3+ Canals - Excl. Filling)',
        ar: 'علاج قناة الجذر (٣ قنوات أو أكثر - باستثناء الحشو)',
      }),
      description: translationsHelper({
        tr: 'Azı dişleri gibi çok köklü dişlerdeki enfeksiyonun temizlenerek kanalların doldurulması işlemi.',
        en: 'Endodontic treatment for multi-rooted teeth like molars, involving infection removal and canal filling.',
        ar: 'علاج لب الأسنان لمتعددة الجذور مثل الأضراس، ويتضمن إزالة العدوى وحشو القنوات.',
      }),
    },
  },
];
