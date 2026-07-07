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

// Delad kanal som alla privatpersoner lyssnar på för att hålla den publika jobblistan
// synkad i realtid. Måste matcha klientens prenumeration (RealtidsContext).
const JOBBLISTA_KANAL = 'jobblista';

// Skickar en broadcast med enbart en typ-etikett till en topic. Realtid är en signal,
// inte en kritisk väg – vi loggar men fäller aldrig huvudanropet.
async function sändBroadcast(topic, typ) {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
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
          { topic, event: 'ny', payload: { typ } },
        ],
      }),
    });
    if (!svar.ok) {
      console.error('Realtidsping svarade', svar.status, await svar.text().catch(() => ''));
    }
  } catch (fel) {
    console.error('Realtidsping misslyckades:', fel.message);
  }
}

// Signal till en enskild användares privata kanal (olästa, passtatus, betyg m.m.).
async function sändRealtidsPing(mottagarId, typ) {
  if (mottagarId == null) return;
  return sändBroadcast(användarKanal(mottagarId), typ);
}

// Signal till den delade jobblista-kanalen – triggar alla privatpersoners jobblista att
// hämta färsk data när ett jobb publiceras, ändras, tas bort eller blir tillsatt/ledigt.
async function sändJobblistaPing(typ) {
  return sändBroadcast(JOBBLISTA_KANAL, typ);
}

module.exports = { sändRealtidsPing, sändJobblistaPing };
