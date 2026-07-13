const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { nuvarandeMånad } = require('../utils/manad');
const { PÅSLAG_PRO, PÅSLAG_GRATIS, GRATIS_PASS_PER_MANAD } = require('../utils/pris');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

const PRENUMERATIONSFÄLT =
  'id, stripe_customer_id, prenumeration_status, prenumeration_expires_at, pass_denna_manad, pass_manad, planval_manad';

// Hämtar ett företags prenumerations- och räknartillstånd.
async function hämtaPrenumeration(id) {
  const { data, error } = await supabase
    .from('användare')
    .select(PRENUMERATIONSFÄLT)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// Slår upp användaren utifrån Stripe-kundens id. Används av webhooken, som bara
// känner till Stripe-kunden och inte vår användare.
async function hämtaViaStripeCustomer(stripeCustomerId) {
  const { data, error } = await supabase
    .from('användare')
    .select(PRENUMERATIONSFÄLT)
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Är företaget Pro just nu? En uppsagd prenumeration behåller status 'pro' fram
// till periodens slut – de har betalat för månaden och ska ha 20% hela vägen ut.
function ärPro(användare) {
  if (användare?.prenumeration_status !== 'pro') return false;
  const utgång = användare.prenumeration_expires_at;
  return !utgång || new Date(utgång) > new Date();
}

// Antal GENOMFÖRDA (godkända) pass denna månad – det är den räknare som avgör vad vi
// fakturerar. Om månadsstämpeln avser en tidigare månad har räknaren ännu inte
// nollställts (cron kan ha missat den 1:a) – då är det korrekta svaret 0.
function aktuelltAntalPass(användare) {
  if (användare?.pass_manad !== nuvarandeMånad()) return 0;
  return användare?.pass_denna_manad ?? 0;
}

// Har företaget redan valt att fortsätta utan abonnemang denna månad? Då ska planvalet
// inte visas igen förrän nästa månad. Avser stämpeln en tidigare månad räknas valet som
// ogjort, så popupen kommer tillbaka av sig själv vid månadsskifte.
function harGjortPlanval(användare) {
  return användare?.planval_manad === nuvarandeMånad();
}

// Registrerar att företaget valt att fortsätta utan abonnemang denna månad.
async function sättPlanvalGjort(id) {
  const { error } = await supabase
    .from('användare')
    .update({ planval_manad: nuvarandeMånad() })
    .eq('id', id);

  if (error) throw error;
}

// Påslaget som FAKTURERAS. Anropas när ett pass tillsätts (en ansökan godkänns) och
// fryses då på jobbet. Bygger enbart på genomförda pass – ett jobb som aldrig tillsätts
// ska inte kosta något.
function gällandePåslag(användare) {
  if (ärPro(användare)) return PÅSLAG_PRO;
  return aktuelltAntalPass(användare) >= GRATIS_PASS_PER_MANAD ? PÅSLAG_GRATIS : PÅSLAG_PRO;
}

// Påslaget som VISAS i appen för ett pass som ännu inte tillsatts. Till skillnad från
// gällandePåslag räknas här även jobb som publicerats men inte fyllts: de ligger i kön
// före det jobb företaget håller på att lägga upp och avgör vilket passnummer det blir.
// Utan detta skulle prisrutan visa det lägre priset samtidigt som popupen varnar för att
// priset höjs.
//
// Prognosen är avsiktligt konservativ. Blir jobbet ändå månadens första godkända pass
// faktureras det lägre påslaget, och kunden betalar mindre än vad vi visade – aldrig mer.
function prognosPåslag(användare, publiceradeDennaMånad = 0) {
  if (ärPro(användare)) return PÅSLAG_PRO;

  // Max av de två: ett jobb publicerat förra månaden kan godkännas denna, och då är
  // publiceringsantalet lågt men de genomförda passen många.
  const förbrukade = Math.max(aktuelltAntalPass(användare), publiceradeDennaMånad);
  return förbrukade >= GRATIS_PASS_PER_MANAD ? PÅSLAG_GRATIS : PÅSLAG_PRO;
}

// Räknar upp antalet publicerade pass atomiskt (radlås i Postgres) så att två
// samtidiga publiceringar inte kan läsa samma värde och båda slinka igenom
// gratisgränsen. Nollställer samtidigt räknaren om månaden bytt.
async function ökaPassDennaManad(id) {
  const { data, error } = await supabase.rpc('oka_pass_denna_manad', {
    p_id: id,
    p_manad: nuvarandeMånad(),
  });

  if (error) throw error;
  return data;
}

// Minskar räknaren när ett godkännande tas tillbaka – passet blev aldrig av och ska
// inte förbruka ett gratispass. Klampar vid 0 och rör bara räknaren om den avser
// innevarande månad (se minska_pass_denna_manad i migrationen).
async function minskaPassDennaManad(id) {
  const { data, error } = await supabase.rpc('minska_pass_denna_manad', {
    p_id: id,
    p_manad: nuvarandeMånad(),
  });

  if (error) throw error;
  return data;
}

// Uppdaterar prenumerationstillståndet. Anropas av Stripe-webhooken och av
// checkout-flödet när en Stripe-kund skapas.
async function sättPrenumeration(id, { status, expiresAt, stripeCustomerId }) {
  const uppdatering = {};
  if (status !== undefined) uppdatering.prenumeration_status = status;
  if (expiresAt !== undefined) uppdatering.prenumeration_expires_at = expiresAt;
  if (stripeCustomerId !== undefined) uppdatering.stripe_customer_id = stripeCustomerId;
  if (!Object.keys(uppdatering).length) return;

  const { error } = await supabase.from('användare').update(uppdatering).eq('id', id);
  if (error) throw error;
}

// Nollställer räknaren för alla företag vid månadsskifte (cron-jobbet).
async function nollställAllaPass(månad) {
  const { error } = await supabase
    .from('användare')
    .update({ pass_denna_manad: 0, pass_manad: månad })
    .neq('pass_manad', månad);

  if (error) throw error;
}

module.exports = {
  hämtaPrenumeration,
  hämtaViaStripeCustomer,
  ärPro,
  aktuelltAntalPass,
  gällandePåslag,
  prognosPåslag,
  harGjortPlanval,
  sättPlanvalGjort,
  ökaPassDennaManad,
  minskaPassDennaManad,
  sättPrenumeration,
  nollställAllaPass,
};
