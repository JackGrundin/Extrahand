// Supabase-klient för realtidsprenumerationer (Supabase Broadcast). Speglar
// frontend/src/api/supabase.js i mobilappen – SAMMA projekt, samma publika anon-nyckel.
// Anon-nyckeln ("anon public") är avsedd att ligga i klienten och är INTE hemlig – till
// skillnad från service-nyckeln som bara finns i backend. Vi använder inte Supabase Auth
// (appen har egen JWT), så sessionshantering stängs av. Realtid används bara som trigger:
// payloaden bär en typ-etikett, och färsk data hämtas via det JWT-skyddade REST-API:t.
import { createClient } from '@supabase/supabase-js';

// Hårdkodad publik fallback (samma värden som appen) med NEXT_PUBLIC-override. Måste stå
// ordagrant eftersom NEXT_PUBLIC inlineas vid byggtid.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://uodpnlkysnevwvekyvog.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZHBubGt5c25ldnd2ZWt5dm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNTExNzMsImV4cCI6MjA5MzcyNzE3M30.mBYabHZC2hS9JAF5SXEzO-fxcwu9jRzxCm48SN3ioYU';

const ärKonfigurerad =
  /^https:\/\/.+\.supabase\.co/.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20;

export const supabase = ärKonfigurerad
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

export const realtidÄrAktiverad = supabase != null;
