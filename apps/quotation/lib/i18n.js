'use client';

/* Bilingual EN/AR provider — same API shape as apps/projects/lib/i18n.js
   (useLanguage → { lang, setLang, t, formatDate, formatNumber }).
   Arabic switches the document to RTL; preference persists in
   localStorage('af-quotation-lang'). */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'af-quotation-lang';

export const translations = {
  en: {
    // Shell / nav
    'nav.dashboard': 'Dashboard',
    'nav.quotations': 'Quotations',
    'nav.customers': 'Customers',
    'nav.catalogue': 'Catalogue',
    'nav.materials': 'Materials',
    'nav.suppliers': 'Suppliers',
    'nav.labour': 'Labour',
    'nav.machines': 'Machines',
    'nav.expenses': 'Expenses',
    'nav.reports': 'Reports',
    'nav.users': 'Users',
    'nav.settings': 'Settings',
    'shell.appName': 'QuotePro',
    'shell.appTagline': 'Quotation & Costing',
    'shell.loading': 'Loading…',
    'shell.logout': 'Logout',
    'shell.notifications': 'Notifications',
    'shell.noNotificationsYet': 'No notifications yet.',
    'shell.toggleTheme': 'Toggle theme',
    'shell.toggleLanguage': 'Toggle language',
    'role.admin': 'Admin',
    'role.viewer': 'Internal Company User',
    'role.external': 'External Assigned User',

    // Login
    'login.tagline': 'AL FAROOQUE Quotation & Costing',
    'login.user': 'User',
    'login.admin': 'Admin',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.continue': 'Continue',
    'login.signingIn': 'Signing in…',
    'login.otpSentPrefix': 'We sent a 6-digit code to',
    'login.verifyAndSignIn': 'Verify & Sign In',
    'login.verifying': 'Verifying…',
    'login.resendCode': 'Resend code',
    'login.resendCodeCountdown': 'Resend code ({seconds}s)',
    'login.backToEmail': '← Back to email',
    'login.backToEmailPassword': '← Back to email & password',

    // Dashboard
    'dashboard.loading': 'Loading dashboard…',
    'dashboard.totalQuotations': 'Total Quotations',
    'dashboard.allTime': 'All time',
    'dashboard.draft': 'Drafts',
    'dashboard.pendingApproval': 'Pending Approval',
    'dashboard.sent': 'Sent',
    'dashboard.accepted': 'Accepted',
    'dashboard.expiringSoon': 'Expiring ≤ 3 days',
    'dashboard.customers': 'Customers',
    'dashboard.materials': 'Materials',
    'dashboard.thisMonth': 'This month',
    'dashboard.quotedValueMonth': 'Quoted This Month (SAR)',
    'dashboard.welcome': 'Welcome',
    'dashboard.gettingStarted': 'Phase 0 shell is running. Master data, quotations and costing arrive in the next phases.',

    // Common
    'common.comingSoon': 'This module is coming in an upcoming phase.',
    'common.backToDashboard': 'Back to Dashboard',
    'common.search': 'Search…',
    'common.add': 'Add',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.save': 'Save',
    'common.saving': 'Saving…',
    'common.cancel': 'Cancel',
    'common.actions': 'Actions',
    'common.confirmDelete': 'Delete this record?',
    'common.noRecords': 'No records yet.',
    'common.all': 'All',
    'common.allTypes': 'All types',
    'common.allCategories': 'All categories',
    'common.importing': 'Importing…',
    'common.importExcel': 'Import Excel',

    // Fields
    'f.name': 'Name',
    'f.nameEn': 'Name (EN)',
    'f.nameAr': 'Name (AR)',
    'f.code': 'Code',
    'f.barcode': 'Barcode',
    'f.category': 'Category',
    'f.kind': 'Type',
    'f.thickness': 'Thickness',
    'f.size': 'Size',
    'f.dimensions': 'Dimensions',
    'f.unit': 'Unit',
    'f.brand': 'Brand',
    'f.latestPrice': 'Latest Price',
    'f.wastePct': 'Waste %',
    'f.notes': 'Notes',
    'f.hourlyRate': 'Hourly Rate',
    'f.dailyRate': 'Daily Rate',
    'f.monthlyRate': 'Monthly Rate',
    'f.overtimeMultiplier': 'OT Multiplier',
    'f.defaultUnit': 'Default Unit',
    'f.hourlyCost': 'Hourly Cost',
    'f.setupCost': 'Setup Cost',
    'f.defaultAmount': 'Default Amount',
    'f.companyNameAr': 'Company Name (AR)',
    'f.companyNameEn': 'Company Name (EN)',
    'f.contactPerson': 'Contact Person',
    'f.phone': 'Phone',
    'f.phone2': 'Phone 2',
    'f.email': 'Email',
    'f.city': 'City',
    'f.customerType': 'Customer Type',
    'f.vatNumber': 'VAT No.',
    'f.crNumber': 'CR No.',
    'f.address': 'Address',
    'f.paymentTerms': 'Payment Terms',
    'f.date': 'Date',
    'f.price': 'Price',
    'f.previousPrice': 'Previous',
    'f.supplier': 'Supplier',
    'f.source': 'Source',

    // Enums
    'unit.hour': 'Hour', 'unit.day': 'Day', 'unit.month': 'Month',
    'dimunit.mm': 'mm', 'dimunit.cm': 'cm', 'dimunit.meter': 'm',
    'ctype.hotel': 'Hotel', 'ctype.contractor': 'Contractor', 'ctype.individual': 'Individual',
    'ctype.engineer': 'Engineer', 'ctype.government': 'Government', 'ctype.other': 'Other',
    'kind.material': 'Materials', 'kind.hardware': 'Hardware',
    'expcat.transport': 'Transport', 'expcat.fuel': 'Fuel', 'expcat.installation': 'Installation',
    'expcat.accommodation': 'Accommodation', 'expcat.packaging': 'Packaging', 'expcat.food': 'Food',
    'expcat.miscellaneous': 'Miscellaneous', 'expcat.consumables': 'Consumables',
    'expcat.equipment_rental': 'Equipment Rental',
    'expunit.fixed': 'Fixed', 'expunit.per_day': 'Per Day', 'expunit.per_trip': 'Per Trip',
    'expunit.per_unit': 'Per Unit', 'expunit.pct_production': '% of Production Cost',
    'source.manual': 'Manual', 'source.bulk': 'Bulk Update', 'source.import': 'Import',
    'source.purchase_report': 'Purchase Report',

    // Materials
    'materials.searchPlaceholder': 'Search name, code, barcode…',
    'materials.importPurchases': 'Import Purchases Report',
    'materials.priceHistory': 'Price History',
    'materials.noPriceHistory': 'No price history yet.',
    'materials.priceEditNote': 'Changing the latest price will add a new entry to this material’s price history.',

    // Imports
    'import.customersResult': 'Imported {inserted} customers ({duplicates} duplicates skipped).',
    'import.purchasesResult': 'Read {rows} rows — {materials} new materials, {suppliers} new suppliers, {prices} price points, {updated} prices updated.',

    // Cost model sections
    'sec.material': 'Materials', 'sec.hardware': 'Hardware', 'sec.labour': 'Labour',
    'sec.machine': 'Machines', 'sec.expense': 'Expenses', 'sec.other': 'Other',

    // Costing
    'cost.summary': 'Cost Summary',
    'cost.productionCost': 'Production Cost',
    'cost.overhead': 'Overhead',
    'cost.risk': 'Risk',
    'cost.totalCost': 'Total Cost',
    'cost.profit': 'Profit',
    'cost.profitAmount': 'Profit',
    'cost.sellingPrice': 'Selling Price',
    'cost.margin': 'Margin',
    'cost.rounding': 'Rounding',
    'cost.mode.pct': 'Profit %',
    'cost.mode.fixed': 'Fixed Amount',
    'cost.mode.selling': 'Set Selling Price',
    'cost.qty': 'Qty',
    'cost.unitCost': 'Unit Cost',
    'cost.lineTotal': 'Total',
    'cost.sectionTotal': 'Section total',
    'cost.addLine': 'Add line',
    'cost.pickPlaceholder': 'Search & add from master data…',
    'cost.emptySection': 'No lines yet — search above to add.',
    'cost.lowMarginWarning': 'Margin below 15% — approval will be required.',
    'cost.saveModel': 'Save Cost Model',
    'cost.setStandard': 'Save & Set Standard Price',
    'cost.saved': 'Cost model saved.',
    'cost.standardUpdated': 'Standard price set to {price} SAR.',
    'cost.unsavedChanges': 'Unsaved changes — remember to save the cost model.',
    'cost.recost': 'Recost',
    'cost.recostTitle': 'Recost with latest prices',
    'cost.recostApply': 'Apply {n} changes',
    'cost.recostApplied': '{n} line prices updated from master data.',
    'cost.noChanges': 'All line prices already match the latest master data.',
    'cost.oldPrice': 'Current',
    'cost.newPrice': 'Latest',
    'cost.pctOfProduction': '% of Prod.',

    // Catalogue
    'catalogue.newProduct': 'New Product',
    'catalogue.standardPrice': 'Standard Price',
    'catalogue.lastCost': 'Last Cost',
    'catalogue.openCosting': 'Open costing',
    'catalogue.basicInfo': 'Basic Info',
    'catalogue.duplicate': 'Duplicate',
    'catalogue.descriptionEn': 'Description (EN — printed on quotation)',
    'catalogue.descriptionAr': 'Description (AR — printed on quotation)',

    // Quotation statuses
    'status.draft': 'Draft',
    'status.pending_approval': 'Pending Approval',
    'status.approved': 'Approved',
    'status.sent': 'Sent',
    'status.accepted': 'Accepted',
    'status.rejected': 'Rejected',
    'status.expired': 'Expired',
    'status.superseded': 'Superseded',
    'status.cancelled': 'Cancelled',

    // Quotations
    'quote.new': 'New Quotation',
    'quote.create': 'Create',
    'quote.number': 'Number',
    'quote.entity': 'Entity',
    'quote.status': 'Status',
    'quote.validUntil': 'Valid Until',
    'quote.grandTotal': 'Grand Total',
    'quote.searchNumber': 'Search number…',
    'quote.customerOptional': 'Optional — you can pick the customer later.',
    'quote.date': 'Date',
    'quote.outputLang': 'PDF Language',
    'quote.paymentTerms': 'Payment Terms',
    'quote.deliveryTerms': 'Delivery Terms',
    'quote.customerNotes': 'Notes to Customer',
    'quote.internalNotes': 'Internal Notes',
    'quote.summary': 'Quotation Summary',
    'quote.subtotal': 'Subtotal',
    'quote.discount': 'Discount',
    'quote.netTotal': 'Net Total',
    'quote.vat': 'VAT',
    'quote.unitPrice': 'Unit Price',
    'quote.internalCost': 'Internal cost',
    'quote.blendedMargin': 'Blended margin',
    'quote.addFromCatalogue': 'From Catalogue',
    'quote.addDetailed': 'Detailed Product',
    'quote.showCosting': 'Costing ▾',
    'quote.hideCosting': 'Costing ▴',
    'quote.useCalculatedPrice': 'Use calculated selling price',
    'quote.descriptionPlaceholder': 'Description / scope of work (printed on the quotation)…',
    'quote.submit': 'Submit',
    'quote.approve': 'Approve',
    'quote.sendBack': 'Send Back',
    'quote.rejectReason': 'Reason for sending back:',
    'quote.markAccepted': 'Mark Accepted',
    'quote.markRejected': 'Mark Rejected',
    'quote.newRevision': 'New Revision',
    'quote.autoApproved': 'Approved automatically — within thresholds.',
    'quote.sentForApproval': 'Sent for approval — exceeds thresholds (amount, margin or discount).',
    'quote.unsaved': 'Unsaved changes…',
    'quote.saved': 'Saved ✓',
    'quote.saveError': 'Autosave failed',
    'quote.conflict': 'Edited elsewhere — reload the page',
    'quote.winReason': 'Win reason / PO reference',
    'quote.lossReason': 'Loss reason / competitor',
    'quote.print': 'Print / PDF',
    'quote.sendEmail': 'Send Email',
    'quote.copyLink': 'Copy Link',
    'quote.linkCopied': 'Public link copied to clipboard.',
    'quote.sendTo': 'To (email)',
    'quote.subject': 'Subject',
    'quote.message': 'Message (optional, shown in the email)',
    'quote.send': 'Send',
    'quote.sentOk': 'Quotation emailed to {to}.',
    'quote.sendNote': 'The email includes the totals and a secure link where the customer can view and download the quotation.',

    // Phase 5+6
    'nav.audit': 'Audit Log',
    'common.template': 'Template',
    'common.export': 'Export',
    'common.updated': 'Updated',
    'common.archive': 'Archive',
    'common.restore': 'Restore',
    'common.currencyUnit': 'SAR',
    'common.genericError': 'Something went wrong. Please try again.',
    'common.importFailed': 'Import failed.',
    'common.duplicate': 'Duplicate',
    'f.country': 'Country', 'f.currency': 'Currency', 'f.bankName': 'Bank', 'f.iban': 'IBAN', 'f.rating': 'Rating',
    'f.companyName': 'Company Name', 'f.description': 'Description',
    'catalogue.productName': 'Product Name',
    'materials.manageCategories': 'Manage Categories',
    'materials.renameCategory': 'New category name:',

    // Parametric cost engine
    'basis.auto': 'Auto', 'basis.fixed': 'Fixed', 'basis.area': 'Area',
    'basis.perimeter': 'Perimeter', 'basis.length': 'Length', 'basis.volume': 'Volume',
    'cost.manual': 'Manual',
    'cost.manualHint': 'Manually overridden — click to reset to the formula. Overridden lines are not rescaled when dimensions change.',
    'cost.scaleBasisHint': 'Scaling formula: how this quantity changes when the product size changes.',
    'cost.resetFormula': 'Reset to formula',
    'quote.updateExisting': 'Update existing product',
    'quote.updateExistingAsk': 'Overwrite "{name}" in the catalogue with these specifications and price?',
    'quote.productUpdated': '"{name}" updated in the catalogue.',
    'quote.variantsTitle': 'Save changes to the catalogue?',
    'quote.variantsHint': 'These products were modified in this quotation. Choose what to do with each before submitting:',
    'quote.keepQuotationOnly': 'This quotation only',
    'quote.continueSubmit': 'Apply & Submit',
    'catalogue.staleCount': '{n} products need recalculation — master prices have changed.',
    'catalogue.recalcAll': 'Recalculate All ({n})',
    'catalogue.recalcDone': '{n} products recalculated (costs updated, selling prices unchanged).',
    'status.active': 'Active', 'status.archived': 'Archived',
    'catalogue.subCategory': 'Sub Category',
    'catalogue.categorySub': 'Category / Sub',
    'catalogue.searchPlaceholder': 'Search name (EN/AR), code, SKU, barcode…',
    'catalogue.translateNote': 'Enter either language — the other is generated automatically and can be edited later.',
    'catalogue.dimensions': 'Dimensions (all optional)',
    'catalogue.dimensionsNote': 'mm for sizes, kg for weight, m² / m³ for area & volume. Area auto-derives from length × width. Used for dynamic size pricing in quotations.',
    'catalogue.images': 'Images',
    'catalogue.dropImages': 'Drop images here or click to upload (multiple allowed)',
    'catalogue.primary': 'Primary',
    'dim.length': 'Length', 'dim.width': 'Width', 'dim.height': 'Height', 'dim.thickness': 'Thickness',
    'dim.depth': 'Depth', 'dim.diameter': 'Diameter', 'dim.weight': 'Weight', 'dim.area': 'Area', 'dim.volume': 'Volume',
    'quote.size': 'Size (mm)',
    'quote.specsChanged': 'Specs changed vs catalogue',
    'quote.saveAsNewProduct': 'Save as new product',
    'quote.savedAsProduct': 'Saved to catalogue as {code}.',
    'quote.createNewProductAsk': '"{name}" — specifications changed. Create a new catalogue product?',
    'import.productsResult': '{ok} products imported ({created} new, {updated} updated, {failed} failed).',
    'import.genericResult': '{created} created, {updated} updated, {failed} failed.',
    'materials.bulkPrice': 'Bulk Price Update',
    'materials.bulkMode': 'Mode',
    'materials.bulkValue': 'Value',
    'materials.bulkMatched': '{n} materials will change:',
    'materials.bulkPreview': 'Preview',
    'materials.bulkApply': 'Apply to {n} materials',
    'materials.bulkApplied': '{n} material prices updated (history recorded).',
    'dashboard.monthlyChart': 'Quoted vs Accepted — last 12 months (SAR)',
    'dashboard.quoted': 'Quoted',
    'dashboard.recentQuotations': 'Recent Quotations',
    'reports.report': 'Report',
    'reports.from': 'From',
    'reports.to': 'To',
    'reports.run': 'Run Report',
    'reports.hint': 'Choose a report and press Run.',
    'reports.rows': 'rows',
    'report.quotation-register': 'Quotation Register',
    'report.sales-by-customer': 'Sales by Customer',
    'report.profit-margin': 'Profit & Margin',
    'report.vat-summary': 'VAT Summary',
    'report.products-pricelist': 'Products Price List',
    'report.material-price-moves': 'Material Price Movements',
    'report.top-materials': 'Top Used Materials',
    'report.labour-rates': 'Labour Rates',
    'report.machines': 'Machines',
    'report.expenses': 'Expense Templates',
    'users.platformRole': 'Platform',
    'users.qrole': 'Quotation Role',
    'users.since': 'Since',
    'users.matrix': 'Role Permissions',
    'users.roleSaved': 'Role updated for {email}.',
    'qrole.admin': 'Admin', 'qrole.manager': 'Manager', 'qrole.sales': 'Sales', 'qrole.estimator': 'Estimator',
    'qrole.accountant': 'Accountant', 'qrole.production': 'Production', 'qrole.readonly': 'Read Only',
    'perm.write': 'Create/Edit', 'perm.approve': 'Approve', 'perm.costs': 'See Costs', 'perm.reports': 'Reports', 'perm.admin': 'Admin',
    'settings.entities': 'Company & Entities',
    'settings.defaults': 'Defaults & VAT',
    'settings.profit': 'Profit',
    'settings.approvals': 'Approvals',
    'settings.numbering': 'Numbering',
    'settings.system': 'Email, Backup & Storage',
    'settings.vatRate': 'VAT %',
    'settings.addressEn': 'Address (EN)',
    'settings.addressAr': 'Address (AR)',
    'settings.quotePrefix': 'Quotation Prefix',
    'settings.nextSeq': 'Next Number',
    'settings.validityDays': 'Validity (days)',
    'settings.currency': 'Currency',
    'settings.autoTranslate': 'Auto Translation',
    'settings.autoTranslateHint': 'Auto-generate the missing EN/AR text on save',
    'settings.overhead_pct': 'Overhead %',
    'settings.risk_pct': 'Risk %',
    'settings.profit_pct': 'Profit %',
    'settings.rounding': 'Rounding (SAR)',
    'settings.approvalAmount': 'Approval above amount (SAR)',
    'settings.approvalMargin': 'Approval below margin %',
    'settings.approvalDiscount': 'Approval above discount %',
    'settings.productPrefix': 'Product Code Prefix',
    'settings.numberingNote': 'Quotation numbers are per entity ({PREFIX}-{YEAR}-{SEQ}); product IDs are sequence-backed and never reused.',
    'settings.saved': 'Settings saved.',
    'settings.systemNote': 'These are configured via environment variables in Vercel / .env.local (never stored in the database):',
    'settings.backupNote': 'Database backups: Supabase automated daily backups + PITR (enable in Supabase Dashboard → Database → Backups). Product images live in the public product-images storage bucket.',
    'audit.table': 'Table',
    'audit.action': 'Action',
    'audit.actor': 'User',
    'audit.record': 'Record',
    'audit.view': 'View',
    'audit.before': 'Before',
    'audit.after': 'After',

    // Product categories (stored as codes; displayed translated)
    'cat.DOORS': 'Doors', 'cat.WINDOWS': 'Windows', 'cat.KITCHEN': 'Kitchen',
    'cat.FURNITURE': 'Furniture', 'cat.CHAIRS': 'Chairs', 'cat.SOFA': 'Sofa',
    'cat.CUPBOARDS': 'Cupboards', 'cat.TABLES': 'Tables', 'cat.COUNTERS': 'Counters',
    'cat.CLADDING': 'Cladding', 'cat.CURTAINS': 'Curtains', 'cat.STEEL': 'Steel',
    'cat.ALUMINIUM': 'Aluminium', 'cat.GLASS': 'Glass', 'cat.OTHER': 'Other',

    // Units (stored as codes; displayed translated)
    'u.piece': 'Piece', 'u.nos': 'Nos', 'u.m': 'm', 'u.m2': 'm²', 'u.m3': 'm³',
    'u.litre': 'Litre', 'u.kg': 'kg', 'u.sheet': 'Sheet', 'u.roll': 'Roll',
    'u.set': 'Set', 'u.box': 'Box', 'u.dozen': 'Dozen', 'u.carton': 'Carton',
    'u.lm': 'Linear m', 'u.sqm': 'm²', 'u.hour': 'Hour', 'u.day': 'Day',
  },

  ar: {
    // Shell / nav
    'nav.dashboard': 'لوحة التحكم',
    'nav.quotations': 'عروض الأسعار',
    'nav.customers': 'العملاء',
    'nav.catalogue': 'كتالوج المنتجات',
    'nav.materials': 'المواد',
    'nav.suppliers': 'الموردون',
    'nav.labour': 'العمالة',
    'nav.machines': 'المكائن',
    'nav.expenses': 'المصاريف',
    'nav.reports': 'التقارير',
    'nav.users': 'المستخدمون',
    'nav.settings': 'الإعدادات',
    'shell.appName': 'QuotePro',
    'shell.appTagline': 'عروض الأسعار والتكاليف',
    'shell.loading': 'جارٍ التحميل…',
    'shell.logout': 'تسجيل الخروج',
    'shell.notifications': 'الإشعارات',
    'shell.noNotificationsYet': 'لا توجد إشعارات بعد.',
    'shell.toggleTheme': 'تبديل السمة',
    'shell.toggleLanguage': 'تبديل اللغة',
    'role.admin': 'مدير',
    'role.viewer': 'مستخدم داخلي',
    'role.external': 'مستخدم خارجي',

    // Login
    'login.tagline': 'عروض أسعار وتكاليف الفاروق',
    'login.user': 'مستخدم',
    'login.admin': 'مدير',
    'login.email': 'البريد الإلكتروني',
    'login.password': 'كلمة المرور',
    'login.continue': 'متابعة',
    'login.signingIn': 'جارٍ تسجيل الدخول…',
    'login.otpSentPrefix': 'أرسلنا رمزاً مكوناً من 6 أرقام إلى',
    'login.verifyAndSignIn': 'تحقق وسجّل الدخول',
    'login.verifying': 'جارٍ التحقق…',
    'login.resendCode': 'إعادة إرسال الرمز',
    'login.resendCodeCountdown': 'إعادة إرسال الرمز ({seconds}ث)',
    'login.backToEmail': '→ العودة إلى البريد الإلكتروني',
    'login.backToEmailPassword': '→ العودة إلى البريد الإلكتروني وكلمة المرور',

    // Dashboard
    'dashboard.loading': 'جارٍ تحميل لوحة التحكم…',
    'dashboard.totalQuotations': 'إجمالي عروض الأسعار',
    'dashboard.allTime': 'منذ البداية',
    'dashboard.draft': 'مسودات',
    'dashboard.pendingApproval': 'بانتظار الاعتماد',
    'dashboard.sent': 'مرسلة',
    'dashboard.accepted': 'مقبولة',
    'dashboard.expiringSoon': 'تنتهي خلال ٣ أيام',
    'dashboard.customers': 'العملاء',
    'dashboard.materials': 'المواد',
    'dashboard.thisMonth': 'هذا الشهر',
    'dashboard.quotedValueMonth': 'قيمة العروض هذا الشهر (ر.س)',
    'dashboard.welcome': 'مرحباً',
    'dashboard.gettingStarted': 'المرحلة صفر تعمل الآن. البيانات الأساسية وعروض الأسعار والتكاليف ستتوفر في المراحل القادمة.',

    // Common
    'common.comingSoon': 'هذه الوحدة قادمة في مرحلة لاحقة.',
    'common.backToDashboard': 'العودة إلى لوحة التحكم',
    'common.search': 'بحث…',
    'common.add': 'إضافة',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.save': 'حفظ',
    'common.saving': 'جارٍ الحفظ…',
    'common.cancel': 'إلغاء',
    'common.actions': 'إجراءات',
    'common.confirmDelete': 'هل تريد حذف هذا السجل؟',
    'common.noRecords': 'لا توجد سجلات بعد.',
    'common.all': 'الكل',
    'common.allTypes': 'كل الأنواع',
    'common.allCategories': 'كل الفئات',
    'common.importing': 'جارٍ الاستيراد…',
    'common.importExcel': 'استيراد إكسل',

    // Fields
    'f.name': 'الاسم',
    'f.nameEn': 'الاسم (إنجليزي)',
    'f.nameAr': 'الاسم (عربي)',
    'f.code': 'الكود',
    'f.barcode': 'الباركود',
    'f.category': 'الفئة',
    'f.kind': 'النوع',
    'f.thickness': 'السماكة',
    'f.size': 'المقاس',
    'f.dimensions': 'الأبعاد',
    'f.unit': 'الوحدة',
    'f.brand': 'الماركة',
    'f.latestPrice': 'آخر سعر',
    'f.wastePct': 'نسبة الهدر ٪',
    'f.notes': 'ملاحظات',
    'f.hourlyRate': 'أجر الساعة',
    'f.dailyRate': 'أجر اليوم',
    'f.monthlyRate': 'الراتب الشهري',
    'f.overtimeMultiplier': 'معامل الإضافي',
    'f.defaultUnit': 'الوحدة الافتراضية',
    'f.hourlyCost': 'تكلفة الساعة',
    'f.setupCost': 'تكلفة التجهيز',
    'f.defaultAmount': 'المبلغ الافتراضي',
    'f.companyNameAr': 'اسم الشركة (عربي)',
    'f.companyNameEn': 'اسم الشركة (إنجليزي)',
    'f.contactPerson': 'الشخص المسؤول',
    'f.phone': 'الجوال',
    'f.phone2': 'جوال 2',
    'f.email': 'البريد الإلكتروني',
    'f.city': 'المدينة',
    'f.customerType': 'نوع العميل',
    'f.vatNumber': 'الرقم الضريبي',
    'f.crNumber': 'السجل التجاري',
    'f.address': 'العنوان',
    'f.paymentTerms': 'شروط الدفع',
    'f.date': 'التاريخ',
    'f.price': 'السعر',
    'f.previousPrice': 'السابق',
    'f.supplier': 'المورد',
    'f.source': 'المصدر',

    // Enums
    'unit.hour': 'ساعة', 'unit.day': 'يوم', 'unit.month': 'شهر',
    'dimunit.mm': 'مم', 'dimunit.cm': 'سم', 'dimunit.meter': 'م',
    'ctype.hotel': 'فندق', 'ctype.contractor': 'مقاول / شركة', 'ctype.individual': 'فرد',
    'ctype.engineer': 'مهندس / استشاري', 'ctype.government': 'جهة حكومية', 'ctype.other': 'أخرى',
    'kind.material': 'مواد', 'kind.hardware': 'إكسسوارات وعدد',
    'expcat.transport': 'نقل', 'expcat.fuel': 'وقود', 'expcat.installation': 'تركيب',
    'expcat.accommodation': 'سكن', 'expcat.packaging': 'تغليف', 'expcat.food': 'طعام',
    'expcat.miscellaneous': 'متنوعة', 'expcat.consumables': 'مستهلكات',
    'expcat.equipment_rental': 'تأجير معدات',
    'expunit.fixed': 'ثابت', 'expunit.per_day': 'لكل يوم', 'expunit.per_trip': 'لكل رحلة',
    'expunit.per_unit': 'لكل وحدة', 'expunit.pct_production': '٪ من تكلفة الإنتاج',
    'source.manual': 'يدوي', 'source.bulk': 'تحديث جماعي', 'source.import': 'استيراد',
    'source.purchase_report': 'تقرير المشتريات',

    // Materials
    'materials.searchPlaceholder': 'ابحث بالاسم أو الكود أو الباركود…',
    'materials.importPurchases': 'استيراد تقرير المشتريات',
    'materials.priceHistory': 'سجل الأسعار',
    'materials.noPriceHistory': 'لا يوجد سجل أسعار بعد.',
    'materials.priceEditNote': 'تغيير آخر سعر سيضيف سجلاً جديداً في تاريخ أسعار هذه المادة.',

    // Imports
    'import.customersResult': 'تم استيراد {inserted} عميلاً (تم تخطي {duplicates} مكرر).',
    'import.purchasesResult': 'تمت قراءة {rows} صفاً — {materials} مادة جديدة، {suppliers} مورداً جديداً، {prices} نقطة سعر، {updated} سعراً محدثاً.',

    // Cost model sections
    'sec.material': 'المواد', 'sec.hardware': 'الإكسسوارات', 'sec.labour': 'العمالة',
    'sec.machine': 'المكائن', 'sec.expense': 'المصاريف', 'sec.other': 'أخرى',

    // Costing
    'cost.summary': 'ملخص التكلفة',
    'cost.productionCost': 'تكلفة الإنتاج',
    'cost.overhead': 'المصاريف العامة',
    'cost.risk': 'المخاطرة',
    'cost.totalCost': 'إجمالي التكلفة',
    'cost.profit': 'الربح',
    'cost.profitAmount': 'الربح',
    'cost.sellingPrice': 'سعر البيع',
    'cost.margin': 'الهامش',
    'cost.rounding': 'التقريب',
    'cost.mode.pct': 'ربح ٪',
    'cost.mode.fixed': 'مبلغ ثابت',
    'cost.mode.selling': 'تحديد سعر البيع',
    'cost.qty': 'الكمية',
    'cost.unitCost': 'تكلفة الوحدة',
    'cost.lineTotal': 'الإجمالي',
    'cost.sectionTotal': 'إجمالي القسم',
    'cost.addLine': 'إضافة بند',
    'cost.pickPlaceholder': 'ابحث وأضف من البيانات الأساسية…',
    'cost.emptySection': 'لا توجد بنود — ابحث أعلاه للإضافة.',
    'cost.lowMarginWarning': 'الهامش أقل من ١٥٪ — سيتطلب اعتماداً.',
    'cost.saveModel': 'حفظ نموذج التكلفة',
    'cost.setStandard': 'حفظ وتحديد السعر القياسي',
    'cost.saved': 'تم حفظ نموذج التكلفة.',
    'cost.standardUpdated': 'تم تحديد السعر القياسي {price} ر.س.',
    'cost.unsavedChanges': 'توجد تغييرات غير محفوظة — لا تنسَ حفظ نموذج التكلفة.',
    'cost.recost': 'إعادة التسعير',
    'cost.recostTitle': 'إعادة التسعير بآخر الأسعار',
    'cost.recostApply': 'تطبيق {n} تغيير',
    'cost.recostApplied': 'تم تحديث {n} بنداً من البيانات الأساسية.',
    'cost.noChanges': 'جميع أسعار البنود مطابقة لآخر بيانات أساسية.',
    'cost.oldPrice': 'الحالي',
    'cost.newPrice': 'الأحدث',
    'cost.pctOfProduction': '٪ من الإنتاج',

    // Catalogue
    'catalogue.newProduct': 'منتج جديد',
    'catalogue.standardPrice': 'السعر القياسي',
    'catalogue.lastCost': 'آخر تكلفة',
    'catalogue.openCosting': 'فتح التكلفة',
    'catalogue.basicInfo': 'البيانات الأساسية',
    'catalogue.duplicate': 'نسخ المنتج',
    'catalogue.descriptionEn': 'الوصف (إنجليزي — يُطبع في عرض السعر)',
    'catalogue.descriptionAr': 'الوصف (عربي — يُطبع في عرض السعر)',

    // Quotation statuses
    'status.draft': 'مسودة',
    'status.pending_approval': 'بانتظار الاعتماد',
    'status.approved': 'معتمد',
    'status.sent': 'مرسل',
    'status.accepted': 'مقبول',
    'status.rejected': 'مرفوض',
    'status.expired': 'منتهي',
    'status.superseded': 'مستبدل',
    'status.cancelled': 'ملغي',

    // Quotations
    'quote.new': 'عرض سعر جديد',
    'quote.create': 'إنشاء',
    'quote.number': 'الرقم',
    'quote.entity': 'المنشأة',
    'quote.status': 'الحالة',
    'quote.validUntil': 'صالح حتى',
    'quote.grandTotal': 'الإجمالي النهائي',
    'quote.searchNumber': 'ابحث بالرقم…',
    'quote.customerOptional': 'اختياري — يمكنك اختيار العميل لاحقاً.',
    'quote.date': 'التاريخ',
    'quote.outputLang': 'لغة الملف',
    'quote.paymentTerms': 'شروط الدفع',
    'quote.deliveryTerms': 'شروط التسليم',
    'quote.customerNotes': 'ملاحظات للعميل',
    'quote.internalNotes': 'ملاحظات داخلية',
    'quote.summary': 'ملخص عرض السعر',
    'quote.subtotal': 'المجموع',
    'quote.discount': 'الخصم',
    'quote.netTotal': 'الصافي',
    'quote.vat': 'الضريبة',
    'quote.unitPrice': 'سعر الوحدة',
    'quote.internalCost': 'التكلفة الداخلية',
    'quote.blendedMargin': 'الهامش الإجمالي',
    'quote.addFromCatalogue': 'من الكتالوج',
    'quote.addDetailed': 'منتج مفصّل',
    'quote.showCosting': 'التكلفة ▾',
    'quote.hideCosting': 'التكلفة ▴',
    'quote.useCalculatedPrice': 'استخدام سعر البيع المحسوب',
    'quote.descriptionPlaceholder': 'الوصف / نطاق العمل (يُطبع في عرض السعر)…',
    'quote.submit': 'إرسال للاعتماد',
    'quote.approve': 'اعتماد',
    'quote.sendBack': 'إعادة للمسودة',
    'quote.rejectReason': 'سبب الإعادة:',
    'quote.markAccepted': 'تحديد كمقبول',
    'quote.markRejected': 'تحديد كمرفوض',
    'quote.newRevision': 'مراجعة جديدة',
    'quote.autoApproved': 'تم الاعتماد تلقائياً — ضمن الحدود المسموحة.',
    'quote.sentForApproval': 'أُرسل للاعتماد — تجاوز الحدود (المبلغ أو الهامش أو الخصم).',
    'quote.unsaved': 'تغييرات غير محفوظة…',
    'quote.saved': 'تم الحفظ ✓',
    'quote.saveError': 'فشل الحفظ التلقائي',
    'quote.conflict': 'تم التعديل من مكان آخر — أعد تحميل الصفحة',
    'quote.winReason': 'سبب الفوز / رقم أمر الشراء',
    'quote.lossReason': 'سبب الخسارة / المنافس',
    'quote.print': 'طباعة / PDF',
    'quote.sendEmail': 'إرسال بالبريد',
    'quote.copyLink': 'نسخ الرابط',
    'quote.linkCopied': 'تم نسخ الرابط العام.',
    'quote.sendTo': 'إلى (البريد الإلكتروني)',
    'quote.subject': 'الموضوع',
    'quote.message': 'رسالة (اختيارية، تظهر في البريد)',
    'quote.send': 'إرسال',
    'quote.sentOk': 'تم إرسال عرض السعر إلى {to}.',
    'quote.sendNote': 'يتضمن البريد الإجماليات ورابطاً آمناً يمكن للعميل من خلاله عرض وتحميل عرض السعر.',

    // Phase 5+6
    'nav.audit': 'سجل التدقيق',
    'common.template': 'قالب',
    'common.export': 'تصدير',
    'common.updated': 'آخر تحديث',
    'common.archive': 'أرشفة',
    'common.restore': 'استرجاع',
    'common.currencyUnit': 'ر.س',
    'common.genericError': 'حدث خطأ ما. يرجى المحاولة مرة أخرى.',
    'common.importFailed': 'فشل الاستيراد.',
    'common.duplicate': 'نسخ',
    'f.country': 'الدولة', 'f.currency': 'العملة', 'f.bankName': 'البنك', 'f.iban': 'الآيبان', 'f.rating': 'التقييم',
    'f.companyName': 'اسم الشركة', 'f.description': 'الوصف',
    'catalogue.productName': 'اسم المنتج',
    'materials.manageCategories': 'إدارة الفئات',
    'materials.renameCategory': 'اسم الفئة الجديد:',

    // Parametric cost engine
    'basis.auto': 'تلقائي', 'basis.fixed': 'ثابت', 'basis.area': 'المساحة',
    'basis.perimeter': 'المحيط', 'basis.length': 'الطول', 'basis.volume': 'الحجم',
    'cost.manual': 'يدوي',
    'cost.manualHint': 'تعديل يدوي — اضغط للعودة إلى المعادلة. البنود المعدلة يدوياً لا يعاد حسابها عند تغيير المقاسات.',
    'cost.scaleBasisHint': 'معادلة التحجيم: كيف تتغير هذه الكمية عند تغيير مقاس المنتج.',
    'cost.resetFormula': 'إعادة للمعادلة',
    'quote.updateExisting': 'تحديث المنتج الحالي',
    'quote.updateExistingAsk': 'استبدال مواصفات وسعر "{name}" في الكتالوج بهذه القيم؟',
    'quote.productUpdated': 'تم تحديث "{name}" في الكتالوج.',
    'quote.variantsTitle': 'حفظ التغييرات في الكتالوج؟',
    'quote.variantsHint': 'تم تعديل هذه المنتجات في عرض السعر. اختر ما تريد فعله بكل منها قبل الإرسال:',
    'quote.keepQuotationOnly': 'هذا العرض فقط',
    'quote.continueSubmit': 'تطبيق وإرسال',
    'catalogue.staleCount': '{n} منتجاً يحتاج إعادة حساب — تغيّرت الأسعار الأساسية.',
    'catalogue.recalcAll': 'إعادة حساب الكل ({n})',
    'catalogue.recalcDone': 'تمت إعادة حساب {n} منتجاً (تم تحديث التكاليف، أسعار البيع لم تتغير).',
    'status.active': 'نشط', 'status.archived': 'مؤرشف',
    'catalogue.subCategory': 'الفئة الفرعية',
    'catalogue.categorySub': 'الفئة / الفرعية',
    'catalogue.searchPlaceholder': 'ابحث بالاسم (عربي/إنجليزي) أو الكود أو SKU أو الباركود…',
    'catalogue.translateNote': 'أدخل أي لغة — تُولَّد اللغة الأخرى تلقائياً ويمكن تعديلها لاحقاً.',
    'catalogue.dimensions': 'الأبعاد (كلها اختيارية)',
    'catalogue.dimensionsNote': 'المقاسات بالمليمتر، الوزن بالكيلو، المساحة م² والحجم م³. تُحسب المساحة تلقائياً من الطول × العرض. تُستخدم للتسعير الديناميكي بالمقاس.',
    'catalogue.images': 'الصور',
    'catalogue.dropImages': 'اسحب الصور هنا أو اضغط للرفع (يسمح بعدة صور)',
    'catalogue.primary': 'رئيسية',
    'dim.length': 'الطول', 'dim.width': 'العرض', 'dim.height': 'الارتفاع', 'dim.thickness': 'السماكة',
    'dim.depth': 'العمق', 'dim.diameter': 'القطر', 'dim.weight': 'الوزن', 'dim.area': 'المساحة', 'dim.volume': 'الحجم',
    'quote.size': 'المقاس (مم)',
    'quote.specsChanged': 'المواصفات تغيّرت عن الكتالوج',
    'quote.saveAsNewProduct': 'حفظ كمنتج جديد',
    'quote.savedAsProduct': 'تم الحفظ في الكتالوج برقم {code}.',
    'quote.createNewProductAsk': '"{name}" — تغيّرت المواصفات. إنشاء منتج جديد في الكتالوج؟',
    'import.productsResult': 'تم استيراد {ok} منتجاً ({created} جديد، {updated} محدث، {failed} فشل).',
    'import.genericResult': '{created} جديد، {updated} محدث، {failed} فشل.',
    'materials.bulkPrice': 'تحديث الأسعار جماعياً',
    'materials.bulkMode': 'الطريقة',
    'materials.bulkValue': 'القيمة',
    'materials.bulkMatched': 'سيتغير سعر {n} مادة:',
    'materials.bulkPreview': 'معاينة',
    'materials.bulkApply': 'تطبيق على {n} مادة',
    'materials.bulkApplied': 'تم تحديث أسعار {n} مادة (مع تسجيل التاريخ).',
    'dashboard.monthlyChart': 'المعروض مقابل المقبول — آخر ١٢ شهراً (ر.س)',
    'dashboard.quoted': 'معروض',
    'dashboard.recentQuotations': 'أحدث عروض الأسعار',
    'reports.report': 'التقرير',
    'reports.from': 'من',
    'reports.to': 'إلى',
    'reports.run': 'تشغيل التقرير',
    'reports.hint': 'اختر تقريراً ثم اضغط تشغيل.',
    'reports.rows': 'صفوف',
    'report.quotation-register': 'سجل عروض الأسعار',
    'report.sales-by-customer': 'المبيعات حسب العميل',
    'report.profit-margin': 'الربح والهامش',
    'report.vat-summary': 'ملخص الضريبة',
    'report.products-pricelist': 'قائمة أسعار المنتجات',
    'report.material-price-moves': 'تغيرات أسعار المواد',
    'report.top-materials': 'أكثر المواد استخداماً',
    'report.labour-rates': 'أجور العمالة',
    'report.machines': 'المكائن',
    'report.expenses': 'قوالب المصاريف',
    'users.platformRole': 'المنصة',
    'users.qrole': 'دور عروض الأسعار',
    'users.since': 'منذ',
    'users.matrix': 'صلاحيات الأدوار',
    'users.roleSaved': 'تم تحديث دور {email}.',
    'qrole.admin': 'مدير النظام', 'qrole.manager': 'مدير', 'qrole.sales': 'مبيعات', 'qrole.estimator': 'مهندس تسعير',
    'qrole.accountant': 'محاسب', 'qrole.production': 'إنتاج', 'qrole.readonly': 'قراءة فقط',
    'perm.write': 'إنشاء/تعديل', 'perm.approve': 'اعتماد', 'perm.costs': 'رؤية التكاليف', 'perm.reports': 'التقارير', 'perm.admin': 'إدارة',
    'settings.entities': 'الشركة والمنشآت',
    'settings.defaults': 'الافتراضيات والضريبة',
    'settings.profit': 'الربح',
    'settings.approvals': 'الاعتمادات',
    'settings.numbering': 'الترقيم',
    'settings.system': 'البريد والنسخ الاحتياطي والتخزين',
    'settings.vatRate': 'الضريبة ٪',
    'settings.addressEn': 'العنوان (إنجليزي)',
    'settings.addressAr': 'العنوان (عربي)',
    'settings.quotePrefix': 'بادئة رقم العرض',
    'settings.nextSeq': 'الرقم التالي',
    'settings.validityDays': 'الصلاحية (أيام)',
    'settings.currency': 'العملة',
    'settings.autoTranslate': 'الترجمة التلقائية',
    'settings.autoTranslateHint': 'توليد النص الناقص عربي/إنجليزي تلقائياً عند الحفظ',
    'settings.overhead_pct': 'المصاريف العامة ٪',
    'settings.risk_pct': 'المخاطرة ٪',
    'settings.profit_pct': 'الربح ٪',
    'settings.rounding': 'التقريب (ر.س)',
    'settings.approvalAmount': 'اعتماد فوق مبلغ (ر.س)',
    'settings.approvalMargin': 'اعتماد تحت هامش ٪',
    'settings.approvalDiscount': 'اعتماد فوق خصم ٪',
    'settings.productPrefix': 'بادئة كود المنتج',
    'settings.numberingNote': 'أرقام العروض لكل منشأة ({بادئة}-{سنة}-{تسلسل})؛ أكواد المنتجات تسلسلية ولا يُعاد استخدامها أبداً.',
    'settings.saved': 'تم حفظ الإعدادات.',
    'settings.systemNote': 'تُضبط هذه عبر متغيرات البيئة في Vercel / ‎.env.local (لا تُخزن في قاعدة البيانات):',
    'settings.backupNote': 'النسخ الاحتياطي: نسخ Supabase اليومية التلقائية + استعادة نقطة زمنية (فعّلها من لوحة Supabase → قاعدة البيانات → النسخ الاحتياطي). صور المنتجات في حاوية التخزين product-images.',
    'audit.table': 'الجدول',
    'audit.action': 'الإجراء',
    'audit.actor': 'المستخدم',
    'audit.record': 'السجل',
    'audit.view': 'عرض',
    'audit.before': 'قبل',
    'audit.after': 'بعد',

    // Product categories (stored as codes; displayed translated)
    'cat.DOORS': 'أبواب', 'cat.WINDOWS': 'نوافذ', 'cat.KITCHEN': 'مطابخ',
    'cat.FURNITURE': 'أثاث', 'cat.CHAIRS': 'كراسي', 'cat.SOFA': 'كنب',
    'cat.CUPBOARDS': 'دواليب', 'cat.TABLES': 'طاولات', 'cat.COUNTERS': 'كاونترات',
    'cat.CLADDING': 'تكسيات', 'cat.CURTAINS': 'ستائر', 'cat.STEEL': 'حديد',
    'cat.ALUMINIUM': 'ألمنيوم', 'cat.GLASS': 'زجاج', 'cat.OTHER': 'أخرى',

    // Units (stored as codes; displayed translated)
    'u.piece': 'قطعة', 'u.nos': 'عدد', 'u.m': 'متر', 'u.m2': 'م²', 'u.m3': 'م³',
    'u.litre': 'لتر', 'u.kg': 'كجم', 'u.sheet': 'لوح', 'u.roll': 'رول',
    'u.set': 'طقم', 'u.box': 'علبة', 'u.dozen': 'درزن', 'u.carton': 'كرتون',
    'u.lm': 'متر طولي', 'u.sqm': 'م²', 'u.hour': 'ساعة', 'u.day': 'يوم',
  },
};

const LanguageContext = createContext(null);

/* ═══ Data auto-translation layer (single-language data model) ═══
   Stored business values (product names, descriptions, notes …) exist
   once in the DB in whatever language they were typed. tr(text) renders
   them in the CURRENT UI language: passthrough when the script already
   matches, otherwise an in-memory (+sessionStorage) cache lookup backed
   by batched calls to /api/translate (server cache + dictionary).
   Untranslated values render as-is first, then update when the batch
   lands — switching languages feels instant.                          */

const AR_RE = /[؀-ۿ]/;
const dataCache = { en: new Map(), ar: new Map() };
const pending = { en: new Set(), ar: new Set() };
const timers = { en: null, ar: null };
let notifyVersionBump = null;

function loadSessionCache(lang) {
  try {
    const raw = sessionStorage.getItem('af-quotation-tr-' + lang);
    if (raw) for (const [k, v] of JSON.parse(raw)) dataCache[lang].set(k, v);
  } catch (_) {}
}
function saveSessionCache(lang) {
  try {
    sessionStorage.setItem('af-quotation-tr-' + lang,
      JSON.stringify([...dataCache[lang]].slice(-2000)));
  } catch (_) {}
}

function queueTranslation(text, lang) {
  pending[lang].add(text);
  if (timers[lang]) return;
  timers[lang] = setTimeout(async () => {
    const texts = [...pending[lang]].slice(0, 400);
    pending[lang].clear();
    timers[lang] = null;
    if (!texts.length) return;
    try {
      const res = await fetch('/api/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ texts, to: lang }),
      });
      const d = res.ok ? await res.json() : null;
      if (d && d.map) {
        for (const k of Object.keys(d.map)) dataCache[lang].set(k, d.map[k]);
        saveSessionCache(lang);
        if (notifyVersionBump) notifyVersionBump();
      }
    } catch (_) {}
  }, 80);
}

/* Pure lookup used by tr(); memo-safe (same inputs → same output). */
function translateData(text, lang) {
  const s = text === null || text === undefined ? '' : String(text);
  if (!s.trim()) return s;
  if ((lang === 'ar') === AR_RE.test(s)) return s;      // already right language
  const hit = dataCache[lang].get(s.trim());
  if (hit !== undefined) return hit;
  queueTranslation(s.trim(), lang);
  return s;                                              // lazy: original until batch lands
}

/* ═══ Stored-bilingual field picker (v6 model) ═══
   Rows carry BOTH languages (name_en/name_ar …). pickL() returns the
   right one for the UI language synchronously — instant, no network,
   no re-render wave. Falls back: other language → canonical column.  */
export function pickL(row, base, lang) {
  if (!row) return '';
  const en = row[base + '_en'], ar = row[base + '_ar'];
  const v = lang === 'ar' ? (ar || en) : (en || ar);
  return v || row[base] || '';
}

/* Enum/code display: t('cat.DOORS') when defined, else raw code. */
export function codeLabel(t, prefix, code) {
  if (!code) return '—';
  const key = prefix + '.' + String(code);
  const out = t(key);
  return out === key ? String(code) : out;
}

function applyDom(lang) {
  try {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  } catch (_) {}
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('en');
  const [trVersion, setTrVersion] = useState(0);

  useEffect(() => {
    notifyVersionBump = () => setTrVersion(v => v + 1);
    loadSessionCache('en');
    loadSessionCache('ar');
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'ar' || saved === 'en') {
        setLangState(saved);
        applyDom(saved);
      }
    } catch (_) {}
    return () => { notifyVersionBump = null; };
  }, []);

  const setLang = useCallback((next) => {
    setLangState(next);
    applyDom(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
  }, []);

  const t = useCallback((key, vars) => {
    let str = (translations[lang] && translations[lang][key]) || translations.en[key] || key;
    if (vars) {
      Object.keys(vars).forEach(k => { str = str.replace('{' + k + '}', String(vars[k])); });
    }
    return str;
  }, [lang]);

  const formatDate = useCallback((value, opts) => {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', opts || { dateStyle: 'medium' }).format(new Date(value));
    } catch (_) { return String(value); }
  }, [lang]);

  const formatNumber = useCallback((value, opts) => {
    if (value === null || value === undefined || value === '') return '';
    try {
      return new Intl.NumberFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', opts || { maximumFractionDigits: 2 }).format(Number(value));
    } catch (_) { return String(value); }
  }, [lang]);

  /* tr(): display-time translation of stored data values. Depends on
     trVersion so consumers re-render when a translation batch arrives. */
  const tr = useCallback((text) => translateData(text, lang),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, trVersion]);

  /* trL(row, base): instant stored-bilingual pick — the primary display
     path since v6. tr() remains only as fallback for legacy snapshots. */
  const trL = useCallback((row, base = 'name') => pickL(row, base, lang), [lang]);

  const value = useMemo(() => ({ lang, setLang, t, tr, trL, formatDate, formatNumber }), [lang, setLang, t, tr, trL, formatDate, formatNumber]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return ctx;
}
