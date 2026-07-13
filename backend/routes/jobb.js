const express = require('express');
const { kräverInloggning, kräverTyp } = require('../middleware/auth');
const { skapaJobb, hämtaAllaJobb, hämtaJobbViaId, hämtaJobbFörFöretag, hämtaTidigareJobbFörFöretag, uppdateraJobb, taBortJobb, räknaJobbDennaMånad } = require('../db/jobb');
const { hämtaGodkändaFörJobb } = require('../db/ansokningar');
const { skickaMeddelande } = require('../db/meddelanden');
const { hämtaPushToken, hämtaPrivatpersonerIStad } = require('../db/användare');
const { hämtaPrenumeration, ärPro, harGjortPlanval, sättPlanvalGjort } = require('../db/prenumeration');
const { GRATIS_PASS_PER_MANAD } = require('../utils/pris');
const { skickaNotifikation } = require('../utils/pushNotifikation');
const { sändJobblistaPing } = require('../realtid');

const router = express.Router();

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

// GET /api/jobb/:id — publik, hämtar ett specifikt jobb
router.get('/:id', async (req, res) => {
  try {
    const jobb = await hämtaJobbViaId(req.params.id);
    if (!jobb) {
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
  const { titel, beskrivning, plats, adress, lon, typ, kategori, antal_dagar, arbetstider, ob_tillagg, acceptera_hogre_paslag } = req.body;

  if (!titel || !beskrivning || !typ) {
    return res.status(400).json({ fel: 'Fälten titel, beskrivning och typ krävs' });
  }
  if (!adress) {
    return res.status(400).json({ fel: 'Adress till arbetsplatsen krävs' });
  }

  const giltiga_typer = ['gig', 'sommarjobb', 'deltid', 'heltid', 'uppdrag'];
  if (!giltiga_typer.includes(typ)) {
    return res.status(400).json({ fel: 'Ogiltig typ' });
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
  const { titel, beskrivning, plats, adress, lon, typ, kategori, antal_dagar, arbetstider, ob_tillagg } = req.body;

  if (!titel || !beskrivning || !typ) {
    return res.status(400).json({ fel: 'Fälten titel, beskrivning och typ krävs' });
  }
  if (!adress) {
    return res.status(400).json({ fel: 'Adress till arbetsplatsen krävs' });
  }

  try {
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
    });

    if (!jobb) {
      return res.status(404).json({ fel: 'Jobbet hittades inte eller tillhör inte ditt konto' });
    }

    res.json(jobb);

    // Realtidssignal – en ändring kan flytta jobbet in i eller ut ur den aktiva listan
    sändJobblistaPing('jobb-andrad');
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
