const express = require('express');
const { kräverInloggning, kräverTyp } = require('../middleware/auth');
const { skapaJobb, hämtaAllaJobb, hämtaJobbViaId, hämtaJobbFörFöretag, hämtaTidigareJobbFörFöretag, uppdateraJobb, taBortJobb, räknaJobbDennaMånad, markeraAnsökningarSedda } = require('../db/jobb');
const { hämtaGodkändaFörJobb } = require('../db/ansokningar');
const { skickaMeddelande } = require('../db/meddelanden');
const { hämtaPushToken, hämtaPrivatpersonerIStad } = require('../db/användare');
const { hämtaPrenumeration, ärPro, harGjortPlanval, sättPlanvalGjort } = require('../db/prenumeration');
const { GRATIS_PASS_PER_MANAD } = require('../utils/pris');
const { normaliseraKrav, valideraBehorighetsKrav } = require('../utils/behorighet');
const { notifieraOmNyaKrav } = require('../utils/kravNotis');
const { skickaNotifikation } = require('../utils/pushNotifikation');
const { sändJobblistaPing } = require('../realtid');

const router = express.Router();

const GILTIGA_TYPER = ['gig', 'sommarjobb', 'deltid', 'heltid', 'uppdrag'];

// Validerar ett inkommande jobb. Returnerar ett felmeddelande (sträng) om något
// obligatoriskt fält saknas, annars null. Servern är sista försvaret: en tom timlön
// kopieras vidare som 0 till tidrapporten och ger en faktura på 0 kr, så det måste
// stoppas här även om appen redan validerat. Alla fält utom OB-tillägg krävs.
function valideraJobbInput({ titel, beskrivning, typ, plats, adress, lon, kategori, arbetstider, behorighets_krav }) {
  if (!titel || !beskrivning || !typ) return 'Fälten titel, beskrivning och typ krävs';
  if (!GILTIGA_TYPER.includes(typ)) return 'Ogiltig typ';
  if (!plats || !String(plats).trim()) return 'Stad krävs';
  if (!adress || !String(adress).trim()) return 'Adress till arbetsplatsen krävs';
  if (!kategori || !String(kategori).trim()) return 'Kategori krävs';
  if (!arbetstider || !String(arbetstider).trim()) return 'Arbetstider krävs';
  if (lon == null || !(Number(lon) > 0)) return 'Giltig timlön krävs';
  // Behörighetskrav är frivilliga – de flesta jobb har inga – men skickas de måste de
  // hålla formatet, annars går de inte att jämföra mot vad den sökande intygat.
  return valideraBehorighetsKrav(behorighets_krav);
}

// GET /api/jobb — publik, hämtar alla jobb
router.get('/', async (req, res) => {
  try {
    const jobb = await hämtaAllaJobb();
    res.json(jobb);
  } catch (fel) {
    console.error('Fel vid hämtning av jobb:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av jobb' });
  }
});

// GET /api/jobb/mina — hämtar inloggat företags egna jobb
router.get('/mina', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const jobb = await hämtaJobbFörFöretag(req.användare.id, { endastAktiva: true });
    res.json(jobb);
  } catch (fel) {
    console.error('Fel vid hämtning av egna jobb:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av egna jobb' });
  }
});

// GET /api/jobb/mina/tidigare — inloggat företags tidigare pass (jobb med passerade datum)
router.get('/mina/tidigare', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const jobb = await hämtaTidigareJobbFörFöretag(req.användare.id);
    res.json(jobb);
  } catch (fel) {
    console.error('Fel vid hämtning av tidigare jobb:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av tidigare jobb' });
  }
});

// POST /api/jobb/:id/markera-ansokningar-sedda — nollställer räknaren för nya ansökningar
// på ett jobb (anropas när företaget öppnar jobbets ansökningslista)
router.post('/:id/markera-ansokningar-sedda', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    await markeraAnsökningarSedda(req.params.id, req.användare.id);
    res.json({ ok: true });
  } catch (fel) {
    console.error('Fel vid markering av sedda ansökningar:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// GET /api/jobb/:id — publik, hämtar ett specifikt jobb
router.get('/:id', async (req, res) => {
  try {
    const jobb = await hämtaJobbViaId(req.params.id);
    if (!jobb) {
      return res.status(404).json({ fel: 'Jobbet hittades inte' });
    }
    // Ett materialiserat schemapass är ingen annons och ska inte gå att öppna som en.
    // Schemats annons-jobb (schema_pass_id null) får däremot hämtas – det är dit
    // schemaansökningar går.
    if (jobb.schema_pass_id) {
      return res.status(404).json({ fel: 'Jobbet hittades inte' });
    }
    res.json(jobb);
  } catch (fel) {
    console.error('Fel vid hämtning av jobb:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av jobb' });
  }
});

// POST /api/jobb — kräver inloggning som företag
router.post('/', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const { titel, beskrivning, plats, adress, lon, typ, kategori, antal_dagar, arbetstider, ob_tillagg, behorighets_krav, acceptera_hogre_paslag } = req.body;

  const valideringsfel = valideraJobbInput({ titel, beskrivning, typ, plats, adress, lon, kategori, arbetstider, behorighets_krav });
  if (valideringsfel) {
    return res.status(400).json({ fel: valideringsfel });
  }

  try {
    // Varning innan företaget binder upp sig: har de redan publicerat två pass denna
    // månad höjs priset om fler än två faktiskt genomförs. Räknas direkt ur Jobb, så
    // ett borttaget jobb försvinner automatiskt ur räkningen. Pro-företag har inget tak
    // och ska aldrig se planvalet.
    const prenumeration = await hämtaPrenumeration(req.användare.id);

    // Har företaget redan valt att fortsätta utan abonnemang denna månad ska de inte
    // tillfrågas igen – valet gäller resten av månaden.
    if (!ärPro(prenumeration) && !acceptera_hogre_paslag && !harGjortPlanval(prenumeration)) {
      const publicerade = await räknaJobbDennaMånad(req.användare.id);
      if (publicerade >= GRATIS_PASS_PER_MANAD) {
        return res.status(409).json({
          fel: 'Ni har redan publicerat två pass denna månad',
          kod: 'KRAVER_PLANVAL',
        });
      }
    }

    // Påslaget sätts inte här. Det fryses först när en ansökan godkänns – ett pass som
    // aldrig tillsätts ska varken kosta något eller förbruka ett gratispass.
    const jobb = await skapaJobb({
      titel,
      beskrivning,
      plats: plats || null,
      adress: adress.trim(),
      lon: lon || null,
      typ,
      kategori: kategori || null,
      antal_dagar: antal_dagar || null,
      arbetstider: arbetstider?.trim() || null,
      ob_tillagg: Array.isArray(ob_tillagg) ? ob_tillagg : [],
      behorighets_krav: normaliseraKrav(behorighets_krav),
      foretag_id: req.användare.id,
    });

    // Företaget tryckte "Fortsätt utan abonnemang" – kom ihåg valet så att de slipper
    // frågan igen resten av månaden. Registreras först när jobbet faktiskt skapats.
    if (acceptera_hogre_paslag && !ärPro(prenumeration) && !harGjortPlanval(prenumeration)) {
      await sättPlanvalGjort(req.användare.id);
    }

    res.status(201).json(jobb);

    // Realtidssignal till alla privatpersoners jobblista om det nya jobbet
    sändJobblistaPing('jobb-ny');

    // Notifiera privatpersoner i samma stad om det nya jobbet (blockerar inte svaret)
    notifieraPrivatpersonerIStad(jobb).catch((notisfel) =>
      console.error('Notisfel vid nytt jobb:', notisfel)
    );
  } catch (fel) {
    console.error('Fel vid skapande av jobb:', fel);
    res.status(500).json({ fel: 'Serverfel vid skapande av jobb' });
  }
});

// Skickar push-notis till alla privatpersoner i jobbets stad: "Nytt jobb nära dig"
async function notifieraPrivatpersonerIStad(jobb) {
  const stad = jobb?.Plats;
  if (!stad) return;
  const mottagare = await hämtaPrivatpersonerIStad(stad);
  for (const person of mottagare) {
    await skickaNotifikation(
      person.push_token,
      'Nytt jobb nära dig',
      `${jobb.Titel} i ${stad}`
    );
  }
}

// PUT /api/jobb/:id — företag uppdaterar sitt jobb
router.put('/:id', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const { titel, beskrivning, plats, adress, lon, typ, kategori, antal_dagar, arbetstider, ob_tillagg, behorighets_krav } = req.body;

  const valideringsfel = valideraJobbInput({ titel, beskrivning, typ, plats, adress, lon, kategori, arbetstider, behorighets_krav });
  if (valideringsfel) {
    return res.status(400).json({ fel: valideringsfel });
  }

  try {
    // Kravlistan läses FÖRE uppdateringen – jämförelsen efteråt avgör om de som redan
    // sökt måste bekräfta på nytt.
    const tidigareKrav = normaliseraKrav((await hämtaJobbViaId(req.params.id))?.behorighets_krav);

    const jobb = await uppdateraJobb(req.params.id, req.användare.id, {
      titel, beskrivning,
      plats: plats || null,
      adress: adress.trim(),
      lon: lon || null,
      typ,
      kategori: kategori || null,
      antal_dagar: antal_dagar || null,
      arbetstider: arbetstider?.trim() || null,
      ob_tillagg: Array.isArray(ob_tillagg) ? ob_tillagg : [],
      behorighets_krav: normaliseraKrav(behorighets_krav),
    });

    if (!jobb) {
      return res.status(404).json({ fel: 'Jobbet hittades inte eller tillhör inte ditt konto' });
    }

    res.json(jobb);

    // Realtidssignal – en ändring kan flytta jobbet in i eller ut ur den aktiva listan
    sändJobblistaPing('jobb-andrad');

    notifieraOmNyaKrav(jobb.id, jobb.Titel, tidigareKrav, jobb.behorighets_krav);
  } catch (fel) {
    console.error('Fel vid uppdatering av jobb:', fel);
    res.status(500).json({ fel: 'Serverfel vid uppdatering av jobb' });
  }
});

// DELETE /api/jobb/:id — företag tar bort sitt jobb
router.delete('/:id', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const godkända = await hämtaGodkändaFörJobb(req.params.id);
    await taBortJobb(req.params.id, req.användare.id);
    res.json({ ok: true });

    // Realtidssignal till alla privatpersoners jobblista om att jobbet försvunnit
    sändJobblistaPing('jobb-borttagen');

    // Meddela godkända privatpersoner att passet tagits bort
    for (const a of godkända) {
      try {
        await skickaMeddelande({
          ansokan_id: a.id,
          avsandare_id: req.användare.id,
          innehall: 'Passet har tagits bort av företaget.',
        });
        const pushToken = await hämtaPushToken(a.sokande_id);
        await skickaNotifikation(pushToken, 'Pass inställt', 'Ett pass du var godkänd för har tagits bort av företaget.');
      } catch (notisfel) {
        console.error('Notifikationsfel vid borttagning av jobb:', notisfel);
      }
    }
  } catch (fel) {
    console.error('Fel vid borttagning av jobb:', fel);
    res.status(500).json({ fel: 'Serverfel vid borttagning av jobb' });
  }
});

module.exports = router;
