'use strict';

/* ═══════════════════════════════════════════════════════════════════
   AL FAROOQUE — Admin Dashboard
   Session-guarded SPA-lite shell. Every module below reads/writes the
   real Supabase tables through /api/admin/* (service-role, server-side
   only) — no localStorage, no dummy data.
   ═══════════════════════════════════════════════════════════════════ */

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const money = n => 'SAR ' + Number(n || 0).toLocaleString('en-US');
const icons = () => { if (window.lucide) window.lucide.createIcons(); };

/* ════════════════════════════════════════════════════════════════
   I18N — every user-visible string rendered by this file.
   Data values (names, emails, product names), order numbers, currency
   amounts and dates are NEVER translated; status values sent to the
   API stay English — only their display labels are translated.
   ════════════════════════════════════════════════════════════════ */
const I18N = {
  en: {
    /* chrome */
    brand_tag: 'Admin Portal', soon: 'Soon',
    sec_overview: 'Overview', sec_sales: 'Sales', sec_catalog: 'Catalog', sec_insights: 'Insights', sec_system: 'System',
    nav_dashboard: 'Dashboard', nav_notifications: 'Notifications', nav_orders: 'Orders', nav_customers: 'Customers',
    nav_quotes: 'Quotes', nav_messages: 'Messages', nav_payments: 'Payments', nav_invoices: 'Invoices',
    nav_products: 'Products', nav_categories: 'Categories', nav_inventory: 'Inventory', nav_production: 'Production',
    nav_reports: 'Reports', nav_analytics: 'Analytics', nav_website_settings: 'Website Settings', nav_users: 'Users',
    nav_roles: 'Roles & Permissions', nav_audit: 'Audit Logs', nav_email_templates: 'Email Templates',
    nav_system_settings: 'System Settings', nav_account: 'My Account', nav_logout: 'Logout',
    search_ph: 'Search orders, customers, products…',
    aria_menu: 'Menu', aria_theme: 'Toggle theme', aria_notifications: 'Notifications', aria_quick_add: 'Quick Actions', aria_lang: 'Switch language',
    /* coming soon */
    coming_soon: 'Coming Soon',
    coming_soon_body: "This module is planned for a follow-up phase and isn't live yet. No dummy data is shown here on purpose.",
    /* home */
    home_title: 'Dashboard', home_sub_prefix: 'Live overview — ',
    kpi_today_orders: "Today's Orders", kpi_pending: 'Pending Orders', kpi_processing: 'Processing', kpi_completed: 'Completed',
    kpi_cancelled: 'Cancelled', kpi_revenue: 'Revenue (Completed)', kpi_quotes: 'Quotes', kpi_products: 'Products',
    kpi_customers: 'Customers', kpi_low_stock: 'Low Stock', kpi_new_suffix: 'new',
    recent_orders: 'Recent Orders', recent_customers: 'Recent Customers', view_all: 'View all',
    low_stock_alerts: 'Low Stock Alerts', stock_lbl: 'Stock', threshold_lbl: 'Threshold',
    no_orders_yet: 'No orders yet.', no_customers_yet: 'No customers yet.',
    open_details_for: 'Open details for',
    /* shared */
    view: 'View', edit: 'Edit', del: 'Delete', save: 'Save', save_changes: 'Save Changes', send: 'Send',
    add: 'Add', cancel: 'Cancel', prev: 'Previous', next: 'Next',
    page_of: (p, tp, tot) => 'Page ' + p + ' of ' + tp + ' (' + tot + ' total)',
    actions: 'Actions', status: 'Status', date: 'Date', name: 'Name', email: 'Email', phone: 'Phone',
    company: 'Company', country: 'Country', address: 'Address', notes: 'Notes', message: 'Message', subject: 'Subject',
    registered_customer: 'Registered customer', guest: 'Guest', item: 'Item', unknown: 'Unknown',
    /* orders */
    orders_title: 'Orders', today_suffix: ' — Today', order_search_ph: 'Search order # / customer…',
    all_statuses: 'All statuses', th_order_no: 'Order #', th_customer: 'Customer', th_items: 'Items', th_total: 'Total',
    th_payment: 'Payment', no_orders_found: 'No orders found.',
    order_word: 'Order', products_count: 'Products', no_item_details_order: 'No item details stored on this order.',
    customer_section: 'Customer', order_info: 'Order Information', order_id: 'Order ID', order_status: 'Order Status',
    payment_status: 'Payment Status', current_stage: 'Current Stage', tracking: 'Tracking',
    est_completion: 'Est. Completion', est_delivery: 'Est. Delivery', tracking_number: 'Tracking Number',
    courier: 'Courier', totals: 'Totals', subtotal: 'Subtotal', vat: 'VAT (15%)', shipping: 'Shipping',
    discount: 'Discount', grand_total: 'Grand Total', delivery_address: 'Delivery Address',
    edit_order: 'Edit Order', tracking_pct: 'Tracking %', delivery_date: 'Delivery Date',
    shipping_cost: 'Shipping Cost', cust_delivery_address: 'Customer / Delivery Address', admin_notes: 'Admin Notes',
    items: 'Items', qty: 'Qty', unit_price: 'Unit Price', current_total: 'Current Total', no_item_details: 'No item details.',
    order_updated: 'Order updated — synced to the customer dashboard.',
    spec_category: 'Category', spec_sku: 'SKU', spec_material: 'Material', spec_size: 'Size', spec_color: 'Color',
    spec_finish: 'Finish', spec_quantity: 'Quantity',
    /* deleted orders */
    nav_orders_deleted: 'Deleted Orders', orders_deleted_title: 'Deleted Orders',
    confirm_delete_order: 'Delete Order — Are you sure you want to delete this order? The order can be recovered within 30 days.',
    order_deleted_toast: 'Order deleted — it can be recovered within 30 days.',
    confirm_permanent_delete_order: 'This action cannot be undone. Delete permanently?',
    order_recovered_toast: 'Order recovered.', order_permanently_deleted_toast: 'Order permanently deleted.',
    recover: 'Recover', delete_permanently: 'Delete Permanently',
    th_deleted_by: 'Deleted By', th_deleted_date: 'Deleted Date', th_days_remaining: 'Days Remaining',
    no_deleted_orders_found: 'No deleted orders found.', deleted_by_ph: 'All admins',
    soft_delete_not_enabled: 'This feature will be available after Soft Delete is enabled.',
    all_recovery: 'All recovery windows', recovery_green: 'Green (>14 days)', recovery_orange: 'Orange (4–14 days)', recovery_red: 'Red (≤3 days)',
    days_left: n => n + ' Day' + (n === 1 ? '' : 's') + ' Left', expires_today: 'Expires Today',
    super_admin_only: 'Only a Super Admin can permanently delete an order.',
    date_from: 'From', date_to: 'To',
    /* customers */
    customers_title: 'Customers', cust_search_ph: 'Search name, company, email…',
    th_orders: 'Orders', th_joined: 'Joined', th_order_details: 'Order Details',
    orders_count: n => n + ' Order' + (n === 1 ? '' : 's'),
    active: 'Active', disabled: 'Disabled', no_customers_found: 'No customers found.',
    view_orders: 'View Orders', cust_info: 'Customer Information', full_name: 'Full Name',
    verified: 'Verified', unverified: 'Unverified', registered: 'Registered', last_login: 'Last Login',
    order_history: 'Order History', no_items_stored: 'No item details stored.',
    orders_for: 'Orders — ', edit_customer: 'Edit Customer — ', first_name: 'First Name', last_name: 'Last Name',
    reset_password: 'Reset Password', email_customer: 'Email Customer', delete_account: 'Delete Account',
    customer_updated: 'Customer updated.', pw_reset_sent: 'Password reset email sent.', email_sent: 'Email sent.',
    customer_deleted: 'Customer deleted.', email_modal_title: 'Email ',
    confirm_delete_customer: 'Permanently delete this customer account? This cannot be undone.',
    /* products */
    products_title: 'Products', low_stock_suffix: ' — Low Stock', add_product: 'Add Product',
    prod_search_ph: 'Search products…', th_product: 'Product', th_category: 'Category', th_price: 'Price',
    th_stock: 'Stock', hidden: 'Hidden', no_products_found: 'No products found.',
    confirm_delete_product: 'Delete this product?', product_deleted: 'Product deleted.',
    edit_product: 'Edit Product', id_numeric: 'ID (numeric)', name_en: 'Name (EN)', name_ar: 'Name (AR)',
    price_sar: 'Price (SAR)', desc_en: 'Description (EN)', image_urls: 'Image URLs (one per line)',
    featured: 'Featured', active_visible: 'Active (visible)', name_required: 'Name is required.',
    id_required: 'A numeric ID is required for new products.', product_saved: 'Product saved.',
    /* categories */
    categories_title: 'Categories', add_category: 'Add Category', th_slug: 'Slug', th_sort: 'Sort',
    no_categories: 'No categories yet.', confirm_delete_category: 'Delete this category?', deleted: 'Deleted.',
    edit_category: 'Edit Category', slug: 'Slug', sort_order: 'Sort Order',
    name_slug_required: 'Name and slug are required.', category_saved: 'Category saved.',
    /* quotes */
    quotes_title: 'Quotes', all: 'All', th_contact: 'Contact', th_product_service: 'Product/Service',
    no_quotes: 'No quotes yet.', quote_from: 'Quote from ', convert_to_order: 'Convert to Order',
    saved: 'Saved.', converted: 'Converted to order.',
    /* deleted quotes */
    nav_quotes_deleted: 'Deleted Quotes', quotes_deleted_title: 'Deleted Quotes',
    confirm_delete_quote: 'Delete Quote — Are you sure you want to delete this quote? It can be recovered within 30 days.',
    quote_deleted_toast: 'Quote deleted — it can be recovered within 30 days.',
    confirm_permanent_delete_quote: 'This action cannot be undone. Delete permanently?',
    quote_recovered_toast: 'Quote recovered.', quote_permanently_deleted_toast: 'Quote permanently deleted.',
    no_deleted_quotes_found: 'No deleted quotes found.',
    soft_delete_quotes_not_enabled: 'This feature will be available after Soft Delete is enabled.',
    /* reply to customer */
    reply_to_customer: 'Reply to Customer', to_field: 'To', subject_field: 'Subject',
    attachments_field: 'Attachments', choose_files: 'Choose Files', no_attachments: 'No files attached.',
    close: 'Close', sending_ellipsis: 'Sending…', email_sent_success: 'Email Sent Successfully',
    communication_history: 'Communication History', no_replies_yet: 'No replies sent yet.',
    reply_status_sent: 'Delivered', reply_status_failed: 'Failed',
    subject_message_required: 'Subject and message are required.',
    /* notifications */
    notifications_title: 'Notifications', mark_all_read: 'Mark all as read', no_notifications: 'No notifications.',
    mark_read: 'Mark read',
    /* audit */
    audit_title: 'Audit Logs', th_when: 'When', th_admin: 'Admin', th_action: 'Action', th_entity: 'Entity', th_ip: 'IP',
    no_activity: 'No activity recorded yet.',
    /* account */
    account_title: 'My Account', signed_in_as: 'Signed in as',
    temp_pw_warning: 'You are using the temporary password — please change it below.',
    change_password: 'Change Password', current_password: 'Current Password', new_password: 'New Password',
    update_password: 'Update Password', security: 'Security', logout_all: 'Logout from all devices',
    password_updated: 'Password updated.',
    confirm_logout_all: 'This will sign you out on every device. Continue?',
    /* statuses (display only — underlying values sent to the API stay English) */
    st_all: 'All', st_pending: 'Pending', st_confirmed: 'Confirmed', st_processing: 'Processing',
    st_manufacturing: 'Manufacturing', st_quality_check: 'Quality Check', st_packed: 'Packed', st_ready: 'Ready',
    st_shipped: 'Shipped', st_out_for_delivery: 'Out For Delivery', st_delivered: 'Delivered',
    st_completed: 'Completed', st_cancelled: 'Cancelled', st_returned: 'Returned', st_rejected: 'Rejected',
    st_paid: 'Paid', st_failed: 'Failed', st_refunded: 'Refunded',
    st_new: 'New', st_contacted: 'Contacted', st_quoted: 'Quoted', st_converted: 'Converted', st_closed: 'Closed',
    st_active: 'Active', st_suspended: 'Suspended',
  },
  ar: {
    brand_tag: 'بوابة الإدارة', soon: 'قريباً',
    sec_overview: 'نظرة عامة', sec_sales: 'المبيعات', sec_catalog: 'الكتالوج', sec_insights: 'التحليلات', sec_system: 'النظام',
    nav_dashboard: 'لوحة التحكم', nav_notifications: 'الإشعارات', nav_orders: 'الطلبات', nav_customers: 'العملاء',
    nav_quotes: 'عروض الأسعار', nav_messages: 'الرسائل', nav_payments: 'المدفوعات', nav_invoices: 'الفواتير',
    nav_products: 'المنتجات', nav_categories: 'التصنيفات', nav_inventory: 'المخزون', nav_production: 'الإنتاج',
    nav_reports: 'التقارير', nav_analytics: 'الإحصائيات', nav_website_settings: 'إعدادات الموقع', nav_users: 'المستخدمون',
    nav_roles: 'الأدوار والصلاحيات', nav_audit: 'سجلات التدقيق', nav_email_templates: 'قوالب البريد',
    nav_system_settings: 'إعدادات النظام', nav_account: 'حسابي', nav_logout: 'تسجيل الخروج',
    search_ph: 'ابحث في الطلبات والعملاء والمنتجات…',
    aria_menu: 'القائمة', aria_theme: 'تبديل المظهر', aria_notifications: 'الإشعارات', aria_quick_add: 'إجراءات سريعة', aria_lang: 'تغيير اللغة',
    coming_soon: 'قريباً',
    coming_soon_body: 'هذه الوحدة مخطط لها في مرحلة قادمة وليست متاحة بعد. لا تُعرض هنا أي بيانات تجريبية عن قصد.',
    home_title: 'لوحة التحكم', home_sub_prefix: 'نظرة مباشرة — ',
    kpi_today_orders: 'طلبات اليوم', kpi_pending: 'طلبات معلقة', kpi_processing: 'قيد المعالجة', kpi_completed: 'مكتملة',
    kpi_cancelled: 'ملغاة', kpi_revenue: 'الإيرادات (المكتملة)', kpi_quotes: 'عروض الأسعار', kpi_products: 'المنتجات',
    kpi_customers: 'العملاء', kpi_low_stock: 'مخزون منخفض', kpi_new_suffix: 'جديد',
    recent_orders: 'أحدث الطلبات', recent_customers: 'أحدث العملاء', view_all: 'عرض الكل',
    low_stock_alerts: 'تنبيهات المخزون المنخفض', stock_lbl: 'المخزون', threshold_lbl: 'حد التنبيه',
    no_orders_yet: 'لا توجد طلبات بعد.', no_customers_yet: 'لا يوجد عملاء بعد.',
    open_details_for: 'فتح تفاصيل',
    view: 'عرض', edit: 'تعديل', del: 'حذف', save: 'حفظ', save_changes: 'حفظ التغييرات', send: 'إرسال',
    add: 'إضافة', cancel: 'إلغاء', prev: 'السابق', next: 'التالي',
    page_of: (p, tp, tot) => 'صفحة ' + p + ' من ' + tp + ' (الإجمالي ' + tot + ')',
    actions: 'إجراءات', status: 'الحالة', date: 'التاريخ', name: 'الاسم', email: 'البريد الإلكتروني', phone: 'الهاتف',
    company: 'الشركة', country: 'الدولة', address: 'العنوان', notes: 'ملاحظات', message: 'الرسالة', subject: 'الموضوع',
    registered_customer: 'عميل مسجّل', guest: 'زائر', item: 'منتج', unknown: 'غير معروف',
    orders_title: 'الطلبات', today_suffix: ' — اليوم', order_search_ph: 'ابحث برقم الطلب / العميل…',
    all_statuses: 'كل الحالات', th_order_no: 'رقم الطلب', th_customer: 'العميل', th_items: 'العناصر', th_total: 'الإجمالي',
    th_payment: 'الدفع', no_orders_found: 'لا توجد طلبات مطابقة.',
    order_word: 'طلب', products_count: 'المنتجات', no_item_details_order: 'لا توجد تفاصيل عناصر محفوظة لهذا الطلب.',
    customer_section: 'العميل', order_info: 'معلومات الطلب', order_id: 'معرّف الطلب', order_status: 'حالة الطلب',
    payment_status: 'حالة الدفع', current_stage: 'المرحلة الحالية', tracking: 'التتبع',
    est_completion: 'الإنجاز المتوقع', est_delivery: 'التسليم المتوقع', tracking_number: 'رقم التتبع',
    courier: 'شركة الشحن', totals: 'الإجماليات', subtotal: 'المجموع الفرعي', vat: 'ضريبة القيمة المضافة (15%)', shipping: 'الشحن',
    discount: 'الخصم', grand_total: 'الإجمالي الكلي', delivery_address: 'عنوان التسليم',
    edit_order: 'تعديل الطلب', tracking_pct: 'نسبة التتبع %', delivery_date: 'تاريخ التسليم',
    shipping_cost: 'تكلفة الشحن', cust_delivery_address: 'عنوان العميل / التسليم', admin_notes: 'ملاحظات الإدارة',
    items: 'العناصر', qty: 'الكمية', unit_price: 'سعر الوحدة', current_total: 'الإجمالي الحالي', no_item_details: 'لا توجد تفاصيل عناصر.',
    order_updated: 'تم تحديث الطلب — تمت مزامنته مع لوحة العميل.',
    spec_category: 'التصنيف', spec_sku: 'رمز المنتج', spec_material: 'الخامة', spec_size: 'المقاس', spec_color: 'اللون',
    spec_finish: 'التشطيب', spec_quantity: 'الكمية',
    nav_orders_deleted: 'الطلبات المحذوفة', orders_deleted_title: 'الطلبات المحذوفة',
    confirm_delete_order: 'حذف الطلب — هل أنت متأكد من حذف هذا الطلب؟ يمكن استرجاعه خلال 30 يوماً.',
    order_deleted_toast: 'تم حذف الطلب — يمكن استرجاعه خلال 30 يوماً.',
    confirm_permanent_delete_order: 'لا يمكن التراجع عن هذا الإجراء. هل تريد الحذف النهائي؟',
    order_recovered_toast: 'تم استرجاع الطلب.', order_permanently_deleted_toast: 'تم حذف الطلب نهائياً.',
    recover: 'استرجاع', delete_permanently: 'حذف نهائي',
    th_deleted_by: 'حذف بواسطة', th_deleted_date: 'تاريخ الحذف', th_days_remaining: 'الأيام المتبقية',
    no_deleted_orders_found: 'لا توجد طلبات محذوفة.', deleted_by_ph: 'كل المسؤولين',
    soft_delete_not_enabled: 'ستتوفر هذه الميزة بعد تفعيل الحذف الناعم.',
    all_recovery: 'كل فترات الاسترجاع', recovery_green: 'أخضر (أكثر من 14 يوماً)', recovery_orange: 'برتقالي (4–14 يوماً)', recovery_red: 'أحمر (3 أيام أو أقل)',
    days_left: n => n + ' يوم متبقٍ', expires_today: 'ينتهي اليوم',
    super_admin_only: 'فقط المسؤول الأعلى يمكنه الحذف النهائي للطلب.',
    date_from: 'من', date_to: 'إلى',
    customers_title: 'العملاء', cust_search_ph: 'ابحث بالاسم أو الشركة أو البريد…',
    th_orders: 'الطلبات', th_joined: 'تاريخ التسجيل', th_order_details: 'تفاصيل الطلبات',
    orders_count: n => n === 1 ? 'طلب واحد' : n === 2 ? 'طلبان' : (n + ' طلبات'),
    active: 'نشط', disabled: 'معطّل', no_customers_found: 'لا يوجد عملاء مطابقون.',
    view_orders: 'عرض الطلبات', cust_info: 'معلومات العميل', full_name: 'الاسم الكامل',
    verified: 'موثّق', unverified: 'غير موثّق', registered: 'تاريخ التسجيل', last_login: 'آخر تسجيل دخول',
    order_history: 'سجل الطلبات', no_items_stored: 'لا توجد تفاصيل عناصر محفوظة.',
    orders_for: 'الطلبات — ', edit_customer: 'تعديل العميل — ', first_name: 'الاسم الأول', last_name: 'اسم العائلة',
    reset_password: 'إعادة تعيين كلمة المرور', email_customer: 'مراسلة العميل', delete_account: 'حذف الحساب',
    customer_updated: 'تم تحديث بيانات العميل.', pw_reset_sent: 'تم إرسال رابط إعادة التعيين بالبريد.', email_sent: 'تم إرسال البريد.',
    customer_deleted: 'تم حذف العميل.', email_modal_title: 'مراسلة ',
    confirm_delete_customer: 'حذف حساب هذا العميل نهائياً؟ لا يمكن التراجع عن هذا الإجراء.',
    products_title: 'المنتجات', low_stock_suffix: ' — مخزون منخفض', add_product: 'إضافة منتج',
    prod_search_ph: 'ابحث في المنتجات…', th_product: 'المنتج', th_category: 'التصنيف', th_price: 'السعر',
    th_stock: 'المخزون', hidden: 'مخفي', no_products_found: 'لا توجد منتجات مطابقة.',
    confirm_delete_product: 'حذف هذا المنتج؟', product_deleted: 'تم حذف المنتج.',
    edit_product: 'تعديل المنتج', id_numeric: 'المعرّف (رقمي)', name_en: 'الاسم (إنجليزي)', name_ar: 'الاسم (عربي)',
    price_sar: 'السعر (ر.س)', desc_en: 'الوصف (إنجليزي)', image_urls: 'روابط الصور (رابط في كل سطر)',
    featured: 'مميّز', active_visible: 'نشط (ظاهر)', name_required: 'الاسم مطلوب.',
    id_required: 'المعرّف الرقمي مطلوب للمنتجات الجديدة.', product_saved: 'تم حفظ المنتج.',
    categories_title: 'التصنيفات', add_category: 'إضافة تصنيف', th_slug: 'المعرّف اللطيف', th_sort: 'الترتيب',
    no_categories: 'لا توجد تصنيفات بعد.', confirm_delete_category: 'حذف هذا التصنيف؟', deleted: 'تم الحذف.',
    edit_category: 'تعديل التصنيف', slug: 'المعرّف اللطيف', sort_order: 'ترتيب العرض',
    name_slug_required: 'الاسم والمعرّف مطلوبان.', category_saved: 'تم حفظ التصنيف.',
    quotes_title: 'عروض الأسعار', all: 'الكل', th_contact: 'جهة الاتصال', th_product_service: 'المنتج/الخدمة',
    no_quotes: 'لا توجد عروض أسعار بعد.', quote_from: 'عرض سعر من ', convert_to_order: 'تحويل إلى طلب',
    saved: 'تم الحفظ.', converted: 'تم التحويل إلى طلب.',
    nav_quotes_deleted: 'عروض الأسعار المحذوفة', quotes_deleted_title: 'عروض الأسعار المحذوفة',
    confirm_delete_quote: 'حذف عرض السعر — هل أنت متأكد؟ يمكن استرجاعه خلال 30 يوماً.',
    quote_deleted_toast: 'تم حذف عرض السعر — يمكن استرجاعه خلال 30 يوماً.',
    confirm_permanent_delete_quote: 'لا يمكن التراجع عن هذا الإجراء. هل تريد الحذف النهائي؟',
    quote_recovered_toast: 'تم استرجاع عرض السعر.', quote_permanently_deleted_toast: 'تم حذف عرض السعر نهائياً.',
    no_deleted_quotes_found: 'لا توجد عروض أسعار محذوفة.',
    soft_delete_quotes_not_enabled: 'ستتوفر هذه الميزة بعد تفعيل الحذف الناعم.',
    reply_to_customer: 'الرد على العميل', to_field: 'إلى', subject_field: 'الموضوع',
    attachments_field: 'المرفقات', choose_files: 'اختيار ملفات', no_attachments: 'لا توجد ملفات مرفقة.',
    close: 'إغلاق', sending_ellipsis: 'جارٍ الإرسال…', email_sent_success: 'تم إرسال البريد بنجاح',
    communication_history: 'سجل المراسلات', no_replies_yet: 'لا توجد ردود مرسلة بعد.',
    reply_status_sent: 'تم التسليم', reply_status_failed: 'فشل',
    subject_message_required: 'الموضوع والرسالة مطلوبان.',
    notifications_title: 'الإشعارات', mark_all_read: 'تحديد الكل كمقروء', no_notifications: 'لا توجد إشعارات.',
    mark_read: 'تحديد كمقروء',
    audit_title: 'سجلات التدقيق', th_when: 'الوقت', th_admin: 'المشرف', th_action: 'الإجراء', th_entity: 'العنصر', th_ip: 'عنوان IP',
    no_activity: 'لا يوجد نشاط مسجّل بعد.',
    account_title: 'حسابي', signed_in_as: 'مسجّل الدخول باسم',
    temp_pw_warning: 'أنت تستخدم كلمة المرور المؤقتة — يرجى تغييرها أدناه.',
    change_password: 'تغيير كلمة المرور', current_password: 'كلمة المرور الحالية', new_password: 'كلمة المرور الجديدة',
    update_password: 'تحديث كلمة المرور', security: 'الأمان', logout_all: 'تسجيل الخروج من جميع الأجهزة',
    password_updated: 'تم تحديث كلمة المرور.',
    confirm_logout_all: 'سيتم تسجيل خروجك من جميع الأجهزة. هل تريد المتابعة؟',
    st_all: 'الكل', st_pending: 'معلّق', st_confirmed: 'مؤكّد', st_processing: 'قيد المعالجة',
    st_manufacturing: 'قيد التصنيع', st_quality_check: 'فحص الجودة', st_packed: 'تم التغليف', st_ready: 'جاهز',
    st_shipped: 'تم الشحن', st_out_for_delivery: 'خارج للتوصيل', st_delivered: 'تم التسليم',
    st_completed: 'مكتمل', st_cancelled: 'ملغي', st_returned: 'مرتجع', st_rejected: 'مرفوض',
    st_paid: 'مدفوع', st_failed: 'فشل', st_refunded: 'مسترد',
    st_new: 'جديد', st_contacted: 'تم التواصل', st_quoted: 'تم التسعير', st_converted: 'تم التحويل', st_closed: 'مغلق',
    st_active: 'نشط', st_suspended: 'موقوف',
  },
};

let LANG = (function () { try { return localStorage.getItem('language') === 'ar' ? 'ar' : 'en'; } catch (e) { return 'en'; } })();
function t(key) {
  const d = I18N[LANG] || I18N.en;
  if (key in d) return d[key];
  if (key in I18N.en) return I18N.en[key];
  return key;
}
/* Map from the English data-soon module names in dashboard.html to keys */
const SOON_KEYS = {
  'Messages': 'nav_messages', 'Payments': 'nav_payments', 'Invoices': 'nav_invoices',
  'Inventory': 'nav_inventory', 'Production': 'nav_production', 'Reports': 'nav_reports',
  'Analytics': 'nav_analytics', 'Website Settings': 'nav_website_settings', 'Users': 'nav_users',
  'Roles & Permissions': 'nav_roles', 'Email Templates': 'nav_email_templates', 'System Settings': 'nav_system_settings',
};
function soonName(name) { return SOON_KEYS[name] ? t(SOON_KEYS[name]) : name; }

/* ── Theme (presentation only) ── */
function currentTheme() { return document.documentElement.classList.contains('light') ? 'light' : 'dark'; }
function applyTheme(th) {
  document.documentElement.classList.toggle('light', th === 'light');
  document.body.classList.toggle('light', th === 'light');
  document.documentElement.style.colorScheme = th;
  const b = $('#themeToggleBtn');
  if (b) { b.innerHTML = '<i data-lucide="' + (th === 'light' ? 'moon' : 'sun') + '"></i>'; icons(); }
}

/* ── Static chrome translation (sidebar/topbar carry data-i18n keys) ── */
function applyLangChrome() {
  document.documentElement.lang = LANG;
  document.documentElement.dir = LANG === 'ar' ? 'rtl' : 'ltr';
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.getAttribute('data-i18n-ph')); });
  $$('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
  const lb = $('#langToggleBtn');
  if (lb) lb.textContent = LANG === 'ar' ? 'EN' : 'ع';
}
function setLang(l) {
  if (l === LANG) return;
  LANG = l;
  try { localStorage.setItem('language', l); } catch (e) {}
  applyLangChrome();
  closeModal();
  /* Re-render the current SPA page in the new language (router state
     lives in the hash — same entry point the hashchange handler uses). */
  goTo(location.hash.replace('#', ''));
}

/* ── Skeleton loading (dashboard/page-level) ── */
function skeletonHTML() {
  const card =
    '<div class="ad-skel">' +
      '<div class="ad-skel-line" style="width:36px;height:36px;border-radius:8px"></div>' +
      '<div class="ad-skel-line" style="width:62%"></div>' +
      '<div class="ad-skel-line" style="width:40%"></div>' +
    '</div>';
  return '<div class="ad-page"><div class="ad-skel-grid">' + card + card + card + card + '</div>' +
    '<div class="ad-skel"><div class="ad-skel-line" style="width:30%"></div><div class="ad-skel-line"></div><div class="ad-skel-line" style="width:85%"></div><div class="ad-skel-line" style="width:70%"></div></div></div>';
}

/* ── KPI count-up (presentation only; respects prefers-reduced-motion) ── */
function animateStatNums(scope) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  $$('.ad-stat-num', scope).forEach(el => {
    const m = /^([^\d]*)([\d,]+)(.*)$/.exec(el.textContent.trim());
    if (!m) return;
    const target = Number(m[2].replace(/,/g, ''));
    if (!isFinite(target) || target <= 0) return;
    const hadCommas = m[2].indexOf(',') !== -1;
    const pre = m[1], suf = m[3], dur = 700, t0 = performance.now();
    const fmt = n => hadCommas ? n.toLocaleString('en-US') : String(n);
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = pre + fmt(Math.round(target * e)) + suf;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/* ── API helper: same-origin, CSRF header, auto-redirect to login on 401 ── */
async function api(path, opts) {
  opts = opts || {};
  const headers = Object.assign({ 'X-Admin-Request': '1' }, opts.headers || {});
  if (opts.body && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers,
    credentials: 'same-origin',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) { location.href = '/pages/admin/login.html'; throw new Error('Not authenticated'); }
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ── Toast ── */
function toast(text) {
  let el = $('#adToast');
  if (!el) { el = document.createElement('div'); el.id = 'adToast'; el.className = 'ad-toast'; document.body.appendChild(el); }
  el.textContent = text;
  el.classList.add('is-visible');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('is-visible'), 2600);
}

/* ── Generic modal (reused by every module) ── */
function ensureModal() {
  let el = $('#adModal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'adModal';
    el.className = 'ad-modal-overlay';
    el.innerHTML = '<div class="ad-modal" id="adModalInner"><button class="ad-modal-close" id="adModalClose">&times;</button><div id="adModalBody"></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) closeModal(); });
    $('#adModalClose', el).addEventListener('click', closeModal);
  }
  return el;
}
function openModal(html, wide) {
  const el = ensureModal();
  $('#adModalInner', el).className = 'ad-modal' + (wide ? ' ad-modal--wide' : '');
  $('#adModalBody', el).innerHTML = html;
  el.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  icons();
  return el;
}
function closeModal() {
  const el = $('#adModal');
  if (el) el.classList.remove('is-open');
  document.body.style.overflow = '';
}

/* ── Image lightbox (product previews) ─────────────────────────────
   One overlay reused for every gallery. Opened via delegated clicks on
   any element carrying data-lb (URI-encoded JSON array of image URLs) +
   data-lb-idx, so it works inside dynamically rendered modals with
   nothing to rebind. Click the image to zoom, arrows/keys to navigate,
   Esc / backdrop / × to close. */
let LB = null, LB_IMGS = [], LB_IDX = 0;
function ensureLightbox() {
  if (LB) return LB;
  LB = document.createElement('div');
  LB.id = 'adLightbox';
  LB.className = 'ad-lightbox';
  LB.innerHTML =
    '<button class="ad-lb-btn ad-lb-close" aria-label="Close">&times;</button>' +
    '<button class="ad-lb-btn ad-lb-prev" aria-label="Previous">&#10094;</button>' +
    '<img class="ad-lb-img" alt="">' +
    '<button class="ad-lb-btn ad-lb-next" aria-label="Next">&#10095;</button>' +
    '<div class="ad-lb-count"></div>';
  document.body.appendChild(LB);
  LB.addEventListener('click', e => { if (e.target === LB) closeLightbox(); });
  LB.querySelector('.ad-lb-close').addEventListener('click', closeLightbox);
  LB.querySelector('.ad-lb-prev').addEventListener('click', () => lbNav(-1));
  LB.querySelector('.ad-lb-next').addEventListener('click', () => lbNav(1));
  LB.querySelector('.ad-lb-img').addEventListener('click', function () { this.classList.toggle('is-zoomed'); });
  document.addEventListener('keydown', e => {
    if (!LB.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') lbNav(-1);
    else if (e.key === 'ArrowRight') lbNav(1);
  });
  return LB;
}
function lbShow() {
  const img = LB.querySelector('.ad-lb-img');
  img.classList.remove('is-zoomed');
  img.src = LB_IMGS[LB_IDX];
  const multi = LB_IMGS.length > 1;
  LB.querySelector('.ad-lb-prev').style.visibility = multi ? 'visible' : 'hidden';
  LB.querySelector('.ad-lb-next').style.visibility = multi ? 'visible' : 'hidden';
  LB.querySelector('.ad-lb-count').textContent = multi ? (LB_IDX + 1) + ' / ' + LB_IMGS.length : '';
}
function lbNav(d) { if (!LB_IMGS.length) return; LB_IDX = (LB_IDX + d + LB_IMGS.length) % LB_IMGS.length; lbShow(); }
function openLightbox(images, idx) {
  if (!images || !images.length) return;
  ensureLightbox();
  LB_IMGS = images; LB_IDX = Math.min(Math.max(0, idx || 0), images.length - 1);
  lbShow();
  LB.classList.add('is-open');
}
function closeLightbox() { if (LB) LB.classList.remove('is-open'); }

/* ── Read-only view helpers ────────────────────────────────────────── */
/* Product images were migrated with repo-relative paths ("assets/…");
   admin pages live under /pages/admin/, so root-anchor them. */
function imgUrl(src) {
  if (!src) return '';
  if (/^(https?:)?\/\//.test(src) || src.charAt(0) === '/') return src;
  return '/' + src;
}
function lbAttrs(imgs, idx) {
  return ' data-lb="' + encodeURIComponent(JSON.stringify(imgs)) + '" data-lb-idx="' + idx + '"';
}
/* Label/value rows; values are pre-escaped by the caller (some contain
   badge HTML). Empty values render as "—". */
function infoGrid(pairs) {
  return '<div class="ad-view-grid">' + pairs.map(p =>
    '<div class="ad-view-row"><span class="ad-view-lbl">' + esc(p[0]) + '</span><span class="ad-view-val">' + (p[1] == null || p[1] === '' ? '—' : p[1]) + '</span></div>'
  ).join('') + '</div>';
}
/* One order line as a product card: thumbnail + gallery (lightbox-able),
   name, description and specs — all from the enriched product record the
   API joined in; items whose product was deleted/renamed fall back to
   the snapshot fields stored on the order itself. */
function orderItemCard(it) {
  const p = it.product || null;
  const imgs = (p && p.images.length ? p.images : []).map(imgUrl);
  const thumb = imgs.length
    ? '<img class="ad-oi-thumb" src="' + esc(imgs[0]) + '" alt="" loading="lazy"' + lbAttrs(imgs, 0) + '>'
    : '<div class="ad-oi-thumb ad-oi-thumb--empty"><i data-lucide="package"></i></div>';
  const gallery = imgs.length > 1
    ? '<div class="ad-oi-gallery">' + imgs.map((src, i) =>
        '<img src="' + esc(src) + '" alt="" loading="lazy"' + lbAttrs(imgs, i) + '>').join('') + '</div>'
    : '';
  const qty = Number(it.qty) || 1;
  const unit = it.price != null ? Number(it.price) : (it.lineTotal ? Number(it.lineTotal) / qty : 0);
  const total = it.lineTotal != null ? Number(it.lineTotal) : unit * qty;
  const spec = (lbl, val) => val ? '<div class="ad-oi-spec"><span>' + esc(lbl) + '</span>' + esc(val) + '</div>' : '';
  return '<div class="ad-oi-card">' +
    '<div class="ad-oi-media">' + thumb + gallery + '</div>' +
    '<div class="ad-oi-body">' +
      '<div class="ad-oi-name">' + esc(it.name || (p && p.name) || t('item')) + '</div>' +
      (p && p.description ? '<div class="ad-oi-desc">' + esc(p.description) + '</div>' : '') +
      '<div class="ad-oi-specs">' +
        spec(t('spec_category'), p && p.category) +
        spec(t('spec_sku'), p && p.sku) +
        spec(t('spec_material'), it.material || (p && p.material)) +
        spec(t('spec_size'), it.size || (p && p.sizes.length ? p.sizes.join(' / ') : null)) +
        spec(t('spec_color'), it.color) +
        spec(t('spec_finish'), it.finish || (p && p.finishes.length ? p.finishes.join(' / ') : null)) +
        spec(t('spec_quantity'), '× ' + qty) +
        spec(t('unit_price'), money(unit)) +
      '</div>' +
    '</div>' +
    '<div class="ad-oi-total">' + money(total) + '</div>' +
  '</div>';
}

/* ── State ── */
let CURRENT_ADMIN = null;
let currentPage = 'home';

/* ════════════════════════════════════════════════════════════════
   BOOT
   ════════════════════════════════════════════════════════════════ */
async function boot() {
  try {
    const data = await api('/api/admin/auth');
    CURRENT_ADMIN = data.admin;
  } catch (e) { return; } // already redirected to login

  /* Profile-display is cosmetic — never let a hiccup here block wiring
     the actual navigation below. */
  try {
    $('#profileName').textContent = CURRENT_ADMIN.full_name || CURRENT_ADMIN.email;
    $('#profileAvatar').textContent = (CURRENT_ADMIN.full_name || CURRENT_ADMIN.email || '??').slice(0, 2).toUpperCase();
  } catch (e) { console.error('[admin] profile display failed (non-fatal):', e); }

  applyTheme(currentTheme());   // syncs the toggle icon with the pre-paint script
  applyLangChrome();            // translates the static sidebar/topbar chrome
  wireNav();
  wireTopbar();
  startClock();
  pollNotifBadge();
  /* Skip the network round-trip while the tab is in the background —
     nobody is looking at the badge — and catch up immediately the
     moment it's visible again instead of waiting up to 30s. */
  setInterval(() => { if (!document.hidden) pollNotifBadge(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pollNotifBadge(); });

  /* Initial route: the URL hash is the source of truth (works with
     Back/Forward and survives a refresh) — ?page=<x> is accepted as an
     alternate entry-point format (e.g. a shared link) and is normalised
     into a hash immediately so the rest of the routing stays unified. */
  const initialParams = new URLSearchParams(location.search);
  const pageParam = initialParams.get('page');
  let startPage = location.hash.replace('#', '');
  if (!startPage && pageParam) {
    startPage = pageParam;
    history.replaceState(null, '', location.pathname + '#' + pageParam);
  }
  goTo(startPage || 'home');
  window.addEventListener('hashchange', () => goTo(location.hash.replace('#', '')));
  icons();

  /* Deep-link handoff from the "View Order" email button (via login.js) —
     jump straight to that exact order/quote once the dashboard is ready,
     then clean the query string off the URL. */
  const params = new URLSearchParams(location.search);
  const openOrderId = params.get('openOrder');
  const openQuoteId = params.get('openQuote');
  if (openOrderId || openQuoteId) {
    history.replaceState(null, '', location.pathname + location.hash);
    if (openOrderId) { location.hash = '#orders'; setTimeout(() => openOrderDetail(openOrderId), 200); }
    else { location.hash = '#quotes'; setTimeout(() => openQuoteDetail(openQuoteId), 200); }
  }
}

/* Navigation uses ONE delegated listener on document instead of binding
   a handler to each button individually. This is deliberate: it can
   never "miss" a button (nothing to forget to (re)bind), it doesn't care
   whether the click lands on the <button>, the icon Lucide swaps in for
   the original <i data-lucide>, or the label <span> — e.target.closest()
   finds the right ancestor regardless — and it keeps working even if a
   render function ever rebuilds part of the chrome. Sidebar AND topbar
   buttons (#notifBellBtn, #quickAddBtn, #profileBtn) all carry the same
   [data-page] attribute, so one handler covers both. */
function wireNav() {
  document.addEventListener('click', e => {
    if (!e.target || typeof e.target.closest !== 'function') return;
    /* Product image → lightbox (works inside any modal, nothing to rebind) */
    const lbEl = e.target.closest('[data-lb]');
    if (lbEl) {
      try { openLightbox(JSON.parse(decodeURIComponent(lbEl.getAttribute('data-lb'))), Number(lbEl.getAttribute('data-lb-idx')) || 0); } catch (_) {}
      return;
    }
    const pageBtn = e.target.closest('[data-page]');
    if (pageBtn) { location.hash = '#' + pageBtn.getAttribute('data-page'); return; }
    const soonBtn = e.target.closest('[data-soon]');
    if (soonBtn) { renderComingSoon(soonBtn.getAttribute('data-soon')); return; }
    /* Any other button (View / Edit / View Orders / Delete / …) has its
       own dedicated listener bound where it's rendered — never let that
       click also fall through to a containing clickable row below. */
    if (e.target.closest('button')) return;
    /* Dashboard Home rows + the Customers table row open the read-only
       preview (same as each table's View button) — same delegated
       listener, so this keeps working no matter how many times the
       page re-renders (auto-refresh included). */
    const orderRow = e.target.closest('[data-order-row]');
    if (orderRow) { openOrderView(orderRow.getAttribute('data-order-row')); return; }
    const custRow = e.target.closest('[data-customer-row]');
    if (custRow) { openCustomerView(custRow.getAttribute('data-customer-row')); }
  });
  /* Generic keyboard activation for every non-native clickable element
     (stat cards, table rows) marked up as role="button" — native
     <button>s already get this for free, this covers the rest. */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    /* e.target is the plain Document (no .closest()) when the key is
       pressed while nothing on the page has focus — guard against that
       instead of throwing on every such keypress. */
    if (!e.target || typeof e.target.closest !== 'function') return;
    const el = e.target.closest('[role="button"][tabindex]');
    if (!el) return;
    e.preventDefault();
    el.click();
  });
  $('#logoutBtn').addEventListener('click', async () => {
    try { await api('/api/admin/auth', { method: 'POST', body: { action: 'logout' } }); } catch (e) {}
    location.href = '/products';
  });
  $('#sideToggle').addEventListener('click', () => $('#adSide').classList.toggle('is-open'));
  const backdrop = $('#adBackdrop');
  if (backdrop) backdrop.addEventListener('click', () => $('#adSide').classList.remove('is-open'));
}
function wireTopbar() {
  /* #notifBellBtn / #profileBtn already carry [data-page] and are handled
     by the delegated listener above — only their extra side-effects live here. */
  $('#quickAddBtn').addEventListener('click', () => { setTimeout(() => { const b = $('#productAddBtn'); if (b) b.click(); }, 150); });
  /* Theme toggle — persists only when the admin explicitly toggles, so
     system-followers keep following the OS until they choose. */
  const themeBtn = $('#themeToggleBtn');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem('af-admin-theme', next); } catch (e) {}
  });
  /* Language toggle — instant, no reload; same localStorage key as the
     main site's language switcher so admin and site stay in sync. */
  const langBtn = $('#langToggleBtn');
  if (langBtn) langBtn.addEventListener('click', () => setLang(LANG === 'ar' ? 'en' : 'ar'));
  $('#globalSearch').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const term = e.target.value.trim();
    if (!term) return;
    location.hash = '#orders';
    setTimeout(() => { const s = $('#orderSearchInput'); if (s) { s.value = term; s.dispatchEvent(new Event('input')); } }, 150);
  });
}
function startClock() {
  const el = $('#adClock');
  const tick = () => { el.textContent = new Date().toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }); };
  tick();
  /* No point re-rendering a clock nobody can see. */
  setInterval(() => { if (!document.hidden) tick(); }, 1000);
}
async function pollNotifBadge() {
  try {
    const data = await api('/api/admin/notifications');
    const n = data.unread || 0;
    [$('#navNotifBadge'), $('#bellBadge')].forEach(b => { if (b) { b.hidden = n === 0; b.classList.toggle('ad-hidden', n === 0); b.textContent = n > 9 ? '9+' : String(n); } });
  } catch (e) {}
}

const ROUTES = ['home', 'orders', 'orders-deleted', 'customers', 'products', 'categories', 'quotes', 'quotes-deleted', 'notifications', 'audit', 'account'];
let homeRefreshTimer = null;

/* A route can carry filters as a query string appended to the hash
   itself, e.g. "#orders?status=pending" or "#products?lowStock=1" —
   this is how the Dashboard Home stat cards deep-link into a filtered
   view of another page while staying on the same hash-routing system
   (works with Back/Forward and refresh exactly like a plain route). */
function goTo(rawPage) {
  const parts = String(rawPage || '').split('?');
  let page = parts[0];
  const filters = parts[1] ? Object.fromEntries(new URLSearchParams(parts[1])) : {};
  if (!ROUTES.includes(page)) page = 'home';

  if (homeRefreshTimer) { clearInterval(homeRefreshTimer); homeRefreshTimer = null; }

  currentPage = page;
  $$('.ad-nav-item[data-page]').forEach(b => b.classList.toggle('is-active', b.getAttribute('data-page') === page));
  $('#adSide').classList.remove('is-open');
  const content = $('#adContent');
  content.innerHTML = skeletonHTML();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const renderers = {
    home: renderHome, orders: renderOrders, 'orders-deleted': renderDeletedOrders, customers: renderCustomers, products: renderProducts,
    categories: renderCategories, quotes: renderQuotes, 'quotes-deleted': renderDeletedQuotes, notifications: renderNotifications,
    audit: renderAudit, account: renderAccount,
  };
  renderers[page](filters).catch(err => {
    content.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">⚠️</div><p>' + esc(err.message) + '</p></div>';
  });
}

function renderComingSoon(name) {
  $('#adContent').innerHTML =
    '<div class="ad-page"><div class="ad-coming-soon"><div class="ad-coming-soon-icon"><i data-lucide="hammer"></i></div>' +
    '<h3>' + esc(soonName(name)) + ' — ' + esc(t('coming_soon')) + '</h3>' +
    '<p>' + esc(t('coming_soon_body')) + '</p></div></div>';
  icons();
}

/* ════════════════════════════════════════════════════════════════
   DASHBOARD HOME
   ════════════════════════════════════════════════════════════════ */
const HOME_REFRESH_MS = 20000; // auto-refresh while Home is the active page

async function renderHome() {
  await loadHomeStats();
  /* Keep the widgets current without a manual browser refresh — cleared
     in goTo() the moment the admin navigates away from Home. */
  homeRefreshTimer = setInterval(() => { if (currentPage === 'home' && !document.hidden) loadHomeStats(true); }, HOME_REFRESH_MS);
}

async function loadHomeStats(isBackgroundRefresh) {
  let s;
  try { s = await api('/api/admin/dashboard-stats'); }
  catch (err) {
    if (!isBackgroundRefresh) $('#adContent').innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">⚠️</div><p>' + esc(err.message) + '</p></div>';
    return;
  }

  /* Each card is clickable (mouse + Enter/Space) and deep-links into the
     related page with its filter pre-applied — data-page carries the
     same "page?query" format the router already understands; Revenue
     routes into the Reports placeholder like the sidebar item does. */
  const statCard = (icon, num, label, color, nav) => {
    const navAttr = nav.soon ? ' data-soon="' + esc(nav.soon) + '"' : ' data-page="' + esc(nav.page) + '"';
    return '<div class="ad-stat" role="button" tabindex="0" aria-label="' + esc(label) + ': ' + esc(String(num)) + '"' + navAttr + '>' +
      '<div class="ad-stat-icon" style="background:var(--ad-card-2);color:' + color + '"><i data-lucide="' + icon + '"></i></div>' +
      '<div class="ad-stat-num">' + num + '</div><div class="ad-stat-lbl">' + esc(label) + '</div></div>';
  };

  const content = $('#adContent');
  content.innerHTML =
    '<div class="ad-page">' +
      '<div class="ad-page-head"><div><h1 class="ad-page-title">' + esc(t('home_title')) + '</h1><p class="ad-page-sub">' + esc(t('home_sub_prefix')) + new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '</p></div></div>' +
      '<div class="ad-stats-grid">' +
        statCard('shopping-cart', s.todayOrders, t('kpi_today_orders'), 'var(--ad-teal-2)', { page: 'orders?today=1' }) +
        statCard('clock', s.pending, t('kpi_pending'), 'var(--ad-amber)', { page: 'orders?status=pending' }) +
        statCard('loader', s.processing, t('kpi_processing'), 'var(--ad-purple)', { page: 'orders?status=processing' }) +
        statCard('check-circle', s.completed, t('kpi_completed'), 'var(--ad-green)', { page: 'orders?status=completed' }) +
        statCard('x-circle', s.cancelled, t('kpi_cancelled'), 'var(--ad-red)', { page: 'orders?status=cancelled' }) +
        statCard('banknote', money(s.revenue), t('kpi_revenue'), 'var(--ad-green)', { soon: 'Reports' }) +
        statCard('file-text', s.quotesTotal + ' (' + s.quotesNew + ' ' + t('kpi_new_suffix') + ')', t('kpi_quotes'), 'var(--ad-blue)', { page: 'quotes' }) +
        statCard('package', s.productsTotal, t('kpi_products'), 'var(--ad-teal-2)', { page: 'products' }) +
        statCard('users', s.customersTotal, t('kpi_customers'), 'var(--ad-purple)', { page: 'customers' }) +
        statCard('alert-triangle', s.lowStockCount, t('kpi_low_stock'), 'var(--ad-red)', { page: 'products?lowStock=1' }) +
      '</div>' +
      '<div class="ad-form-grid">' +
        '<div class="ad-card"><div class="ad-card-title">' + esc(t('recent_orders')) + '<a href="#orders" class="ad-btn-sm">' + esc(t('view_all')) + '</a></div>' +
          '<div id="homeRecentOrders"></div></div>' +
        '<div class="ad-card"><div class="ad-card-title">' + esc(t('recent_customers')) + '<a href="#customers" class="ad-btn-sm">' + esc(t('view_all')) + '</a></div>' +
          '<div id="homeRecentCustomers"></div></div>' +
      '</div>' +
      (s.lowStock.length ? '<div class="ad-card"><div class="ad-card-title">' + esc(t('low_stock_alerts')) + '</div><div id="homeLowStock"></div></div>' : '') +
    '</div>';

  $('#homeRecentOrders').innerHTML = s.recentOrders.length
    ? s.recentOrders.map(o => rowLine(o.order_no || o.id.slice(0, 8), o.customer, money(o.grand_total), o.status, { orderId: o.id })).join('')
    : '<p class="ad-empty">' + esc(t('no_orders_yet')) + '</p>';
  $('#homeRecentCustomers').innerHTML = s.recentCustomers.length
    ? s.recentCustomers.map(c => rowLine(c.name, c.email, new Date(c.created_at).toLocaleDateString(), null, { customerId: c.id })).join('')
    : '<p class="ad-empty">' + esc(t('no_customers_yet')) + '</p>';
  const lowStockEl = $('#homeLowStock');
  if (lowStockEl) lowStockEl.innerHTML = s.lowStock.map(p => rowLine(p.name, t('stock_lbl') + ': ' + p.stock, t('threshold_lbl') + ' ' + p.low_stock_threshold, 'cancelled')).join('');
  icons();
  if (!isBackgroundRefresh) animateStatNums(content);
}
/* `link` is optional: { orderId } or { customerId } makes the whole row
   clickable/keyboard-activatable, opening the exact same detail modal as
   the table's "View" button — handled by the delegated listener in
   wireNav(), so this keeps working across every re-render (including
   the Home auto-refresh) with nothing extra to rebind. */
function rowLine(a, b, c, status, link) {
  const interactive = link && (link.orderId || link.customerId);
  const attrs = !interactive ? '' :
    ' role="button" tabindex="0" class="ad-row-clickable" aria-label="' + esc(t('open_details_for')) + ' ' + esc(a) + '"' +
    (link.orderId ? ' data-order-row="' + esc(link.orderId) + '"' : ' data-customer-row="' + esc(link.customerId) + '"');
  return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--ad-border);font-size:13px"' + attrs + '>' +
    '<div><div style="font-weight:600">' + esc(a) + '</div><div style="color:var(--ad-text-50);font-size:12px">' + esc(b) + '</div></div>' +
    '<div style="display:flex;align-items:center;gap:8px">' + (status ? '<span class="ad-badge ad-badge--' + esc(status) + '">' + esc(label(status)) + '</span>' : '') + '<span>' + esc(c) + '</span></div>' +
  '</div>';
}

/* ════════════════════════════════════════════════════════════════
   ORDERS
   ════════════════════════════════════════════════════════════════ */
const ORDER_STATUSES = ['pending','confirmed','processing','manufacturing','quality_check','packed','ready','shipped','out_for_delivery','delivered','completed','cancelled','returned','rejected'];
let ordersPage = 1, ordersStatus = 'all', ordersSearch = '', ordersToday = false;
/* Set from the `softDeleteEnabled` flag every /api/admin/orders* response
   carries — true until the first real check says otherwise, so the
   Delete button only disappears once we actually know the migration
   hasn't run (never assumed up front). */
let SOFT_DELETE_ENABLED = true;

async function renderOrders(filters) {
  filters = filters || {};
  ordersStatus = ORDER_STATUSES.includes(filters.status) ? filters.status : 'all';
  ordersToday = filters.today === '1';
  ordersSearch = ''; ordersPage = 1;

  $('#adContent').innerHTML =
    '<div class="ad-page"><div class="ad-page-head"><h1 class="ad-page-title">' + esc(t('orders_title')) + (ordersToday ? esc(t('today_suffix')) : '') + '</h1></div>' +
    '<div class="ad-toolbar">' +
      '<input class="ad-input" id="orderSearchInput" type="search" placeholder="' + esc(t('order_search_ph')) + '">' +
      '<select class="ad-select" id="orderStatusFilter"><option value="all">' + esc(t('all_statuses')) + '</option>' +
        ORDER_STATUSES.map(s => '<option value="' + s + '"' + (s === ordersStatus ? ' selected' : '') + '>' + label(s) + '</option>').join('') +
      '</select>' +
    '</div>' +
    '<div id="ordersTableWrap"></div></div>';

  $('#orderSearchInput').addEventListener('input', debounce(e => { ordersSearch = e.target.value; ordersPage = 1; loadOrdersTable(); }, 350));
  $('#orderStatusFilter').addEventListener('change', e => { ordersStatus = e.target.value; ordersPage = 1; loadOrdersTable(); });
  await loadOrdersTable();
}
/* Display label for a status value — translated when a dictionary entry
   exists; the underlying value sent to the API always stays English. */
function label(s) {
  const key = 'st_' + s;
  const v = t(key);
  if (v !== key) return v;
  return String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

async function loadOrdersTable() {
  const wrap = $('#ordersTableWrap');
  wrap.innerHTML = '<div class="ad-loading"><div class="ad-spinner"></div></div>';
  const q = new URLSearchParams({ page: ordersPage, pageSize: 15, status: ordersStatus, search: ordersSearch });
  if (ordersToday) q.set('today', '1');
  const data = await api('/api/admin/orders?' + q.toString());
  SOFT_DELETE_ENABLED = data.softDeleteEnabled !== false;
  if (!data.orders.length) { wrap.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">📦</div>' + esc(t('no_orders_found')) + '</div>'; return; }
  wrap.innerHTML =
    '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>' + esc(t('th_order_no')) + '</th><th>' + esc(t('th_customer')) + '</th><th>' + esc(t('email')) + '</th><th>' + esc(t('th_items')) + '</th><th>' + esc(t('th_total')) + '</th><th>' + esc(t('status')) + '</th><th>' + esc(t('th_payment')) + '</th><th>' + esc(t('date')) + '</th><th>' + esc(t('actions')) + '</th></tr></thead><tbody>' +
    data.orders.map(o => {
      const name = o.guest_name || o.customer_name || (o.user_id ? t('registered_customer') : t('guest'));
      const email = o.guest_email || o.customer_email || '—';
      return '<tr><td>' + esc(o.order_no || o.id.slice(0, 8)) + '</td>' +
      '<td>' + esc(name) + '</td>' +
      '<td>' + esc(email) + '</td>' +
      '<td>' + (o.items ? o.items.length : 0) + '</td>' +
      '<td>' + money(o.grand_total) + '</td>' +
      '<td><span class="ad-badge ad-badge--' + esc(o.status) + '">' + label(o.status) + '</span></td>' +
      '<td><span class="ad-badge ad-badge--' + esc(o.payment_status || 'pending') + '">' + label(o.payment_status || 'pending') + '</span></td>' +
      '<td>' + new Date(o.created_at).toLocaleDateString() + '</td>' +
      '<td class="ad-actions-row">' +
        '<button class="ad-btn-sm ad-btn-sm--primary" data-view="' + o.id + '">' + esc(t('view')) + '</button>' +
        '<button class="ad-btn-sm" data-edit-order="' + o.id + '">' + esc(t('edit')) + '</button>' +
        (SOFT_DELETE_ENABLED ? '<button class="ad-btn-sm ad-btn-sm--danger" data-delete-order="' + o.id + '">' + esc(t('del')) + '</button>' : '') +
      '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    pagination(ordersPage, data.total, 15, p => { ordersPage = p; loadOrdersTable(); });
  $$('[data-view]', wrap).forEach(b => b.addEventListener('click', () => openOrderView(b.getAttribute('data-view'))));
  $$('[data-edit-order]', wrap).forEach(b => b.addEventListener('click', () => openOrderDetail(b.getAttribute('data-edit-order'))));
  $$('[data-delete-order]', wrap).forEach(b => b.addEventListener('click', () => deleteOrderAction(b.getAttribute('data-delete-order'))));
}

/* Soft delete only — the order row and all its data stay in the DB,
   just flagged out of every active query (server enforces this too,
   see api/admin/orders/delete.js), and it becomes recoverable for 30
   days from the Deleted Orders page. */
async function deleteOrderAction(id) {
  if (!confirm(t('confirm_delete_order'))) return;
  try {
    await api('/api/admin/orders/delete', { method: 'POST', body: { id } });
    toast(t('order_deleted_toast'));
    loadOrdersTable();
  } catch (err) { toast(err.message); }
}

function pagination(page, total, pageSize, onChange) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return '';
  const id = 'pg-' + Math.random().toString(36).slice(2);
  setTimeout(() => {
    const prev = $('#' + id + '-prev'), next = $('#' + id + '-next');
    if (prev) prev.addEventListener('click', () => onChange(page - 1));
    if (next) next.addEventListener('click', () => onChange(page + 1));
  }, 0);
  return '<div class="ad-pagination">' +
    '<button class="ad-btn-sm" id="' + id + '-prev"' + (page <= 1 ? ' disabled' : '') + '>' + esc(t('prev')) + '</button>' +
    '<span>' + esc(t('page_of')(page, totalPages, total)) + '</span>' +
    '<button class="ad-btn-sm" id="' + id + '-next"' + (page >= totalPages ? ' disabled' : '') + '>' + esc(t('next')) + '</button>' +
  '</div>';
}

/* ════════════════════════════════════════════════════════════════
   DELETED ORDERS — Recover / Permanently Delete (Super Admin only)
   ════════════════════════════════════════════════════════════════ */
let deletedOrdersPage = 1, deletedOrdersSearch = '', deletedOrdersBy = '', deletedOrdersRecovery = 'all',
  deletedOrdersFrom = '', deletedOrdersTo = '', deletedOrdersStatus = 'all';

async function renderDeletedOrders() {
  deletedOrdersPage = 1; deletedOrdersSearch = ''; deletedOrdersBy = ''; deletedOrdersRecovery = 'all';
  deletedOrdersFrom = ''; deletedOrdersTo = ''; deletedOrdersStatus = 'all';

  $('#adContent').innerHTML =
    '<div class="ad-page"><div class="ad-page-head"><h1 class="ad-page-title">' + esc(t('orders_deleted_title')) + '</h1></div>' +
    '<div class="ad-toolbar">' +
      '<input class="ad-input" id="delOrderSearchInput" type="search" placeholder="' + esc(t('order_search_ph')) + '">' +
      '<select class="ad-select" id="delOrderStatusFilter"><option value="all">' + esc(t('all_statuses')) + '</option>' +
        ORDER_STATUSES.map(s => '<option value="' + s + '">' + label(s) + '</option>').join('') +
      '</select>' +
      '<select class="ad-select" id="delOrderRecoveryFilter">' +
        '<option value="all">' + esc(t('all_recovery')) + '</option>' +
        '<option value="green">' + esc(t('recovery_green')) + '</option>' +
        '<option value="orange">' + esc(t('recovery_orange')) + '</option>' +
        '<option value="red">' + esc(t('recovery_red')) + '</option>' +
      '</select>' +
      '<label class="ad-inline-label">' + esc(t('date_from')) + ' <input class="ad-input" id="delOrderFrom" type="date"></label>' +
      '<label class="ad-inline-label">' + esc(t('date_to')) + ' <input class="ad-input" id="delOrderTo" type="date"></label>' +
    '</div>' +
    '<div id="deletedOrdersTableWrap"></div></div>';

  $('#delOrderSearchInput').addEventListener('input', debounce(e => { deletedOrdersSearch = e.target.value; deletedOrdersPage = 1; loadDeletedOrdersTable(); }, 350));
  $('#delOrderStatusFilter').addEventListener('change', e => { deletedOrdersStatus = e.target.value; deletedOrdersPage = 1; loadDeletedOrdersTable(); });
  $('#delOrderRecoveryFilter').addEventListener('change', e => { deletedOrdersRecovery = e.target.value; deletedOrdersPage = 1; loadDeletedOrdersTable(); });
  $('#delOrderFrom').addEventListener('change', e => { deletedOrdersFrom = e.target.value; deletedOrdersPage = 1; loadDeletedOrdersTable(); });
  $('#delOrderTo').addEventListener('change', e => { deletedOrdersTo = e.target.value; deletedOrdersPage = 1; loadDeletedOrdersTable(); });
  await loadDeletedOrdersTable();
}

/* Green / Orange / Red countdown badge — thresholds match the server's
   own bucketing in api/admin/orders/deleted.js's recovery filter so the
   badge colour and the filter dropdown always agree on the same order. */
function recoveryBadge(daysRemaining) {
  const cls = daysRemaining > 14 ? 'completed' : daysRemaining > 3 ? 'pending' : 'cancelled';
  const text = daysRemaining <= 0 ? t('expires_today') : t('days_left')(daysRemaining);
  return '<span class="ad-badge ad-badge--' + cls + '">' + esc(text) + '</span>';
}

async function loadDeletedOrdersTable() {
  const wrap = $('#deletedOrdersTableWrap');
  wrap.innerHTML = '<div class="ad-loading"><div class="ad-spinner"></div></div>';
  const q = new URLSearchParams({ page: deletedOrdersPage, pageSize: 15, search: deletedOrdersSearch, recovery: deletedOrdersRecovery, status: deletedOrdersStatus });
  if (deletedOrdersBy) q.set('deletedBy', deletedOrdersBy);
  if (deletedOrdersFrom) q.set('dateFrom', deletedOrdersFrom);
  if (deletedOrdersTo) q.set('dateTo', deletedOrdersTo);
  const data = await api('/api/admin/orders/deleted?' + q.toString());
  SOFT_DELETE_ENABLED = data.softDeleteEnabled !== false;
  if (!SOFT_DELETE_ENABLED) {
    wrap.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">🔒</div>' + esc(t('soft_delete_not_enabled')) + '</div>';
    return;
  }
  if (!data.orders.length) { wrap.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">🗑️</div>' + esc(t('no_deleted_orders_found')) + '</div>'; return; }

  const isSuperAdmin = CURRENT_ADMIN && CURRENT_ADMIN.role === 'admin';
  wrap.innerHTML =
    '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>' + esc(t('th_order_no')) + '</th><th>' + esc(t('th_customer')) + '</th><th>' + esc(t('email')) + '</th><th>' + esc(t('th_total')) + '</th><th>' + esc(t('status')) + '</th><th>' + esc(t('th_deleted_by')) + '</th><th>' + esc(t('th_deleted_date')) + '</th><th>' + esc(t('th_days_remaining')) + '</th><th>' + esc(t('actions')) + '</th></tr></thead><tbody>' +
    data.orders.map(o => {
      const name = o.guest_name || o.customer_name || (o.user_id ? t('registered_customer') : t('guest'));
      const email = o.guest_email || o.customer_email || '—';
      return '<tr><td>' + esc(o.order_no || o.id.slice(0, 8)) + '</td>' +
      '<td>' + esc(name) + '</td>' +
      '<td>' + esc(email) + '</td>' +
      '<td>' + money(o.grand_total) + '</td>' +
      '<td><span class="ad-badge ad-badge--' + esc(o.status) + '">' + label(o.status) + '</span></td>' +
      '<td>' + esc(o.deleted_by_name || '—') + '</td>' +
      '<td>' + new Date(o.deleted_at).toLocaleDateString() + '</td>' +
      '<td>' + recoveryBadge(o.days_remaining) + '</td>' +
      '<td class="ad-actions-row">' +
        '<button class="ad-btn-sm ad-btn-sm--primary" data-recover="' + o.id + '">' + esc(t('recover')) + '</button>' +
        (isSuperAdmin ? '<button class="ad-btn-sm ad-btn-sm--danger" data-perm-delete="' + o.id + '">' + esc(t('delete_permanently')) + '</button>' : '') +
      '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    pagination(deletedOrdersPage, data.total, 15, p => { deletedOrdersPage = p; loadDeletedOrdersTable(); });
  $$('[data-recover]', wrap).forEach(b => b.addEventListener('click', () => recoverOrderAction(b.getAttribute('data-recover'))));
  $$('[data-perm-delete]', wrap).forEach(b => b.addEventListener('click', () => permanentlyDeleteOrderAction(b.getAttribute('data-perm-delete'))));
}

async function recoverOrderAction(id) {
  try {
    await api('/api/admin/orders/recover', { method: 'POST', body: { id } });
    toast(t('order_recovered_toast'));
    loadDeletedOrdersTable();
  } catch (err) { toast(err.message); }
}

/* Restricted to Super Admin (admin_users.role === 'admin') — the button
   itself is already hidden for anyone else (see isSuperAdmin above),
   but the server re-checks the same rule so this can't be bypassed by
   calling the API directly. */
async function permanentlyDeleteOrderAction(id) {
  if (!confirm(t('confirm_permanent_delete_order'))) return;
  try {
    await api('/api/admin/orders/permanent?id=' + id, { method: 'DELETE' });
    toast(t('order_permanently_deleted_toast'));
    loadDeletedOrdersTable();
  } catch (err) { toast(err.message); }
}

/* Read-only order preview — everything below comes from the order row
   plus the product records the API joined onto each item. No inputs,
   no save; editing lives in openOrderDetail (the Edit button). */
async function openOrderView(id) {
  const data = await api('/api/admin/orders?id=' + id);
  const o = data.order;
  const custName = o.guest_name || o.customer_name || (o.user_id ? t('registered_customer') : t('guest'));
  const items = o.items || [];
  const statusIdx = ORDER_STATUSES.indexOf(o.status);
  const cancelled = ['cancelled', 'returned', 'rejected'].includes(o.status);
  const timeline = '<div class="ad-timeline">' + ORDER_STATUSES.slice(0, 11).map(s => {
    const done = ORDER_STATUSES.indexOf(s) <= statusIdx && statusIdx !== -1 && !cancelled;
    return '<div class="ad-timeline-step' + (done ? ' is-done' : '') + '"><div class="ad-timeline-dot">' + (done ? '✓' : '') + '</div><div class="ad-timeline-label">' + label(s) + '</div></div>';
  }).join('') + '</div>';

  openModal(
    '<h3 class="ad-modal-title">' + esc(t('order_word')) + ' ' + esc(o.order_no || o.id.slice(0, 8)) + ' &nbsp;' +
      '<span class="ad-badge ad-badge--' + esc(o.status) + '">' + label(o.status) + '</span> ' +
      '<span class="ad-badge ad-badge--' + esc(o.payment_status || 'pending') + '">' + label(o.payment_status || 'pending') + '</span></h3>' +

    '<div class="ad-card-title">' + esc(t('products_count')) + ' (' + items.length + ')</div>' +
    (items.length ? items.map(orderItemCard).join('') : '<p class="ad-empty">' + esc(t('no_item_details_order')) + '</p>') +

    '<div class="ad-card-title" style="margin-top:16px">' + esc(t('customer_section')) + '</div>' +
    infoGrid([
      [t('name'), esc(custName)],
      [t('email'), esc(o.guest_email || o.customer_email || '')],
      [t('phone'), esc(o.guest_phone || '')],
      [t('company'), esc(o.guest_company || '')],
      [t('delivery_address'), esc(o.delivery_address || '')],
    ]) +

    '<div class="ad-card-title" style="margin-top:16px">' + esc(t('order_info')) + '</div>' +
    infoGrid([
      [t('order_id'), esc(o.order_no || o.id)],
      [t('date'), esc(new Date(o.created_at).toLocaleString())],
      [t('order_status'), '<span class="ad-badge ad-badge--' + esc(o.status) + '">' + label(o.status) + '</span>'],
      [t('payment_status'), '<span class="ad-badge ad-badge--' + esc(o.payment_status || 'pending') + '">' + label(o.payment_status || 'pending') + '</span>'],
      [t('current_stage'), esc(o.current_stage || '')],
      [t('tracking'), (o.tracking_pct || 0) + '%'],
      [t('est_completion'), esc(o.estimated_completion || '')],
      [t('est_delivery'), esc(o.estimated_delivery || '')],
      [t('tracking_number'), esc(o.tracking_number || '')],
      [t('courier'), esc(o.courier || '')],
      [t('notes'), esc(o.admin_notes || '')],
    ]) +
    timeline +

    '<div class="ad-card-title" style="margin-top:16px">' + esc(t('totals')) + '</div>' +
    infoGrid([
      [t('subtotal'), money(o.subtotal)],
      [t('vat'), money(o.vat)],
      [t('shipping'), o.shipping_cost != null ? money(o.shipping_cost) : ''],
      [t('discount'), o.discount != null ? money(o.discount) : ''],
      [t('grand_total'), '<strong style="color:var(--ad-teal-2)">' + money(o.grand_total) + '</strong>'],
    ]),
    true
  );
  icons();
}

async function openOrderDetail(id) {
  const data = await api('/api/admin/orders?id=' + id);
  const o = data.order;
  const items = o.items || [];
  openModal(
    '<h3 class="ad-modal-title">' + esc(t('edit_order')) + ' ' + esc(o.order_no || o.id.slice(0, 8)) + '</h3>' +
    '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px;font-size:13px;color:var(--ad-text-70)">' +
      '<div><strong>' + esc(t('th_customer')) + ':</strong> ' + esc(o.guest_name || o.customer_name || (o.user_id ? t('registered_customer') : t('guest'))) + '</div>' +
      '<div><strong>' + esc(t('email')) + ':</strong> ' + esc(o.guest_email || o.customer_email || '—') + '</div>' +
      (o.guest_phone ? '<div><strong>' + esc(t('phone')) + ':</strong> ' + esc(o.guest_phone) + '</div>' : '') +
    '</div>' +
    '<div class="ad-timeline">' + ORDER_STATUSES.slice(0, 11).map(s => {
      const idx = ORDER_STATUSES.indexOf(o.status);
      const done = ORDER_STATUSES.indexOf(s) <= idx && idx !== -1 && !['cancelled','returned','rejected'].includes(o.status);
      return '<div class="ad-timeline-step' + (done ? ' is-done' : '') + '"><div class="ad-timeline-dot">' + (done ? '✓' : '') + '</div><div class="ad-timeline-label">' + label(s) + '</div></div>';
    }).join('') + '</div>' +
    '<div class="ad-form-grid">' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('order_status')) + '</label><select class="ad-input ad-select" id="ordStatus">' +
        ORDER_STATUSES.map(s => '<option value="' + s + '"' + (s === o.status ? ' selected' : '') + '>' + label(s) + '</option>').join('') + '</select></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('payment_status')) + '</label><select class="ad-input ad-select" id="ordPayment">' +
        ['pending','paid','failed','refunded'].map(s => '<option value="' + s + '"' + (s === (o.payment_status || 'pending') ? ' selected' : '') + '>' + label(s) + '</option>').join('') + '</select></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('tracking_pct')) + '</label><input class="ad-input" id="ordPct" type="number" min="0" max="100" value="' + (o.tracking_pct || 0) + '"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('current_stage')) + '</label><input class="ad-input" id="ordStage" value="' + esc(o.current_stage || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('est_completion')) + '</label><input class="ad-input" id="ordEstComplete" type="date" value="' + (o.estimated_completion || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('delivery_date')) + '</label><input class="ad-input" id="ordEstDeliver" type="date" value="' + (o.estimated_delivery || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('tracking_number')) + '</label><input class="ad-input" id="ordTracking" value="' + esc(o.tracking_number || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('courier')) + '</label><input class="ad-input" id="ordCourier" value="' + esc(o.courier || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('discount')) + '</label><input class="ad-input" id="ordDiscount" type="number" min="0" step="0.01" value="' + (o.discount || 0) + '"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('shipping_cost')) + '</label><input class="ad-input" id="ordShipping" type="number" min="0" step="0.01" value="' + (o.shipping_cost || 0) + '"></div>' +
    '</div>' +
    '<div class="ad-field"><label class="ad-label">' + esc(t('cust_delivery_address')) + '</label><textarea class="ad-input ad-textarea" id="ordAddress">' + esc(o.delivery_address || '') + '</textarea></div>' +
    '<div class="ad-field"><label class="ad-label">' + esc(t('admin_notes')) + '</label><textarea class="ad-input ad-textarea" id="ordNotes">' + esc(o.admin_notes || '') + '</textarea></div>' +
    '<div class="ad-card-title" style="margin-top:14px">' + esc(t('items')) + '</div>' +
    (items.length ? '<div class="ad-form-grid" id="ordItemsGrid">' + items.map((it, i) => (
      '<div class="ad-field" style="grid-column:1/-1;display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;border-bottom:1px solid var(--ad-border);padding-bottom:10px">' +
        '<div style="flex:1 1 200px"><label class="ad-label">' + esc(it.name) + '</label></div>' +
        '<div style="width:100px"><label class="ad-label">' + esc(t('qty')) + '</label><input class="ad-input ad-item-qty" type="number" min="1" value="' + (Number(it.qty) || 1) + '" data-idx="' + i + '"></div>' +
        '<div style="width:140px"><label class="ad-label">' + esc(t('unit_price')) + '</label><input class="ad-input ad-item-price" type="number" min="0" step="0.01" value="' + (Number(it.price) || 0) + '" data-idx="' + i + '"></div>' +
      '</div>'
    )).join('') + '</div>' : '<p class="ad-empty">' + esc(t('no_item_details')) + '</p>') +
    '<div style="text-align:end;font-size:15px;margin-top:10px">' + esc(t('current_total')) + ': <strong>' + money(o.grand_total) + '</strong></div>' +
    '<div class="ad-form-actions"><button class="ad-btn-sm ad-btn-sm--primary" id="ordSaveBtn">' + esc(t('save_changes')) + '</button></div>',
    true
  );
  $('#ordSaveBtn').addEventListener('click', async () => {
    const btn = $('#ordSaveBtn'); btn.disabled = true;
    try {
      const newItems = items.map((it, i) => {
        const qtyEl = $('.ad-item-qty[data-idx="' + i + '"]');
        const priceEl = $('.ad-item-price[data-idx="' + i + '"]');
        return { name: it.name, qty: qtyEl ? Number(qtyEl.value) || 1 : it.qty, price: priceEl ? Number(priceEl.value) || 0 : it.price };
      });
      await api('/api/admin/orders?id=' + o.id, { method: 'PATCH', body: {
        status: $('#ordStatus').value, payment_status: $('#ordPayment').value,
        tracking_pct: Number($('#ordPct').value) || 0, current_stage: $('#ordStage').value,
        estimated_completion: $('#ordEstComplete').value || null, estimated_delivery: $('#ordEstDeliver').value || null,
        tracking_number: $('#ordTracking').value, courier: $('#ordCourier').value,
        discount: Number($('#ordDiscount').value) || 0, shipping_cost: Number($('#ordShipping').value) || 0,
        delivery_address: $('#ordAddress').value, admin_notes: $('#ordNotes').value,
        items: items.length ? newItems : undefined,
      }});
      toast(t('order_updated'));
      closeModal();
      /* This modal can be opened from the Orders page OR from a customer's
         order history — only refresh whichever table is actually on screen. */
      if ($('#ordersTableWrap')) loadOrdersTable();
      else if ($('#custTableWrap')) loadCustomersTable();
    } catch (err) { toast(err.message); } finally { btn.disabled = false; }
  });
}

/* ════════════════════════════════════════════════════════════════
   CUSTOMERS
   ════════════════════════════════════════════════════════════════ */
let customersPage = 1, customersSearch = '';
async function renderCustomers() {
  $('#adContent').innerHTML =
    '<div class="ad-page"><div class="ad-page-head"><h1 class="ad-page-title">' + esc(t('customers_title')) + '</h1></div>' +
    '<div class="ad-toolbar"><input class="ad-input" id="custSearchInput" type="search" placeholder="' + esc(t('cust_search_ph')) + '"></div>' +
    '<div id="custTableWrap"></div></div>';
  $('#custSearchInput').addEventListener('input', debounce(e => { customersSearch = e.target.value; customersPage = 1; loadCustomersTable(); }, 350));
  await loadCustomersTable();
}
async function loadCustomersTable() {
  const wrap = $('#custTableWrap');
  wrap.innerHTML = '<div class="ad-loading"><div class="ad-spinner"></div></div>';
  const q = new URLSearchParams({ page: customersPage, pageSize: 15, search: customersSearch });
  const data = await api('/api/admin/customers?' + q.toString());
  if (!data.customers.length) { wrap.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">👤</div>' + esc(t('no_customers_found')) + '</div>'; return; }
  wrap.innerHTML =
    '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>' + esc(t('name')) + '</th><th>' + esc(t('email')) + '</th><th>' + esc(t('phone')) + '</th><th>' + esc(t('th_orders')) + '</th><th>' + esc(t('status')) + '</th><th>' + esc(t('th_joined')) + '</th><th>' + esc(t('th_order_details')) + '</th><th>' + esc(t('actions')) + '</th></tr></thead><tbody>' +
    data.customers.map(c => (
      '<tr data-customer-row="' + c.id + '" role="button" tabindex="0">' +
      '<td>' + esc(c.name) + (c.company ? '<br><span style="color:var(--ad-text-35);font-size:11px">' + esc(c.company) + '</span>' : '') + '</td>' +
      '<td>' + esc(c.email) + '</td><td>' + esc(c.phone || '—') + '</td>' +
      '<td>' + esc(t('orders_count')(c.orders_count)) + '</td>' +
      '<td><span class="ad-badge ad-badge--' + (c.is_banned ? 'suspended' : 'active') + '">' + esc(c.is_banned ? t('disabled') : t('active')) + '</span></td>' +
      '<td>' + new Date(c.created_at).toLocaleDateString() + '</td>' +
      '<td class="ad-actions-row"><button class="ad-btn-sm ad-btn-sm--primary" data-view-orders="' + c.id + '">' + esc(t('view_orders')) + '</button></td>' +
      '<td class="ad-actions-row"><button class="ad-btn-sm" data-edit-cust="' + c.id + '">' + esc(t('edit')) + '</button></td>' +
      '</tr>'
    )).join('') + '</tbody></table></div>' +
    pagination(customersPage, data.total, 15, p => { customersPage = p; loadCustomersTable(); });
  $$('[data-view-orders]', wrap).forEach(b => b.addEventListener('click', () => openCustomerOrders(b.getAttribute('data-view-orders'))));
  $$('[data-edit-cust]', wrap).forEach(b => b.addEventListener('click', () => openCustomerDetail(b.getAttribute('data-edit-cust'))));
}
/* One order as a card: head (order#, date, status/payment badges, total)
   + its items as product cards + a View/Edit button pair. Shared by the
   read-only Customer Details view and the "View Orders" page so the
   markup and wiring never drift apart. */
function orderHistoryBlock(o) {
  return '<div class="ad-ov-order">' +
    '<div class="ad-ov-order-head">' +
      '<strong>' + esc(o.order_no || o.id.slice(0, 8)) + '</strong>' +
      '<span style="color:var(--ad-text-50)">' + new Date(o.created_at).toLocaleDateString() + '</span>' +
      '<span class="ad-badge ad-badge--' + esc(o.status) + '">' + label(o.status) + '</span>' +
      '<span class="ad-badge ad-badge--' + esc(o.payment_status || 'pending') + '">' + label(o.payment_status || 'pending') + '</span>' +
      '<span style="margin-inline-start:auto;font-weight:700">' + money(o.grand_total) + '</span>' +
    '</div>' +
    ((o.items || []).length ? o.items.map(orderItemCard).join('') : '<p class="ad-empty" style="padding:14px">' + esc(t('no_items_stored')) + '</p>') +
    '<div class="ad-actions-row" style="padding:10px 0 0">' +
      '<button class="ad-btn-sm ad-btn-sm--primary" data-view="' + o.id + '">' + esc(t('view')) + '</button>' +
      '<button class="ad-btn-sm" data-edit-order="' + o.id + '">' + esc(t('edit')) + '</button>' +
    '</div>' +
  '</div>';
}
function wireOrderHistoryButtons(scope) {
  $$('[data-view]', scope).forEach(b => b.addEventListener('click', () => openOrderView(b.getAttribute('data-view'))));
  $$('[data-edit-order]', scope).forEach(b => b.addEventListener('click', () => openOrderDetail(b.getAttribute('data-edit-order'))));
}

/* Read-only customer profile with full order history — each order shows
   its items as product cards (image/description/specs from the joined
   product records) plus View/Edit buttons. Editing customer info itself
   happens in openCustomerDetail (the Edit button). */
async function openCustomerView(id) {
  const data = await api('/api/admin/customers?id=' + id);
  const c = data.customer;
  openModal(
    '<h3 class="ad-modal-title">' + esc(c.full_name || c.email) + ' &nbsp;' +
      '<span class="ad-badge ad-badge--' + (c.is_banned ? 'suspended' : 'active') + '">' + esc(c.is_banned ? t('disabled') : t('active')) + '</span></h3>' +

    '<div class="ad-card-title">' + esc(t('cust_info')) + '</div>' +
    infoGrid([
      [t('full_name'), esc(c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' '))],
      [t('email'), esc(c.email) + (c.email_verified ? ' <span class="ad-badge ad-badge--active">' + esc(t('verified')) + '</span>' : ' <span class="ad-badge ad-badge--pending">' + esc(t('unverified')) + '</span>')],
      [t('phone'), esc(c.mobile || '')],
      [t('company'), esc(c.company || '')],
      [t('country'), esc(c.country || '')],
      [t('address'), esc([c.address, c.city, c.postal_code].filter(Boolean).join(', '))],
      [t('registered'), esc(new Date(c.created_at).toLocaleDateString())],
      [t('last_login'), c.last_login ? esc(new Date(c.last_login).toLocaleString()) : ''],
      [t('status'), '<span class="ad-badge ad-badge--' + (c.is_banned ? 'suspended' : 'active') + '">' + esc(c.is_banned ? t('disabled') : t('active')) + '</span>'],
    ]) +

    '<div class="ad-card-title" style="margin-top:16px">' + esc(t('order_history')) + ' (' + data.orders.length + ')</div>' +
    (data.orders.length ? data.orders.map(orderHistoryBlock).join('') : '<p class="ad-empty">' + esc(t('no_orders_yet')) + '</p>'),
    true
  );
  icons();
  wireOrderHistoryButtons($('#adModalBody'));
}

/* "View Orders" page — lighter header (name/email/phone only) + the
   customer's full order history, each card with View/Edit buttons.
   Reached from the Customers table's "Order Details" column. */
async function openCustomerOrders(id) {
  const data = await api('/api/admin/customers?id=' + id);
  const c = data.customer;
  openModal(
    '<h3 class="ad-modal-title">' + esc(t('orders_for')) + esc(c.full_name || c.email) + '</h3>' +
    infoGrid([
      [t('name'), esc(c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' '))],
      [t('email'), esc(c.email)],
      [t('phone'), esc(c.mobile || '')],
    ]) +
    '<div class="ad-card-title" style="margin-top:16px">' + esc(t('orders_title')) + ' (' + data.orders.length + ')</div>' +
    (data.orders.length ? data.orders.map(orderHistoryBlock).join('') : '<p class="ad-empty">' + esc(t('no_orders_yet')) + '</p>'),
    true
  );
  icons();
  wireOrderHistoryButtons($('#adModalBody'));
}

/* Edit ONLY the customer's own information — no orders/addresses shown
   here (those live in openCustomerOrders / the "View Orders" button). */
async function openCustomerDetail(id) {
  const data = await api('/api/admin/customers?id=' + id);
  const c = data.customer;
  openModal(
    '<h3 class="ad-modal-title">' + esc(t('edit_customer')) + esc(c.full_name || c.email) + '</h3>' +
    '<div class="ad-form-grid">' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('first_name')) + '</label><input class="ad-input" id="custFirstName" value="' + esc(c.first_name || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('last_name')) + '</label><input class="ad-input" id="custLastName" value="' + esc(c.last_name || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('email')) + '</label><input class="ad-input" id="custEmailInput" type="email" value="' + esc(c.email || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('phone')) + '</label><input class="ad-input" id="custPhone" value="' + esc(c.mobile || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('company')) + '</label><input class="ad-input" id="custCompany" value="' + esc(c.company || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('country')) + '</label><input class="ad-input" id="custCountry" value="' + esc(c.country || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('status')) + '</label><select class="ad-input ad-select" id="custStatus">' +
        '<option value="active"' + (!c.is_banned ? ' selected' : '') + '>' + esc(t('active')) + '</option>' +
        '<option value="suspended"' + (c.is_banned ? ' selected' : '') + '>' + esc(t('disabled')) + '</option>' +
      '</select></div>' +
    '</div>' +
    '<div class="ad-field"><label class="ad-label">' + esc(t('address')) + '</label><textarea class="ad-input ad-textarea" id="custAddress">' + esc(c.address || '') + '</textarea></div>' +
    '<div class="ad-field"><label class="ad-label">' + esc(t('notes')) + '</label><textarea class="ad-input ad-textarea" id="custNotes">' + esc(c.notes || '') + '</textarea></div>' +
    '<div class="ad-form-actions" style="margin-top:16px;flex-wrap:wrap">' +
      '<button class="ad-btn-sm ad-btn-sm--primary" id="custSaveBtn">' + esc(t('save_changes')) + '</button>' +
      '<button class="ad-btn-sm" id="custResetPw">' + esc(t('reset_password')) + '</button>' +
      '<button class="ad-btn-sm" id="custEmail">' + esc(t('email_customer')) + '</button>' +
      '<button class="ad-btn-sm ad-btn-sm--danger" id="custDelete">' + esc(t('delete_account')) + '</button>' +
    '</div>',
    true
  );
  $('#custSaveBtn').addEventListener('click', async () => {
    const btn = $('#custSaveBtn'); btn.disabled = true;
    try {
      const wasBanned = c.is_banned;
      const nowBanned = $('#custStatus').value === 'suspended';
      const body = {
        first_name: $('#custFirstName').value, last_name: $('#custLastName').value,
        company: $('#custCompany').value, mobile: $('#custPhone').value,
        country: $('#custCountry').value, address: $('#custAddress').value,
        email: $('#custEmailInput').value, notes: $('#custNotes').value,
      };
      if (nowBanned !== wasBanned) body.disabled = nowBanned;
      await api('/api/admin/customers?id=' + c.id, { method: 'PATCH', body });
      toast(t('customer_updated'));
      closeModal();
      loadCustomersTable();
    } catch (err) { toast(err.message); } finally { btn.disabled = false; }
  });
  $('#custResetPw').addEventListener('click', async () => {
    try { await api('/api/admin/customers', { method: 'POST', body: { action: 'reset-password', id: c.id } }); toast(t('pw_reset_sent')); }
    catch (err) { toast(err.message); }
  });
  $('#custEmail').addEventListener('click', () => {
    openModal(
      '<h3 class="ad-modal-title">' + esc(t('email_modal_title')) + esc(c.email) + '</h3>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('subject')) + '</label><input class="ad-input" id="emailSubject"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('message')) + '</label><textarea class="ad-input ad-textarea" id="emailMessage"></textarea></div>' +
      '<div class="ad-form-actions"><button class="ad-btn-sm ad-btn-sm--primary" id="emailSendBtn">' + esc(t('send')) + '</button></div>'
    );
    $('#emailSendBtn').addEventListener('click', async () => {
      try {
        await api('/api/admin/customers', { method: 'POST', body: { action: 'email-customer', id: c.id, subject: $('#emailSubject').value, message: $('#emailMessage').value } });
        toast(t('email_sent')); closeModal();
      } catch (err) { toast(err.message); }
    });
  });
  $('#custDelete').addEventListener('click', async () => {
    if (!confirm(t('confirm_delete_customer'))) return;
    try { await api('/api/admin/customers?id=' + c.id, { method: 'DELETE' }); toast(t('customer_deleted')); closeModal(); loadCustomersTable(); }
    catch (err) { toast(err.message); }
  });
}

/* ════════════════════════════════════════════════════════════════
   PRODUCTS
   ════════════════════════════════════════════════════════════════ */
let productsPage = 1, productsSearch = '', productsLowStock = false, CATEGORY_CACHE = [];
async function renderProducts(filters) {
  filters = filters || {};
  productsLowStock = filters.lowStock === '1';
  productsSearch = ''; productsPage = 1;

  const catData = await api('/api/admin/categories');
  CATEGORY_CACHE = catData.categories;
  $('#adContent').innerHTML =
    '<div class="ad-page"><div class="ad-page-head"><h1 class="ad-page-title">' + esc(t('products_title')) + (productsLowStock ? esc(t('low_stock_suffix')) : '') + '</h1>' +
      '<button class="ad-btn-sm ad-btn-sm--primary" id="productAddBtn"><i data-lucide="plus"></i> ' + esc(t('add_product')) + '</button></div>' +
    '<div class="ad-toolbar"><input class="ad-input" id="prodSearchInput" type="search" placeholder="' + esc(t('prod_search_ph')) + '"></div>' +
    '<div id="prodTableWrap"></div></div>';
  icons();
  $('#prodSearchInput').addEventListener('input', debounce(e => { productsSearch = e.target.value; productsPage = 1; loadProductsTable(); }, 350));
  $('#productAddBtn').addEventListener('click', () => openProductEditor(null));
  await loadProductsTable();
}
async function loadProductsTable() {
  const wrap = $('#prodTableWrap');
  wrap.innerHTML = '<div class="ad-loading"><div class="ad-spinner"></div></div>';
  const q = new URLSearchParams({ page: productsPage, pageSize: 15, search: productsSearch });
  if (productsLowStock) q.set('lowStock', '1');
  const data = await api('/api/admin/products?' + q.toString());
  if (!data.products.length) { wrap.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">📦</div>' + esc(t('no_products_found')) + '</div>'; return; }
  wrap.innerHTML =
    '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>' + esc(t('th_product')) + '</th><th>' + esc(t('th_category')) + '</th><th>' + esc(t('th_price')) + '</th><th>' + esc(t('th_stock')) + '</th><th>' + esc(t('status')) + '</th><th>' + esc(t('actions')) + '</th></tr></thead><tbody>' +
    data.products.map(p => (
      '<tr><td>' + esc(p.name) + (p.is_featured ? ' ⭐' : '') + '</td>' +
      '<td>' + esc(catName(p.category_slug)) + '</td><td>' + money(p.price) + '</td>' +
      '<td>' + p.stock + (p.stock <= (p.low_stock_threshold || 5) ? ' ⚠️' : '') + '</td>' +
      '<td><span class="ad-badge ad-badge--' + (p.is_active ? 'active' : 'suspended') + '">' + esc(p.is_active ? t('active') : t('hidden')) + '</span></td>' +
      '<td class="ad-actions-row"><button class="ad-btn-sm" data-edit="' + p.id + '">' + esc(t('edit')) + '</button><button class="ad-btn-sm ad-btn-sm--danger" data-del="' + p.id + '">' + esc(t('del')) + '</button></td></tr>'
    )).join('') + '</tbody></table></div>' +
    pagination(productsPage, data.total, 15, p => { productsPage = p; loadProductsTable(); });
  $$('[data-edit]', wrap).forEach(b => b.addEventListener('click', async () => {
    const d = await api('/api/admin/products?id=' + b.getAttribute('data-edit'));
    openProductEditor(d.product);
  }));
  $$('[data-del]', wrap).forEach(b => b.addEventListener('click', async () => {
    if (!confirm(t('confirm_delete_product'))) return;
    try { await api('/api/admin/products?id=' + b.getAttribute('data-del'), { method: 'DELETE' }); toast(t('product_deleted')); loadProductsTable(); }
    catch (err) { toast(err.message); }
  }));
}
function catName(slug) { const c = CATEGORY_CACHE.find(x => x.slug === slug); return c ? c.name : (slug || '—'); }

function openProductEditor(p) {
  const isEdit = !!p;
  p = p || { id: '', category_slug: '', name: '', name_ar: '', description: '', price: 0, stock: 0, is_featured: false, is_active: true, images: [] };
  openModal(
    '<h3 class="ad-modal-title">' + esc(isEdit ? t('edit_product') : t('add_product')) + '</h3>' +
    '<div class="ad-form-grid">' +
      (isEdit ? '' : '<div class="ad-field"><label class="ad-label">' + esc(t('id_numeric')) + '</label><input class="ad-input" id="pfId" type="number" value="' + esc(p.id) + '"></div>') +
      '<div class="ad-field"><label class="ad-label">' + esc(t('th_category')) + '</label><select class="ad-input ad-select" id="pfCat"><option value="">—</option>' +
        CATEGORY_CACHE.map(c => '<option value="' + c.slug + '"' + (c.slug === p.category_slug ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('name_en')) + '</label><input class="ad-input" id="pfName" value="' + esc(p.name) + '"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('name_ar')) + '</label><input class="ad-input" id="pfNameAr" value="' + esc(p.name_ar || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('price_sar')) + '</label><input class="ad-input" id="pfPrice" type="number" step="0.01" value="' + esc(p.price) + '"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('th_stock')) + '</label><input class="ad-input" id="pfStock" type="number" value="' + esc(p.stock) + '"></div>' +
    '</div>' +
    '<div class="ad-field"><label class="ad-label">' + esc(t('desc_en')) + '</label><textarea class="ad-input ad-textarea" id="pfDesc">' + esc(p.description || '') + '</textarea></div>' +
    '<div class="ad-field"><label class="ad-label">' + esc(t('image_urls')) + '</label><textarea class="ad-input ad-textarea" id="pfImages">' + esc((p.images || []).join('\n')) + '</textarea></div>' +
    '<label class="ad-check"><input type="checkbox" id="pfFeatured"' + (p.is_featured ? ' checked' : '') + '> ' + esc(t('featured')) + '</label>' +
    '&nbsp;&nbsp;<label class="ad-check"><input type="checkbox" id="pfActive"' + (p.is_active !== false ? ' checked' : '') + '> ' + esc(t('active_visible')) + '</label>' +
    '<div class="ad-form-actions" style="margin-top:14px"><button class="ad-btn-sm ad-btn-sm--primary" id="pfSaveBtn">' + esc(t('save')) + '</button></div>',
    true
  );
  $('#pfSaveBtn').addEventListener('click', async () => {
    const fields = {
      category_slug: $('#pfCat').value || null,
      name: $('#pfName').value.trim(),
      name_ar: $('#pfNameAr').value.trim() || null,
      price: Number($('#pfPrice').value) || 0,
      stock: Number($('#pfStock').value) || 0,
      description: $('#pfDesc').value.trim() || null,
      images: $('#pfImages').value.split('\n').map(s => s.trim()).filter(Boolean),
      is_featured: $('#pfFeatured').checked,
      is_active: $('#pfActive').checked,
    };
    if (!fields.name) return toast(t('name_required'));
    try {
      if (isEdit) await api('/api/admin/products?id=' + p.id, { method: 'PATCH', body: fields });
      else {
        const id = Number($('#pfId').value);
        if (!id) return toast(t('id_required'));
        await api('/api/admin/products', { method: 'POST', body: Object.assign({ id }, fields) });
      }
      toast(t('product_saved')); closeModal(); loadProductsTable();
    } catch (err) { toast(err.message); }
  });
}

/* ════════════════════════════════════════════════════════════════
   CATEGORIES
   ════════════════════════════════════════════════════════════════ */
async function renderCategories() {
  $('#adContent').innerHTML =
    '<div class="ad-page"><div class="ad-page-head"><h1 class="ad-page-title">' + esc(t('categories_title')) + '</h1>' +
    '<button class="ad-btn-sm ad-btn-sm--primary" id="catAddBtn"><i data-lucide="plus"></i> ' + esc(t('add_category')) + '</button></div>' +
    '<div id="catTableWrap"></div></div>';
  icons();
  $('#catAddBtn').addEventListener('click', () => openCategoryEditor(null));
  await loadCategoriesTable();
}
async function loadCategoriesTable() {
  const data = await api('/api/admin/categories');
  CATEGORY_CACHE = data.categories;
  const wrap = $('#catTableWrap');
  if (!data.categories.length) { wrap.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">🗂️</div>' + esc(t('no_categories')) + '</div>'; return; }
  wrap.innerHTML =
    '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>' + esc(t('name')) + '</th><th>' + esc(t('th_slug')) + '</th><th>' + esc(t('th_sort')) + '</th><th>' + esc(t('status')) + '</th><th>' + esc(t('actions')) + '</th></tr></thead><tbody>' +
    data.categories.map(c => (
      '<tr><td>' + esc(c.name) + '</td><td>' + esc(c.slug) + '</td><td>' + c.sort_order + '</td>' +
      '<td><span class="ad-badge ad-badge--' + (c.is_active ? 'active' : 'suspended') + '">' + esc(c.is_active ? t('active') : t('hidden')) + '</span></td>' +
      '<td class="ad-actions-row"><button class="ad-btn-sm" data-edit="' + c.id + '">' + esc(t('edit')) + '</button><button class="ad-btn-sm ad-btn-sm--danger" data-del="' + c.id + '">' + esc(t('del')) + '</button></td></tr>'
    )).join('') + '</tbody></table></div>';
  $$('[data-edit]', wrap).forEach(b => b.addEventListener('click', () => openCategoryEditor(data.categories.find(c => c.id === b.getAttribute('data-edit')))));
  $$('[data-del]', wrap).forEach(b => b.addEventListener('click', async () => {
    if (!confirm(t('confirm_delete_category'))) return;
    try { await api('/api/admin/categories?id=' + b.getAttribute('data-del'), { method: 'DELETE' }); toast(t('deleted')); loadCategoriesTable(); }
    catch (err) { toast(err.message); }
  }));
}
function openCategoryEditor(c) {
  const isEdit = !!c;
  c = c || { slug: '', name: '', name_ar: '', sort_order: 0, is_active: true };
  openModal(
    '<h3 class="ad-modal-title">' + esc(isEdit ? t('edit_category') : t('add_category')) + '</h3>' +
    '<div class="ad-form-grid">' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('slug')) + '</label><input class="ad-input" id="cfSlug" value="' + esc(c.slug) + '"' + (isEdit ? ' disabled' : '') + '></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('sort_order')) + '</label><input class="ad-input" id="cfSort" type="number" value="' + esc(c.sort_order) + '"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('name_en')) + '</label><input class="ad-input" id="cfName" value="' + esc(c.name) + '"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('name_ar')) + '</label><input class="ad-input" id="cfNameAr" value="' + esc(c.name_ar || '') + '"></div>' +
    '</div>' +
    '<label class="ad-check"><input type="checkbox" id="cfActive"' + (c.is_active !== false ? ' checked' : '') + '> ' + esc(t('active')) + '</label>' +
    '<div class="ad-form-actions" style="margin-top:14px"><button class="ad-btn-sm ad-btn-sm--primary" id="cfSaveBtn">' + esc(t('save')) + '</button></div>'
  );
  $('#cfSaveBtn').addEventListener('click', async () => {
    const fields = { name: $('#cfName').value.trim(), name_ar: $('#cfNameAr').value.trim() || null, sort_order: Number($('#cfSort').value) || 0, is_active: $('#cfActive').checked };
    if (!isEdit) fields.slug = $('#cfSlug').value.trim();
    if (!fields.name || (!isEdit && !fields.slug)) return toast(t('name_slug_required'));
    try {
      if (isEdit) await api('/api/admin/categories?id=' + c.id, { method: 'PATCH', body: fields });
      else await api('/api/admin/categories', { method: 'POST', body: fields });
      toast(t('category_saved')); closeModal(); loadCategoriesTable();
    } catch (err) { toast(err.message); }
  });
}

/* ════════════════════════════════════════════════════════════════
   QUOTES
   ════════════════════════════════════════════════════════════════ */
let quotesPage = 1, quotesStatus = 'all';
let SOFT_DELETE_QUOTES_ENABLED = true;
async function renderQuotes() {
  $('#adContent').innerHTML =
    '<div class="ad-page"><div class="ad-page-head"><h1 class="ad-page-title">' + esc(t('quotes_title')) + '</h1></div>' +
    '<div class="ad-toolbar"><select class="ad-select" id="quoteStatusFilter"><option value="all">' + esc(t('all')) + '</option>' +
      ['new','contacted','quoted','converted','closed'].map(s => '<option value="' + s + '">' + label(s) + '</option>').join('') + '</select></div>' +
    '<div id="quoteTableWrap"></div></div>';
  $('#quoteStatusFilter').addEventListener('change', e => { quotesStatus = e.target.value; quotesPage = 1; loadQuotesTable(); });
  await loadQuotesTable();
}
async function loadQuotesTable() {
  const wrap = $('#quoteTableWrap');
  wrap.innerHTML = '<div class="ad-loading"><div class="ad-spinner"></div></div>';
  const q = new URLSearchParams({ page: quotesPage, pageSize: 15, status: quotesStatus });
  const data = await api('/api/admin/quotes?' + q.toString());
  SOFT_DELETE_QUOTES_ENABLED = data.softDeleteEnabled !== false;
  if (!data.quotes.length) { wrap.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">📝</div>' + esc(t('no_quotes')) + '</div>'; return; }
  wrap.innerHTML =
    '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>' + esc(t('name')) + '</th><th>' + esc(t('th_contact')) + '</th><th>' + esc(t('th_product_service')) + '</th><th>' + esc(t('status')) + '</th><th>' + esc(t('date')) + '</th><th>' + esc(t('actions')) + '</th></tr></thead><tbody>' +
    data.quotes.map(q => (
      '<tr><td>' + esc(q.name || '—') + '</td><td>' + esc(q.email || q.phone || '—') + '</td><td>' + esc(q.product || '—') + '</td>' +
      '<td><span class="ad-badge ad-badge--' + esc(q.status) + '">' + label(q.status) + '</span></td>' +
      '<td>' + new Date(q.created_at).toLocaleDateString() + '</td>' +
      '<td class="ad-actions-row"><button class="ad-btn-sm" data-view="' + q.id + '">' + esc(t('view')) + '</button>' +
        (SOFT_DELETE_QUOTES_ENABLED ? '<button class="ad-btn-sm ad-btn-sm--danger" data-delete-quote="' + q.id + '">' + esc(t('del')) + '</button>' : '') +
      '</td></tr>'
    )).join('') + '</tbody></table></div>' +
    pagination(quotesPage, data.total, 15, p => { quotesPage = p; loadQuotesTable(); });
  $$('[data-view]', wrap).forEach(b => b.addEventListener('click', () => openQuoteDetail(b.getAttribute('data-view'))));
  $$('[data-delete-quote]', wrap).forEach(b => b.addEventListener('click', () => deleteQuoteAction(b.getAttribute('data-delete-quote'))));
}

/* Soft delete only — mirrors deleteOrderAction() exactly (see
   api/admin/quotes/delete.js). */
async function deleteQuoteAction(id) {
  if (!confirm(t('confirm_delete_quote'))) return;
  try {
    await api('/api/admin/quotes/delete', { method: 'POST', body: { id } });
    toast(t('quote_deleted_toast'));
    loadQuotesTable();
  } catch (err) { toast(err.message); }
}

async function openQuoteDetail(id) {
  const data = await api('/api/admin/quotes?id=' + id);
  const q = data.quote;
  openModal(
    '<h3 class="ad-modal-title">' + esc(t('quote_from')) + esc(q.name || q.email || t('unknown')) + '</h3>' +
    '<div style="font-size:13px;color:var(--ad-text-70);margin-bottom:14px">' +
      '<div><strong>' + esc(t('email')) + ':</strong> ' + esc(q.email || '—') + '</div><div><strong>' + esc(t('phone')) + ':</strong> ' + esc(q.phone || '—') + '</div>' +
      '<div><strong>' + esc(t('th_product_service')) + ':</strong> ' + esc(q.product || '—') + '</div>' +
      '<div style="margin-top:8px"><strong>' + esc(t('message')) + ':</strong><br>' + esc(q.message || '—') + '</div>' +
    '</div>' +
    '<div class="ad-field"><label class="ad-label">' + esc(t('status')) + '</label><select class="ad-input ad-select" id="qStatus">' +
      ['new','contacted','quoted','converted','closed'].map(s => '<option value="' + s + '"' + (s === q.status ? ' selected' : '') + '>' + label(s) + '</option>').join('') + '</select></div>' +
    '<div class="ad-field"><label class="ad-label">' + esc(t('admin_notes')) + '</label><textarea class="ad-input ad-textarea" id="qNotes">' + esc(q.admin_notes || '') + '</textarea></div>' +
    '<div class="ad-form-actions">' +
      '<button class="ad-btn-sm ad-btn-sm--primary" id="qSaveBtn">' + esc(t('save')) + '</button>' +
      (q.order_id ? '' : '<button class="ad-btn-sm" id="qConvertBtn">' + esc(t('convert_to_order')) + '</button>') +
      (q.email ? '<button class="ad-btn-sm" id="qReplyBtn">' + esc(t('reply_to_customer')) + '</button>' : '') +
      '<button class="ad-btn-sm" id="qCloseBtn">' + esc(t('close')) + '</button>' +
    '</div>' +
    '<div class="ad-card-title" style="margin-top:18px">' + esc(t('communication_history')) + '</div>' +
    '<div id="qReplyHistory"><div class="ad-loading"><div class="ad-spinner"></div></div></div>'
  );
  $('#qSaveBtn').addEventListener('click', async () => {
    try { await api('/api/admin/quotes?id=' + q.id, { method: 'PATCH', body: { status: $('#qStatus').value, admin_notes: $('#qNotes').value } }); toast(t('saved')); closeModal(); loadQuotesTable(); }
    catch (err) { toast(err.message); }
  });
  const convertBtn = $('#qConvertBtn');
  if (convertBtn) convertBtn.addEventListener('click', async () => {
    try { await api('/api/admin/quotes', { method: 'POST', body: { action: 'convert-to-order', id: q.id } }); toast(t('converted')); closeModal(); loadQuotesTable(); }
    catch (err) { toast(err.message); }
  });
  const replyBtn = $('#qReplyBtn');
  if (replyBtn) replyBtn.addEventListener('click', () => openQuoteReply(q));
  $('#qCloseBtn').addEventListener('click', closeModal);
  loadQuoteReplyHistory(q.id);
}

/* ── Reply to Customer (Feature 5-10) ──────────────────────────────
   Reuses the same #adModal as every other module (openModal replaces
   its body) — Cancel/Close/X all return without sending anything;
   nothing is written until Send succeeds. */
let REPLY_ATTACHMENTS = [];

function openQuoteReply(q) {
  REPLY_ATTACHMENTS = [];
  openModal(
    '<h3 class="ad-modal-title">' + esc(t('reply_to_customer')) + '</h3>' +
    '<div class="ad-field"><label class="ad-label">' + esc(t('to_field')) + '</label>' +
      '<input class="ad-input" id="qrTo" value="' + esc(q.email) + '" disabled></div>' +
    '<div class="ad-field"><label class="ad-label">' + esc(t('subject_field')) + '</label>' +
      '<input class="ad-input" id="qrSubject" value="' + esc('Re: your quote request' + (q.product ? ' — ' + q.product : '')) + '"></div>' +
    '<div class="ad-field"><label class="ad-label">' + esc(t('message')) + '</label>' +
      '<textarea class="ad-input ad-textarea" id="qrMessage" style="min-height:140px"></textarea></div>' +
    '<div class="ad-field"><label class="ad-label">' + esc(t('attachments_field')) + '</label>' +
      '<input type="file" id="qrFiles" multiple>' +
      '<div id="qrFileList" style="margin-top:8px"></div>' +
    '</div>' +
    '<div class="ad-form-actions">' +
      '<button class="ad-btn-sm ad-btn-sm--primary" id="qrSendBtn">' + esc(t('send')) + '</button>' +
      '<button class="ad-btn-sm" id="qrCancelBtn">' + esc(t('cancel')) + '</button>' +
    '</div>'
  );
  renderReplyFileList();
  $('#qrFiles').addEventListener('change', e => { addReplyFiles(Array.from(e.target.files || [])); e.target.value = ''; });
  $('#qrCancelBtn').addEventListener('click', () => openQuoteDetail(q.id));
  $('#qrSendBtn').addEventListener('click', () => sendQuoteReply(q.id));
}

const REPLY_MAX_FILE_BYTES = 5 * 1024 * 1024;
function addReplyFiles(files) {
  for (const f of files) {
    if (f.size > REPLY_MAX_FILE_BYTES) { toast(f.name + ' is too large (max 5MB).'); continue; }
    REPLY_ATTACHMENTS.push(f);
  }
  renderReplyFileList();
}
function removeReplyFile(idx) {
  REPLY_ATTACHMENTS.splice(idx, 1);
  renderReplyFileList();
}
function renderReplyFileList() {
  const el = $('#qrFileList');
  if (!el) return;
  if (!REPLY_ATTACHMENTS.length) { el.innerHTML = '<p class="ad-empty" style="padding:8px 0">' + esc(t('no_attachments')) + '</p>'; return; }
  el.innerHTML = REPLY_ATTACHMENTS.map((f, i) =>
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--ad-border);font-size:13px">' +
      '<span>' + esc(f.name) + ' <span style="color:var(--ad-text-50)">(' + Math.round(f.size / 1024) + ' KB)</span></span>' +
      '<button class="ad-btn-sm ad-btn-sm--danger" data-remove-att="' + i + '">&times;</button>' +
    '</div>'
  ).join('');
  $$('[data-remove-att]', el).forEach(b => b.addEventListener('click', () => removeReplyFile(Number(b.getAttribute('data-remove-att')))));
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]+,/, ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function sendQuoteReply(quoteId) {
  const subject = $('#qrSubject').value.trim();
  const message = $('#qrMessage').value.trim();
  if (!subject || !message) return toast(t('subject_message_required'));
  const sendBtn = $('#qrSendBtn');
  sendBtn.disabled = true;
  sendBtn.textContent = t('sending_ellipsis');
  try {
    const attachments = await Promise.all(REPLY_ATTACHMENTS.map(async f => ({
      name: f.name, mime: f.type || 'application/octet-stream', dataBase64: await fileToBase64(f),
    })));
    await api('/api/admin/quotes/reply', { method: 'POST', body: { id: quoteId, subject, message, attachments } });
    toast(t('email_sent_success'));
    openQuoteDetail(quoteId);
  } catch (err) {
    toast(err.message);
    sendBtn.disabled = false;
    sendBtn.textContent = t('send');
  }
}

async function loadQuoteReplyHistory(quoteId) {
  const el = $('#qReplyHistory');
  if (!el) return;
  try {
    const data = await api('/api/admin/quotes/replies?quoteId=' + quoteId);
    if (!data.replies.length) { el.innerHTML = '<p class="ad-empty">' + esc(t('no_replies_yet')) + '</p>'; return; }
    el.innerHTML = data.replies.map(r => {
      const statusKey = r.status === 'failed' ? 'reply_status_failed' : 'reply_status_sent';
      const statusCls = r.status === 'failed' ? 'cancelled' : 'completed';
      const attNames = (r.attachments || []).map(a => a.name).join(', ');
      return '<div style="padding:10px 0;border-bottom:1px solid var(--ad-border);font-size:13px">' +
        '<div style="display:flex;justify-content:space-between;gap:8px">' +
          '<strong>' + esc(r.subject) + '</strong>' +
          '<span class="ad-badge ad-badge--' + statusCls + '">' + esc(t(statusKey)) + '</span>' +
        '</div>' +
        '<div style="color:var(--ad-text-50);font-size:12px;margin:2px 0">' + esc(r.admin_name || '') + ' — ' + new Date(r.created_at).toLocaleString() + '</div>' +
        '<div>' + esc(r.message.length > 200 ? r.message.slice(0, 200) + '…' : r.message) + '</div>' +
        (attNames ? '<div style="color:var(--ad-text-50);font-size:12px;margin-top:4px">📎 ' + esc(attNames) + '</div>' : '') +
      '</div>';
    }).join('');
  } catch (err) {
    el.innerHTML = '<p class="ad-empty">' + esc(err.message) + '</p>';
  }
}

/* ════════════════════════════════════════════════════════════════
   DELETED QUOTES — Recover / Permanently Delete (Super Admin only)
   Mirrors renderDeletedOrders/loadDeletedOrdersTable exactly.
   ════════════════════════════════════════════════════════════════ */
let deletedQuotesPage = 1, deletedQuotesSearch = '', deletedQuotesRecovery = 'all', deletedQuotesStatus = 'all';

async function renderDeletedQuotes() {
  deletedQuotesPage = 1; deletedQuotesSearch = ''; deletedQuotesRecovery = 'all'; deletedQuotesStatus = 'all';

  $('#adContent').innerHTML =
    '<div class="ad-page"><div class="ad-page-head"><h1 class="ad-page-title">' + esc(t('quotes_deleted_title')) + '</h1></div>' +
    '<div class="ad-toolbar">' +
      '<input class="ad-input" id="delQuoteSearchInput" type="search" placeholder="' + esc(t('order_search_ph')) + '">' +
      '<select class="ad-select" id="delQuoteStatusFilter"><option value="all">' + esc(t('all')) + '</option>' +
        ['new','contacted','quoted','converted','closed'].map(s => '<option value="' + s + '">' + label(s) + '</option>').join('') +
      '</select>' +
      '<select class="ad-select" id="delQuoteRecoveryFilter">' +
        '<option value="all">' + esc(t('all_recovery')) + '</option>' +
        '<option value="green">' + esc(t('recovery_green')) + '</option>' +
        '<option value="orange">' + esc(t('recovery_orange')) + '</option>' +
        '<option value="red">' + esc(t('recovery_red')) + '</option>' +
      '</select>' +
    '</div>' +
    '<div id="deletedQuotesTableWrap"></div></div>';

  $('#delQuoteSearchInput').addEventListener('input', debounce(e => { deletedQuotesSearch = e.target.value; deletedQuotesPage = 1; loadDeletedQuotesTable(); }, 350));
  $('#delQuoteStatusFilter').addEventListener('change', e => { deletedQuotesStatus = e.target.value; deletedQuotesPage = 1; loadDeletedQuotesTable(); });
  $('#delQuoteRecoveryFilter').addEventListener('change', e => { deletedQuotesRecovery = e.target.value; deletedQuotesPage = 1; loadDeletedQuotesTable(); });
  await loadDeletedQuotesTable();
}

async function loadDeletedQuotesTable() {
  const wrap = $('#deletedQuotesTableWrap');
  wrap.innerHTML = '<div class="ad-loading"><div class="ad-spinner"></div></div>';
  const q = new URLSearchParams({ page: deletedQuotesPage, pageSize: 15, search: deletedQuotesSearch, recovery: deletedQuotesRecovery, status: deletedQuotesStatus });
  const data = await api('/api/admin/quotes/deleted?' + q.toString());
  SOFT_DELETE_QUOTES_ENABLED = data.softDeleteEnabled !== false;
  if (!SOFT_DELETE_QUOTES_ENABLED) {
    wrap.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">🔒</div>' + esc(t('soft_delete_quotes_not_enabled')) + '</div>';
    return;
  }
  if (!data.quotes.length) { wrap.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">🗑️</div>' + esc(t('no_deleted_quotes_found')) + '</div>'; return; }

  const isSuperAdmin = CURRENT_ADMIN && CURRENT_ADMIN.role === 'admin';
  wrap.innerHTML =
    '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>' + esc(t('name')) + '</th><th>' + esc(t('th_contact')) + '</th><th>' + esc(t('th_product_service')) + '</th><th>' + esc(t('status')) + '</th><th>' + esc(t('th_deleted_by')) + '</th><th>' + esc(t('th_deleted_date')) + '</th><th>' + esc(t('th_days_remaining')) + '</th><th>' + esc(t('actions')) + '</th></tr></thead><tbody>' +
    data.quotes.map(q => (
      '<tr><td>' + esc(q.name || '—') + '</td><td>' + esc(q.email || q.phone || '—') + '</td><td>' + esc(q.product || '—') + '</td>' +
      '<td><span class="ad-badge ad-badge--' + esc(q.status) + '">' + label(q.status) + '</span></td>' +
      '<td>' + esc(q.deleted_by_name || '—') + '</td>' +
      '<td>' + new Date(q.deleted_at).toLocaleDateString() + '</td>' +
      '<td>' + recoveryBadge(q.days_remaining) + '</td>' +
      '<td class="ad-actions-row">' +
        '<button class="ad-btn-sm ad-btn-sm--primary" data-recover-quote="' + q.id + '">' + esc(t('recover')) + '</button>' +
        (isSuperAdmin ? '<button class="ad-btn-sm ad-btn-sm--danger" data-perm-delete-quote="' + q.id + '">' + esc(t('delete_permanently')) + '</button>' : '') +
      '</td></tr>'
    )).join('') + '</tbody></table></div>' +
    pagination(deletedQuotesPage, data.total, 15, p => { deletedQuotesPage = p; loadDeletedQuotesTable(); });
  $$('[data-recover-quote]', wrap).forEach(b => b.addEventListener('click', () => recoverQuoteAction(b.getAttribute('data-recover-quote'))));
  $$('[data-perm-delete-quote]', wrap).forEach(b => b.addEventListener('click', () => permanentlyDeleteQuoteAction(b.getAttribute('data-perm-delete-quote'))));
}

async function recoverQuoteAction(id) {
  try {
    await api('/api/admin/quotes/recover', { method: 'POST', body: { id } });
    toast(t('quote_recovered_toast'));
    loadDeletedQuotesTable();
  } catch (err) { toast(err.message); }
}

async function permanentlyDeleteQuoteAction(id) {
  if (!confirm(t('confirm_permanent_delete_quote'))) return;
  try {
    await api('/api/admin/quotes/permanent?id=' + id, { method: 'DELETE' });
    toast(t('quote_permanently_deleted_toast'));
    loadDeletedQuotesTable();
  } catch (err) { toast(err.message); }
}

/* ════════════════════════════════════════════════════════════════
   NOTIFICATIONS
   ════════════════════════════════════════════════════════════════ */
async function renderNotifications() {
  $('#adContent').innerHTML =
    '<div class="ad-page"><div class="ad-page-head"><h1 class="ad-page-title">' + esc(t('notifications_title')) + '</h1>' +
    '<button class="ad-btn-sm" id="notifMarkAllBtn">' + esc(t('mark_all_read')) + '</button></div><div id="notifList"></div></div>';
  $('#notifMarkAllBtn').addEventListener('click', async () => {
    await api('/api/admin/notifications', { method: 'PATCH', body: { action: 'mark-all-read' } });
    pollNotifBadge(); loadNotifList();
  });
  await loadNotifList();
}
async function loadNotifList() {
  const data = await api('/api/admin/notifications');
  const el = $('#notifList');
  if (!data.notifications.length) { el.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">🔔</div>' + esc(t('no_notifications')) + '</div>'; return; }
  el.innerHTML = data.notifications.map(n => (
    '<div class="ad-card" style="margin-bottom:8px;' + (n.is_read ? 'opacity:0.6' : '') + '">' +
      '<div style="display:flex;justify-content:space-between;gap:10px"><div><strong>' + esc(n.title) + '</strong><div style="color:var(--ad-text-50);font-size:12px;margin-top:3px">' + esc(n.body || '') + '</div></div>' +
      '<div style="display:flex;gap:6px;flex-shrink:0">' +
        (n.is_read ? '' : '<button class="ad-btn-sm" data-read="' + n.id + '">' + esc(t('mark_read')) + '</button>') +
        '<button class="ad-btn-sm ad-btn-sm--danger" data-del="' + n.id + '">' + esc(t('del')) + '</button></div></div>' +
      '<div style="color:var(--ad-text-35);font-size:11px;margin-top:6px">' + new Date(n.created_at).toLocaleString() + '</div>' +
    '</div>'
  )).join('');
  $$('[data-read]', el).forEach(b => b.addEventListener('click', async () => { await api('/api/admin/notifications', { method: 'PATCH', body: { action: 'mark-read', id: b.getAttribute('data-read') } }); pollNotifBadge(); loadNotifList(); }));
  $$('[data-del]', el).forEach(b => b.addEventListener('click', async () => { await api('/api/admin/notifications?id=' + b.getAttribute('data-del'), { method: 'DELETE' }); loadNotifList(); }));
}

/* ════════════════════════════════════════════════════════════════
   AUDIT LOGS
   ════════════════════════════════════════════════════════════════ */
let auditPage = 1;
async function renderAudit() {
  $('#adContent').innerHTML = '<div class="ad-page"><div class="ad-page-head"><h1 class="ad-page-title">' + esc(t('audit_title')) + '</h1></div><div id="auditTableWrap"></div></div>';
  await loadAuditTable();
}
async function loadAuditTable() {
  const wrap = $('#auditTableWrap');
  wrap.innerHTML = '<div class="ad-loading"><div class="ad-spinner"></div></div>';
  const data = await api('/api/admin/audit-logs?page=' + auditPage + '&pageSize=25');
  if (!data.logs.length) { wrap.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">📜</div>' + esc(t('no_activity')) + '</div>'; return; }
  wrap.innerHTML =
    '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>' + esc(t('th_when')) + '</th><th>' + esc(t('th_admin')) + '</th><th>' + esc(t('th_action')) + '</th><th>' + esc(t('th_entity')) + '</th><th>' + esc(t('th_ip')) + '</th></tr></thead><tbody>' +
    data.logs.map(l => (
      '<tr><td>' + new Date(l.created_at).toLocaleString() + '</td><td>' + esc(l.admin_email || '—') + '</td>' +
      '<td>' + esc(l.action) + '</td><td>' + esc(l.entity_type || '') + (l.entity_id ? ' #' + esc(String(l.entity_id).slice(0, 8)) : '') + '</td>' +
      '<td>' + esc(l.ip || '—') + '</td></tr>'
    )).join('') + '</tbody></table></div>' +
    pagination(auditPage, data.total, 25, p => { auditPage = p; loadAuditTable(); });
}

/* ════════════════════════════════════════════════════════════════
   MY ACCOUNT (change password / logout everywhere)
   ════════════════════════════════════════════════════════════════ */
async function renderAccount() {
  $('#adContent').innerHTML =
    '<div class="ad-page"><div class="ad-page-head"><h1 class="ad-page-title">' + esc(t('account_title')) + '</h1></div>' +
    '<div class="ad-card"><div class="ad-card-title">' + esc(t('signed_in_as')) + '</div>' +
      '<p>' + esc(CURRENT_ADMIN.email) + ' — <span class="ad-badge ad-badge--active">' + esc(CURRENT_ADMIN.role) + '</span></p>' +
      (CURRENT_ADMIN.must_change_password ? '<div class="ad-msg ad-msg--error">' + esc(t('temp_pw_warning')) + '</div>' : '') +
    '</div>' +
    '<div class="ad-card"><div class="ad-card-title">' + esc(t('change_password')) + '</div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('current_password')) + '</label><input class="ad-input" id="curPw" type="password"></div>' +
      '<div class="ad-field"><label class="ad-label">' + esc(t('new_password')) + '</label><input class="ad-input" id="newPw" type="password"></div>' +
      '<button class="ad-btn-sm ad-btn-sm--primary" id="changePwBtn">' + esc(t('update_password')) + '</button>' +
    '</div>' +
    '<div class="ad-card"><div class="ad-card-title">' + esc(t('security')) + '</div>' +
      '<button class="ad-btn-sm ad-btn-sm--danger" id="logoutAllBtn">' + esc(t('logout_all')) + '</button>' +
    '</div></div>';

  $('#changePwBtn').addEventListener('click', async () => {
    try {
      await api('/api/admin/auth', { method: 'POST', body: { action: 'change-password', current_password: $('#curPw').value, new_password: $('#newPw').value } });
      toast(t('password_updated')); $('#curPw').value = ''; $('#newPw').value = '';
      CURRENT_ADMIN.must_change_password = false; renderAccount();
    } catch (err) { toast(err.message); }
  });
  $('#logoutAllBtn').addEventListener('click', async () => {
    if (!confirm(t('confirm_logout_all'))) return;
    await api('/api/admin/auth', { method: 'POST', body: { action: 'logout-all' } });
    location.href = '/pages/admin/login.html';
  });
}

boot();
