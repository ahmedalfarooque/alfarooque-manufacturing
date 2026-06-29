/* ═══════════════════════════════════════════════════════
   AL FAROOQUE Manufacturing — Machinery Gallery & Viewer
   ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── MACHINE DATA ────────────────────────────────── */
  var MACHINES = [
    {
      id: 'edge-banding',
      name: 'Edge Banding Machine',
      nameAr: 'آلة تغليف الحواف',
      category: 'Panel Processing',
      categoryAr: 'معالجة الألواح',
      image: '/assets/images/machines/edgeband-machine.jpg',
      overview: 'Automated edge banding machine for seamless application of PVC, ABS and wood veneer edges to panels and boards with precision trimming and corner rounding.',
      overviewAr: 'آلة تغليف حواف أوتوماتيكية للتطبيق السلس لحواف PVC وABS والقشرة الخشبية على الألواح بقص دقيق وتدوير للزوايا.',
      features: [
        'High-speed edge application up to 25 m/min',
        'Compatible with PVC, ABS and real wood veneer tape',
        'Automatic end trimming and corner rounding units',
        'Pre-melting glue system for a permanent bond'
      ],
      featuresAr: [
        'تطبيق حواف عالي السرعة حتى 25 م/دقيقة',
        'متوافق مع شريط PVC وABS والقشرة الخشبية الحقيقية',
        'وحدة قص تلقائي للنهايات وتدوير للزوايا',
        'نظام صمغ مسبق الذوبان لرابط دائم'
      ],
      specs: [
        ['Manufacturer', 'SCM Group'],
        ['Working Speed', '6 – 25 m/min'],
        ['Min Panel Length', '120 mm'],
        ['Motor Power', '3.7 kW'],
        ['Voltage', '380 V / 3-phase'],
        ['Weight', '~ 850 kg']
      ],
      specsAr: [
        ['الشركة المصنعة', 'SCM Group'],
        ['سرعة العمل', '6 – 25 م/دقيقة'],
        ['الحد الأدنى لطول اللوح', '120 مم'],
        ['قدرة المحرك', '3.7 كيلوواط'],
        ['الجهد الكهربائي', '380 فولت / ثلاثي'],
        ['الوزن', '~ 850 كغ']
      ],
      applications: ['Cabinet production', 'Furniture manufacturing', 'Interior fit-out', 'Door carcasses', 'Custom millwork'],
      applicationsAr: ['تصنيع الخزائن', 'تصنيع الأثاث', 'التجهيزات الداخلية', 'هياكل الأبواب', 'أعمال خشبية مخصصة'],
      safety: ['Emergency stop button', 'Thermal motor protection', 'Glue tank temperature control', 'Integrated dust extraction port'],
      safetyAr: ['زر إيقاف الطوارئ', 'حماية حرارية للمحرك', 'تحكم في درجة حرارة خزان الصمغ', 'منفذ شفط غبار متكامل']
    },
    {
      id: 'scm-beam-saw',
      name: 'SCM Gabbiani Beam Saw',
      nameAr: 'منشار الألواح SCM Gabbiani',
      category: 'Cutting & Sawing',
      categoryAr: 'القطع والنشر',
      image: '/assets/images/machines/scm-beam-saw.jpg',
      overview: 'High-performance horizontal beam saw for cutting large-format panel materials. CNC-programmable for batch production with automatic label output and air flotation table.',
      overviewAr: 'منشار شعاعي أفقي عالي الأداء لقطع ألواح كبيرة الحجم. قابل للبرمجة بـ CNC لإنتاج دُفعات مع إخراج ملصقات تلقائي وطاولة تعويم هوائية.',
      features: [
        'CNC-programmable cut sequences for batch production',
        'Automatic push feed with air flotation table',
        'Scoring blade for clean chip-free panel cuts',
        'Integrated label printer for component tracking'
      ],
      featuresAr: [
        'تسلسل قطع قابل للبرمجة بـ CNC لإنتاج الدُفعات',
        'تغذية دفع تلقائية بطاولة تعويم هوائية',
        'نصل تسجيل لقطعات خالية من الرقائق',
        'طابعة ملصقات متكاملة لتتبع المكونات'
      ],
      specs: [
        ['Manufacturer', 'SCM Group'],
        ['Model', 'Gabbiani GT 100'],
        ['Max Panel Length', '4,300 mm'],
        ['Cutting Speed', '80 m/min'],
        ['Motor Power', '11 kW'],
        ['Voltage', '380 V / 3-phase']
      ],
      specsAr: [
        ['الشركة المصنعة', 'SCM Group'],
        ['الطراز', 'Gabbiani GT 100'],
        ['الحد الأقصى لطول اللوح', '4,300 مم'],
        ['سرعة القطع', '80 م/دقيقة'],
        ['قدرة المحرك', '11 كيلوواط'],
        ['الجهد الكهربائي', '380 فولت / ثلاثي']
      ],
      applications: ['Large panel cutting', 'Cabinet production', 'Furniture components', 'Batch sheet processing'],
      applicationsAr: ['قطع الألواح الكبيرة', 'تصنيع الخزائن', 'مكونات الأثاث', 'معالجة الألواح دُفعةً'],
      safety: ['Blade guard with interlock', 'Push-back fence safety bar', 'Emergency stop pedal', 'CE certified'],
      safetyAr: ['حاجز النصل مع قفل', 'شريط أمان سياج الدفع', 'دواسة إيقاف الطوارئ', 'شهادة CE']
    },
    {
      id: 'boring-machine',
      name: 'Semi-Auto Boring Machine',
      nameAr: 'آلة الحفر شبه الأوتوماتيكية',
      category: 'Drilling & Boring',
      categoryAr: 'الحفر والثقب',
      image: '/assets/images/machines/boring-machine.jpg',
      overview: 'Multi-spindle boring machine for precision drilling of cabinet hardware holes, shelf pin positions and dowel holes at the standard 32 mm system spacing.',
      overviewAr: 'آلة حفر متعددة المغازل للثقب الدقيق لفتحات أجهزة الخزائن ومواضع دبابيس الرفوف وفتحات المسامير بالتباعد القياسي 32 مم.',
      features: [
        '21-spindle drilling head for high productivity',
        'Standard 32 mm system spacing for cabinet hardware',
        'Pneumatic panel clamping with depth stop',
        'Quick tool change for different drill diameters'
      ],
      featuresAr: [
        'رأس حفر بـ 21 مغزلاً لإنتاجية عالية',
        'تباعد نظام 32 مم القياسي لأجهزة الخزائن',
        'تثبيت لوحة هوائي مع وقف عمق',
        'تغيير سريع للأداة لأقطار حفر مختلفة'
      ],
      specs: [
        ['Manufacturer', 'BIESSE'],
        ['Model', 'Techno Pro 21'],
        ['No. of Spindles', '21'],
        ['Spindle Spacing', '32 mm'],
        ['Motor Power', '2.2 kW'],
        ['Accuracy', '± 0.05 mm']
      ],
      specsAr: [
        ['الشركة المصنعة', 'BIESSE'],
        ['الطراز', 'Techno Pro 21'],
        ['عدد المغازل', '21'],
        ['تباعد المغازل', '32 مم'],
        ['قدرة المحرك', '2.2 كيلوواط'],
        ['الدقة', '± 0.05 مم']
      ],
      applications: ['Cabinet hardware boring', 'Drawer runner installation', 'Shelf pin drilling', 'Hinge cup drilling'],
      applicationsAr: ['حفر أجهزة الخزائن', 'تركيب دليل الدرج', 'حفر دبابيس الرفوف', 'حفر كوب المفصلات'],
      safety: ['Spindle guards', 'Emergency stop button', 'Two-hand start required', 'Pneumatic pressure safety valve'],
      safetyAr: ['حواجز المغازل', 'زر إيقاف الطوارئ', 'تشغيل باليدين مطلوب', 'صمام أمان الضغط الهوائي']
    },
    {
      id: 'cnc-router',
      name: 'CNC Machining Center',
      nameAr: 'مركز التصنيع CNC',
      category: 'CNC Processing',
      categoryAr: 'المعالجة بـ CNC',
      image: '/assets/images/machines/router-machine.png',
      overview: '3-axis CNC router for precision routing, profiling, engraving and shaping of solid wood, MDF and composite panels with automatic tool change.',
      overviewAr: 'راوتر CNC ثلاثي المحاور للتوجيه الدقيق والتشكيل والنقش على الخشب الصلب والـ MDF والألواح المركبة مع تغيير أداة تلقائي.',
      features: [
        '3-axis CNC control with servo drives',
        'Automatic tool changer with 12 positions',
        'Vacuum table clamping for secure workholding',
        'Offline programming via CAD/CAM software'
      ],
      featuresAr: [
        'تحكم CNC ثلاثي المحاور مع محركات سيرفو',
        'تغيير أداة تلقائي بـ 12 موضعاً',
        'تثبيت بطاولة تفريغ هوائي لتثبيت آمن',
        'برمجة دون اتصال عبر برامج CAD/CAM'
      ],
      specs: [
        ['Manufacturer', 'HOMAG'],
        ['Model', 'BMG 211'],
        ['Working Area', '3,050 × 1,530 mm'],
        ['Spindle Power', '12 kW'],
        ['Max Feed Rate', '25 m/min'],
        ['Accuracy', '± 0.1 mm']
      ],
      specsAr: [
        ['الشركة المصنعة', 'HOMAG'],
        ['الطراز', 'BMG 211'],
        ['منطقة العمل', '3,050 × 1,530 مم'],
        ['قدرة المغزل', '12 كيلوواط'],
        ['أقصى معدل تغذية', '25 م/دقيقة'],
        ['الدقة', '± 0.1 مم']
      ],
      applications: ['Panel routing & shaping', 'Door profiles', 'Decorative screens', 'Cabinet components', 'Architectural millwork'],
      applicationsAr: ['توجيه وتشكيل الألواح', 'ملامح الأبواب', 'الشاشات الزخرفية', 'مكونات الخزائن', 'الأعمال الخشبية المعمارية'],
      safety: ['Full machine enclosure', 'Laser scanner area guard', 'Spindle brake on E-stop', 'Integrated dust extraction'],
      safetyAr: ['حاوية آلة كاملة', 'حارس منطقة الماسح الضوئي الليزري', 'فرامل مغزل عند الإيقاف', 'شفط غبار متكامل']
    },
    {
      id: 'panel-saw',
      name: 'Panel Saw',
      nameAr: 'منشار الألواح',
      category: 'Cutting & Sawing',
      categoryAr: 'القطع والنشر',
      image: '/assets/images/machines/sliding-panel-saw.jpg',
      overview: 'Precision sliding table panel saw for accurate ripping and crosscutting of large sheet materials, essential for furniture panels and cabinet components.',
      overviewAr: 'منشار ألواح بطاولة انزلاقية دقيقة للشق الدقيق والقطع المتعامد لمواد الألواح الكبيرة، ضروري لألواح الأثاث ومكونات الخزائن.',
      features: [
        'Sliding table carriage up to 3,200 mm travel',
        'Tilting saw blade from 0° to 45° for mitre cuts',
        'Scoring blade for clean underside cuts',
        'Digital read-out with fence position memory'
      ],
      featuresAr: [
        'حامل طاولة انزلاقية بحركة تصل إلى 3,200 مم',
        'نصل منشار قابل للإمالة من 0 إلى 45 درجة',
        'نصل تسجيل لقطعات سفلية نظيفة',
        'قراءة رقمية مع ذاكرة موضع السياج'
      ],
      specs: [
        ['Manufacturer', 'SCM Group'],
        ['Model', 'SI 400 Plus'],
        ['Sliding Table', '3,200 mm'],
        ['Motor Power', '5.5 kW'],
        ['Max Cutting Height', '100 mm'],
        ['Blade Diameter', '315 mm']
      ],
      specsAr: [
        ['الشركة المصنعة', 'SCM Group'],
        ['الطراز', 'SI 400 Plus'],
        ['الطاولة الانزلاقية', '3,200 مم'],
        ['قدرة المحرك', '5.5 كيلوواط'],
        ['الحد الأقصى لارتفاع القطع', '100 مم'],
        ['قطر النصل', '315 مم']
      ],
      applications: ['Panel ripping', 'Crosscutting', 'Mitre cuts', 'MDF & plywood', 'Furniture components'],
      applicationsAr: ['شق الألواح', 'القطع المتعامد', 'قطعات الميتر', 'MDF والخشب الرقائقي', 'مكونات الأثاث'],
      safety: ['Blade guard with riving knife', 'Anti-kickback pawls', 'Push stick provided', 'Dust extraction integrated'],
      safetyAr: ['حاجز النصل مع سكين الشق', 'مخالب مانعة للرفس', 'عصا الدفع مُرفقة', 'شفط غبار متكامل']
    },
    {
      id: 'thickness-planer',
      name: 'Thickness Planer',
      nameAr: 'آلة تسوية السماكة',
      category: 'Surface Preparation',
      categoryAr: 'تحضير الأسطح',
      image: '/assets/images/machines/thickness-planer.jpg',
      overview: 'Industrial thickness planer for achieving consistent and accurate timber dimensions across workpieces, essential for high-volume joinery and solid wood production.',
      overviewAr: 'آلة تسوية سماكة صناعية لتحقيق أبعاد خشب متسقة ودقيقة في قطع العمل، ضرورية للإنتاج بكميات كبيرة من النجارة والخشب الصلب.',
      features: [
        'Three-roller feed system for consistent throughput',
        'Carbide-tipped helical cutterhead for smooth finish',
        'Anti-kickback chip breakers for operator safety',
        'Digital thickness display with memory positions'
      ],
      featuresAr: [
        'نظام تغذية ثلاثي البكرات للإنتاج المتسق',
        'رأس قطع حلزوني بنصل كربيد لتشطيب ناعم',
        'كاسرات رقاقة مانعة للرفس لسلامة المشغّل',
        'شاشة سماكة رقمية مع مواضع ذاكرة'
      ],
      specs: [
        ['Manufacturer', 'SCM Group'],
        ['Model', 'M 100'],
        ['Working Width', '1,000 mm'],
        ['Motor Power', '15 kW'],
        ['Feed Speed', '4 – 8 m/min'],
        ['Min Workpiece', '500 mm length']
      ],
      specsAr: [
        ['الشركة المصنعة', 'SCM Group'],
        ['الطراز', 'M 100'],
        ['عرض العمل', '1,000 مم'],
        ['قدرة المحرك', '15 كيلوواط'],
        ['سرعة التغذية', '4 – 8 م/دقيقة'],
        ['الحد الأدنى للقطعة', '500 مم طولاً']
      ],
      applications: ['Timber preparation', 'Surface levelling', 'Dimensional accuracy', 'Hardwood processing'],
      applicationsAr: ['تحضير الخشب', 'تسوية الأسطح', 'الدقة الأبعادية', 'معالجة الخشب الصلب'],
      safety: ['Anti-kickback fingers', 'Blade guard', 'Emergency stop', 'Feed roller interlocks'],
      safetyAr: ['أصابع مانعة للرفس', 'حاجز النصل', 'إيقاف الطوارئ', 'أقفال بكرة التغذية']
    },
    {
      id: 'wide-belt-sander',
      name: 'Wide Belt Sander',
      nameAr: 'آلة الصنفرة الشريطية العريضة',
      category: 'Finishing',
      categoryAr: 'التشطيب',
      image: '/assets/images/machines/sanding-machine.jpg',
      overview: 'Wide belt sanding machine for producing high-quality flat surface finishes on wood panels, MDF and veneered boards at consistent calibrated thickness.',
      overviewAr: 'آلة صنفرة شريطية عريضة لإنتاج تشطيبات سطحية مسطحة عالية الجودة على ألواح الخشب والـ MDF والألواح المقشرة بسماكة معايَرة متسقة.',
      features: [
        'Combined calibration and finishing sanding heads',
        'Variable feed speed 6 – 20 m/min',
        'Pneumatic pressure beam for consistent belt pressure',
        'Auto-oscillating sanding belt for even wear distribution'
      ],
      featuresAr: [
        'رؤوس صنفرة معايرة وتشطيب مدمجة',
        'سرعة تغذية متغيرة 6 – 20 م/دقيقة',
        'شعاع ضغط هوائي للضغط المتسق على الحزام',
        'حزام صنفرة ذاتي التذبذب لتوزيع متساوٍ للتآكل'
      ],
      specs: [
        ['Manufacturer', 'SCM Group'],
        ['Model', 'S 600'],
        ['Sanding Width', '650 mm'],
        ['Total Motor Power', '22 kW'],
        ['Feed Speed', '6 – 20 m/min'],
        ['Belt Size', '650 × 2,620 mm']
      ],
      specsAr: [
        ['الشركة المصنعة', 'SCM Group'],
        ['الطراز', 'S 600'],
        ['عرض الصنفرة', '650 مم'],
        ['إجمالي قدرة المحرك', '22 كيلوواط'],
        ['سرعة التغذية', '6 – 20 م/دقيقة'],
        ['حجم الحزام', '650 × 2,620 مم']
      ],
      applications: ['Panel sanding', 'Surface finishing', 'Veneered boards', 'MDF calibration', 'Pre-coating preparation'],
      applicationsAr: ['صنفرة الألواح', 'تشطيب الأسطح', 'الألواح المقشرة', 'معايرة MDF', 'التحضير لما قبل الطلاء'],
      safety: ['Integrated dust extraction', 'Emergency stop bar', 'Access guards on both sides', 'Belt tracking alarm'],
      safetyAr: ['شفط غبار متكامل', 'شريط إيقاف الطوارئ', 'حواجز وصول من الجانبين', 'إنذار تتبع الحزام']
    },
    {
      id: 'drill-press',
      name: 'Multi-Spindle Drill',
      nameAr: 'مثقاب متعدد المغازل',
      category: 'Drilling & Boring',
      categoryAr: 'الحفر والثقب',
      image: '/assets/images/machines/drill-press.jpg',
      overview: 'Heavy-duty industrial floor drill press with variable speed control for precision drilling operations on all wood, MDF and composite materials.',
      overviewAr: 'مثقاب أرضي صناعي ثقيل مع تحكم في السرعة المتغيرة لعمليات الحفر الدقيق على جميع مواد الخشب والـ MDF والمركبات.',
      features: [
        'Variable spindle speed 200 – 3,630 rpm',
        'Precision depth stop with fine micrometric adjustment',
        'Cast iron tilting table for angled drilling',
        'Laser centre guide for accurate hole positioning'
      ],
      featuresAr: [
        'سرعة مغزل متغيرة 200 – 3,630 دورة/دقيقة',
        'وقف عمق دقيق مع ضبط ميكروميتري',
        'طاولة حديد زهر قابلة للإمالة للحفر المائل',
        'دليل مركز ليزري لتحديد موضع دقيق'
      ],
      specs: [
        ['Manufacturer', 'Jet Equipment'],
        ['Model', 'JDP-20VS'],
        ['Spindle Speed', '200 – 3,630 rpm'],
        ['Motor Power', '1.5 kW'],
        ['Table Size', '465 × 465 mm'],
        ['Chuck Capacity', '16 mm']
      ],
      specsAr: [
        ['الشركة المصنعة', 'Jet Equipment'],
        ['الطراز', 'JDP-20VS'],
        ['سرعة المغزل', '200 – 3,630 دورة/دقيقة'],
        ['قدرة المحرك', '1.5 كيلوواط'],
        ['حجم الطاولة', '465 × 465 مم'],
        ['سعة الظرف', '16 مم']
      ],
      applications: ['Dowel holes', 'Hardware mounting', 'Pre-drilling', 'Cabinet work', 'Custom drilling patterns'],
      applicationsAr: ['فتحات المسامير', 'تركيب الأجهزة', 'الحفر المسبق', 'أعمال الخزائن', 'أنماط حفر مخصصة'],
      safety: ['Chuck guard', 'Emergency stop switch', 'Table lock mechanism', 'Stable floor mounting required'],
      safetyAr: ['حاجز الظرف', 'مفتاح إيقاف الطوارئ', 'آلية قفل الطاولة', 'تركيب أرضي مستقر مطلوب']
    },
    {
      id: 'band-saw',
      name: 'Band Saw',
      nameAr: 'منشار الشريط',
      category: 'Cutting & Sawing',
      categoryAr: 'القطع والنشر',
      image: '/assets/images/machines/band-saw.jpg',
      overview: 'Heavy-duty band saw for curved cuts, resawing thick timber and producing custom profiles and templates from solid wood and engineered lumber.',
      overviewAr: 'منشار شريطي ثقيل للقطع المنحني وإعادة نشر الخشب السميك وإنتاج ملامح مخصصة من الخشب الصلب والخشب الهندسي.',
      features: [
        'Cast iron table and frame for vibration-free operation',
        'Large 800 mm wheel diameter for wide blades',
        'Adjustable upper and lower blade guides',
        'Fence system for accurate straight ripping'
      ],
      featuresAr: [
        'طاولة وإطار من الحديد الزهر لتشغيل بدون اهتزاز',
        'قطر عجلة كبير 800 مم للنصول العريضة',
        'أدلة نصل علوية وسفلية قابلة للضبط',
        'نظام سياج للنشر المستقيم الدقيق'
      ],
      specs: [
        ['Manufacturer', 'SCM Group'],
        ['Model', 'SI 400'],
        ['Wheel Diameter', '800 mm'],
        ['Motor Power', '5.5 kW'],
        ['Max Cutting Height', '400 mm'],
        ['Table Size', '600 × 600 mm']
      ],
      specsAr: [
        ['الشركة المصنعة', 'SCM Group'],
        ['الطراز', 'SI 400'],
        ['قطر العجلة', '800 مم'],
        ['قدرة المحرك', '5.5 كيلوواط'],
        ['الحد الأقصى لارتفاع القطع', '400 مم'],
        ['حجم الطاولة', '600 × 600 مم']
      ],
      applications: ['Curved cuts', 'Resawing solid timber', 'Template production', 'Custom profiles', 'Veneer slicing'],
      applicationsAr: ['القطع المنحني', 'إعادة نشر الخشب الصلب', 'إنتاج القوالب', 'الملامح المخصصة', 'تقطيع القشرة'],
      safety: ['Upper and lower blade guards', 'Emergency stop', 'Push stick for narrow cuts', 'Auto blade tracking'],
      safetyAr: ['حواجز نصل علوية وسفلية', 'إيقاف الطوارئ', 'عصا دفع للقطع الضيقة', 'تتبع تلقائي للنصل']
    },
    {
      id: 'spindle-moulder',
      name: 'Spindle Moulder',
      nameAr: 'آلة تشكيل المغزل',
      category: 'Shaping & Profiling',
      categoryAr: 'التشكيل والتحديد',
      image: '/assets/images/machines/spindle-moulder.jpg',
      overview: 'Heavy-duty spindle moulder for producing door profiles, architectural mouldings, window frames and decorative woodwork elements with precision and consistency.',
      overviewAr: 'آلة تشكيل مغزل ثقيلة لإنتاج ملامح الأبواب والقوالب المعمارية وإطارات النوافذ وعناصر الأعمال الخشبية الزخرفية بدقة واتساق.',
      features: [
        'Variable spindle speed 3,000 – 10,000 rpm',
        'Tilting spindle shaft 0° to 45° for compound profiles',
        'Large 1,000 × 800 mm cast iron table',
        'Spring-loaded pressure shoes for safe, consistent feeding'
      ],
      featuresAr: [
        'سرعة مغزل متغيرة 3,000 – 10,000 دورة/دقيقة',
        'عمود مغزل قابل للإمالة 0 إلى 45 درجة للملامح المركبة',
        'طاولة حديد زهر كبيرة 1,000 × 800 مم',
        'أحذية ضغط بزنبرك لتغذية آمنة ومتسقة'
      ],
      specs: [
        ['Manufacturer', 'SCM Group'],
        ['Model', 'T 130'],
        ['Spindle Speed', '3,000 – 10,000 rpm'],
        ['Motor Power', '5.5 kW'],
        ['Table Size', '1,000 × 800 mm'],
        ['Spindle Diameter', '30 mm']
      ],
      specsAr: [
        ['الشركة المصنعة', 'SCM Group'],
        ['الطراز', 'T 130'],
        ['سرعة المغزل', '3,000 – 10,000 دورة/دقيقة'],
        ['قدرة المحرك', '5.5 كيلوواط'],
        ['حجم الطاولة', '1,000 × 800 مم'],
        ['قطر المغزل', '30 مم']
      ],
      applications: ['Door profiles', 'Window frames', 'Mouldings & skirting', 'Architrave', 'Decorative profiling'],
      applicationsAr: ['ملامح الأبواب', 'إطارات النوافذ', 'القوالب والإطارات', 'الأطر المعمارية', 'التحديد الزخرفي'],
      safety: ['Spindle hood guard', 'Pressure shoe guards', 'Emergency stop button', 'Anti-vibration mounting'],
      safetyAr: ['حاجز غطاء المغزل', 'حواجز أحذية الضغط', 'زر إيقاف الطوارئ', 'تركيب مانع للاهتزاز']
    }
  ];

  /* ── LANGUAGE ───────────────────────────────────── */
  var isAr = document.documentElement.lang === 'ar';

  /* ── RENDER GALLERY CARDS ───────────────────────── */
  function renderGallery() {
    var grid = document.getElementById('mach-grid');
    if (!grid) return;

    var frag = document.createDocumentFragment();
    MACHINES.forEach(function (m, idx) {
      var name = isAr ? m.nameAr : m.name;
      var cat  = isAr ? m.categoryAr : m.category;
      var desc = isAr ? m.overviewAr : m.overview;
      if (desc.length > 88) desc = desc.substring(0, 88) + '…';

      var card = document.createElement('div');
      card.className = 'mach-card reveal';
      card.setAttribute('data-mach', idx);
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', (isAr ? 'عرض تفاصيل: ' : 'View details: ') + name);

      card.innerHTML =
          '<div class="mach-card-img">'
        +   '<img src="' + m.image + '" alt="' + name + '" loading="lazy" decoding="async">'
        + '</div>'
        + '<div class="mach-card-body">'
        +   '<div class="mach-card-cat">' + cat + '</div>'
        +   '<div class="mach-card-name">' + name + '</div>'
        +   '<div class="mach-card-desc">' + desc + '</div>'
        + '</div>'
        + '<div class="mach-card-open" aria-hidden="true">&#8599;</div>';

      card.addEventListener('click', function () { openViewer(idx); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openViewer(idx); }
      });

      frag.appendChild(card);
    });
    grid.appendChild(frag);

    /* observe dynamically-added cards for scroll reveal (main.js can't see them) */
    if ('IntersectionObserver' in window) {
      var revEls = grid.querySelectorAll('.reveal');
      var revRemaining = revEls.length;
      var revIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            revIO.unobserve(e.target);
            if (--revRemaining === 0) revIO.disconnect();
          }
        });
      }, { threshold: 0.10, rootMargin: '0px 0px -40px 0px' });
      revEls.forEach(function (el) { revIO.observe(el); });
    } else {
      /* fallback: make all visible immediately */
      grid.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
    }
  }

  /* ── MODAL STATE ────────────────────────────────── */
  var curIdx   = 0;
  var savedY   = 0;
  var backdrop = null;
  var detailBody = null;
  var detailCol  = null;

  /* ── BUILD MODAL DOM (once) ─────────────────────── */
  function buildModal() {
    if (document.getElementById('mv-backdrop')) {
      backdrop   = document.getElementById('mv-backdrop');
      detailBody = document.getElementById('mv-d-body');
      detailCol  = document.querySelector('.mv-detail-col');
      return;
    }

    /* arrows: in RTL we swap which physical side each logical direction is on */
    var prevChar = '&#8249;'; /* ‹ */
    var nextChar = '&#8250;'; /* › */
    var prevAria = isAr ? 'السابق' : 'Previous';
    var nextAria = isAr ? 'التالي' : 'Next';
    var closeAria = isAr ? 'إغلاق' : 'Close';

    var el = document.createElement('div');
    el.id = 'mv-backdrop';
    el.className = 'mv-backdrop';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', isAr ? 'عارض الآلة' : 'Machine Viewer');

    el.innerHTML =
        '<div class="mv-modal" id="mv-modal" role="document">'
      +   '<div class="mv-inner">'
      +     '<div class="mv-img-col">'
      +       '<div class="mv-img-wrap"><img id="mv-main-img" src="" alt="" loading="eager"></div>'
      +       '<div class="mv-img-badge" id="mv-img-badge"></div>'
      +       '<div class="mv-img-counter" id="mv-img-counter"></div>'
      +       '<button class="mv-nav-btn mv-prev-btn" id="mv-prev" aria-label="' + prevAria + '">' + prevChar + '</button>'
      +       '<button class="mv-nav-btn mv-next-btn" id="mv-next" aria-label="' + nextAria + '">' + nextChar + '</button>'
      +     '</div>'
      +     '<div class="mv-detail-col">'
      +       '<div class="mv-close-btn"><button class="mv-close-x" id="mv-close" aria-label="' + closeAria + '">&times;</button></div>'
      +       '<div class="mv-detail-body" id="mv-d-body"></div>'
      +     '</div>'
      +   '</div>'
      + '</div>';

    document.body.appendChild(el);

    backdrop   = el;
    detailBody = document.getElementById('mv-d-body');
    detailCol  = el.querySelector('.mv-detail-col');

    document.getElementById('mv-close').addEventListener('click', closeViewer);
    document.getElementById('mv-prev').addEventListener('click', function (e) {
      e.stopPropagation();
      /* RTL: the physical ‹ button is on the right, so it navigates forward */
      navigate(isAr ? 1 : -1);
    });
    document.getElementById('mv-next').addEventListener('click', function (e) {
      e.stopPropagation();
      navigate(isAr ? -1 : 1);
    });

    el.addEventListener('click', function (e) {
      if (e.target === el) closeViewer();
    });
  }

  /* ── POPULATE MODAL CONTENT ─────────────────────── */
  function populateModal(idx) {
    var m        = MACHINES[idx];
    var name     = isAr ? m.nameAr     : m.name;
    var cat      = isAr ? m.categoryAr : m.category;
    var overview = isAr ? m.overviewAr : m.overview;
    var features = isAr ? m.featuresAr : m.features;
    var specs    = isAr ? m.specsAr    : m.specs;
    var apps     = isAr ? m.applicationsAr : m.applications;
    var safety   = isAr ? m.safetyAr   : m.safety;

    var lbl = isAr
      ? { feat: 'المميزات الرئيسية', specs: 'المواصفات التقنية', apps: 'التطبيقات', safe: 'ميزات السلامة' }
      : { feat: 'Key Features', specs: 'Specifications', apps: 'Applications', safe: 'Safety Features' };

    /* update image */
    var img = document.getElementById('mv-main-img');
    img.src = m.image;
    img.alt = name;

    document.getElementById('mv-img-badge').textContent = cat;
    document.getElementById('mv-img-counter').textContent = (idx + 1) + ' / ' + MACHINES.length;

    /* build html */
    var featHtml = '<ul class="mv-d-features">'
      + features.map(function (f) { return '<li>' + f + '</li>'; }).join('')
      + '</ul>';

    var specsHtml = '<table class="mv-d-specs"><tbody>'
      + specs.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('')
      + '</tbody></table>';

    var appsHtml = '<div class="mv-d-apps">'
      + apps.map(function (a) { return '<span class="mv-d-app">' + a + '</span>'; }).join('')
      + '</div>';

    var safetyHtml = '<div class="mv-d-safety-box"><div class="mv-d-safety-list">'
      + safety.map(function (s) { return '<div class="mv-d-safety-item">' + s + '</div>'; }).join('')
      + '</div></div>';

    detailBody.innerHTML =
        '<div class="mv-d-cat">' + cat + '</div>'
      + '<div class="mv-d-name">' + name + '</div>'
      + '<div class="mv-d-overview">' + overview + '</div>'
      + '<div class="mv-d-section">' + lbl.feat + '</div>' + featHtml
      + '<div class="mv-d-section">' + lbl.specs + '</div>' + specsHtml
      + '<div class="mv-d-section">' + lbl.apps + '</div>' + appsHtml
      + '<div class="mv-d-section">' + lbl.safe + '</div>' + safetyHtml;

    /* reset scroll + re-trigger entry animation */
    if (detailCol) detailCol.scrollTop = 0;
    detailBody.style.animation = 'none';
    void detailBody.offsetWidth;
    detailBody.style.animation = '';
  }

  /* ── OPEN / CLOSE / NAVIGATE ────────────────────── */
  function openViewer(idx) {
    buildModal();
    curIdx = idx;
    populateModal(curIdx);

    savedY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + savedY + 'px';
    document.body.style.width = '100%';
    document.body.style.overflowY = 'scroll';

    requestAnimationFrame(function () {
      backdrop.classList.add('mv-open');
    });

    setTimeout(function () {
      var cl = document.getElementById('mv-close');
      if (cl) cl.focus();
    }, 380);
  }

  function closeViewer() {
    if (!backdrop) return;
    backdrop.classList.remove('mv-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflowY = '';
    window.scrollTo(0, savedY);
  }

  function navigate(dir) {
    curIdx = (curIdx + dir + MACHINES.length) % MACHINES.length;
    populateModal(curIdx);
  }

  /* ── KEYBOARD ───────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (!backdrop || !backdrop.classList.contains('mv-open')) return;
    if (e.key === 'Escape') { closeViewer(); return; }
    /* ArrowLeft = visually leftward; in RTL that means forward (+1) */
    if (e.key === 'ArrowLeft')  navigate(isAr ?  1 : -1);
    if (e.key === 'ArrowRight') navigate(isAr ? -1 :  1);
  });

  /* ── INIT ───────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderGallery);
  } else {
    renderGallery();
  }
})();
