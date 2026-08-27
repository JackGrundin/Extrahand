const express = require('express');
const { kräverInloggning, kräverTyp } = require('../middleware/auth');
const {
  skapaSchema,
  sättAnnonsJobb,
  hämtaSchemaViaId,
  hämtaÖppnaScheman,
  hämtaSchemanFörFöretag,
  uppdateraSchema,
  skapaSchemaPass,
  hämtaPassFörSchema,
  hämtaSchemaPassFörAnvändare,
  hämtaKalenderPass,
  passMedArv,
  räknaKategorier,
  hämtaEgnaKategorier,
  synkaAnnonsJobb,
  sättSchemaPeriod,
  hämtaPassViaId,
  sättPassInställt,
} = require('../db/scheman');
const { GILTIGA_TYPER: AVDRAGSTYPER, skapaAvdrag, hämtaAktivaAvdrag, avaktiveraAvdrag } = require('../db/schemaAvdrag');
const { tilldelaSchema, frigörFramtidaPass, återställSchema } = require('../db/schemaTilldelning');
const { skapaJobb, räknaJobbDennaMånad, sättJobbPåslag, hämtaJobbFörFöretag, markeraAnsökningarSedda } = require('../db/jobb');
const { hämtaAnsökningarFörJobb, uppdateraStatus, markeraAvhopp, hämtaGodkändaFörFleraJobb, hämtaNamnFörAnvändare } = require('../db/ansokningar');
const { hämtaPrenumeration, ärPro, harGjortPlanval, sättPlanvalGjort, minskaPassDennaManad } = require('../db/prenumeration');
const { hämtaPrivatpersonerIStad, hämtaPushToken } = require('../db/användare');
const { GRATIS_PASS_PER_MANAD, valideraObTillagg } = require('../utils/pris');
const { skickaNotifikation } = require('../utils/pushNotifikation');
const { idagStockholm, parsaArbetstider, passTimmar, slutEpochFörPass } = require('../utils/tid');
const { sändJobblistaPing, sändRealtidsPing } = require('../realtid');

const router = express.Router();

// Speglas av SCHEMATYPER i frontend/src/utils/konstanter.js – ändra alltid på båda ställena.
// 'sommarjobb' fanns i den gamla listan, så befintliga scheman förblir giltiga.
const GILTIGA_TYPER = ['sommarjobb', 'sasongsarbete', 'deltidsjobb', 'periodsarbete'];
const DATUM_MÖNSTER = /^\d{4}-\d{2}-\d{2}$/;
// Speglas av MAX_ANTAL_PASS i frontend/src/screens/PubliceraSchemaScreen.js.
const MAX_ANTAL_PASS = 200;
const TID_MÖNSTER = /^\d{2}:\d{2}$/;

// Validerar ett inkommande schema. Returnerar felmeddelande (sträng) eller null.
// Samma roll som valideraJobbInput i routes/jobb.js: servern är sista försvaret, för en
// tom timlön ger tidrapporter på 0 kr och ett schema utan pass är meningslöst.
const MAX_KATEGORI_LÄNGD = 40;

// Validerar ett inkommande schema. Returnerar felmeddelande (sträng) eller null.
//
// Perioden skickas INTE in längre – den härleds ur passens datum (se härledPeriod). När
// pass läggs ett i taget finns ingen period att validera mot innan passen finns, och
// regeln "alla pass måste ligga inom perioden" blev bara en felkälla.
// Validerar en passlista. Delas av publiceringen och av POST /:id/pass, som lägger till
// pass i efterhand – reglerna måste vara identiska på båda vägarna.
//
// befintliga är pass som redan finns i schemat. Krockkontrollen måste omfatta dem, annars
// kan ett tillagt pass få samma datum + starttid som ett befintligt och ge två tidrapporter
// för samma arbetspass.
function valideraPassLista(pass, befintliga = []) {
  if (!Array.isArray(pass) || !pass.length) return 'Schemat måste innehålla minst ett pass';

  const aktivaBefintliga = befintliga.filter(p => p.status !== 'installt');

  // Varje pass blir en Jobb-rad och en ansökan, kopplade i en sekventiell loop i
  // schemaTilldelning. Utan tak kan ett anrop förbi appen skapa tiotusentals rader.
  // Speglas av MAX_ANTAL_PASS i frontend/src/screens/PubliceraSchemaScreen.js.
  if (pass.length + aktivaBefintliga.length > MAX_ANTAL_PASS) {
    return `Ett schema kan ha högst ${MAX_ANTAL_PASS} pass`;
  }

  const idag = idagStockholm();
  const sedda = new Set(aktivaBefintliga.map(p => `${p.datum} ${p.starttid}`));
  for (const p of pass) {
    if (!DATUM_MÖNSTER.test(p?.datum || '')) return 'Varje pass måste ha ett datum';
    // Ett pass daterat före idag blir permanent dött: hämtaPassAttTilldela filtrerar på
    // .gte('datum', idag) så det tilldelas aldrig, och cronen kräver ansokan_id så det
    // rapporteras aldrig. Det räknas ändå av räknaPassFörSchema, som är divisorn i
    // beräknaAvdragFörPass – ett dött pass späder alltså ut löneavdraget så att summan
    // aldrig når det inskrivna beloppet. Dagens datum är däremot giltigt.
    if (p.datum < idag) return 'Pass kan inte läggas på ett datum som redan passerat';
    if (!TID_MÖNSTER.test(p?.starttid || '') || !TID_MÖNSTER.test(p?.sluttid || '')) {
      return 'Varje pass måste ha start- och sluttid';
    }
    // Identiska tider ger noll timmar. Cronen markerar då passet rapporterat UTAN
    // tidrapport, så personen får inget betalt medan företaget ser "Genomfört".
    // Blockera ALDRIG "sluttid före starttid" – pass över midnatt (22:00–06:00) är giltiga.
    if (p.starttid === p.sluttid) return 'Start- och sluttid kan inte vara samma';
    // Ett pass vars sluttid redan passerat kan aldrig arbetas. Datumkontrollen ovan
    // släpper igenom dagens datum oavsett klockslag, så utan den här raden gick det att
    // publicera ett pass som var över redan när det skapades. Ett midnattspass (idag
    // 22:00–06:00) påverkas inte – slutEpochFörPass ger morgondagens 06:00.
    const passSlut = slutEpochFörPass({ datum: p.datum, starttid: p.starttid, sluttid: p.sluttid });
    if (passSlut != null && passSlut <= Date.now()) {
      return 'Pass kan inte läggas på en tid som redan passerat';
    }
    // Kategori per pass är fri text – företaget namnger sina egna avdelningar och är inte
    // bundet till KATEGORIER-listan. Bara längden begränsas.
    if (p.kategori != null && String(p.kategori).trim().length > MAX_KATEGORI_LÄNGD) {
      return `Kategori får vara högst ${MAX_KATEGORI_LÄNGD} tecken`;
    }
    // Formkontrollen är inte kosmetisk: ett trasigt OB får beräknaObBelopp att kasta, och
    // cron-jobbet skulle då försöka rapportera passet om och om igen var femte minut.
    const obFel = valideraObTillagg(p.ob_tillagg);
    if (obFel) return obFel;

    // Samma datum + starttid två gånger skulle ge två tidrapporter för samma pass.
    // Olika starttid samma datum är däremot tillåtet – det är så en dag med två roller ser ut.
    const nyckel = `${p.datum} ${p.starttid}`;
    if (sedda.has(nyckel)) return 'Samma pass förekommer flera gånger';
    sedda.add(nyckel);
  }
  return null;
}

function valideraSchemaInput({ titel, beskrivning, typ, plats, adress, kategori, timlon, pass, avdrag }) {
  if (!titel || !String(titel).trim()) return 'Titel krävs';
  if (!beskrivning || !String(beskrivning).trim()) return 'Beskrivning krävs';
  if (typ && !GILTIGA_TYPER.includes(typ)) return 'Ogiltig typ';
  if (!plats || !String(plats).trim()) return 'Stad krävs';
  if (!adress || !String(adress).trim()) return 'Adress till arbetsplatsen krävs';
  // Ingen huvudkategori krävs: rollen sätts per pass. Fältet finns kvar i databasen för
  // scheman som skapades när det var obligatoriskt – deras pass utan egen roll ärver det.
  if (timlon == null || !(Number(timlon) > 0)) return 'Giltig timlön krävs';

  const passFel = valideraPassLista(pass);
  if (passFel) return passFel;

  for (const a of (Array.isArray(avdrag) ? avdrag : [])) {
    if (!a?.namn || !String(a.namn).trim()) return 'Varje avdrag måste ha ett namn';
    if (!(Number(a.belopp) > 0)) return 'Varje avdrag måste ha ett belopp större än noll';
    if (a.typ != null && !AVDRAGSTYPER.includes(a.typ)) return 'Ogiltig avdragstyp';
  }
  return null;
}

// Perioden är min/max av passens datum. Ett schema utan pass kan inte publiceras, så
// listan är alltid icke-tom här.
function härledPeriod(pass) {
  const datum = pass.map(p => p.datum).sort();
  return { startdatum: datum[0], slutdatum: datum[datum.length - 1] };
}

// POST /api/scheman — företag publicerar ett schema
router.post('/', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const {
    titel, beskrivning, plats, adress, kategori, typ,
    timlon, pass, avdrag, acceptera_hogre_paslag,
  } = req.body;

  const valideringsfel = valideraSchemaInput({
    titel, beskrivning, typ, plats, adress, kategori, timlon, pass, avdrag,
  });
  if (valideringsfel) return res.status(400).json({ fel: valideringsfel });

  try {
    // Samma planvals-gate som vid vanlig publicering. Ett schema räknas som EN
    // publicering: annons-jobbet nedan är en Jobb-rad, medan passjobben filtreras bort
    // i räknaJobbDennaMånad (se db/jobb.js).
    const prenumeration = await hämtaPrenumeration(req.användare.id);
    if (!ärPro(prenumeration) && !acceptera_hogre_paslag && !harGjortPlanval(prenumeration)) {
      const publicerade = await räknaJobbDennaMånad(req.användare.id);
      if (publicerade >= GRATIS_PASS_PER_MANAD) {
        return res.status(409).json({
          fel: 'Ni har redan publicerat två pass denna månad',
          kod: 'KRAVER_PLANVAL',
        });
      }
    }

    const sorteradePass = [...pass].sort((a, b) =>
      a.datum === b.datum ? a.starttid.localeCompare(b.starttid) : a.datum.localeCompare(b.datum)
    );
    const { startdatum, slutdatum } = härledPeriod(sorteradePass);

    const schema = await skapaSchema({
      foretag_id: req.användare.id,
      titel: titel.trim(),
      beskrivning: beskrivning.trim(),
      plats: plats.trim(),
      adress: adress.trim(),
      // Valfri. Rollen sätts per pass, och huvudkategorin når aldrig jobbfiltret ändå:
      // hämtaAllaJobb, hämtaJobbFörFöretag och hämtaTidigareJobbFörFöretag i db/jobb.js
      // filtrerar alla bort schemajobb med .is('schema_id', null), och schemalistans eget
      // filter i JobbScreen går bara på stad. Optional chaining är inte kosmetiskt här –
      // utan det kastar raden TypeError och ger 500 så fort ett schema saknar kategori.
      kategori: kategori?.trim() || null,
      typ: typ || 'sommarjobb',
      startdatum,
      slutdatum,
      timlon: Number(timlon),
      // OB bor numera på passet. Kolumnen behålls tom för nya scheman och är kvar för
      // gamla, där den fortfarande ärvs av pass utan eget OB.
      ob_tillagg: [],
    });

    // Annons-jobbet. Det bär schemats ansökningar och därmed chatten, och det är här
    // påslaget fryses när en person godkänns. arbetstider innehåller ALLA pass, så
    // annons-ansökan blir det samlade schemakortet i privatpersonens Mina pass.
    // Påslaget sätts inte nu – det fryses vid godkännandet, precis som för vanliga jobb.
    const annonsJobb = await skapaJobb({
      titel: schema.titel,
      beskrivning: schema.beskrivning,
      plats: schema.plats,
      adress: schema.adress,
      lon: schema.timlon,
      typ: schema.typ,
      kategori: schema.kategori,
      antal_dagar: sorteradePass.length,
      // kategori följer med per dag så att personens PassKort kan visa avdelningen.
      arbetstider: JSON.stringify(
        sorteradePass.map(p => ({
          datum: p.datum,
          start: p.starttid,
          slut: p.sluttid,
          kategori: p.kategori?.trim() || null,
        }))
      ),
      ob_tillagg: [],
      foretag_id: req.användare.id,
      schema_id: schema.id,
    });

    await sättAnnonsJobb(schema.id, annonsJobb.id);

    await skapaSchemaPass(sorteradePass.map(p => ({
      schema_id: schema.id,
      datum: p.datum,
      starttid: p.starttid,
      sluttid: p.sluttid,
      // null = ärv schemats värde. Tom sträng ska aldrig sparas som kategori.
      kategori: p.kategori?.trim() || null,
      // [] betyder medvetet inget OB, null betyder ärv. Skicka bara [] när klienten
      // faktiskt angett en (tom) lista.
      ob_tillagg: Array.isArray(p.ob_tillagg) ? p.ob_tillagg : null,
    })));

    for (const a of (Array.isArray(avdrag) ? avdrag : [])) {
      await skapaAvdrag({
        schema_id: schema.id,
        namn: a.namn,
        belopp: Number(a.belopp),
        typ: a.typ,
      });
    }

    if (acceptera_hogre_paslag && !ärPro(prenumeration) && !harGjortPlanval(prenumeration)) {
      await sättPlanvalGjort(req.användare.id);
    }

    res.status(201).json({ ...schema, annons_jobb_id: annonsJobb.id, antalPass: sorteradePass.length });

    sändJobblistaPing('schema-ny');

    notifieraPrivatpersonerIStad(schema).catch(notisfel =>
      console.error('Notisfel vid nytt schema:', notisfel)
    );
  } catch (fel) {
    console.error('Fel vid skapande av schema:', fel);
    res.status(500).json({ fel: 'Serverfel vid skapande av schema' });
  }
});

// Push till privatpersoner i schemats stad, samma mönster som routes/jobb.js
async function notifieraPrivatpersonerIStad(schema) {
  if (!schema?.plats) return;
  const mottagare = await hämtaPrivatpersonerIStad(schema.plats);
  for (const person of mottagare) {
    await skickaNotifikation(
      person.push_token,
      'Nytt längre uppdrag nära dig',
      `${schema.titel} i ${schema.plats}`
    );
  }
}

// GET /api/scheman — öppna scheman att söka
router.get('/', kräverInloggning, async (req, res) => {
  try {
    const scheman = await hämtaÖppnaScheman();
    res.json(scheman);
  } catch (fel) {
    console.error('Fel vid hämtning av scheman:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av scheman' });
  }
});

// GET /api/scheman/mina — företagets egna scheman
router.get('/mina', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const scheman = await hämtaSchemanFörFöretag(req.användare.id);
    res.json(scheman);
  } catch (fel) {
    console.error('Fel vid hämtning av egna scheman:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av egna scheman' });
  }
});

// GET /api/scheman/mina-pass — privatpersonens kommande schemapass
router.get('/mina-pass', kräverInloggning, kräverTyp('privatperson'), async (req, res) => {
  try {
    const pass = await hämtaSchemaPassFörAnvändare(req.användare.id, idagStockholm());
    res.json(pass);
  } catch (fel) {
    console.error('Fel vid hämtning av schemapass:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av schemapass' });
  }
});

// GET /api/scheman/kategorier — företagets tidigare passkategorier, för autocomplete.
// MÅSTE ligga före GET /:id, annars fångar id-routen den.
router.get('/kategorier', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    res.json(await hämtaEgnaKategorier(req.användare.id));
  } catch (fel) {
    console.error('Fel vid hämtning av kategorier:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av kategorier' });
  }
});

// GET /api/scheman/kalender?from&till — bemanningen per datum för kalendervyn.
// Unionerar schemapass OCH företagets godkända enstaka pass. Utan det senare skulle
// företaget bara se halva sin bemanning i kalendern.
router.get('/kalender', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const { from, till } = req.query;
  if (!DATUM_MÖNSTER.test(from || '') || !DATUM_MÖNSTER.test(till || '')) {
    return res.status(400).json({ fel: 'Ange from och till som YYYY-MM-DD' });
  }

  try {
    const [schemaPass, enstakaPass] = await Promise.all([
      hämtaKalenderPass(req.användare.id, from, till),
      hämtaEnstakaPassFörKalender(req.användare.id, from, till),
    ]);

    const alla = [...schemaPass, ...enstakaPass].sort((a, b) =>
      a.datum === b.datum ? (a.starttid ?? '').localeCompare(b.starttid ?? '') : a.datum.localeCompare(b.datum)
    );
    res.json(alla);
  } catch (fel) {
    console.error('Fel vid hämtning av kalender:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av kalender' });
  }
});

// Företagets godkända enstaka pass i intervallet, plockade ur jobbens arbetstider.
// Schemajobb hoppas över – de kommer via hämtaKalenderPass i stället, med rätt status.
async function hämtaEnstakaPassFörKalender(foretag_id, från, till) {
  const jobb = await hämtaJobbFörFöretag(foretag_id);
  if (!jobb.length) return [];

  const godkända = await hämtaGodkändaFörFleraJobb(jobb.map(j => j.id));
  if (!godkända.length) return [];

  const namn = await hämtaNamnFörAnvändare(godkända.map(a => a.sokande_id));
  const personPerJobb = Object.fromEntries(godkända.map(a => [a.jobb_id, a]));

  const rader = [];
  for (const j of jobb) {
    const person = personPerJobb[j.id];
    if (!person) continue;
    for (const dag of parsaArbetstider(j.arbetstider)) {
      if (!dag?.datum || dag.datum < från || dag.datum > till) continue;
      rader.push({
        datum: dag.datum,
        starttid: dag.start ?? null,
        sluttid: dag.slut ?? null,
        personId: person.sokande_id,
        personNamn: namn[person.sokande_id] ?? null,
        titel: j.Titel ?? null,
        // Måste finnas även här, annars blir de två källorna olika formade och kalenderns
        // gruppering per kategori tappar hälften av bemanningen.
        kategori: j.Kategori ?? null,
        typ: 'pass',
        status: 'planerad',
      });
    }
  }
  return rader;
}

// GET /api/scheman/:id — schema med pass. Ägaren får dessutom sökandelistan.
router.get('/:id', kräverInloggning, async (req, res) => {
  try {
    const schema = await hämtaSchemaViaId(req.params.id);
    if (!schema) return res.status(404).json({ fel: 'Schemat hittades inte' });

    const rådaPass = await hämtaPassFörSchema(schema.id);
    const pass = rådaPass.map(p => passMedArv(schema, p));
    const ärÄgare = String(schema.foretag_id) === String(req.användare.id);

    // Avdragen följer med för alla, inte bara ägaren – den som söker måste se dem först.
    const avdrag = await hämtaAktivaAvdrag(schema.id);

    // Schemats totala längd i timmar, till den som överväger att söka. Räknas HÄR och
    // inte i appen: passTimmar hanterar både pass över midnatt (22:00–06:00 = 8 h, inte
    // −16) och svenska sommartidsskiften, och är exakt samma funktion som
    // cron/schemaTidrapport använder för timmarna som faktiskt betalas ut. Telefonens
    // tidszon behöver inte vara Europe/Stockholm, så en spegling i frontend hade kunnat
    // visa en annan siffra än lönen.
    //
    // Inställda pass räknas inte – de ger aldrig någon tidrapport och ingen lön, samma
    // regel som räknaPassFörSchema. antalPass nedan räknar däremot ALLA pass, oförändrat,
    // så ett schema med inställda pass visar fler pass än timmarna motsvarar.
    //
    // Summan avrundas igen: passTimmar avrundar per pass, och sextio termer flyter annars
    // till 464.99999999999994.
    const totaltTimmar = Math.round(
      pass
        .filter(p => p.status !== 'installt')
        .reduce((sum, p) => sum + passTimmar(p), 0) * 100
    ) / 100;

    const svar = {
      ...schema,
      pass,
      antalPass: pass.length,
      totaltTimmar,
      avdrag,
      // Vanligast först, samma ordning som schemalistan använder.
      kategorier: räknaKategorier(pass),
    };

    if (ärÄgare && schema.annons_jobb_id) {
      svar.ansokningar = await hämtaAnsökningarFörJobb(schema.annons_jobb_id);
    }

    res.json(svar);
  } catch (fel) {
    console.error('Fel vid hämtning av schema:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av schema' });
  }
});

// GET /api/scheman/:id/avdrag — schemats löneavdrag.
// Öppen för alla inloggade med flit: den som funderar på att söka måste kunna se att
// t.ex. 200 kr/dag dras för boende INNAN de ansöker, inte först på tidrapporten.
router.get('/:id/avdrag', kräverInloggning, async (req, res) => {
  try {
    res.json(await hämtaAktivaAvdrag(req.params.id));
  } catch (fel) {
    console.error('Fel vid hämtning av avdrag:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av avdrag' });
  }
});

// POST /api/scheman/:id/pass — lägger till pass i ett redan publicerat schema.
//
// Befintliga pass rörs aldrig här: deras datum och tider är låsta efter publicering. Att
// LÄGGA TILL går däremot även på ett tillsatt schema, och då materialiseras de nya passen
// direkt för den godkända personen.
router.post('/:id/pass', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const { pass } = req.body;

  try {
    const schema = await hämtaSchemaViaId(req.params.id);
    if (!schema) return res.status(404).json({ fel: 'Schemat hittades inte' });
    if (String(schema.foretag_id) !== String(req.användare.id)) {
      return res.status(403).json({ fel: 'Åtkomst nekad' });
    }
    if (schema.status === 'avbrutet') {
      return res.status(409).json({ fel: 'Ett avbrutet schema kan inte ändras' });
    }

    const befintliga = await hämtaPassFörSchema(schema.id);
    const fel = valideraPassLista(pass, befintliga);
    if (fel) return res.status(400).json({ fel });

    await skapaSchemaPass(pass.map(p => ({
      schema_id: schema.id,
      datum: p.datum,
      starttid: p.starttid,
      sluttid: p.sluttid,
      // NULL betyder "ärv schemats värde" – se passMedArv. Tom sträng blir alltså null,
      // inte '', annars ärver passet inte längre.
      kategori: p.kategori?.trim() || null,
      ob_tillagg: p.ob_tillagg ?? null,
      status: 'planerad',
    })));

    // Perioden härleds ur passens datum, precis som vid publicering.
    const allaPass = await hämtaPassFörSchema(schema.id);
    const aktiva = allaPass.filter(p => p.status !== 'installt');
    if (aktiva.length) await sättSchemaPeriod(schema.id, härledPeriod(aktiva));

    const uppdaterat = await hämtaSchemaViaId(schema.id);
    await synkaAnnonsJobb(uppdaterat, allaPass);

    // Är schemat tillsatt ska de nya passen tilldelas samma person direkt. tilldelaSchema
    // är idempotent – hämtaPassAttTilldela plockar bara pass utan ansokan_id, alltså exakt
    // de nyss tillagda. Påslaget som redan är fryst på schemat återanvänds; det får aldrig
    // räknas om, och pass_denna_manad ska inte öka: schemat är redan räknat som ett pass.
    if (uppdaterat.anvandare_id) {
      await tilldelaSchema(schema.id, uppdaterat.anvandare_id, uppdaterat.paslag);
      try {
        const token = await hämtaPushToken(uppdaterat.anvandare_id);
        await skickaNotifikation(
          token,
          'Nya pass i ditt schema',
          `${pass.length} ${pass.length === 1 ? 'nytt pass' : 'nya pass'} har lagts till i "${uppdaterat.titel}".`
        );
      } catch (pushFel) {
        console.error('Kunde inte skicka notis om nya pass:', pushFel);
      }
    }

    res.status(201).json({ antalPass: aktiva.length, tillagda: pass.length });
  } catch (fel) {
    console.error('Fel vid tillägg av schemapass:', fel);
    res.status(500).json({ fel: 'Serverfel vid tillägg av pass' });
  }
});

// DELETE /api/scheman/:id/pass/:passId — ställer in ett kommande pass.
//
// Passet RADERAS aldrig och ansökan inte heller: chattmeddelanden hänger på
// meddelanden.ansokan_id, så en radering skulle slita bort historiken. Samma mönster som
// frigörFramtidaPass använder när någon hoppar av. Ett pass med tidrapport rörs inte alls –
// arbetet är utfört och ska betalas.
router.delete('/:id/pass/:passId', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const schema = await hämtaSchemaViaId(req.params.id);
    if (!schema) return res.status(404).json({ fel: 'Schemat hittades inte' });
    if (String(schema.foretag_id) !== String(req.användare.id)) {
      return res.status(403).json({ fel: 'Åtkomst nekad' });
    }

    const passet = await hämtaPassViaId(req.params.passId);
    if (!passet || String(passet.schema_id) !== String(schema.id)) {
      return res.status(404).json({ fel: 'Passet hittades inte' });
    }
    if (passet.tidrapport_id) {
      return res.status(409).json({ fel: 'Passet är redan rapporterat och kan inte tas bort' });
    }
    if (passet.status !== 'planerad') {
      return res.status(409).json({ fel: 'Bara planerade pass kan tas bort' });
    }

    if (passet.ansokan_id) await uppdateraStatus(passet.ansokan_id, 'avvisad');
    await sättPassInställt(passet.id);

    const allaPass = await hämtaPassFörSchema(schema.id);
    const aktiva = allaPass.filter(p => p.status !== 'installt');
    // Perioden nollas INTE när sista passet ställs in: startdatum/slutdatum är not null,
    // och en period utan pass är ändå meningslös att visa. Annons-jobbet får däremot noll
    // pass via synkaAnnonsJobb, vilket är det som syns för den som söker.
    if (aktiva.length) await sättSchemaPeriod(schema.id, härledPeriod(aktiva));

    await synkaAnnonsJobb(await hämtaSchemaViaId(schema.id), allaPass);

    res.json({ ok: true, antalPass: aktiva.length });
  } catch (fel) {
    console.error('Fel vid borttagning av schemapass:', fel);
    res.status(500).json({ fel: 'Serverfel vid borttagning av pass' });
  }
});

// POST /api/scheman/:id/markera-ansokningar-sedda — nollställer räknaren för nya
// ansökningar på ett schema (anropas när företaget öppnar schemat och ser ansökningarna).
//
// Stämpeln sitter på annons-jobbet, inte på schemat: schemats ansökningar är vanliga rader
// mot den Jobb-raden, så samma markeraAnsökningarSedda som vanliga jobb använder gäller här.
router.post('/:id/markera-ansokningar-sedda', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const schema = await hämtaSchemaViaId(req.params.id);
    if (!schema) return res.status(404).json({ fel: 'Schemat hittades inte' });
    if (String(schema.foretag_id) !== String(req.användare.id)) {
      return res.status(403).json({ fel: 'Åtkomst nekad' });
    }
    // Utan annons kan schemat inte ha några ansökningar – inget att stämpla.
    if (schema.annons_jobb_id) {
      await markeraAnsökningarSedda(schema.annons_jobb_id, req.användare.id);
    }
    res.json({ ok: true });
  } catch (fel) {
    console.error('Fel vid markering av sedda schemaansökningar:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// POST /api/scheman/:id/avdrag — företag lägger till ett löneavdrag
router.post('/:id/avdrag', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const { namn, belopp, typ } = req.body;
  if (!namn || !String(namn).trim()) return res.status(400).json({ fel: 'Namn krävs' });
  if (!(Number(belopp) > 0)) return res.status(400).json({ fel: 'Giltigt belopp krävs' });
  if (typ != null && !AVDRAGSTYPER.includes(typ)) return res.status(400).json({ fel: 'Ogiltig avdragstyp' });

  try {
    const schema = await hämtaSchemaViaId(req.params.id);
    if (!schema) return res.status(404).json({ fel: 'Schemat hittades inte' });
    if (String(schema.foretag_id) !== String(req.användare.id)) {
      return res.status(403).json({ fel: 'Åtkomst nekad' });
    }

    const avdrag = await skapaAvdrag({ schema_id: schema.id, namn, belopp, typ });
    res.status(201).json(avdrag);

    // Är schemat redan tillsatt måste personen få veta direkt. Ett löneavdrag som dyker
    // upp först på tidrapporten är fel ordning – de ska kunna reagera innan de jobbar.
    if (schema.anvandare_id != null) {
      sändRealtidsPing(schema.anvandare_id, 'pass-status');
      (async () => {
        const token = await hämtaPushToken(schema.anvandare_id);
        const enhet = avdrag.typ === 'totalt' ? 'totalt' : 'per pass';
        await skickaNotifikation(
          token,
          'Nytt löneavdrag',
          `${schema.titel}: ${avdrag.namn} ${avdrag.belopp} kr ${enhet} dras från kommande pass.`
        );
      })().catch(console.error);
    }
  } catch (fel) {
    console.error('Fel vid skapande av avdrag:', fel);
    res.status(500).json({ fel: 'Serverfel vid skapande av avdrag' });
  }
});

// DELETE /api/scheman/:id/avdrag/:avdragId — mjuk borttagning.
// Redan skapade tidrapporter bär sin frysta kopia och påverkas aldrig.
router.delete('/:id/avdrag/:avdragId', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const schema = await hämtaSchemaViaId(req.params.id);
    if (!schema) return res.status(404).json({ fel: 'Schemat hittades inte' });
    if (String(schema.foretag_id) !== String(req.användare.id)) {
      return res.status(403).json({ fel: 'Åtkomst nekad' });
    }

    await avaktiveraAvdrag(req.params.avdragId, schema.id);
    res.json({ ok: true });
  } catch (fel) {
    console.error('Fel vid borttagning av avdrag:', fel);
    res.status(500).json({ fel: 'Serverfel vid borttagning av avdrag' });
  }
});

// PATCH /api/scheman/:id/ersatt — företag byter person för schemats framtida pass.
// Den nya personen måste redan ha sökt schemat. Genomförda pass behåller den gamla
// personen, och påslaget är redan fryst så ingen ny debitering sker.
router.patch('/:id/ersatt', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const { ny_anvandare_id } = req.body;
  if (ny_anvandare_id == null) return res.status(400).json({ fel: 'Ny person krävs' });

  try {
    const schema = await hämtaSchemaViaId(req.params.id);
    if (!schema) return res.status(404).json({ fel: 'Schemat hittades inte' });
    if (String(schema.foretag_id) !== String(req.användare.id)) {
      return res.status(403).json({ fel: 'Åtkomst nekad' });
    }
    if (!schema.annons_jobb_id) return res.status(400).json({ fel: 'Schemat saknar annons' });

    const ansökningar = await hämtaAnsökningarFörJobb(schema.annons_jobb_id);
    const nyAnsökan = ansökningar.find(a => String(a.sokande_id) === String(ny_anvandare_id));
    if (!nyAnsökan) {
      return res.status(400).json({ fel: 'Personen har inte sökt det här schemat' });
    }

    const tidigare = ansökningar.filter(a => a.status === 'godkänd' && a.id !== nyAnsökan.id);

    // Frigör den förra personens framtida pass innan den nya tilldelas, annars skulle
    // passen redan ha en godkänd ansökan och hoppas över av tilldelaSchema.
    await frigörFramtidaPass(schema.id);
    for (const a of tidigare) await uppdateraStatus(a.id, 'avvisad');
    await uppdateraStatus(nyAnsökan.id, 'godkänd');

    // Samma frysta påslag som tidigare – ett personbyte får inte ändra ett avtalat pris.
    await tilldelaSchema(schema.id, nyAnsökan.sokande_id, schema.paslag);

    res.json({ ok: true });

    for (const a of tidigare) sändRealtidsPing(a.sokande_id, 'pass-status');
    sändRealtidsPing(nyAnsökan.sokande_id, 'pass-status');

    (async () => {
      const token = await hämtaPushToken(nyAnsökan.sokande_id);
      await skickaNotifikation(token, 'Grattis!', `Du är godkänd för schemat "${schema.titel}"!`);
    })().catch(console.error);
  } catch (fel) {
    console.error('Fel vid byte av person i schema:', fel);
    res.status(500).json({ fel: 'Serverfel vid byte av person' });
  }
});

// POST /api/scheman/:id/hoppa-av — privatpersonen lämnar schemat
router.post('/:id/hoppa-av', kräverInloggning, kräverTyp('privatperson'), async (req, res) => {
  try {
    const schema = await hämtaSchemaViaId(req.params.id);
    if (!schema) return res.status(404).json({ fel: 'Schemat hittades inte' });
    if (String(schema.anvandare_id ?? '') !== String(req.användare.id)) {
      return res.status(403).json({ fel: 'Du är inte tilldelad det här schemat' });
    }

    // Frigör framtida pass och gör schemat sökbart igen. Genomförda pass och deras
    // tidrapporter rörs inte – arbetet är utfört och ska betalas.
    const { harGenomfört, frigjordaAnsökningar } = await återställSchema(schema.id);

    // Har inget pass genomförts blev schemat aldrig av och ska inte förbruka ett
    // gratispass. Samma regel som när företaget tar tillbaka ett godkännande.
    if (!harGenomfört) {
      await minskaPassDennaManad(schema.foretag_id);
      if (schema.annons_jobb_id) await sättJobbPåslag(schema.annons_jobb_id, null);
    }

    // Annons-ansökan sätts tillbaka till väntande så att företaget kan välja en ny person.
    const avhoppade = [...(frigjordaAnsökningar || [])];
    if (schema.annons_jobb_id) {
      const ansökningar = await hämtaAnsökningarFörJobb(schema.annons_jobb_id);
      for (const a of ansökningar) {
        if (String(a.sokande_id) === String(req.användare.id)) {
          await uppdateraStatus(a.id, 'avvisad');
          avhoppade.push(a.id);
        } else if (a.status === 'avvisad') {
          await uppdateraStatus(a.id, 'väntande');
        }
      }
    }

    // Stämplas här och ingen annanstans: statusen är 'avvisad' precis som när företaget
    // nekar någon, och utan stämpeln skulle personen få beskedet "Avvisad" om ett uppdrag
    // hen själv valde att lämna.
    await markeraAvhopp(avhoppade);

    res.json({ ok: true });

    sändRealtidsPing(schema.foretag_id, 'ansokan');
    sändJobblistaPing('schema-ledigt');

    (async () => {
      const token = await hämtaPushToken(schema.foretag_id);
      await skickaNotifikation(
        token,
        'Avhopp från schema',
        `En person har hoppat av schemat "${schema.titel}". Framtida pass är lediga igen.`
      );
    })().catch(console.error);
  } catch (fel) {
    console.error('Fel vid avhopp från schema:', fel);
    res.status(500).json({ fel: 'Serverfel vid avhopp' });
  }
});

// POST /api/scheman/:id/avbryt — företaget ställer in schemat
router.post('/:id/avbryt', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const schema = await hämtaSchemaViaId(req.params.id);
    if (!schema) return res.status(404).json({ fel: 'Schemat hittades inte' });
    if (String(schema.foretag_id) !== String(req.användare.id)) {
      return res.status(403).json({ fel: 'Åtkomst nekad' });
    }

    // ställInPass: framtida pass markeras 'installt' i stället för att bli sökbara igen.
    const { harGenomfört } = await återställSchema(schema.id, { ställInPass: true });

    if (!harGenomfört) {
      const godkända = schema.anvandare_id != null;
      if (godkända) {
        await minskaPassDennaManad(schema.foretag_id);
        if (schema.annons_jobb_id) await sättJobbPåslag(schema.annons_jobb_id, null);
      }
    }

    res.json({ ok: true });

    sändJobblistaPing('schema-borttagen');

    if (schema.anvandare_id != null) {
      sändRealtidsPing(schema.anvandare_id, 'pass-status');
      (async () => {
        const token = await hämtaPushToken(schema.anvandare_id);
        await skickaNotifikation(token, 'Schema inställt', `"${schema.titel}" har ställts in av företaget.`);
      })().catch(console.error);
    }
  } catch (fel) {
    console.error('Fel vid avbrytande av schema:', fel);
    res.status(500).json({ fel: 'Serverfel vid avbrytande av schema' });
  }
});

// PUT /api/scheman/:id — företag redigerar ett ännu inte tillsatt schema
router.put('/:id', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const { titel, beskrivning, plats, adress, kategori, typ, timlon } = req.body;
  if (!titel || !String(titel).trim()) return res.status(400).json({ fel: 'Titel krävs' });
  if (timlon != null && !(Number(timlon) > 0)) return res.status(400).json({ fel: 'Giltig timlön krävs' });
  // Samma GILTIGA_TYPER som POST använder – ingen andra sanning om vilka typer som finns.
  if (typ !== undefined && !GILTIGA_TYPER.includes(typ)) return res.status(400).json({ fel: 'Ogiltig typ' });

  try {
    // Läs timlönen före uppdateringen – jämförelsen efteråt avgör om personen ska notifieras.
    const tidigareTimlon = (await hämtaSchemaViaId(req.params.id))?.timlon;

    // Bara fält som faktiskt skickats uppdateras. Tidigare nollades plats, adress och
    // kategori så fort de utelämnades, vilket gjorde en delvis uppdatering till tyst
    // dataförlust – en redigering av bara titeln raderade adressen.
    const schema = await uppdateraSchema(req.params.id, req.användare.id, {
      titel: titel.trim(),
      ...(beskrivning !== undefined ? { beskrivning: beskrivning?.trim() ?? null } : {}),
      ...(plats !== undefined ? { plats: plats?.trim() ?? null } : {}),
      ...(adress !== undefined ? { adress: adress?.trim() ?? null } : {}),
      ...(kategori !== undefined ? { kategori: kategori?.trim() ?? null } : {}),
      ...(typ !== undefined ? { typ } : {}),
      ...(timlon != null ? { timlon: Number(timlon) } : {}),
    });

    // Inget matchade: schemat finns inte, ägs av någon annan, eller är redan tillsatt.
    if (!schema) {
      const befintligt = await hämtaSchemaViaId(req.params.id);
      if (!befintligt) return res.status(404).json({ fel: 'Schemat hittades inte' });
      if (String(befintligt.foretag_id) !== String(req.användare.id)) {
        return res.status(403).json({ fel: 'Åtkomst nekad' });
      }
      return res.status(409).json({ fel: 'Ett tillsatt schema kan inte redigeras' });
    }

    // Annons-jobbet är en riktig Jobb-rad och det är den som syns i chatten och i
    // personens Mina pass. Utan synkningen låg gamla värden kvar där efter en redigering.
    await synkaAnnonsJobb(schema);

    // En ändrad timlön på ett tillsatt schema ändrar vad någon får betalt för arbete de
    // redan tackat ja till. Det får inte ske tyst.
    if (schema.anvandare_id && timlon != null && Number(timlon) !== Number(tidigareTimlon)) {
      try {
        const token = await hämtaPushToken(schema.anvandare_id);
        await skickaNotifikation(
          token,
          'Timlönen har ändrats',
          `Timlönen för "${schema.titel}" är nu ${Number(timlon).toLocaleString('sv-SE')} kr/tim.`
        );
      } catch (pushFel) {
        // En utebliven notis får aldrig fälla själva redigeringen.
        console.error('Kunde inte skicka notis om ändrad timlön:', pushFel);
      }
    }

    res.json(schema);
  } catch (fel) {
    console.error('Fel vid uppdatering av schema:', fel);
    res.status(500).json({ fel: 'Serverfel vid uppdatering av schema' });
  }
});

module.exports = router;
