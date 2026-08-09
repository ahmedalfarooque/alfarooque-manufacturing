'use client';
import { useLang } from '@/lib/i18n';
import UnifiedErpLogin from '../../../shared/UnifiedErpLogin';
export default function LoginPage() {
  const context = useLang();
  const labels = context.lang === 'ar' ? {
    'shell.toggleLanguage':'تبديل اللغة','shell.toggleTheme':'تبديل المظهر','login.user':'مستخدم','login.admin':'مسؤول','login.email':'البريد الإلكتروني','login.password':'كلمة المرور','login.continue':'متابعة','login.signingIn':'جارٍ تسجيل الدخول…','login.verifying':'جارٍ التحقق…','login.verifyAndSignIn':'تحقق وسجل الدخول','login.resendCode':'إعادة إرسال الرمز','login.backToEmail':'العودة إلى البريد','login.backToEmailPassword':'العودة إلى البريد وكلمة المرور','login.codeSentTo':'تم إرسال الرمز إلى','login.successRedirect':'تم بنجاح — جارٍ التحويل…','login.genericError':'حدث خطأ. حاول مرة أخرى.'
  } : {
    'shell.toggleLanguage':'Toggle language','shell.toggleTheme':'Toggle theme','login.user':'User','login.admin':'Admin','login.email':'Email','login.password':'Password','login.continue':'Continue','login.signingIn':'Signing in…','login.verifying':'Verifying…','login.verifyAndSignIn':'Verify & Sign In','login.resendCode':'Resend code','login.backToEmail':'Back to email','login.backToEmailPassword':'Back to email and password','login.codeSentTo':'Code sent to','login.successRedirect':'Success — redirecting…','login.genericError':'Something went wrong. Please try again.'
  };
  const language = { ...context, t: key => labels[key] || context.t(key) };
  return <UnifiedErpLogin {...language} title="CRM" subtitle={language.lang === 'ar' ? 'إدارة علاقات العملاء' : 'Customer Relationship Management'} themeKey="af-crm-theme" userActions={{ login:'email-login', verify:'verify-otp', resend:'resend-otp' }} adminActions={{ login:'login', verify:'verify-otp', resend:'resend-otp' }} />;
}
