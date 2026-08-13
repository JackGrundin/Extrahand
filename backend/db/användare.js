const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

async function skapaAnvändare({ namn, email, lösenord, typ, beskrivning, bransch, stad, hemsida, telefonnummer, organisationsnummer, fakturaadress, postnummer, ort, fakturamail, referensperson }) {
  const { data, error } = await supabase
    .from('användare')
    .insert([{ Namn: namn, Email: email, Lösenord: lösenord, Typ: typ, beskrivning, bransch, stad, hemsida, telefonnummer, organisationsnummer, fakturaadress, postnummer, ort, fakturamail, referensperson }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function hämtaAnvändareViaEmail(email) {
  const { data, error } = await supabase
    .from('användare')
    .select('*')
    .eq('Email', email)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function hämtaAnvändareViaId(id) {
  const { data, error } = await supabase
    .from('användare')
    .select('id, Namn, Typ, created_at, cv, erfarenheter, kompetenser, intressen, profil_bild, beskrivning, bransch, stad, hemsida, telefonnummer, organisationsnummer, fakturaadress, postnummer, ort, fakturamail, referensperson')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

async function uppdateraProfilBild(id, url) {
  const { error } = await supabase.from('användare').update({ profil_bild: url }).eq('id', id);
  if (error) throw error;
}

async function uppdateraProfil(id, { cv, erfarenheter, kompetenser, intressen, beskrivning, bransch, stad, hemsida, telefonnummer }) {
  const { error } = await supabase
    .from('användare')
    .update({ cv, erfarenheter, kompetenser, intressen, beskrivning, bransch, stad, hemsida, telefonnummer })
    .eq('id', id);
  if (error) throw error;
}

// Uppdaterar enbart användarens stad (utan att röra övriga profilfält). Används
// av GPS-flödet och det manuella stadsfältet i profilen.
async function uppdateraStad(id, stad) {
  const { error } = await supabase
    .from('användare')
    .update({ stad })
    .eq('id', id);
  if (error) throw error;
}

// Hämtar push-tokens för privatpersoner i en viss stad (skiftlägesokänslig
// matchning). Används för att notifiera om nya jobb i närheten.
async function hämtaPrivatpersonerIStad(stad) {
  if (!stad) return [];
  const { data, error } = await supabase
    .from('användare')
    .select('id, push_token')
    .eq('Typ', 'privatperson')
    .ilike('stad', stad.trim())
    .not('push_token', 'is', null);
  if (error) throw error;
  return data || [];
}

async function sparaPushToken(id, token) {
  const { error } = await supabase
    .from('användare')
    .update({ push_token: token })
    .eq('id', id);
  if (error) throw error;
}

async function hämtaPushToken(id) {
  const { data } = await supabase
    .from('användare')
    .select('push_token')
    .eq('id', id)
    .single();
  return data?.push_token || null;
}

async function hämtaAllaFöretag() {
  const { data, error } = await supabase
    .from('användare')
    .select('id, Namn, Email, telefonnummer, organisationsnummer, fakturaadress, postnummer, ort, fakturamail, referensperson, created_at')
    .eq('Typ', 'företag')
    .not('aktiv', 'is', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!data || !data.length) return [];

  const { data: jobb } = await supabase
    .from('Jobb')
    .select('Foretag_id');

  const jobbRäkning = (jobb || []).reduce((acc, j) => {
    const fid = String(j.Foretag_id);
    if (j.Foretag_id != null) acc[fid] = (acc[fid] || 0) + 1;
    return acc;
  }, {});

  return data.map(f => ({ ...f, antalJobb: jobbRäkning[String(f.id)] ?? 0 }));
}

async function hämtaAllaPrivatpersoner() {
  const { data, error } = await supabase
    .from('användare')
    .select('id, Namn, Email, telefonnummer, avtal_godkant, created_at')
    .eq('Typ', 'privatperson')
    .not('aktiv', 'is', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function godkännAvtal(id) {
  const { error } = await supabase
    .from('användare')
    .update({ avtal_godkant: true })
    .eq('id', id);
  if (error) throw error;
}

async function sparaVerifieringskod(id, kod, expiresAt) {
  const { error } = await supabase
    .from('användare')
    .update({ verifieringskod: kod, kod_expires_at: expiresAt })
    .eq('id', id);
  if (error) throw error;
}

async function markeraEmailVerifierad(id) {
  const { error } = await supabase
    .from('användare')
    .update({ email_verifierad: true, verifieringskod: null, kod_expires_at: null })
    .eq('id', id);
  if (error) throw error;
}

// ── Återställning av lösenord ────────────────────────────────────────────────

// Endast hashen lagras. Token i klartext finns bara i mejlet och i länken.
async function sparaÅterställningsToken(id, tokenHash, expiresAt) {
  const { error } = await supabase
    .from('användare')
    .update({ aterstallning_token_hash: tokenHash, aterstallning_expires_at: expiresAt })
    .eq('id', id);
  if (error) throw error;
}

async function hämtaAnvändareViaÅterställningsToken(tokenHash) {
  const { data, error } = await supabase
    .from('användare')
    .select('*')
    .eq('aterstallning_token_hash', tokenHash)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Sätter nytt lösenord och bränner token i samma update, så att länken aldrig kan
// användas två gånger.
async function uppdateraLösenord(id, hashatLösenord) {
  const { error } = await supabase
    .from('användare')
    .update({
      Lösenord: hashatLösenord,
      aterstallning_token_hash: null,
      aterstallning_expires_at: null,
    })
    .eq('id', id);
  if (error) throw error;
}

// ── Radering av konto ────────────────────────────────────────────────────────

// Raderar all personuppgift på användarraden och markerar kontot som inaktivt.
// Raden i sig blir kvar: tidrapporter, fakturaunderlag, betyg och chattmeddelanden
// pekar på id:t, och en borttagen rad hade slitit sönder både bokföringen och
// motpartens historik.
//
// E-postadressen ersätts med en unik platshållare i stället för att nollas. Två
// skäl: kolumnen är unik-indexerad så flera raderade konton skulle krocka på NULL
// om indexet är strikt, och personen ska kunna registrera sig på nytt med sin
// riktiga adress efteråt.
//
// Lösenordet sätts till ett ogiltigt värde (inte NULL) så att bcrypt.compare
// alltid returnerar false även om någon kodväg missar aktiv-kontrollen.
async function raderaKonto(id) {
  const { error } = await supabase
    .from('användare')
    .update({
      Namn: 'Borttaget konto',
      Email: `raderad+${id}@fastgig.se`,
      Lösenord: 'RADERAT',
      aktiv: false,
      raderad_at: new Date().toISOString(),
      telefonnummer: null,
      cv: null,
      erfarenheter: null,
      kompetenser: null,
      intressen: null,
      profil_bild: null,
      beskrivning: null,
      bransch: null,
      stad: null,
      hemsida: null,
      push_token: null,
      organisationsnummer: null,
      fakturaadress: null,
      postnummer: null,
      ort: null,
      fakturamail: null,
      referensperson: null,
      verifieringskod: null,
      kod_expires_at: null,
      aterstallning_token_hash: null,
      aterstallning_expires_at: null,
    })
    .eq('id', id);
  if (error) throw error;
}

module.exports = { skapaAnvändare, hämtaAnvändareViaEmail, hämtaAnvändareViaId, uppdateraProfil, uppdateraProfilBild, uppdateraStad, hämtaPrivatpersonerIStad, sparaPushToken, hämtaPushToken, hämtaAllaPrivatpersoner, godkännAvtal, hämtaAllaFöretag, sparaVerifieringskod, markeraEmailVerifierad, sparaÅterställningsToken, hämtaAnvändareViaÅterställningsToken, uppdateraLösenord, raderaKonto };
