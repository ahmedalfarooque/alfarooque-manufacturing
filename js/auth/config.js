/* ═══════════════════════════════════════════════════════════════════
   AL FAROOQUE — Supabase public client config
   ───────────────────────────────────────────────────────────────────
   These TWO values are PUBLIC by design. The Supabase "anon" key is meant
   to ship in client-side code — it is gated server-side by Row-Level
   Security (see supabase/schema.sql). It is NOT a secret.

   ⚠ NEVER put the Supabase "service_role" key here — that one IS secret
     and must only live in server-side env vars.

   ▶ HOW TO FILL THIS IN:
     1. Create a free project at https://supabase.com
     2. Dashboard → Project Settings → API
     3. Copy "Project URL"  →  url
        Copy "anon public" key  →  anonKey
     4. Run supabase/schema.sql in Dashboard → SQL Editor
     5. See AUTH_SETUP.md for the full walkthrough (Google OAuth, emails…)
   ═══════════════════════════════════════════════════════════════════ */
window.__AF_SUPABASE__ = {
  url:     'https://YOUR-PROJECT-REF.supabase.co',
  anonKey: 'YOUR-SUPABASE-ANON-PUBLIC-KEY',
};
