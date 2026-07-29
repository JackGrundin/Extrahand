// Tilldelning av ett schema till en person, och frigörande när någon hoppar av.
//
// Materialiseringen är kärnan i schemafunktionen: varje framtida schemapass blir en
// riktig Jobb-rad med en direkt godkänd ansökan, exakt som routes/jobbforfragan.js gör
// när ett erbjudet pass accepteras. Därmed fungerar chatt, tidrapporter, bestridande,
// korrigering, betyg och fakturering utan en enda ny kodväg.

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { skapaJobbBatch, sättJobbPåslag } = require('./jobb');
const {
  passMedArv,
  hämtaSchemaViaId,
  hämtaPassAttTilldela,
  hämtaPassAttFrigöra,
  kopplaPassTillJobb,
  frikopplaPass,
  sättPassInställt,
  sättSchemaStatus,
  sättSchemaTilldelning,
  harGenomförtPass,
  hämtaJobbIdnFörSchema,
} = require('./scheman');
const { idagStockholm } = require('../utils/tid');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { realtime: { transport: ws } }
);

// Skapar flera ansökningar i ett anrop och sätter dem direkt till godkänd. Ett schema med
// 60 pass ska inte bli 120 rundturer till databasen.
async function skapaGodkändaAnsökningar(rader) {
  if (!rader.length) return [];
  const skapade = [];
  for (let i = 0; i < rader.length; i += 50) {
    const { data, error } = await supabase
      .from('ansokningar')
      .insert(rader.slice(i, i + 50).map(r => ({
        jobb_id: r.jobb_id,
        sokande_id: r.sokande_id,
        meddelande: null,
        status: 'godkänd',
      })))
      .select();
    if (error) throw error;
    skapade.push(...(data || []));
  }
  return skapade;
}

// Materialiserar schemats framtida pass för den godkända personen.
//
// Idempotent: bara pass där ansokan_id är null rörs, så ett avbrutet anrop (deploy mitt i,
// nätverksfel) kan köras igen utan att skapa dubbletter.
//
// paslag kommer från annons-jobbet, där det just frysts av den vanliga godkännandelogiken
// i routes/ansokningar.js. Räknaren pass_denna_manad har redan ökats där – en gång för
// hela schemat, vilket är precis vad kravet "ett schema = ett pass" säger.
async function tilldelaSchema(schemaId, sokandeId, paslag) {
  const schema = await hämtaSchemaViaId(schemaId);
  if (!schema) return { antalPass: 0 };

  const pass = await hämtaPassAttTilldela(schemaId, idagStockholm());

  if (pass.length) {
    // Pass som redan har ett jobb (från en tidigare person som hoppat av) återanvänder
    // Jobb-raden – den har rätt fryst påslag och rätt innehåll sedan tidigare.
    const utanJobb = pass.filter(p => !p.jobb_id);

    // Varje pass har sin egen roll och sitt eget OB. passMedArv faller tillbaka på schemats
    // värden för pass som lades innan de flyttades till passnivå.
    const nyaJobb = await skapaJobbBatch(utanJobb.map(p => {
      const { kategori, ob_tillagg } = passMedArv(schema, p);
      return {
        titel: schema.titel,
        beskrivning: schema.beskrivning,
        plats: schema.plats,
        adress: schema.adress,
        lon: schema.timlon,
        typ: schema.typ,
        kategori,
        antal_dagar: 1,
        arbetstider: JSON.stringify([{ datum: p.datum, start: p.starttid, slut: p.sluttid, kategori }]),
        ob_tillagg,
        paslag,
        foretag_id: schema.foretag_id,
        schema_id: schema.id,
        schema_pass_id: p.id,
      };
    }));

    // Matcha jobb mot pass via schema_pass_id, inte via insättningsordning – batchen kan
    // komma tillbaka i annan ordning än den skickades.
    const jobbPerPass = Object.fromEntries(nyaJobb.map(j => [j.schema_pass_id, j.id]));
    const passMedJobb = pass.map(p => ({ pass: p, jobbId: p.jobb_id ?? jobbPerPass[p.id] }))
      .filter(x => x.jobbId != null);

    const ansökningar = await skapaGodkändaAnsökningar(
      passMedJobb.map(x => ({ jobb_id: x.jobbId, sokande_id: sokandeId }))
    );
    const ansökanPerJobb = Object.fromEntries(ansökningar.map(a => [a.jobb_id, a.id]));

    for (const { pass: p, jobbId } of passMedJobb) {
      await kopplaPassTillJobb(p.id, {
        jobb_id: jobbId,
        ansokan_id: ansökanPerJobb[jobbId] ?? null,
        anvandare_id: sokandeId,
      });
    }
  }

  await sättSchemaTilldelning(schemaId, { anvandare_id: sokandeId, paslag });
  await sättSchemaStatus(schemaId, 'tillsatt');

  return { antalPass: pass.length };
}

// Frigör framtida pass när någon hoppar av eller godkännandet tas tillbaka.
//
// Genomförda pass rörs ALDRIG: arbetet är utfört, ska betalas och ska ligga kvar i
// privatpersonens Genomförda, i betygen och i faktureringsunderlaget.
//
// Ansökningarna raderas inte, de avvisas. Chattmeddelanden hänger på meddelanden.ansokan_id
// och hämtaKonversationMellan väljer aktiv ansökan bland dem – en radering skulle slita
// bort chatthistoriken mellan parterna. Jobb-raden behålls också, så nästa person kan
// återanvända den med sitt redan frysta påslag.
async function frigörFramtidaPass(schemaId, { ställInPass = false } = {}) {
  const pass = await hämtaPassAttFrigöra(schemaId, idagStockholm());

  for (const p of pass) {
    if (p.ansokan_id) {
      const { error } = await supabase
        .from('ansokningar')
        .update({ status: 'avvisad' })
        .eq('id', p.ansokan_id);
      if (error) throw error;
    }
    if (ställInPass) await sättPassInställt(p.id);
    else await frikopplaPass(p.id);
  }

  return { antalPass: pass.length };
}

// Nollar påslaget på schemat och alla dess jobb. Anropas bara när INGET pass hunnit
// genomföras – ett schema där någon faktiskt jobbat ska faktureras som avtalat.
async function nollaSchemaPåslag(schemaId) {
  await sättSchemaTilldelning(schemaId, { paslag: null });
  for (const jobbId of await hämtaJobbIdnFörSchema(schemaId)) {
    await sättJobbPåslag(jobbId, null);
  }
}

// Tar tillbaka en tilldelning helt: frigör framtida pass och gör schemat sökbart igen.
// Returnerar om påslaget nollades, så att anropande route vet om pass-räknaren också ska
// minskas (det görs av den vanliga godkännandelogiken i routes/ansokningar.js).
async function återställSchema(schemaId, { ställInPass = false } = {}) {
  const harGenomfört = await harGenomförtPass(schemaId);

  await frigörFramtidaPass(schemaId, { ställInPass });
  await sättSchemaTilldelning(schemaId, { anvandare_id: null });

  if (!harGenomfört) await nollaSchemaPåslag(schemaId);
  await sättSchemaStatus(schemaId, ställInPass ? 'avbrutet' : 'publicerat');

  return { harGenomfört };
}

module.exports = { tilldelaSchema, frigörFramtidaPass, nollaSchemaPåslag, återställSchema };
