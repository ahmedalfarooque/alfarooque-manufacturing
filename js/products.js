/* ════════════════════════════════════════════════════════════
   AL FAROOQUE MANUFACTURING — PRODUCTS PAGE v1.0
   Hero Slider · Product Grid · Cart · Modal · Orders
   ════════════════════════════════════════════════════════════ */
'use strict';

/* ════ CONFIG — update before going live ════ */
var WA_NUMBER   = '966545542792';       // WhatsApp number, no leading +
var ORDER_EMAIL = 'arshad@alfarooque.com';
var CART_KEY    = 'afq-products-cart';
var SLIDE_MS    = 5000;                 // Hero auto-advance interval (ms)

/* ════ LANGUAGE ════ */
var IS_AR = document.documentElement.lang === 'ar';
var BASE_PATH = IS_AR ? '' : '';        // Both files in root; assets path same

/* ════ POLYFILLS ════ */
var _ric = typeof requestIdleCallback === 'function'
  ? requestIdleCallback
  : function(cb) { setTimeout(cb, 1); };

/* ════════════════════════════════════════════
   PRODUCT DATA
   ════════════════════════════════════════════ */
/* Image naming convention in assets/images/Products/:
   "[Product Name] 1.png"  "[Product Name] 2.png"  "[Product Name] 3.png"
   Add matching images to the folder to replace placeholder fallbacks.       */
var _DOOR_TEAK = [
  'assets/images/Products/Premium Solid Teak Exterior Door 1.png',
  'assets/images/Products/Premium Solid Teak Exterior Door 2.png',
  'assets/images/Products/Premium Solid Teak Exterior Door 3.png'
];
var _DOOR_HARD = [
  'assets/images/Products/Premium Solid Hardwood Exterior Door 1.png',
  'assets/images/Products/Premium Solid Hardwood Exterior Door 2.png',
  'assets/images/Products/Premium Solid Hardwood Exterior Door 3.png'
];
var _DOOR_MDF = [
  'assets/images/Products/Semi-Solid Interior Door (MDF Veneer Finish) 1.png',
  'assets/images/Products/Semi-Solid Interior Door (MDF Veneer Finish) 2.png',
  'assets/images/Products/Semi-Solid Interior Door (MDF Veneer Finish) 3.png'
];
var _DOOR_PLY = [
  'assets/images/Products/Semi-Solid Interior Door (Plywood Finish) 1.png',
  'assets/images/Products/Semi-Solid Interior Door (Plywood Finish) 2.png',
  'assets/images/Products/Semi-Solid Interior Door (Plywood Finish) 3.png'
];
var _DOOR_HC_MDF = [
  'assets/images/Products/Hollow Core Interior Door (MDF Veneer Finish) 1.png',
  'assets/images/Products/Hollow Core Interior Door (MDF Veneer Finish) 2.png',
  'assets/images/Products/Hollow Core Interior Door (MDF Veneer Finish) 3.png',
  'assets/images/Products/Hollow Core Interior Door (MDF Veneer Finish) 4.png'
];
var _DOOR_HC_PLY = [
  'assets/images/Products/Hollow Core Interior Door (Plywood Finish) 1.png',
  'assets/images/Products/Hollow Core Interior Door (Plywood Finish) 2.png',
  'assets/images/Products/Hollow Core Interior Door (Plywood Finish) 3.png',
  'assets/images/Products/Hollow Core Interior Door (Plywood Finish) 4.png'
];
var _DOOR_HONEY = [
  'assets/images/Products/Honeycomb Hollow Core Interior Door 1.png',
  'assets/images/Products/Honeycomb Hollow Core Interior Door 2.png',
  'assets/images/Products/Honeycomb Hollow Core Interior Door 3.png',
  'assets/images/Products/Honeycomb Hollow Core Interior Door 4.png'
];
var _DOOR_ECO = [
  'assets/images/Products/Economy Interior Door 1.png',
  'assets/images/Products/Economy Interior Door 2.png',
  'assets/images/Products/Economy Interior Door 3.png',
  'assets/images/Products/Economy Interior Door 4.png'
];

var _DOOR_SIZES = ['2100 × 900 mm', '2100 × 1000 mm', t('Custom sizes on request','أحجام مخصصة عند الطلب')];

var _BED_IMGS = [
  'assets/images/Products/Beds & Accessories/Bed and Mattress set 1_1.png',
  'assets/images/Products/Beds & Accessories/Bed and Mattress set 1_2.png',
  'assets/images/Products/Beds & Accessories/Bed and Mattress set 1_3.png'
];
var _SOFA_IMGS = [
  'assets/images/Products/Sofa/Sofa 1_1.png',
  'assets/images/Products/Sofa/Sofa 1_2.png',
  'assets/images/Products/Sofa/Sofa 1_3.png',
  'assets/images/Products/Sofa/Sofa 1_4.png'
];

var PRODUCTS = [
  {
    id: 1, cat: 'doors', material: 'Wood', availability: 'In Stock',
    rating: 4.8, reviewCount: 32, badge: 'BEST SELLER', featured: true,
    tags: ['Exterior', 'Premium', 'Solid Wood'],
    name: 'Premium Solid Teak Exterior Door',
    nameAr: 'باب خارجي من خشب التيك الصلب الفاخر',
    desc: 'Premium exterior door crafted with a solid teak wood door jamb, cast jamb, and main frame. Finished with high-quality varnish, sealer & lacquer, or paint for maximum durability. Includes a 5-year warranty.',
    descAr: 'باب خارجي فاخر مصنوع من خشب التيك الصلب مع إطار وأطراف وهيكل رئيسي متكامل. تشطيب بورنيش عالي الجودة أو سيلر ولاكيه أو دهان لمتانة قصوى. يشمل ضمان 5 سنوات.',
    price: 9500,
    img: _DOOR_TEAK[0], imgs: _DOOR_TEAK,
    warrantyLabel: '5-Year Warranty', warrantyLabelAr: 'ضمان 5 سنوات',
    features: ['Premium solid teak construction','Solid teak door jamb and main frame','Cast iron jamb for enhanced durability','Superior moisture and weather resistance','Anti-termite and corrosion treatment','Varnish, sealer & lacquer, or paint finish','Elegant natural teak grain appearance','5-year manufacturer warranty'],
    featuresAr: ['بناء متين من خشب التيك الصلب الفاخر','إطار باب ورئيسي من خشب التيك الصلب','إطار مصبوب لمتانة فائقة','مقاومة فائقة للرطوبة والعوامل الجوية','معالجة مضادة للحشرات والتآكل','تشطيب ورنيش أو سيلر ولاكيه أو دهان','مظهر أنيق بحبوب التيك الطبيعية','ضمان المصنع لمدة 5 سنوات'],
    specs: {'Product Type':'Door','Door Type':'Exterior – Solid Core','Frame Material':'Solid Teak Wood','Core Material':'Solid Teak Wood','Surface Finish':'Varnish / Sealer & Lacquer / Paint','Wood Species':'Teak','Warranty':'5 Years','Application':'Residential & Commercial','Installation':'Exterior','Country':'Saudi Arabia'},
    specsAr: {'نوع المنتج':'باب','نوع الباب':'خارجي – قلب صلب','مادة الإطار':'خشب التيك الصلب','مادة القلب':'خشب التيك الصلب','التشطيب السطحي':'ورنيش / سيلر ولاكيه / دهان','نوع الخشب':'تيك','الضمان':'5 سنوات','التطبيق':'سكني وتجاري','التركيب':'خارجي','البلد':'المملكة العربية السعودية'},
    applications: ['Villas','Luxury Residences','Commercial Buildings','Hotels & Resorts','Government Projects','High-End Offices'],
    applicationsAr: ['الفلل','المساكن الفاخرة','المباني التجارية','الفنادق والمنتجعات','المشاريع الحكومية','المكاتب الراقية'],
    finishes: ['Natural Teak Varnish','Sealer & Lacquer','Paint Finish','Custom Colors'],
    finishesAr: ['ورنيش التيك الطبيعي','سيلر ولاكيه','تشطيب دهان','ألوان مخصصة'],
    sizes: _DOOR_SIZES
  },
  {
    id: 2, cat: 'doors', material: 'Wood', availability: 'In Stock',
    rating: 4.7, reviewCount: 27, badge: 'FEATURED', featured: true,
    tags: ['Exterior', 'Premium', 'Solid Wood'],
    name: 'Premium Solid Hardwood Exterior Door',
    nameAr: 'باب خارجي من الخشب الصلب الفاخر',
    desc: 'Exterior door manufactured from premium solid hardwood options including Oak, Mahogany, Beech, or Walnut. Finished with varnish, sealer & lacquer, or paint. Includes a 5-year warranty.',
    descAr: 'باب خارجي مصنوع من أخشاب صلبة فاخرة تشمل البلوط والماهوجني والزان أو الجوز. تشطيب بورنيش أو سيلر ولاكيه أو دهان. يشمل ضمان 5 سنوات.',
    price: 6500,
    img: _DOOR_HARD[0], imgs: _DOOR_HARD,
    warrantyLabel: '5-Year Warranty', warrantyLabelAr: 'ضمان 5 سنوات',
    features: ['Premium hardwood species selection','Outstanding weather resistance','Solid core construction throughout','Multiple premium finish options','Heavy-duty jamb and main frame','Classic elegant natural design','Long service life and durability','5-year manufacturer warranty'],
    featuresAr: ['اختيار أجود أنواع الأخشاب الصلبة','مقاومة ممتازة لعوامل الطقس','بناء ذو قلب صلب بالكامل','خيارات تشطيب فاخرة متعددة','إطار وهيكل رئيسي متين','تصميم كلاسيكي راقٍ وأنيق','عمر خدمة طويل ومتانة فائقة','ضمان المصنع لمدة 5 سنوات'],
    specs: {'Product Type':'Door','Door Type':'Exterior – Solid Core','Frame Material':'Solid Hardwood','Core Material':'Solid Hardwood','Surface Finish':'Varnish / Sealer & Lacquer / Paint','Wood Species':'Oak / Mahogany / Beech / Walnut','Warranty':'5 Years','Application':'Residential & Commercial','Installation':'Exterior','Country':'Saudi Arabia'},
    specsAr: {'نوع المنتج':'باب','نوع الباب':'خارجي – قلب صلب','مادة الإطار':'خشب صلب فاخر','مادة القلب':'خشب صلب فاخر','التشطيب السطحي':'ورنيش / سيلر ولاكيه / دهان','نوع الخشب':'بلوط / ماهوجني / زان / جوز','الضمان':'5 سنوات','التطبيق':'سكني وتجاري','التركيب':'خارجي','البلد':'المملكة العربية السعودية'},
    applications: ['Villas','Residential Buildings','Commercial Offices','Hotels','Government Projects','Schools & Hospitals'],
    applicationsAr: ['الفلل','المباني السكنية','المكاتب التجارية','الفنادق','المشاريع الحكومية','المدارس والمستشفيات'],
    finishes: ['Natural Wood Varnish','Sealer & Lacquer','Paint Finish','PU Finish','Custom Colors'],
    finishesAr: ['ورنيش الخشب الطبيعي','سيلر ولاكيه','تشطيب دهان','تشطيب PU','ألوان مخصصة'],
    sizes: _DOOR_SIZES
  },
  {
    id: 3, cat: 'doors', material: 'MDF', availability: 'In Stock',
    rating: 4.5, reviewCount: 41,
    tags: ['Interior', 'MDF'],
    name: 'Semi-Solid Interior Door (MDF Veneer Finish)',
    nameAr: 'باب داخلي شبه صلب (تشطيب قشرة MDF)',
    desc: 'Interior door with Swedish wood frame, full chipboard core, waterproof MDF pressing, premium wood veneer, and sealer & lacquer or painted finish. Includes a 1-year warranty.',
    descAr: 'باب داخلي بإطار خشب سويدي وقلب رقاقة خشبية كامل وضغط MDF مقاوم للماء وقشرة خشب فاخرة وتشطيب سيلر ولاكيه أو دهان. يشمل ضمان سنة واحدة.',
    price: 1050,
    img: _DOOR_MDF[0], imgs: _DOOR_MDF,
    warrantyLabel: '1-Year Warranty', warrantyLabelAr: 'ضمان سنة واحدة',
    features: ['Swedish wood frame for structural stability','Full chipboard core for rigidity','Waterproof MDF pressing layer','Premium natural wood veneer surface','Sealer & lacquer or paint finish','Smooth and precise surface quality','Suitable for residential & commercial','1-year manufacturer warranty'],
    featuresAr: ['إطار خشب سويدي لثبات هيكلي ممتاز','قلب رقاقة خشبية كاملة للصلابة','طبقة ضغط MDF مقاومة للماء','سطح قشرة خشب طبيعية فاخرة','تشطيب سيلر ولاكيه أو دهان','جودة سطح ناعمة ودقيقة','مناسب للاستخدام السكني والتجاري','ضمان المصنع لمدة سنة واحدة'],
    specs: {'Product Type':'Door','Door Type':'Interior – Semi-Solid Core','Frame Material':'Swedish Wood','Core Material':'Full Chipboard','Surface Finish':'Wood Veneer + Sealer & Lacquer / Paint','Wood Species':'Swedish Wood + MDF Veneer','Warranty':'1 Year','Application':'Residential & Commercial','Installation':'Interior','Country':'Saudi Arabia'},
    specsAr: {'نوع المنتج':'باب','نوع الباب':'داخلي – قلب شبه صلب','مادة الإطار':'خشب سويدي','مادة القلب':'رقاقة خشبية كاملة','التشطيب السطحي':'قشرة خشب + سيلر ولاكيه / دهان','نوع الخشب':'خشب سويدي + قشرة MDF','الضمان':'سنة واحدة','التطبيق':'سكني وتجاري','التركيب':'داخلي','البلد':'المملكة العربية السعودية'},
    applications: ['Residences & Villas','Apartments','Hotels & Resorts','Commercial Offices','Healthcare Facilities','Educational Buildings'],
    applicationsAr: ['المنازل والفلل','الشقق السكنية','الفنادق والمنتجعات','المكاتب التجارية','المرافق الصحية','المباني التعليمية'],
    finishes: ['Natural Wood Veneer','Sealer & Lacquer','Paint Finish','Custom Colors'],
    finishesAr: ['قشرة خشب طبيعية','سيلر ولاكيه','تشطيب دهان','ألوان مخصصة'],
    sizes: _DOOR_SIZES
  },
  {
    id: 4, cat: 'doors', material: 'Wood', availability: 'In Stock',
    rating: 4.4, reviewCount: 38,
    tags: ['Interior'],
    name: 'Semi-Solid Interior Door (Plywood Finish)',
    nameAr: 'باب داخلي شبه صلب (تشطيب خشب رقائقي)',
    desc: 'Swedish wood frame with full chipboard core, plywood pressing, and painted or Talveen finish. Designed for residential and commercial interiors. Includes a 1-year warranty.',
    descAr: 'إطار خشب سويدي مع قلب رقاقة خشبية كامل وضغط خشب رقائقي وتشطيب دهان أو تالفين. مصمم للديكورات الداخلية السكنية والتجارية. يشمل ضمان سنة واحدة.',
    price: 950,
    img: _DOOR_PLY[0], imgs: _DOOR_PLY,
    warrantyLabel: '1-Year Warranty', warrantyLabelAr: 'ضمان سنة واحدة',
    features: ['Swedish wood structural frame','Full chipboard solid core','Plywood pressing for durability','Paint or Talveen surface finish','Durable and cost-effective','Precision engineered construction','Suitable for residential & commercial','1-year manufacturer warranty'],
    featuresAr: ['إطار هيكلي من الخشب السويدي','قلب رقاقة خشبية صلبة كاملة','ضغط خشب رقائقي للمتانة','تشطيب دهان أو تالفين','متين وفعّال من حيث التكلفة','بناء مهندس بدقة','مناسب للاستخدام السكني والتجاري','ضمان المصنع لمدة سنة واحدة'],
    specs: {'Product Type':'Door','Door Type':'Interior – Semi-Solid Core','Frame Material':'Swedish Wood','Core Material':'Full Chipboard','Surface Finish':'Plywood + Paint / Talveen','Wood Species':'Swedish Wood','Warranty':'1 Year','Application':'Residential & Commercial','Installation':'Interior','Country':'Saudi Arabia'},
    specsAr: {'نوع المنتج':'باب','نوع الباب':'داخلي – قلب شبه صلب','مادة الإطار':'خشب سويدي','مادة القلب':'رقاقة خشبية كاملة','التشطيب السطحي':'خشب رقائقي + دهان / تالفين','نوع الخشب':'خشب سويدي','الضمان':'سنة واحدة','التطبيق':'سكني وتجاري','التركيب':'داخلي','البلد':'المملكة العربية السعودية'},
    applications: ['Residential Buildings','Apartments','Schools','Hospitals','Commercial Buildings','Government Facilities'],
    applicationsAr: ['المباني السكنية','الشقق','المدارس','المستشفيات','المباني التجارية','المرافق الحكومية'],
    finishes: ['Paint Finish','Talveen Finish','Custom Colors'],
    finishesAr: ['تشطيب دهان','تشطيب تالفين','ألوان مخصصة'],
    sizes: _DOOR_SIZES
  },
  {
    id: 5, cat: 'doors', material: 'MDF', availability: 'In Stock',
    rating: 4.3, reviewCount: 29,
    tags: ['Interior', 'MDF'],
    name: 'Hollow Core Interior Door (MDF Veneer Finish)',
    nameAr: 'باب داخلي بقلب أجوف (تشطيب قشرة MDF)',
    desc: 'Interior hollow-core door featuring a Swedish wood frame, chipboard core with 5 cm spacing, waterproof MDF pressing, wood veneer finish, and sealer & lacquer or paint. Includes a 1-year warranty.',
    descAr: 'باب داخلي بقلب أجوف بإطار خشب سويدي وقلب رقاقة خشبية بفراغات 5 سم وضغط MDF مقاوم للماء وقشرة خشب وتشطيب سيلر ولاكيه أو دهان. يشمل ضمان سنة واحدة.',
    price: 1000,
    img: _DOOR_HC_MDF[0], imgs: _DOOR_HC_MDF,
    warrantyLabel: '1-Year Warranty', warrantyLabelAr: 'ضمان سنة واحدة',
    features: ['Swedish wood perimeter frame','Hollow chipboard core (5 cm spacing)','Waterproof MDF pressing layer','Premium natural wood veneer surface','Lightweight yet structurally sound','Good sound insulation properties','Elegant and smooth finish','1-year manufacturer warranty'],
    featuresAr: ['إطار محيطي من الخشب السويدي','قلب رقاقة أجوف (فراغات 5 سم)','طبقة ضغط MDF مقاومة للماء','سطح قشرة خشب طبيعية فاخرة','خفيف الوزن ومتين هيكلياً','خصائص جيدة لعزل الصوت','تشطيب أنيق وناعم','ضمان المصنع لمدة سنة واحدة'],
    specs: {'Product Type':'Door','Door Type':'Interior – Hollow Core','Frame Material':'Swedish Wood','Core Material':'Hollow Chipboard (5 cm spacing)','Surface Finish':'Wood Veneer + Sealer & Lacquer / Paint','Wood Species':'Swedish Wood + MDF Veneer','Warranty':'1 Year','Application':'Residential & Commercial','Installation':'Interior','Country':'Saudi Arabia'},
    specsAr: {'نوع المنتج':'باب','نوع الباب':'داخلي – قلب أجوف','مادة الإطار':'خشب سويدي','مادة القلب':'رقاقة أجوف (فراغات 5 سم)','التشطيب السطحي':'قشرة خشب + سيلر ولاكيه / دهان','نوع الخشب':'خشب سويدي + قشرة MDF','الضمان':'سنة واحدة','التطبيق':'سكني وتجاري','التركيب':'داخلي','البلد':'المملكة العربية السعودية'},
    applications: ['Bedrooms & Living Rooms','Apartments','Hotels','Commercial Offices','Healthcare Facilities','Educational Buildings'],
    applicationsAr: ['غرف النوم والمعيشة','الشقق السكنية','الفنادق','المكاتب التجارية','المرافق الصحية','المباني التعليمية'],
    finishes: ['Natural Wood Veneer','Sealer & Lacquer','Paint Finish','Custom Colors'],
    finishesAr: ['قشرة خشب طبيعية','سيلر ولاكيه','تشطيب دهان','ألوان مخصصة'],
    sizes: _DOOR_SIZES
  },
  {
    id: 6, cat: 'doors', material: 'Wood', availability: 'In Stock',
    rating: 4.2, reviewCount: 22,
    tags: ['Interior'],
    name: 'Hollow Core Interior Door (Plywood Finish)',
    nameAr: 'باب داخلي بقلب أجوف (تشطيب خشب رقائقي)',
    desc: 'Hollow-core interior door with Swedish wood frame, chipboard core, plywood pressing, and painted or Talveen finish. Includes a 6-month warranty.',
    descAr: 'باب داخلي بقلب أجوف بإطار خشب سويدي وقلب رقاقة خشبية وضغط خشب رقائقي وتشطيب دهان أو تالفين. يشمل ضمان 6 أشهر.',
    price: 850,
    img: _DOOR_HC_PLY[0], imgs: _DOOR_HC_PLY,
    warrantyLabel: '6-Month Warranty', warrantyLabelAr: 'ضمان 6 أشهر',
    features: ['Swedish wood frame construction','Hollow chipboard core','Plywood pressing layer','Paint or Talveen surface finish','Lightweight design for easy handling','Cost-effective door solution','Easy and fast installation','6-month manufacturer warranty'],
    featuresAr: ['بناء إطار من الخشب السويدي','قلب رقاقة خشبية أجوف','طبقة ضغط خشب رقائقي','تشطيب دهان أو تالفين','تصميم خفيف الوزن لسهولة التعامل','حل اقتصادي للأبواب','تركيب سهل وسريع','ضمان المصنع لمدة 6 أشهر'],
    specs: {'Product Type':'Door','Door Type':'Interior – Hollow Core','Frame Material':'Swedish Wood','Core Material':'Hollow Chipboard','Surface Finish':'Plywood + Paint / Talveen','Wood Species':'Swedish Wood','Warranty':'6 Months','Application':'Residential & Commercial','Installation':'Interior','Country':'Saudi Arabia'},
    specsAr: {'نوع المنتج':'باب','نوع الباب':'داخلي – قلب أجوف','مادة الإطار':'خشب سويدي','مادة القلب':'رقاقة خشبية أجوف','التشطيب السطحي':'خشب رقائقي + دهان / تالفين','نوع الخشب':'خشب سويدي','الضمان':'6 أشهر','التطبيق':'سكني وتجاري','التركيب':'داخلي','البلد':'المملكة العربية السعودية'},
    applications: ['Residential Buildings','Apartments','Budget Hotels','Schools','Warehouses','Utility Rooms'],
    applicationsAr: ['المباني السكنية','الشقق','الفنادق الاقتصادية','المدارس','المستودعات','الغرف الخدمية'],
    finishes: ['Paint Finish','Talveen Finish','Custom Colors'],
    finishesAr: ['تشطيب دهان','تشطيب تالفين','ألوان مخصصة'],
    sizes: _DOOR_SIZES
  },
  {
    id: 7, cat: 'doors', material: 'Wood', availability: 'In Stock',
    rating: 4.1, reviewCount: 18, badge: 'NEW',
    tags: ['Interior'],
    name: 'Honeycomb Hollow Core Interior Door',
    nameAr: 'باب داخلي بقلب أجوف خلوي',
    desc: 'Lightweight interior door with Swedish wood frame, honeycomb core construction, plywood pressing, and painted or Talveen finish. Includes a 6-month warranty.',
    descAr: 'باب داخلي خفيف الوزن بإطار خشب سويدي وبنية قلب خلوي وضغط خشب رقائقي وتشطيب دهان أو تالفين. يشمل ضمان 6 أشهر.',
    price: 700,
    img: _DOOR_HONEY[0], imgs: _DOOR_HONEY,
    warrantyLabel: '6-Month Warranty', warrantyLabelAr: 'ضمان 6 أشهر',
    features: ['Swedish wood perimeter frame','Ultra-lightweight honeycomb core','Plywood pressing for surface rigidity','Paint or Talveen surface finish','Eco-friendly lightweight construction','Ideal for partition applications','Quick and easy installation','6-month manufacturer warranty'],
    featuresAr: ['إطار محيطي من الخشب السويدي','قلب خلوي خفيف الوزن للغاية','ضغط خشب رقائقي لصلابة السطح','تشطيب دهان أو تالفين','بناء بيئي خفيف الوزن','مثالي لتطبيقات الفواصل','تركيب سريع وسهل','ضمان المصنع لمدة 6 أشهر'],
    specs: {'Product Type':'Door','Door Type':'Interior – Honeycomb Core','Frame Material':'Swedish Wood','Core Material':'Honeycomb','Surface Finish':'Plywood + Paint / Talveen','Wood Species':'Swedish Wood','Warranty':'6 Months','Application':'Residential & Commercial','Installation':'Interior','Country':'Saudi Arabia'},
    specsAr: {'نوع المنتج':'باب','نوع الباب':'داخلي – قلب خلوي','مادة الإطار':'خشب سويدي','مادة القلب':'خلوي','التشطيب السطحي':'خشب رقائقي + دهان / تالفين','نوع الخشب':'خشب سويدي','الضمان':'6 أشهر','التطبيق':'سكني وتجاري','التركيب':'داخلي','البلد':'المملكة العربية السعودية'},
    applications: ['Residential Buildings','Apartments','Lightweight Partitions','Offices','Schools','Utility Areas'],
    applicationsAr: ['المباني السكنية','الشقق','الفواصل الخفيفة','المكاتب','المدارس','المناطق الخدمية'],
    finishes: ['Paint Finish','Talveen Finish','Custom Colors'],
    finishesAr: ['تشطيب دهان','تشطيب تالفين','ألوان مخصصة'],
    sizes: _DOOR_SIZES
  },
  {
    id: 8, cat: 'doors', material: 'Wood', availability: 'In Stock',
    rating: 3.9, reviewCount: 52,
    tags: ['Interior', 'Budget'],
    name: 'Economy Interior Door',
    nameAr: 'باب داخلي اقتصادي',
    desc: 'Budget-friendly interior door suitable for standard residential applications. Supplied without warranty.',
    descAr: 'باب داخلي اقتصادي مناسب للتطبيقات السكنية القياسية. يُورَّد بدون ضمان.',
    price: 550,
    img: _DOOR_ECO[0], imgs: _DOOR_ECO,
    warrantyLabel: 'No Warranty', warrantyLabelAr: 'بدون ضمان',
    features: ['Budget-friendly construction','Standard residential grade quality','Paint surface finish','Lightweight design','Easy installation','Suitable for standard applications','Cost-effective solution','Functional and practical'],
    featuresAr: ['بناء اقتصادي ميسور التكلفة','جودة سكنية قياسية','تشطيب دهان سطحي','تصميم خفيف الوزن','تركيب سهل','مناسب للتطبيقات القياسية','حل فعّال من حيث التكلفة','عملي ونافع'],
    specs: {'Product Type':'Door','Door Type':'Interior – Standard','Frame Material':'Standard Wood','Core Material':'Standard Core','Surface Finish':'Paint','Wood Species':'Standard Wood','Warranty':'No Warranty','Application':'Residential','Installation':'Interior','Country':'Saudi Arabia'},
    specsAr: {'نوع المنتج':'باب','نوع الباب':'داخلي – قياسي','مادة الإطار':'خشب قياسي','مادة القلب':'قلب قياسي','التشطيب السطحي':'دهان','نوع الخشب':'خشب قياسي','الضمان':'بدون ضمان','التطبيق':'سكني','التركيب':'داخلي','البلد':'المملكة العربية السعودية'},
    applications: ['Standard Residential Buildings','Apartments','Budget Housing Projects','Utility Rooms','Storage Areas'],
    applicationsAr: ['المباني السكنية القياسية','الشقق','مشاريع الإسكان الميسور','الغرف الخدمية','مناطق التخزين'],
    finishes: ['Paint Finish'],
    finishesAr: ['تشطيب دهان'],
    sizes: _DOOR_SIZES
  },
  {
    id: 9, cat: 'beds', material: 'MDF', availability: 'In Stock',
    rating: 4.9, reviewCount: 0,
    tags: ['Bedroom', 'Furniture', 'Mattress'],
    name: 'Wooden Bed with Spring Mattress',
    nameAr: 'سرير خشبي مع مرتبة سبرينج',
    desc: 'Premium wooden bed manufactured using high-quality MDF melamine panels with a strong internal plywood support system and solid wooden legs. Includes a comfortable 20 cm thick spring mattress. Professional manufacturing, delivery, and installation included.',
    descAr: 'سرير خشبي فاخر مصنوع من ألواح MDF ميلامين عالية الجودة مع نظام دعم داخلي قوي من الخشب الرقائقي وأرجل خشبية صلبة. يشمل مرتبة سبرينج مريحة بسماكة 20 سم. يشمل التصنيع والتوصيل والتركيب الاحترافي.',
    price: 1250,
    img: _BED_IMGS[0], imgs: _BED_IMGS,
    warrantyLabel: '1-Year Warranty', warrantyLabelAr: 'ضمان سنة واحدة',
    features: [
      'Premium 18 mm MDF Melamine construction',
      'Heavy-duty 18 mm plywood internal support frame',
      'Six solid wooden legs for maximum stability',
      'Elegant modern finish (Colour as per customer selection)',
      '20 cm thick premium spring mattress included',
      'Strong, durable and long-lasting construction',
      'Professional manufacturing, delivery & installation',
      'Suitable for residential, apartments, hotels & staff accommodation',
      'Easy maintenance and scratch-resistant finish',
      '1-Year Manufacturer Warranty'
    ],
    featuresAr: [
      'بناء فاخر من MDF ميلامين بسماكة 18 مم',
      'إطار داعم داخلي من الخشب الرقائقي بسماكة 18 مم',
      'ستة أرجل خشبية صلبة لأقصى استقرار',
      'تشطيب أنيق وعصري (اللون حسب اختيار العميل)',
      'مرتبة سبرينج فاخرة بسماكة 20 سم مشمولة',
      'بناء قوي ومتين وطويل الأمد',
      'تصنيع احترافي والتوصيل والتركيب مشمولان',
      'مناسب للمساكن والشقق والفنادق وسكن الموظفين',
      'تشطيب سهل الصيانة ومقاوم للخدش',
      'ضمان المصنع لمدة سنة واحدة'
    ],
    specs: {
      'Product Type':       'Wooden Bed with Mattress',
      'Material':           '18 mm MDF Melamine',
      'Internal Support':   '18 mm Plywood Base',
      'Legs':               '6 Solid Wooden Legs',
      'Mattress Type':      'Premium Spring Mattress',
      'Mattress Thickness': '20 cm',
      'Finish':             'Melamine Finish',
      'Colour':             'As Per Selection',
      'Installation':       'Included',
      'Delivery':           'Included',
      'Warranty':           '1 Year',
      'Application':        'Residential & Commercial',
      'Country':            'Saudi Arabia',
      'Package Includes':   'Wooden Bed Frame, 20 cm Spring Mattress, Hardware & Accessories, Delivery, Installation'
    },
    specsAr: {
      'نوع المنتج':      'سرير خشبي مع مرتبة',
      'المادة':          'MDF ميلامين 18 مم',
      'الدعم الداخلي':   'قاعدة خشب رقائقي 18 مم',
      'الأرجل':          '6 أرجل خشبية صلبة',
      'نوع المرتبة':     'مرتبة سبرينج فاخرة',
      'سماكة المرتبة':   '20 سم',
      'التشطيب':         'تشطيب ميلامين',
      'اللون':           'حسب الاختيار',
      'التركيب':         'مشمول',
      'التوصيل':         'مشمول',
      'الضمان':          'سنة واحدة',
      'التطبيق':         'سكني وتجاري',
      'البلد':           'المملكة العربية السعودية',
      'محتويات الطلب':   'هيكل السرير الخشبي، مرتبة سبرينج 20 سم، كامل المعدات والإكسسوارات، التوصيل، التركيب'
    },
    applications: ['Villas','Apartments','Hotels & Resorts','Staff Accommodation','Guest Houses','Residential Bedrooms','Furnished Apartments','Commercial Housing'],
    applicationsAr: ['الفلل','الشقق السكنية','الفنادق والمنتجعات','سكن الموظفين','دور الضيافة','غرف النوم السكنية','الشقق المفروشة','الإسكان التجاري'],
    finishes: ['Walnut','Oak','Wenge','White','Grey Oak','Custom Colours Available'],
    finishesAr: ['جوز','بلوط','وينج','أبيض','بلوط رمادي','ألوان مخصصة متاحة'],
    sizes: ['90 × 200 cm (Single)','120 × 200 cm (Small Double)','160 × 200 cm (Queen)','180 × 200 cm (King)','Custom Sizes on Request']
  },
  {
    id: 10, cat: 'sofa', material: 'Wood', availability: 'In Stock',
    rating: 4.8, reviewCount: 0,
    tags: ['Living Room', 'Furniture', 'Upholstery'],
    name: 'Luxury Double Seater Sofa',
    nameAr: 'كنبة فاخرة مزدوجة المقاعد',
    desc: 'Premium double-seater sofa manufactured with a solid wood frame, high-density memory foam cushions, and premium fabric or leather upholstery. Designed for superior comfort and durability.',
    descAr: 'كنبة مزدوجة فاخرة مصنوعة بإطار خشب صلب ووسائد فوم ذاكرة عالية الكثافة وتنجيد قماش أو جلد فاخر. مصممة للراحة الفائقة والمتانة.',
    price: 2400,
    img: _SOFA_IMGS[0], imgs: _SOFA_IMGS,
    warrantyLabel: '1-Year Warranty', warrantyLabelAr: 'ضمان سنة واحدة',
    features: [
      'Solid wood frame',
      'Premium memory foam seating',
      'Fabric or leather upholstery',
      'Colour & fabric grade as selected',
      'Strong durable construction',
      'Comfortable ergonomic seating',
      'Elegant modern design',
      'Manufacture & Delivery Included',
      '1-Year Warranty'
    ],
    featuresAr: [
      'إطار خشب صلب',
      'وسائد جلوس من الفوم ذاكرة الفاخر',
      'تنجيد قماش أو جلد',
      'اللون ودرجة القماش حسب الاختيار',
      'بناء قوي ومتين',
      'جلسة مريحة وفق تصميم هندسي',
      'تصميم أنيق وعصري',
      'التصنيع والتوصيل مشمولان',
      'ضمان سنة واحدة'
    ],
    specs: {
      'Frame':       'Solid Wood',
      'Cushion':     'Memory Foam',
      'Upholstery':  'Fabric / Leather',
      'Finish':      'Customer Selection',
      'Warranty':    '1 Year'
    },
    specsAr: {
      'الإطار':    'خشب صلب',
      'الوسادة':   'فوم ذاكرة',
      'التنجيد':   'قماش / جلد',
      'التشطيب':   'اختيار العميل',
      'الضمان':    'سنة واحدة'
    },
    applications: ['Offices','Reception Areas','Villas','Apartments','Hotels'],
    applicationsAr: ['المكاتب','مناطق الاستقبال','الفلل','الشقق','الفنادق'],
    finishes: ['Fabric Upholstery','Leather Upholstery','Custom Colours Available'],
    finishesAr: ['تنجيد قماش','تنجيد جلد','ألوان مخصصة متاحة'],
    sizes: ['Double Seater (2-person)','Custom Sizes on Request']
  }
];

/* ════ O(1) product lookup map ════ */
var PRODUCTS_MAP = {};
PRODUCTS.forEach(function(p){ PRODUCTS_MAP[p.id] = p; });
function getProduct(id) { return PRODUCTS_MAP[id] || null; }

/* ════ Helper ════ */
function t(en, ar) { return IS_AR ? ar : en; }
function fmt(n) { return 'SAR ' + Number(n).toLocaleString('en-US'); }
function esc(s) { return encodeURIComponent(s); }
function capFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

/* ════ Wishlist ════ */
var wishlist = {
  _key: 'afq-wishlist',
  _set: null,
  _load: function() {
    if (this._set) return;
    try { this._set = new Set(JSON.parse(localStorage.getItem(this._key) || '[]')); }
    catch(e) { this._set = new Set(); }
  },
  _save: function() {
    try { localStorage.setItem(this._key, JSON.stringify(Array.from(this._set))); } catch(e){}
  },
  has: function(id) { this._load(); return this._set.has(id); },
  toggle: function(id) {
    this._load();
    if (this._set.has(id)) this._set.delete(id); else this._set.add(id);
    this._save();
    return this._set.has(id);
  }
};

/* ════ Share ════ */
function shareProduct(p) {
  var name = IS_AR ? p.nameAr : p.name;
  var url  = window.location.href.split('#')[0] + '#product-' + p.id;
  if (navigator.share) {
    navigator.share({ title: name, text: name + ' — AL FAROOQUE Manufacturing', url: url }).catch(function(){});
  } else {
    try { navigator.clipboard.writeText(url); } catch(e){}
    var el = document.getElementById('pfShareToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pfShareToast';
      el.className = 'pf-share-toast';
      document.body.appendChild(el);
    }
    el.textContent = t('Link copied!', 'تم نسخ الرابط!');
    el.classList.add('show');
    setTimeout(function(){ el.classList.remove('show'); }, 2200);
  }
}

/* ════ Stars renderer ════ */
function starsHtml(rating, reviewCount) {
  if (!rating) return '';
  var full = Math.floor(rating);
  var half = (rating - full) >= 0.5;
  var html = '<div class="prod-rating">';
  html += '<span class="prod-stars" aria-label="' + rating + ' out of 5">';
  for (var i = 0; i < 5; i++) {
    if (i < full)            html += '<span class="star star-full">★</span>';
    else if (i === full && half) html += '<span class="star star-half">★</span>';
    else                     html += '<span class="star star-empty">★</span>';
  }
  html += '</span>';
  if (reviewCount) html += '<span class="prod-review-count">(' + reviewCount + ')</span>';
  html += '</div>';
  return html;
}

/* ════════════════════════════════════════════
   HERO SLIDER
   ════════════════════════════════════════════ */
var slider = {
  cur: 0,
  total: 0,
  timer: null,
  progressTimer: null,
  slides: [],
  dots: [],
  progressEl: null,

  init: function() {
    this.slides = document.querySelectorAll('.ph-slide');
    this.dots   = document.querySelectorAll('.ph-dot');
    this.progressEl = document.getElementById('phProgress');
    this.total  = this.slides.length;
    if (!this.total) return;

    // Arrows
    var prev = document.getElementById('phPrev');
    var next = document.getElementById('phNext');
    var self = this;
    if (prev) prev.addEventListener('click', function() { self.go(self.cur - 1); });
    if (next) next.addEventListener('click', function() { self.go(self.cur + 1); });

    // Dots
    this.dots.forEach(function(d, i) {
      d.addEventListener('click', function() { self.go(i); });
    });

    // Touch swipe
    var startX = 0;
    var sliderEl = document.getElementById('phSlider');
    if (sliderEl) {
      sliderEl.addEventListener('touchstart', function(e) { startX = e.touches[0].clientX; }, {passive:true});
      sliderEl.addEventListener('touchend', function(e) {
        var dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 40) self.go(dx < 0 ? self.cur + 1 : self.cur - 1);
      }, {passive:true});
    }

    this.show(0);
    this.startAuto();

    // Parallax on scroll — cache references once
    var phHero = document.querySelector('.ph-hero');
    var phBgs  = document.querySelectorAll('.ph-slide-bg');
    if (phHero && phBgs.length) {
      var phTicking = false;
      window.addEventListener('scroll', function() {
        if (phTicking) return; phTicking = true;
        requestAnimationFrame(function() {
          phTicking = false;
          var y = window.scrollY;
          var heroH = phHero.offsetHeight;
          if (y > heroH) return;
          var ratio = y / heroH;
          var val = 'translateY(' + (ratio * 30) + '%)';
          for (var i = 0; i < phBgs.length; i++) {
            phBgs[i].style.transform = val;
          }
        });
      }, {passive: true});
    }
  },

  go: function(idx) {
    var n = ((idx % this.total) + this.total) % this.total;
    this.show(n);
    this.resetAuto();
  },

  show: function(idx) {
    var self = this;
    this.slides.forEach(function(s, i) { s.classList.toggle('active', i === idx); });
    this.dots.forEach(function(d, i) { d.classList.toggle('active', i === idx); });
    this.cur = idx;
    this.startProgress();
  },

  startAuto: function() {
    var self = this;
    this.timer = setInterval(function() { self.go(self.cur + 1); }, SLIDE_MS);
  },

  resetAuto: function() {
    clearInterval(this.timer);
    this.startAuto();
  },

  startProgress: function() {
    var el = this.progressEl;
    if (!el) return;
    el.style.transition = 'none';
    el.style.width = '0%';
    var self = this;
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        el.style.transition = 'width ' + SLIDE_MS + 'ms linear';
        el.style.width = '100%';
      });
    });
  }
};

/* ════════════════════════════════════════════
   PRODUCT RENDERING
   ════════════════════════════════════════════ */
var grid = document.getElementById('prodGrid');

function catLabel(cat) {
  var map = {
    doors:     t('Doors','الأبواب'),
    wood:      t('Wood Works','أعمال الخشب'),
    steel:     t('Steel Works','أعمال الحديد'),
    aluminium: t('Aluminium Works','أعمال الألومنيوم'),
    beds:      t('Beds & Accessories','الأسرة والإكسسوارات'),
    sofa:      t('Sofa','الكنب')
  };
  return map[cat] || cat;
}

/* ════════════════════════════════════════════
   PRODUCT IMAGE STACK
   ════════════════════════════════════════════ */
function ProductImageStack(container, imgs, name, productId) {
  this.container   = container;
  this.imgs        = imgs;
  this.name        = name;
  this.productId   = productId;
  this.frontIdx    = 0;
  this.locked      = false;
  this._touchStartX = 0;
  /* true on devices that have a real pointer and support CSS :hover */
  this._hasHover   = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  this._build();
}

/* Returns 'front'|'left'|'right'|'back' for image at imgIdx given current frontIdx.
   n=1: only front
   n=2: front + right
   n=3: front, left(1), right(2)
   n=4: front, left(1), back(2), right(3) */
ProductImageStack.prototype._posOf = function(imgIdx) {
  var n    = this.imgs.length;
  var diff = (imgIdx - this.frontIdx + n) % n;
  if (diff === 0) return 'front';
  if (n === 2)    return 'right';
  if (diff === 1) return 'left';
  if (n === 3)    return 'right';
  if (diff === 2) return 'back';
  return 'right';
};

ProductImageStack.prototype._build = function() {
  var self = this;
  var n = this.imgs.length;
  this.container.innerHTML = '';

  var wrap = document.createElement('div');
  wrap.className = 'iss-wrap';
  this.container.appendChild(wrap);
  this._wrap = wrap;

  this._cards = this.imgs.map(function(src, i) {
    var card = document.createElement('div');
    card.className    = 'iss-card';
    card.dataset.pos  = self._posOf(i);
    card.dataset.idx  = i;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', self.name + ' — ' + t('Image', 'صورة') + ' ' + (i + 1));
    card.setAttribute('tabindex', i === 0 ? '0' : '-1');
    var img       = document.createElement('img');
    img.src        = src;
    img.alt        = self.name + ' ' + (i + 1);
    img.loading    = i === 0 ? 'eager' : 'lazy';
    img.decoding   = 'async';
    card.appendChild(img);
    wrap.appendChild(card);
    return card;
  });

  /* Counter: "1/3" top-right — only shown when n > 1 */
  if (n > 1) {
    var counter = document.createElement('div');
    counter.className = 'iss-counter';
    counter.setAttribute('aria-hidden', 'true');
    counter.textContent = '1/' + n;
    this.container.appendChild(counter);
    this._counter = counter;
  } else {
    this._counter = null;
  }

  /* Navigation dots — only shown when n > 1 */
  if (n > 1) {
    var dotsWrap = document.createElement('div');
    dotsWrap.className = 'iss-dots';
    dotsWrap.setAttribute('aria-hidden', 'true');
    this._dotEls = this.imgs.map(function(_, i) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'iss-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', t('Image', 'صورة') + ' ' + (i + 1));
      dot.addEventListener('click', function(e) {
        e.stopPropagation();
        self.rotateTo(i);
      });
      dotsWrap.appendChild(dot);
      return dot;
    });
    this.container.appendChild(dotsWrap);
  } else {
    this._dotEls = [];
  }

  this._applyZ();
  this._bind();
};

/* Sync z-index, counter, and dots to current frontIdx */
ProductImageStack.prototype._applyZ = function() {
  var self = this;
  var n = this.imgs.length;
  this._cards.forEach(function(card, i) {
    card.style.zIndex = self._posOf(i) === 'front' ? '3' : '2';
    card.setAttribute('tabindex', self._posOf(i) === 'front' ? '0' : '-1');
  });
  if (this._counter) {
    this._counter.textContent = (this.frontIdx + 1) + '/' + n;
  }
  if (this._dotEls && this._dotEls.length) {
    this._dotEls.forEach(function(dot, i) {
      dot.classList.toggle('active', i === self.frontIdx);
    });
  }
};

/* Smoothly rotate so newFront becomes the front image */
ProductImageStack.prototype.rotateTo = function(newFront) {
  if (newFront === this.frontIdx || this.locked) return;
  this.locked = true;
  var self    = this;
  var n       = this.imgs.length;

  /* Elevate the incoming card above the current front before the CSS transition fires */
  this._cards[newFront].style.zIndex = '4';

  this.frontIdx = newFront;
  this._cards.forEach(function(card, i) {
    card.dataset.pos = self._posOf(i);
  });

  /* Update counter and dots immediately for instant feedback */
  if (this._counter) {
    this._counter.textContent = (this.frontIdx + 1) + '/' + n;
  }
  if (this._dotEls && this._dotEls.length) {
    this._dotEls.forEach(function(dot, i) {
      dot.classList.toggle('active', i === self.frontIdx);
    });
  }

  /* Normalise z-indices after the CSS transition completes */
  setTimeout(function() {
    self.locked = false;
    self._applyZ();
  }, 520);
};

ProductImageStack.prototype._bind = function() {
  var self = this;
  var n    = this.imgs.length;
  var wrap = this._wrap;

  /* ── Desktop hover: mouseover delegates to the wrap (mouseenter doesn't bubble) ── */
  if (self._hasHover) {
    wrap.addEventListener('mouseover', function(e) {
      var card = e.target.closest('.iss-card');
      if (!card) return;
      var i = parseInt(card.dataset.idx, 10);
      if (self._posOf(i) !== 'front') self.rotateTo(i);
    });
  }

  /* ── Click / tap: single delegated listener on the wrap ── */
  wrap.addEventListener('click', function(e) {
    var card = e.target.closest('.iss-card');
    if (!card) return;
    e.stopPropagation();
    var i = parseInt(card.dataset.idx, 10);
    var isFront = self._posOf(i) === 'front';
    if (!self._hasHover && !isFront) {
      self.rotateTo(i);
    } else {
      imgGallery.open(self.productId, i);
    }
  });

  /* ── Keyboard: single delegated listener on the wrap ── */
  wrap.addEventListener('keydown', function(e) {
    if (!e.target.closest('.iss-card')) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      self.rotateTo((self.frontIdx + 1) % n);
      self._cards[self.frontIdx].focus();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      self.rotateTo((self.frontIdx - 1 + n) % n);
      self._cards[self.frontIdx].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      imgGallery.open(self.productId, self.frontIdx);
    }
  });

  /* ── Touch swipe ── */
  wrap.addEventListener('touchstart', function(e) {
    self._touchStartX = e.touches[0].clientX;
  }, { passive: true });

  wrap.addEventListener('touchend', function(e) {
    var dx = e.changedTouches[0].clientX - self._touchStartX;
    if (Math.abs(dx) > 35) {
      var newFront = dx < 0
        ? (self.frontIdx - 1 + n) % n
        : (self.frontIdx + 1) % n;
      self.rotateTo(newFront);
    }
  }, { passive: true });
};

/* ════════════════════════════════════════════
   CART TOAST
   ════════════════════════════════════════════ */
var _toastEl    = null;
var _toastTimer = null;

function showCartToast(productName) {
  if (!_toastEl) {
    var el = document.createElement('div');
    el.className = 'cart-toast';
    el.innerHTML = [
      '<span class="cart-toast-icon">',
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      '</span>',
      '<div class="cart-toast-body">',
        '<div class="cart-toast-title">' + t('Added to Cart', 'أُضيف إلى السلة') + '</div>',
        '<div class="cart-toast-name"></div>',
      '</div>',
      '<button class="cart-toast-view">' + t('View Cart', 'عرض السلة') + '</button>',
      '<button class="cart-toast-close" aria-label="' + t('Close', 'إغلاق') + '">&times;</button>'
    ].join('');
    document.body.appendChild(el);
    _toastEl = el;
    el.querySelector('.cart-toast-view').addEventListener('click', function() {
      cart.openDrawer();
      _hideCartToast();
    });
    el.querySelector('.cart-toast-close').addEventListener('click', _hideCartToast);
  }
  _toastEl.querySelector('.cart-toast-name').textContent = productName;
  clearTimeout(_toastTimer);
  _toastEl.classList.add('show');
  _toastTimer = setTimeout(_hideCartToast, 3200);
}

function _hideCartToast() {
  if (_toastEl) _toastEl.classList.remove('show');
  clearTimeout(_toastTimer);
}

/* ════════════════════════════════════════════
   CARD BUILDER
   ════════════════════════════════════════════ */
function buildCard(p) {
  var name        = IS_AR ? p.nameAr : p.name;
  var desc        = IS_AR ? p.descAr : p.desc;
  var warrantyLbl = IS_AR ? p.warrantyLabelAr : p.warrantyLabel;
  var detailsLbl  = t('View Details','عرض التفاصيل');
  var orderLbl    = t('Order Now','اطلب الآن');
  var addCartLbl  = t('Add to Cart','أضف للسلة');
  var hasImgs     = p.imgs && p.imgs.length > 0;
  var catLbl      = catLabel(p.cat);
  var inWishlist  = wishlist.has(p.id);

  /* Image area */
  var imgArea = document.createElement('div');
  imgArea.className = 'prod-card-img';

  if (hasImgs) {
    new ProductImageStack(imgArea, p.imgs, name, p.id);
  } else {
    var noImg = document.createElement('div');
    noImg.className = 'prod-card-no-img';
    noImg.innerHTML =
      '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
      '<span>' + t('Image Coming Soon','الصورة قريباً') + '</span>';
    imgArea.appendChild(noImg);
  }

  /* Category badge — after image stack so ProductImageStack._build() doesn't wipe it */
  var catBadge = document.createElement('span');
  catBadge.className = 'prod-cat-badge';
  catBadge.textContent = catLbl;
  imgArea.appendChild(catBadge);

  /* Quality badge (NEW, BEST SELLER, FEATURED, SALE, etc.) */
  if (p.badge) {
    var qBadge = document.createElement('span');
    qBadge.className = 'prod-q-badge prod-q-badge--' + p.badge.toLowerCase().replace(/\s+/g, '-');
    qBadge.textContent = p.badge;
    imgArea.appendChild(qBadge);
  }

  /* Quick actions overlay */
  var qa = document.createElement('div');
  qa.className = 'prod-qa';
  qa.innerHTML = [
    '<button class="pqa-btn btn-wishlist' + (inWishlist ? ' wishlisted' : '') + '" data-id="' + p.id + '" aria-label="' + t('Wishlist','المفضلة') + '" title="' + t('Wishlist','المفضلة') + '">',
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + (inWishlist ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>',
    '</button>',
    '<button class="pqa-btn btn-quickview" data-id="' + p.id + '" aria-label="' + t('Quick View','عرض سريع') + '" title="' + t('Quick View','عرض سريع') + '">',
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    '</button>',
    '<button class="pqa-btn btn-share" data-id="' + p.id + '" aria-label="' + t('Share','مشاركة') + '" title="' + t('Share','مشاركة') + '">',
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
    '</button>'
  ].join('');
  imgArea.appendChild(qa);

  /* Card wrapper */
  var div = document.createElement('div');
  div.className   = 'prod-card';
  div.dataset.id  = p.id;
  div.dataset.cat = p.cat;
  div.appendChild(imgArea);

  /* Card body */
  var stockHtml = '';
  if (p.availability) {
    var isStock = p.availability === 'In Stock';
    stockHtml = '<span class="prod-stock ' + (isStock ? 'ps-instock' : 'ps-order') + '">' +
      (isStock
        ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' + t('In Stock','متوفر')
        : t('Made to Order','حسب الطلب')
      ) + '</span>';
  }

  var priceHtml = '<div class="prod-price-row">' +
    '<div class="prod-price">' + fmt(p.price) + '</div>' +
    (p.oldPrice ? '<div class="prod-old-price">' + fmt(p.oldPrice) + '</div>' : '') +
    (warrantyLbl
      ? '<span class="prod-warranty-badge"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' + warrantyLbl + '</span>'
      : '') +
    '</div>';

  var body = document.createElement('div');
  body.className = 'prod-card-body';
  body.innerHTML = [
    '<div class="prod-name-row">',
      '<div class="prod-name">' + name + '</div>',
      stockHtml,
    '</div>',
    starsHtml(p.rating, p.reviewCount),
    '<p class="prod-desc">' + desc + '</p>',
    priceHtml,
    '<div class="prod-actions">',
      '<button class="btn-view-details" data-id="' + p.id + '" aria-label="' + detailsLbl + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
        detailsLbl +
      '</button>',
      '<button class="btn-add-cart" data-id="' + p.id + '" aria-label="' + addCartLbl + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/><line x1="17" y1="9" x2="17" y2="15"/><line x1="14" y1="12" x2="20" y2="12"/></svg>' +
        addCartLbl +
      '</button>',
      '<button class="btn-order-now" data-id="' + p.id + '" aria-label="' + orderLbl + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
        orderLbl +
      '</button>',
    '</div>'
  ].join('');
  div.appendChild(body);

  return div;
}

var BATCH_SIZE = 12;       // LCM(4,3,2)=12 — every initial render & Load More ends on a complete row
var renderedCount = 0;

function renderBatch() {
  if (!grid) return;
  var slice = PRODUCTS.slice(renderedCount, renderedCount + BATCH_SIZE);
  var frag = document.createDocumentFragment();   // efficient single reflow
  var newCards = [];
  slice.forEach(function(p) {
    var card = buildCard(p);
    frag.appendChild(card);
    newCards.push(card);
  });
  grid.appendChild(frag);
  newCards.forEach(function(c, i) {
    setTimeout(function() { c.classList.add('visible'); }, 30 + i * 45);
  });
  renderedCount += slice.length;
  var wrap = document.getElementById('prodLoadMoreWrap');
  if (wrap) wrap.style.display = (renderedCount < PRODUCTS.length) ? '' : 'none';
}

function renderProducts() {
  if (!grid) return;
  grid.innerHTML = '';
  renderedCount = 0;
  renderBatch();
  // Load More button
  var lm = document.getElementById('prodLoadMore');
  if (lm) {
    lm.textContent = t('Load More Products', 'عرض المزيد من المنتجات');
    lm.addEventListener('click', renderBatch);
  }
  // Delegate card click events (attached once)
  grid.addEventListener('click', function(e) {
    var detBtn   = e.target.closest('.btn-view-details');
    var ord      = e.target.closest('.btn-order-now');
    var addCart  = e.target.closest('.btn-add-cart');
    var wlBtn    = e.target.closest('.btn-wishlist');
    var qvBtn    = e.target.closest('.btn-quickview');
    var shareBtn = e.target.closest('.btn-share');
    var imgArea  = e.target.closest('.prod-card-img');
    var card     = e.target.closest('.prod-card');

    if (wlBtn) {
      e.stopPropagation();
      var id = parseInt(wlBtn.dataset.id, 10);
      var added = wishlist.toggle(id);
      wlBtn.classList.toggle('wishlisted', added);
      var svg = wlBtn.querySelector('svg');
      if (svg) svg.setAttribute('fill', added ? 'currentColor' : 'none');
    } else if (qvBtn) {
      e.stopPropagation();
      prodModal.open(parseInt(qvBtn.dataset.id, 10));
    } else if (shareBtn) {
      e.stopPropagation();
      var sp = getProduct(parseInt(shareBtn.dataset.id, 10));
      if (sp) shareProduct(sp);
    } else if (detBtn) {
      e.stopPropagation();
      prodModal.open(parseInt(detBtn.dataset.id, 10));
    } else if (ord) {
      e.stopPropagation();
      orderModal.open(parseInt(ord.dataset.id, 10), 1);
    } else if (addCart) {
      e.stopPropagation();
      var p = getProduct(parseInt(addCart.dataset.id, 10));
      if (p) { cart.add(p.id, 1); showCartToast(IS_AR ? p.nameAr : p.name); }
    } else if (imgArea) {
      var imgCard = imgArea.closest('.prod-card');
      if (imgCard) imgGallery.open(parseInt(imgCard.dataset.id, 10), 0);
    } else if (card) {
      prodModal.open(parseInt(card.dataset.id, 10));
    }
  });
}


/* ════════════════════════════════════════════
   PRODUCT MODAL
   ════════════════════════════════════════════ */
var prodModal = {
  el: null,
  modalQty: 1,
  currentImgIdx: 0,
  currentProduct: null,

  init: function() {
    this.el = document.getElementById('prodModal');
    if (!this.el) return;
    var self = this;
    document.getElementById('pmClose').addEventListener('click', function() { self.close(); });
    document.getElementById('prodModalBd').addEventListener('click', function() { self.close(); });
    document.getElementById('pmQtyMinus').addEventListener('click', function() {
      if (self.modalQty > 1) { self.modalQty--; self.updateQty(); }
    });
    document.getElementById('pmQtyPlus').addEventListener('click', function() {
      self.modalQty++;
      self.updateQty();
    });
    document.getElementById('pmAddCart').addEventListener('click', function() {
      if (!self.currentProduct) return;
      cart.add(self.currentProduct.id, self.modalQty);
      self.close();
    });
    document.getElementById('pmOrderNow').addEventListener('click', function() {
      if (!self.currentProduct) return;
      self.close();
      orderModal.open(self.currentProduct.id, self.modalQty);
    });
    var quoteBtn = document.getElementById('pmQuoteBtn');
    if (quoteBtn) {
      quoteBtn.addEventListener('click', function() {
        if (!self.currentProduct) return;
        self.close();
        orderModal.open(self.currentProduct.id, self.modalQty);
      });
    }
    document.addEventListener('keydown', function(e) {
      if (!self.el || !self.el.classList.contains('open')) return;
      if (e.key === 'Escape') { self.close(); }
      else if (e.key === 'ArrowLeft')  { self.goImg(self.currentImgIdx - 1); }
      else if (e.key === 'ArrowRight') { self.goImg(self.currentImgIdx + 1); }
    });

    // Inject gallery prev/next nav buttons + touch swipe
    var gallerySide = this.el.querySelector('.pm-gallery-side');
    if (gallerySide) {
      var prevBtn = document.createElement('button');
      prevBtn.className = 'pm-img-prev';
      prevBtn.setAttribute('aria-label', t('Previous image','الصورة السابقة'));
      prevBtn.innerHTML = '&#8592;';
      prevBtn.addEventListener('click', function(e) { e.stopPropagation(); self.goImg(self.currentImgIdx - 1); });

      var nextBtn = document.createElement('button');
      nextBtn.className = 'pm-img-next';
      nextBtn.setAttribute('aria-label', t('Next image','الصورة التالية'));
      nextBtn.innerHTML = '&#8594;';
      nextBtn.addEventListener('click', function(e) { e.stopPropagation(); self.goImg(self.currentImgIdx + 1); });

      gallerySide.appendChild(prevBtn);
      gallerySide.appendChild(nextBtn);

      var pmTouchX = 0;
      var mainImgWrap = this.el.querySelector('.pm-main-img');
      if (mainImgWrap) {
        mainImgWrap.addEventListener('touchstart', function(e) { pmTouchX = e.touches[0].clientX; }, {passive:true});
        mainImgWrap.addEventListener('touchend', function(e) {
          var dx = e.changedTouches[0].clientX - pmTouchX;
          if (Math.abs(dx) > 40) self.goImg(dx < 0 ? self.currentImgIdx + 1 : self.currentImgIdx - 1);
        }, {passive:true});
      }
    }
  },

  goImg: function(idx) {
    if (!this.currentProduct) return;
    var p    = this.currentProduct;
    var imgs = p.imgs && p.imgs.length ? p.imgs : (p.img ? [p.img] : []);
    var len  = imgs.length;
    if (!len) return;
    var n = ((idx % len) + len) % len;

    /* Same image — nothing to do */
    if (n === this.currentImgIdx) return;

    var prev = this.currentImgIdx;
    this.currentImgIdx = n;

    /* Update active thumbnail using cached refs — no querySelectorAll per click */
    if (this._thumbEls) {
      if (this._thumbEls[prev]) this._thumbEls[prev].classList.remove('active');
      if (this._thumbEls[n])    this._thumbEls[n].classList.add('active');
    }

    /* Swap main image via decode() so the browser can decode off the main thread.
       The Promise resolves in a microtask if already decoded (cached), or async if not.
       Either way the click handler returns immediately, keeping INP low. */
    var mainImg = document.getElementById('pmMainImg');
    if (!mainImg || !imgs[n]) return;
    var src    = imgs[n];
    var altTxt = (IS_AR ? p.nameAr : p.name) + ' ' + (n + 1);
    var tmpImg = new Image();
    tmpImg.src = src;
    var doSwap = function() { mainImg.src = src; mainImg.alt = altTxt; };
    (tmpImg.decode ? tmpImg.decode().then(doSwap).catch(doSwap) : (doSwap(), Promise.resolve()));

    /* Preload the adjacent images so the next click is instant */
    var self = this;
    _ric(function() {
      [-1, 1].forEach(function(d) {
        var adj = ((n + d + len) % len);
        if (adj !== prev && imgs[adj]) {
          var pre = new Image();
          pre.src = imgs[adj];
          pre.decode && pre.decode().catch(function(){});
        }
      });
    }, { timeout: 1000 });
  },

  open: function(id) {
    var p = getProduct(id);
    if (!p || !this.el) return;
    this.currentProduct = p;
    this.modalQty = 1;
    this._thumbEls = null; /* clear stale refs from previous product */

    /* Phase 1 — paint the modal shell immediately so the frame commits fast (good INP). */
    this.populateFast(p);
    this.el.classList.add('open');
    document.body.style.overflow = 'hidden';

    /* Phase 2 — fill the heavy sections (specs table, tags, thumbnails) after the first
       painted frame so they never block the interaction response. */
    var self = this;
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        self.populateSlow(p);
      });
    });
  },

  close: function() {
    if (!this.el) return;
    this.el.classList.remove('open');
    document.body.style.overflow = '';
  },

  /* Phase 1: above-the-fold content — name, price, image. Runs before first paint. */
  populateFast: function(p) {
    var name        = IS_AR ? p.nameAr : p.name;
    var desc        = IS_AR ? p.descAr : p.desc;
    var warrantyLbl = IS_AR ? p.warrantyLabelAr : p.warrantyLabel;

    document.getElementById('pmCat').textContent   = catLabel(p.cat);
    document.getElementById('pmTitle').textContent  = name;
    document.getElementById('pmPrice').innerHTML    = fmt(p.price);
    document.getElementById('pmDesc').textContent   = desc;

    var wBadge = document.getElementById('pmWarrantyBadge');
    if (wBadge) {
      wBadge.textContent = warrantyLbl || '';
      wBadge.style.display = warrantyLbl ? '' : 'none';
    }

    /* Main image — needed above the fold */
    var mainImg = document.getElementById('pmMainImg');
    var imgs = p.imgs && p.imgs.length ? p.imgs : (p.img ? [p.img] : []);
    this.currentImgIdx = 0;
    if (imgs.length) {
      mainImg.src = imgs[0];
      mainImg.alt = name;
      mainImg.style.display = '';
    } else {
      mainImg.src = '';
      mainImg.style.display = 'none';
    }

    this.updateQty();
  },

  /* Phase 2: below-the-fold content — deferred to after the first frame. */
  populateSlow: function(p) {
    var name         = IS_AR ? p.nameAr : p.name;
    var specs        = IS_AR ? p.specsAr : p.specs;
    var features     = IS_AR ? (p.featuresAr || []) : (p.features || []);
    var applications = IS_AR ? (p.applicationsAr || []) : (p.applications || []);
    var finishes     = IS_AR ? (p.finishesAr || []) : (p.finishes || []);
    var sizes        = p.sizes || ['2100 × 900 mm', '2100 × 1000 mm'];
    var imgs         = p.imgs && p.imgs.length ? p.imgs : (p.img ? [p.img] : []);

    /* Features list */
    var featEl = document.getElementById('pmFeatures');
    if (featEl) {
      featEl.innerHTML = features.map(function(f) {
        return '<li><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' + f + '</li>';
      }).join('');
    }

    /* Specs table — build with fragment to minimise reflow */
    var specsEl = document.getElementById('pmSpecs');
    if (specsEl) {
      var frag = document.createDocumentFragment();
      Object.keys(specs).forEach(function(k) {
        var row = document.createElement('div');
        row.className = 'pm-spec-row';
        row.innerHTML = '<div class="pm-spec-key">' + k + '</div><div class="pm-spec-val">' + specs[k] + '</div>';
        frag.appendChild(row);
      });
      specsEl.innerHTML = '';
      specsEl.appendChild(frag);
    }

    /* Tag groups */
    var appsEl = document.getElementById('pmApplications');
    if (appsEl) appsEl.innerHTML = applications.map(function(a) { return '<span class="pm-tag">' + a + '</span>'; }).join('');

    var finEl = document.getElementById('pmFinishes');
    if (finEl) finEl.innerHTML = finishes.map(function(f) { return '<span class="pm-tag">' + f + '</span>'; }).join('');

    var sizeEl = document.getElementById('pmSizes');
    if (sizeEl) sizeEl.innerHTML = sizes.map(function(s) { return '<span class="pm-tag pm-tag-size">' + s + '</span>'; }).join('');

    /* WhatsApp link */
    var waEl = document.getElementById('pmWhatsapp');
    if (waEl) {
      waEl.href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(t(
        'Hello Al Farooque Manufacturing, I am interested in: ' + name + '. Please send me a quotation.',
        'مرحباً شركة الفاروق للتصنيع، أنا مهتم بـ: ' + name + '. أرجو إرسال عرض سعر.'
      ));
    }

    /* Quote button */
    var quoteEl = document.getElementById('pmQuoteBtn');
    if (quoteEl) quoteEl.dataset.id = p.id;

    /* Thumbnails — build with fragment, cache element refs for fast goImg() */
    var thumbsEl = document.getElementById('pmThumbs');
    if (thumbsEl) {
      var self = this;
      var thumbFrag = document.createDocumentFragment();
      var thumbEls  = [];
      imgs.forEach(function(src, i) {
        var div = document.createElement('div');
        div.className = 'pm-thumb' + (i === 0 ? ' active' : '');
        var img = document.createElement('img');
        img.src      = src;
        img.alt      = name + ' ' + (i + 1);
        img.loading  = 'lazy';
        img.decoding = 'async';
        div.appendChild(img);
        div.addEventListener('click', function() { self.goImg(i); });
        thumbFrag.appendChild(div);
        thumbEls.push(div);
      });
      thumbsEl.innerHTML = '';
      thumbsEl.appendChild(thumbFrag);
      this._thumbEls = thumbEls; /* store for O(1) active-state swaps in goImg() */
    }

    /* Pre-decode all product images on idle so subsequent goImg() calls resolve instantly */
    if (imgs.length > 1) {
      _ric(function() {
        imgs.forEach(function(src, i) {
          if (i === 0) return; /* first image already decoded by populateFast */
          var pre = new Image();
          pre.src = src;
          pre.decode && pre.decode().catch(function(){});
        });
      }, { timeout: 2000 });
    }
  },

  /* Legacy alias — kept so any external callers still work. */
  populate: function(p) {
    this.populateFast(p);
    this.populateSlow(p);
  },

  updateQty: function() {
    var el = document.getElementById('pmQtyNum');
    if (el) el.textContent = this.modalQty;
    var totalEl = document.getElementById('pmTotal');
    if (totalEl && this.currentProduct) {
      totalEl.textContent = t('Total: ','الإجمالي: ');
      var strong = document.createElement('strong');
      strong.textContent = fmt(this.currentProduct.price * this.modalQty);
      totalEl.appendChild(strong);
    }
  }
};

/* ════════════════════════════════════════════
   CART SYSTEM
   ════════════════════════════════════════════ */
var cart = {
  items: [],
  drawerEl: null,
  backdropEl: null,
  fabBadge: null,

  init: function() {
    this.load();
    this.drawerEl  = document.getElementById('cartDrawer');
    this.backdropEl= document.getElementById('cartBackdrop');
    this.fabBadge  = document.getElementById('cartFabBadge');
    var self = this;

    var fab = document.getElementById('cartFab');
    if (fab) fab.addEventListener('click', function() { self.openDrawer(); });

    var closeBtn = document.getElementById('cartClose');
    if (closeBtn) closeBtn.addEventListener('click', function() { self.closeDrawer(); });

    if (this.backdropEl) this.backdropEl.addEventListener('click', function() { self.closeDrawer(); });

    var proceedBtn = document.getElementById('cartProceed');
    if (proceedBtn) proceedBtn.addEventListener('click', function() {
      if (!self.items.length) return;
      self.closeDrawer();
      orderModal.openCart();
    });

    /* Single delegated listener on list — handles all qty/remove clicks */
    var list = document.getElementById('cartItemsList');
    if (list) {
      list.addEventListener('click', function(e) {
        var minus  = e.target.closest('.ci-minus');
        var plus   = e.target.closest('.ci-plus');
        var remove = e.target.closest('.cart-item-remove');
        if (minus)  self.updateQty(parseInt(minus.dataset.id, 10), -1);
        else if (plus)   self.updateQty(parseInt(plus.dataset.id, 10), 1);
        else if (remove) self.remove(parseInt(remove.dataset.id, 10));
      });
    }

    this.renderDrawer();
    this.updateBadge();
  },

  load: function() {
    try { this.items = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch(e) { this.items = []; }
  },

  save: function() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(this.items)); } catch(e) {}
  },

  add: function(id, qty) {
    var existing = this.items.filter(function(i){return i.id===id;})[0];
    if (existing) {
      existing.qty += qty;
    } else {
      this.items.push({id: id, qty: qty});
    }
    this.save();
    this.renderDrawer();
    this.updateBadge(true);
  },

  remove: function(id) {
    this.items = this.items.filter(function(i){return i.id!==id;});
    this.save();
    this.renderDrawer();
    this.updateBadge(false);
  },

  updateQty: function(id, delta) {
    var item = this.items.filter(function(i){return i.id===id;})[0];
    if (!item) return;
    item.qty = item.qty + delta;
    if (item.qty <= 0) { return this.remove(id); }
    this.save();
    this.renderDrawer();
    this.updateBadge(false);
  },

  total: function() {
    return this.items.reduce(function(sum, i) {
      var p = getProduct(i.id);
      return sum + (p ? p.price * i.qty : 0);
    }, 0);
  },

  vat: function() {
    return Math.round(this.total() * 0.15);
  },

  grand: function() {
    return this.total() + this.vat();
  },

  count: function() {
    return this.items.reduce(function(s,i){return s+i.qty;}, 0);
  },

  openDrawer: function() {
    if (this.drawerEl)   this.drawerEl.classList.add('open');
    if (this.backdropEl) this.backdropEl.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  closeDrawer: function() {
    if (this.drawerEl)   this.drawerEl.classList.remove('open');
    if (this.backdropEl) this.backdropEl.classList.remove('open');
    document.body.style.overflow = '';
  },

  updateBadge: function(bump) {
    var c = this.count();
    var badge = this.fabBadge;
    if (!badge) return;
    badge.textContent = c;
    badge.classList.toggle('show', c > 0);
    if (bump && c > 0) {
      /* Use rAF double-frame to restart animation without forced layout */
      badge.classList.remove('bump');
      requestAnimationFrame(function() {
        requestAnimationFrame(function() { badge.classList.add('bump'); });
      });
    }
    var dc = document.getElementById('cartDrCount');
    if (dc) dc.textContent = t(c + ' item' + (c!==1?'s':''), c + ' منتج');
  },

  renderDrawer: function() {
    var list = document.getElementById('cartItemsList');
    if (!list) return;
    var frag = document.createDocumentFragment();
    if (!this.items.length) {
      var empty = document.createElement('div');
      empty.className = 'cart-empty-msg';
      empty.innerHTML = '<span class="cart-empty-ico">🛒</span><div class="cart-empty-txt">' + t('Your cart is empty','سلة التسوق فارغة') + '</div>';
      frag.appendChild(empty);
    } else {
      this.items.forEach(function(ci) {
        var p = getProduct(ci.id);
        if (!p) return;
        var name = IS_AR ? p.nameAr : p.name;
        var el = document.createElement('div');
        el.className = 'cart-item';
        el.dataset.id = p.id;
        el.innerHTML = [
          '<div class="cart-item-img"><img src="' + p.img + '" alt="' + name + '" loading="lazy" decoding="async"></div>',
          '<div class="cart-item-info">',
            '<div class="cart-item-name">' + name + '</div>',
            '<div class="cart-item-unit-price">' + fmt(p.price * ci.qty) + '</div>',
            '<div class="ci-qty-ctrl">',
              '<button class="ci-qty-btn ci-minus" data-id="' + p.id + '">−</button>',
              '<span class="ci-qty-val">' + ci.qty + '</span>',
              '<button class="ci-qty-btn ci-plus" data-id="' + p.id + '">+</button>',
            '</div>',
          '</div>',
          '<button class="cart-item-remove" data-id="' + p.id + '" aria-label="' + t('Remove','حذف') + '">×</button>'
        ].join('');
        frag.appendChild(el);
      });
    }
    list.textContent = ''; /* clear without innerHTML assignment */
    list.appendChild(frag);

    /* Single delegated listener — set once in init(), not recreated here */
    var total = this.total();
    var vat   = this.vat();
    var grand = this.grand();
    var subEl = document.getElementById('cartSubtotal');
    var vatEl = document.getElementById('cartVat');
    var totEl = document.getElementById('cartGrandTotal');
    if (subEl) subEl.textContent = fmt(total);
    if (vatEl) vatEl.textContent = fmt(vat);
    if (totEl) totEl.textContent = fmt(grand);
    var proceedBtn = document.getElementById('cartProceed');
    if (proceedBtn) proceedBtn.disabled = !this.items.length;
    this.updateBadge(false);
  }
};

/* ════════════════════════════════════════════
   ORDER MODAL
   ════════════════════════════════════════════ */
var orderModal = {
  el: null,
  productId: null,
  qty: 1,
  isCartOrder: false,

  init: function() {
    this.el = document.getElementById('orderModal');
    if (!this.el) return;
    var self = this;
    document.getElementById('omClose').addEventListener('click', function() { self.close(); });
    document.getElementById('orderModalBd').addEventListener('click', function() { self.close(); });
    document.getElementById('omQtyMinus').addEventListener('click', function() {
      if (self.qty > 1) { self.qty--; self.updateTotal(); }
    });
    document.getElementById('omQtyPlus').addEventListener('click', function() {
      self.qty++;
      self.updateTotal();
    });
    document.getElementById('omWaBtn').addEventListener('click', function() { self.sendWhatsApp(); });
    document.getElementById('omEmBtn').addEventListener('click', function() { self.sendEmail(); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && self.el.classList.contains('open')) self.close();
    });
  },

  open: function(id, qty) {
    this.productId  = id;
    this.qty        = qty || 1;
    this.isCartOrder= false;
    var p = getProduct(id);
    if (!p) return;
    var name = IS_AR ? p.nameAr : p.name;
    document.getElementById('omProdImg').src = p.img;
    document.getElementById('omProdImg').alt = name;
    document.getElementById('omProdName').textContent = name;
    document.getElementById('omProdPrice').textContent = fmt(p.price);
    document.getElementById('omProdNote').textContent = t('Unit price','سعر الوحدة');
    document.getElementById('omQtyVal').textContent = this.qty;
    // Show qty section for single product
    var qtySection = document.getElementById('omQtySection');
    if (qtySection) qtySection.style.display = '';
    this.updateTotal();
    this.el.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  openCart: function() {
    this.isCartOrder = true;
    this.qty = cart.count();
    // Show cart summary
    var p = {img: 'assets/images/logo/IAA_LOGO.png', nameAr: 'سلة التسوق', name: 'Cart Order (' + this.qty + ' items)'};
    document.getElementById('omProdImg').src = p.img;
    document.getElementById('omProdImg').alt = IS_AR ? p.nameAr : p.name;
    document.getElementById('omProdName').textContent = IS_AR ? p.nameAr : p.name;
    document.getElementById('omProdPrice').textContent = fmt(cart.grand());
    document.getElementById('omProdNote').textContent = t('Grand Total (incl. 15% VAT)','الإجمالي الكلي (شامل ضريبة 15%)');
    var qtySection = document.getElementById('omQtySection');
    if (qtySection) qtySection.style.display = 'none';
    this.updateTotal();
    this.el.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  close: function() {
    if (!this.el) return;
    this.el.classList.remove('open');
    document.body.style.overflow = '';
  },

  updateTotal: function() {
    var subEl   = document.getElementById('omSubtotalVal');
    var vatEl   = document.getElementById('omVatVal');
    var grandEl = document.getElementById('omGrandVal');
    if (!subEl) return;
    var subtotal, vat, grand;
    if (this.isCartOrder) {
      subtotal = cart.total();
      vat      = cart.vat();
      grand    = cart.grand();
    } else {
      var p = getProduct(orderModal.productId);
      subtotal = p ? p.price * this.qty : 0;
      vat      = Math.round(subtotal * 0.15);
      grand    = subtotal + vat;
    }
    subEl.textContent   = fmt(subtotal);
    vatEl.textContent   = fmt(vat);
    grandEl.textContent = fmt(grand);
    var qtyEl = document.getElementById('omQtyVal');
    if (qtyEl && !this.isCartOrder) qtyEl.textContent = this.qty;
  },

  buildMessage: function() {
    var name  = document.getElementById('omName').value.trim()  || '—';
    var phone = document.getElementById('omPhone').value.trim() || '—';
    var email = document.getElementById('omEmail').value.trim() || '—';
    var msg   = document.getElementById('omMsg').value.trim()   || '';
    var lines = [];
    if (IS_AR) {
      lines.push('🛒 *طلب منتج جديد — الفاروقي للتصنيع*\n');
      if (this.isCartOrder) {
        lines.push('📦 *المنتجات:*');
        cart.items.forEach(function(ci) {
          var p = getProduct(ci.id);
          if (p) lines.push('  • ' + p.nameAr + ' × ' + ci.qty + ' — ' + fmt(p.price * ci.qty));
        });
        lines.push('💵 *المجموع الجزئي:* ' + fmt(cart.total()));
        lines.push('🧾 *ضريبة القيمة المضافة (15%):* ' + fmt(cart.vat()));
        lines.push('💰 *الإجمالي الكلي:* ' + fmt(cart.grand()));
      } else {
        var p = getProduct(this.productId);
        if (p) {
          var sub = p.price * this.qty;
          var vat = Math.round(sub * 0.15);
          lines.push('📦 *المنتج:* ' + p.nameAr);
          lines.push('💵 *سعر الوحدة:* ' + fmt(p.price));
          lines.push('🔢 *الكمية:* ' + this.qty);
          lines.push('💵 *المجموع الجزئي:* ' + fmt(sub));
          lines.push('🧾 *ضريبة القيمة المضافة (15%):* ' + fmt(vat));
          lines.push('💰 *الإجمالي الكلي:* ' + fmt(sub + vat));
        }
      }
      lines.push('\n👤 *الاسم:* ' + name);
      lines.push('📞 *الهاتف:* ' + phone);
      lines.push('📧 *البريد:* ' + email);
      if (msg) lines.push('💬 *ملاحظة:* ' + msg);
      lines.push('\nأرغب في تأكيد الطلب. يرجى التواصل معي.');
    } else {
      lines.push('🛒 *New Product Order — AL FAROOQUE Manufacturing*\n');
      if (this.isCartOrder) {
        lines.push('📦 *Products:*');
        cart.items.forEach(function(ci) {
          var p = getProduct(ci.id);
          if (p) lines.push('  • ' + p.name + ' × ' + ci.qty + ' — ' + fmt(p.price * ci.qty));
        });
        lines.push('💵 *Subtotal:* ' + fmt(cart.total()));
        lines.push('🧾 *VAT (15%):* ' + fmt(cart.vat()));
        lines.push('💰 *Grand Total:* ' + fmt(cart.grand()));
      } else {
        var p = getProduct(orderModal.productId);
        if (p) {
          var sub = p.price * this.qty;
          var vat = Math.round(sub * 0.15);
          lines.push('📦 *Product:* ' + p.name);
          lines.push('💵 *Unit Price:* ' + fmt(p.price));
          lines.push('🔢 *Quantity:* ' + this.qty);
          lines.push('💵 *Subtotal:* ' + fmt(sub));
          lines.push('🧾 *VAT (15%):* ' + fmt(vat));
          lines.push('💰 *Grand Total:* ' + fmt(sub + vat));
        }
      }
      lines.push('\n👤 *Name:* ' + name);
      lines.push('📞 *Phone:* ' + phone);
      lines.push('📧 *Email:* ' + email);
      if (msg) lines.push('💬 *Note:* ' + msg);
      lines.push('\nI would like to place this order. Please contact me.');
    }
    return lines.join('\n');
  },

  buildEmailBody: function() {
    var name  = document.getElementById('omName').value.trim()  || '—';
    var phone = document.getElementById('omPhone').value.trim() || '—';
    var email = document.getElementById('omEmail').value.trim() || '—';
    var msg   = document.getElementById('omMsg').value.trim()   || '';
    var lines = [];
    if (IS_AR) {
      lines.push('طلب منتج جديد — الفاروقي للتصنيع\n');
      if (this.isCartOrder) {
        lines.push('المنتجات:');
        cart.items.forEach(function(ci) {
          var p = getProduct(ci.id);
          if (p) lines.push('  - ' + p.nameAr + ' × ' + ci.qty + ' = ' + fmt(p.price * ci.qty));
        });
        lines.push('المجموع الجزئي: ' + fmt(cart.total()));
        lines.push('ضريبة القيمة المضافة (15%): ' + fmt(cart.vat()));
        lines.push('الإجمالي الكلي: ' + fmt(cart.grand()));
      } else {
        var p = getProduct(this.productId);
        if (p) {
          var sub = p.price * this.qty;
          var vat = Math.round(sub * 0.15);
          lines.push('المنتج: ' + p.nameAr);
          lines.push('سعر الوحدة: ' + fmt(p.price));
          lines.push('الكمية: ' + this.qty);
          lines.push('المجموع الجزئي: ' + fmt(sub));
          lines.push('ضريبة القيمة المضافة (15%): ' + fmt(vat));
          lines.push('الإجمالي الكلي: ' + fmt(sub + vat));
        }
      }
      lines.push('\nالاسم: ' + name);
      lines.push('الهاتف: ' + phone);
      lines.push('البريد الإلكتروني: ' + email);
      if (msg) lines.push('ملاحظة: ' + msg);
      lines.push('\nأرغب في تأكيد الطلب.');
    } else {
      lines.push('New Product Order — AL FAROOQUE Manufacturing\n');
      if (this.isCartOrder) {
        lines.push('Products:');
        cart.items.forEach(function(ci) {
          var p = getProduct(ci.id);
          if (p) lines.push('  - ' + p.name + ' x ' + ci.qty + ' = ' + fmt(p.price * ci.qty));
        });
        lines.push('Subtotal: ' + fmt(cart.total()));
        lines.push('VAT (15%): ' + fmt(cart.vat()));
        lines.push('Grand Total: ' + fmt(cart.grand()));
      } else {
        var p = getProduct(orderModal.productId);
        if (p) {
          var sub = p.price * this.qty;
          var vat = Math.round(sub * 0.15);
          lines.push('Product: ' + p.name);
          lines.push('Unit Price: ' + fmt(p.price));
          lines.push('Quantity: ' + this.qty);
          lines.push('Subtotal: ' + fmt(sub));
          lines.push('VAT (15%): ' + fmt(vat));
          lines.push('Grand Total: ' + fmt(sub + vat));
        }
      }
      lines.push('\nName: ' + name);
      lines.push('Phone: ' + phone);
      lines.push('Email: ' + email);
      if (msg) lines.push('Note: ' + msg);
      lines.push('\nI would like to place this order. Please contact me.');
    }
    return lines.join('\n');
  },

  sendWhatsApp: function() {
    var text = this.buildMessage();
    var url  = 'https://wa.me/' + WA_NUMBER + '?text=' + esc(text);
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  sendEmail: function() {
    var p = this.isCartOrder ? null : getProduct(orderModal.productId);
    var subject = IS_AR
      ? 'طلب جديد — ' + (p ? p.nameAr : 'طلب سلة')
      : 'New Product Order — ' + (p ? p.name : 'Cart Order');
    var body = this.buildEmailBody();
    window.location.href = 'mailto:' + ORDER_EMAIL + '?subject=' + esc(subject) + '&body=' + esc(body);
  }
};

/* ════════════════════════════════════════════
   YEAR
   ════════════════════════════════════════════ */
function updateYear() {
  var el = document.getElementById('current-year');
  if (el) el.textContent = new Date().getFullYear();
}

/* ════════════════════════════════════════════
   LANGUAGE SWITCHER PATCH (products pages)
   Ensures EN↔AR redirect works for products pages
   ════════════════════════════════════════════ */
function patchLangSwitcher() {
  document.querySelectorAll('.lang-btn').forEach(function(btn) {
    var target = btn.dataset.lang;
    var current = document.documentElement.lang === 'ar' ? 'ar' : 'en';
    if (target === current) return;
    btn.addEventListener('click', function(e) {
      e.stopImmediatePropagation();
      localStorage.setItem('language', target);
      document.body.style.opacity = '0';
      document.body.style.transition = 'opacity 0.2s ease';
      var dest = target === 'ar' ? 'products-ar.html' : 'products.html';
      setTimeout(function() { window.location.href = dest; }, 200);
    }, true);
  });
}

/* ════════════════════════════════════════════
   IMAGE GALLERY
   ════════════════════════════════════════════ */
var imgGallery = {
  el: null,
  currentIdx: 0,
  currentImgs: [],

  init: function() {
    var self = this;
    var modal = document.createElement('div');
    modal.className = 'img-gallery-modal';
    modal.id = 'imgGalleryModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', t('Image Gallery', 'معرض الصور'));
    modal.innerHTML = [
      '<div class="ig-backdrop" id="igBackdrop"></div>',
      '<button class="ig-close" id="igClose" aria-label="' + t('Close','إغلاق') + '">&#215;</button>',
      '<button class="ig-arrow ig-prev" id="igPrev" aria-label="' + t('Previous','السابق') + '">&#8592;</button>',
      '<button class="ig-arrow ig-next" id="igNext" aria-label="' + t('Next','التالي') + '">&#8594;</button>',
      '<div class="ig-inner">',
        '<div class="ig-main">',
          '<div class="ig-main-img-wrap" id="igMainImgWrap">',
            '<img id="igMainImg" src="" alt="" loading="eager">',
          '</div>',
        '</div>',
        '<div class="ig-counter" id="igCounter" aria-live="polite"></div>',
      '<div class="ig-thumbs" id="igThumbs"></div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);
    this.el = modal;

    document.getElementById('igClose').addEventListener('click', function() { self.close(); });
    document.getElementById('igBackdrop').addEventListener('click', function() { self.close(); });
    document.getElementById('igPrev').addEventListener('click', function() { self.go(self.currentIdx - 1); });
    document.getElementById('igNext').addEventListener('click', function() { self.go(self.currentIdx + 1); });

    document.addEventListener('keydown', function(e) {
      if (!self.el || !self.el.classList.contains('open')) return;
      if (e.key === 'Escape')      { self.close(); }
      else if (e.key === 'ArrowLeft')  { self.go(self.currentIdx - 1); }
      else if (e.key === 'ArrowRight') { self.go(self.currentIdx + 1); }
    });

    var touchStartX = 0;
    var wrap = document.getElementById('igMainImgWrap');
    if (wrap) {
      wrap.addEventListener('touchstart', function(e) {
        touchStartX = e.touches[0].clientX;
      }, { passive: true });
      wrap.addEventListener('touchend', function(e) {
        var dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 40) self.go(dx < 0 ? self.currentIdx + 1 : self.currentIdx - 1);
      }, { passive: true });
    }
  },

  open: function(id, startIdx) {
    var p = getProduct(id);
    if (!p || !this.el) return;
    var name = IS_AR ? p.nameAr : p.name;
    this.currentImgs = p.imgs && p.imgs.length ? p.imgs : (p.img ? [p.img] : []);
    if (!this.currentImgs.length) return;
    this._savedScrollY = window.pageYOffset;
    this.buildThumbs(name);
    this.go(startIdx !== undefined ? startIdx : 0);
    this.el.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  close: function() {
    if (!this.el) return;
    this.el.classList.remove('open');
    document.body.style.overflow = '';
    if (this._savedScrollY !== undefined) {
      window.scrollTo(0, this._savedScrollY);
      this._savedScrollY = undefined;
    }
  },

  go: function(idx) {
    var len = this.currentImgs.length;
    var n = ((idx % len) + len) % len;
    this.currentIdx = n;
    var mainImg = document.getElementById('igMainImg');
    if (mainImg) mainImg.src = this.currentImgs[n];
    document.querySelectorAll('#igThumbs .ig-thumb').forEach(function(th, i) {
      th.classList.toggle('active', i === n);
    });
    var prevBtn  = document.getElementById('igPrev');
    var nextBtn  = document.getElementById('igNext');
    var counter  = document.getElementById('igCounter');
    var show = len > 1;
    if (prevBtn) prevBtn.style.display = show ? '' : 'none';
    if (nextBtn) nextBtn.style.display = show ? '' : 'none';
    if (counter) counter.textContent = show ? (n + 1) + ' / ' + len : '';
  },

  buildThumbs: function(name) {
    var self = this;
    var thumbsEl = document.getElementById('igThumbs');
    if (!thumbsEl) return;
    thumbsEl.innerHTML = '';
    this.currentImgs.forEach(function(src, i) {
      var btn = document.createElement('button');
      btn.className = 'ig-thumb';
      btn.setAttribute('aria-label', name + ' ' + (i + 1));
      var img = document.createElement('img');
      img.src = src;
      img.alt = name + ' ' + (i + 1);
      img.loading = 'lazy';
      btn.appendChild(img);
      btn.addEventListener('click', function() { self.go(i); });
      thumbsEl.appendChild(btn);
    });
  }
};

/* ════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
  slider.init();
  renderProducts();
  cart.init();
  prodModal.init();
  orderModal.init();
  imgGallery.init();
  updateYear();
  /* Patch language switcher after it initialises */
  setTimeout(patchLangSwitcher, 50);
});
