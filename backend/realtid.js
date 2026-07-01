// Skickar en lättviktig realtidssignal till en användares privata broadcast-kanal via
// Supabase Realtime. Payloaden innehåller AVSIKTLIGT inget känsligt innehåll – bara en
// typ-etikett – så att inget exponeras via den publika anon-nyckeln. Klienten använder
// signalen enbart som en trigger och hämtar sedan färsk data via det JWT-skyddade API:t.
//
// Anropas server-side med service-nyckeln (aldrig i klienten). Bygger på Supabase
// Realtimes broadcast-endpoint, så ingen postgres-publikation eller RLS-öppning behövs.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;

// Kanalnamn per användare. Måste matcha klientens prenumeration (RealtidsContext).
function användarKanal(användarId) {
  return `anvandare:${användarId}`;
}

async function sändRealtidsPing(mottagarId, typ) {
  if (!SUPABASE_URL || !SERVICE_KEY || mottagarId == null) return;
  try {
    const svar = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          { topic: användarKanal(mottagarId), event: 'ny', payload: { typ } },
        ],
      }),
    });
    if (!svar.ok) {
      console.error('Realtidsping svarade', svar.status, await svar.text().catch(() => ''));
    }
  } catch (fel) {
    // Realtid är en signal, inte en kritisk väg – logga men fäll aldrig huvudanropet.
    console.error('Realtidsping misslyckades:', fel.message);
  }
}

module.exports = { sändRealtidsPing };
