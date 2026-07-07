import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Publika Supabase-uppgifter för realtidsprenumerationer. Anon-nyckeln ("anon public")
// är avsedd att ligga i klienten och är inte hemlig – till skillnad från service-nyckeln
// som bara finns i backend. Hämta båda värdena i Supabase-dashboarden:
//   Project Settings → API → Project URL och Project API keys → anon public.
const SUPABASE_URL = 'https://uodpnlkysnevwvekyvog.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZHBubGt5c25ldnd2ZWt5dm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNTExNzMsImV4cCI6MjA5MzcyNzE3M30.mBYabHZC2hS9JAF5SXEzO-fxcwu9jRzxCm48SN3ioYU';

// Realtid aktiveras bara när riktiga värden fyllts i. Saknas de faller appen tillbaka
// på uppdatering vid fokus/förgrund utan att krascha.
const ärKonfigurerad =
  /^https:\/\/.+\.supabase\.co/.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20;

// Vi använder inte Supabase Auth (appen har egen JWT), så sessionshantering stängs av.
export const supabase = ärKonfigurerad
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

export const realtidÄrAktiverad = supabase != null;
