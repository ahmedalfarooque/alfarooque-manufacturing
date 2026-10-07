'use strict';

/* Application-level access — "which ERP applications may this user enter?"
   This is deliberately separate from the in-app role/module permissions
   ("what may they do once inside"), which stay in permissionRegistry.js /
   moduleAuthorization.js.

   Single source of truth: the shared `app_permissions` table (one row per
   user × app, unique (user_id, app_id)). A row = access to that app; the
   row's app_role / module_access are the in-app layer. Platform admins
   (platform_users.role = 'admin') and the super-admin account always have
   every application and never carry rows.

   Used by every app's login route (deny sign-in to an application the
   user was not granted, and tell the client where to go next), by the
   shared admin Users handlers (grant / revoke per application) and by the
   application launcher. Pure functions — no I/O — so they are unit-tested
   once in appAccess.test.js and behave identically in all six apps. */

const { APPS } = require('./permissionRegistry');

const APP_LABELS = { quotation: 'QuotePro', projects: 'Projects', cars: 'Cars', inventory: 'Inventory', accounting: 'Accounting', crm: 'CRM' };

/* Default in-app role for a brand-new grant made from the Application
   Access editor; admins refine it afterwards with the role selector. */
const DEFAULT_GRANT_ROLE = 'readonly';

function isPlatformAdmin(user, { isSuperAdmin = false } = {}) {
  return !!isSuperAdmin || !!(user && user.role === 'admin');
}

/* Ordered, de-duplicated list of app ids the user may enter. `grants` are
   app_permissions rows (anything with an `app_id`). */
function grantedAppIds(user, grants, opts = {}) {
  if (isPlatformAdmin(user, opts)) return [...APPS];
  const have = new Set((grants || []).map(g => g && g.app_id).filter(Boolean));
  return APPS.filter(id => have.has(id));
}

/* What should happen after a successful OTP verification in `appId`?
   - allowed: may a session for THIS app be minted at all
   - reason:  'ok' | 'no_apps' (nothing assigned anywhere) | 'app_not_granted'
   - apps:    the user's full application list (for the launcher / error UI)
   - next:    where the client should go: '/launch' when the user has more
              than one application, otherwise this app's dashboard. */
function loginDecision({ user, grants, appId, isSuperAdmin = false, dashboard = '/dashboard' }) {
  const apps = grantedAppIds(user, grants, { isSuperAdmin });
  if (!APPS.includes(appId)) return { allowed: false, reason: 'unknown_app', apps, next: null };
  if (apps.length === 0) return { allowed: false, reason: 'no_apps', apps, next: null };
  if (!apps.includes(appId)) return { allowed: false, reason: 'app_not_granted', apps, next: null };
  return { allowed: true, reason: 'ok', apps, next: apps.length > 1 ? '/launch' : dashboard };
}

/* The role baked into the app session JWT. Platform admins and the
   super-admin are always 'admin', on BOTH login tabs — every server route
   already treats them as admin via readSession, so the JWT must say the
   same or the edge page gate and the API disagree (that disagreement was
   the Cars "Users -> Dashboard" bug). Everyone else gets the in-app role of
   their grant for this application. */
function sessionRoleFor({ user, grant, isSuperAdmin = false }) {
  if (isSuperAdmin || (user && user.role === 'admin')) return 'admin';
  return (grant && grant.app_role) || DEFAULT_GRANT_ROLE;
}

/* Grant editor: which rows to create and which to delete to reach the
   wanted set. Unknown ids are rejected (null) so a typo can never grant
   or revoke anything. Duplicates collapse. */
function diffAppGrants(currentIds, wantedIds) {
  const wanted = [...new Set((wantedIds || []).filter(x => typeof x === 'string'))];
  if (wanted.some(id => !APPS.includes(id))) return null;
  const current = new Set((currentIds || []).filter(id => APPS.includes(id)));
  return {
    add: APPS.filter(id => wanted.includes(id) && !current.has(id)),
    remove: APPS.filter(id => current.has(id) && !wanted.includes(id)),
    apps: APPS.filter(id => wanted.includes(id)),
  };
}

/* Edge/middleware check on a verified session payload. Returns true /
   false, or null when the token predates the `apps` claim (the caller
   decides how strict to be for legacy tokens). */
function sessionCanEnterApp(session, appId) {
  if (!session) return false;
  if (session.role === 'admin') return true;
  if (Array.isArray(session.apps)) return session.apps.includes(appId);
  return null;
}

/* Page gate shared by every app's middleware. Pure: takes the verified
   session payload (already run through the super-admin override) and
   returns what to do, so the exact rules are unit-tested once.
     'next'      render the page
     'login'     no session
     'dashboard' signed-in visitor on the login page
     'no-access' session may not enter this application
     'forbidden' admin-only page, non-admin session
   User management is an ADMIN capability: it never depends on the
   application-access rows (an admin must be able to open Users to grant
   access to someone who has none). */
function pageGate({ session, viaSso = false, pathname, appId, adminOnlyPrefixes = [], loginPrefixes = ['/login'] }) {
  const isLogin = loginPrefixes.some(p => pathname.startsWith(p));
  if (isLogin) return session ? { action: 'dashboard' } : { action: 'next' };
  if (!session) return { action: 'login' };
  if (session.role !== 'admin') {
    const can = sessionCanEnterApp(session, appId);
    if (can === false || (can === null && viaSso)) return { action: 'no-access' };
  }
  const adminOnly = adminOnlyPrefixes.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (adminOnly && session.role !== 'admin') return { action: 'forbidden' };
  return { action: 'next' };
}

/* Effective session for the page gate: identical to lib/auth.js
   readSession, the super-admin account is admin whatever the JWT says. */
function effectiveSession(session, isSuperAdmin) {
  if (!session) return null;
  return isSuperAdmin ? { ...session, role: 'admin' } : session;
}

module.exports = { APP_LABELS, DEFAULT_GRANT_ROLE, isPlatformAdmin, grantedAppIds, loginDecision, sessionRoleFor, diffAppGrants, sessionCanEnterApp, pageGate, effectiveSession };
