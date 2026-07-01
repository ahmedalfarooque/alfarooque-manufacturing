/* ═══════════════════════════════════════════════════════════════════
   AL FAROOQUE — Supabase public client config
   ───────────────────────────────────────────────────────────────────
   These TWO values are PUBLIC by design. The Supabase publishable key
   ("sb_publishable_…") is meant to ship in client-side code — it is gated
   server-side by Row-Level Security (see supabase/schema.sql). Not secret.

   ⚠ NEVER put an "sb_secret_…" key here — those are admin keys and must
     only live in server-side env vars.

   To rotate: Supabase → Project Settings → API keys. Update the value
   below, then redeploy. See AUTH_SETUP.md for the full walkthrough.
   ═══════════════════════════════════════════════════════════════════ */
window.__AF_SUPABASE__ = {
  url:     'https://yvzczhyluzkuhsnfckob.supabase.co',
  anonKey: 'sb_publishable_V0g4gItY8vG_wWlW2EVrKQ_2fKf_vi7',

  /* Flip to true ONLY after you enable Google in Supabase
     (Authentication → Providers → Google) with a Google Cloud OAuth
     client. While false, the Google button shows as "coming soon" so
     users never hit the "provider is not enabled" error. */
  googleEnabled: false,
};
