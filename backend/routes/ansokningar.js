const express = require('express');
const { kräverInloggning, kräverTyp } = require('../middleware/auth');
const { skapaAnsökan, uppdateraIntygande, hämtaAnsökningarFörSökande, hämtaAnsökningarFörJobb, finnsDubblettAnsökan, uppdateraStatus, hämtaAnsökanViaId, avvisaAllaUtomEn, återställAllaFörJobb, hämtaAllaKonversationerFörFöretag, ångraAnsökan, hämtaAnsökanMedJobbInfo, hämtaKonversationMellan, hämtaGrupperadeKonversationer, hämtaGodkändaFörJobb } = require('../db/ansokningar');
const { hämtaPushToken, hämtaAnvändareViaId } = require('../db/användare');
const { hämtaJobbViaId, sättJobbPåslag } = require('../db/jobb');
const { hämtaPrenumeration, gällandePåslag, ökaPassDennaManad, minskaPassDennaManad } = require('../db/prenumeration');
const { tilldelaSchema, räknaTilldelbaraPass, frigörFramtidaPass, återställSchema } = require('../db/schemaTilldelning');
const { normaliseraKrav, saknadeKrav } = require('../utils/behorighet');
const { skickaNotifikation } = require('../utils/pushNotifikation');
const { sändRealtidsPing, sändJobblistaPing } = require('../realtid');

const router = express.Router();

// POST /api/ansokningar/:jobbId — privatperson söker ett jobb
router.post('/:jobbId', kräverInloggning, kräverTyp('privatperson'), async (req, res) => {
  const { jobbId } = req.params;
  const { meddelande, intygade_krav } = req.body;

  try {
    // Materialiserade schemapass söks aldrig direkt – man söker schemat som helhet via
    // dess annons-jobb, och passens ansökningar skapas automatiskt vid godkännandet.
    const jobbet = await hämtaJobbViaId(jobbId);
    if (!jobbet || jobbet.schema_pass_id) {
      return res.status(404).json({ fel: 'Jobbet hittades inte' });
    }

    // Passet är tillsatt om någon redan blivit godkänd – då går det inte längre att söka
    const godkända = await hämtaGodkändaFörJobb(jobbId);
    if (godkända.length > 0) {
      return res.status(409).json({ fel: 'Jobbet är redan tillsatt' });
    }

    const dubblett = await finnsDubblettAnsökan(jobbId, req.användare.id);
    if (dubblett) {
      return res.status(409).json({ fel: 'Du har redan sökt detta jobb' });
    }

    // Behörighetskraven. Spärren sitter här och ingen annanstans: en schemaansökan går mot
    // schemats annons-jobb, alltså genom precis den här routen, så den täcker både enstaka
    // pass och scheman. Förutsätter att synkaAnnonsJobb speglat schemats krav till Jobb.
    const krav = normaliseraKrav(jobbet.behorighets_krav);
    if (saknadeKrav(krav, intygade_krav).length > 0) {
      return res.status(400).json({ fel: 'Du måste intyga att du uppfyller alla behörighetskrav' });
    }

    const ansökan = await skapaAnsökan({
      jobb_id: jobbId,
      sokande_id: req.användare.id,
      meddelande: meddelande || null,
      // Jobbets lista, inte klientens – se skapaAnsökan i db/ansokningar.js.
      intygade_krav: krav,
    });

    res.status(201).json(ansökan);

    try {
      const [jobb, sökande] = await Promise.all([
        hämtaJobbViaId(jobbId),
        hämtaAnvändareViaId(req.användare.id),
      ]);
      const foretagId = jobb?.Foretag_id ?? jobb?.foretag_id;
      // Realtidssignal (utan innehåll) till företaget om den nya ansökan
      sändRealtidsPing(foretagId, 'ansokan');
      const pushToken = await hämtaPushToken(foretagId);
      await skickaNotifikation(pushToken, 'Ny ansökan!', `${sökande?.Namn ?? 'Någon'} har sökt "${jobb?.Titel ?? 'ditt jobb'}"`)
    } catch (notisfel) {
      console.error('Push-notifikation fel:', notisfel);
    }
  } catch (fel) {
    console.error('Fel vid ansökan:', fel);
    res.status(500).json({ fel: 'Serverfel vid ansökan' });
  }
});

// POST /api/ansokningar/:id/intyga — bekräftar krav som tillkommit efter ansökan
//
// Företaget får lägga till krav när som helst. Personens intygande är fryst på ansökan och
// täcker bara de krav som fanns då, så tills hen bekräftar på nytt ser företaget "Kräver ny
// bekräftelse" på sökandekortet.
router.post('/:id/intyga', kräverInloggning, kräverTyp('privatperson'), async (req, res) => {
  try {
    // hämtaAnsökanViaId använder .single() och KASTAR när raden saknas, i stället för att
    // ge null. Utan den här hanteringen blir ett okänt (eller felformat) id ett 500, fast
    // rätt svar är 404. Andra fel ska fortfarande bubbla upp som serverfel.
    let ansökan = null;
    try {
      ansökan = await hämtaAnsökanViaId(req.params.id);
    } catch (uppslagsfel) {
      // PGRST116 = noll rader, 22P02 = ogiltig uuid-syntax.
      if (!['PGRST116', '22P02'].includes(uppslagsfel?.code)) throw uppslagsfel;
    }
    if (!ansökan) return res.status(404).json({ fel: 'Ansökan hittades inte' });
    if (String(ansökan.sokande_id) !== String(req.användare.id)) {
      return res.status(403).json({ fel: 'Åtkomst nekad' });
    }
    if (ansökan.status === 'avvisad') {
      return res.status(409).json({ fel: 'Ansökan är inte längre aktiv' });
    }

    const jobbet = await hämtaJobbViaId(ansökan.jobb_id);
    if (!jobbet) return res.status(404).json({ fel: 'Jobbet hittades inte' });

    const krav = normaliseraKrav(jobbet.behorighets_krav);
    if (saknadeKrav(krav, req.body?.intygade_krav).length > 0) {
      return res.status(400).json({ fel: 'Du måste intyga att du uppfyller alla behörighetskrav' });
    }

    await uppdateraIntygande(ansökan.id, krav);
    res.json({ ok: true });

    // Företagets vy uppdateras direkt – brickan är härledd ur saknadeKrav.
    sändRealtidsPing(jobbet.Foretag_id ?? jobbet.foretag_id, 'ansokan');
  } catch (fel) {
    console.error('Fel vid intygande av behörighetskrav:', fel);
    res.status(500).json({ fel: 'Serverfel vid intygande' });
  }
});

// GET /api/ansokningar/mina — privatperson ser sina egna ansökningar
router.get('/mina', kräverInloggning, kräverTyp('privatperson'), async (req, res) => {
  try {
    const ansökningar = await hämtaAnsökningarFörSökande(req.användare.id);
    res.json(ansökningar);
  } catch (fel) {
    console.error('Fel vid hämtning av ansökningar:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av ansökningar' });
  }
});

// GET /api/ansokningar/foretag — hämtar alla konversationer för inloggat företag
router.get('/foretag', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const konversationer = await hämtaAllaKonversationerFörFöretag(req.användare.id);
    res.json(konversationer);
  } catch (fel) {
    console.error('Fel vid hämtning av konversationer:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// GET /api/ansokningar/konversationer — konversationer grupperade per motpart (företag eller privatperson)
router.get('/konversationer', kräverInloggning, async (req, res) => {
  try {
    const ärFöretag = req.användare.typ === 'företag';
    const konversationer = await hämtaGrupperadeKonversationer(req.användare.id, ärFöretag);
    res.json(konversationer);
  } catch (fel) {
    console.error('Fel vid hämtning av grupperade konversationer:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av konversationer' });
  }
});

// GET /api/ansokningar/konversation/:medAnvandareId — all chattinfo mellan inloggad och motpart
router.get('/konversation/:medAnvandareId', kräverInloggning, async (req, res) => {
  try {
    const ärFöretag = req.användare.typ === 'företag';
    const motpartId = Number(req.params.medAnvandareId);
    const företagId = ärFöretag ? req.användare.id : motpartId;
    const privatpersonId = ärFöretag ? motpartId : req.användare.id;
    const data = await hämtaKonversationMellan(företagId, privatpersonId, motpartId);
    res.json(data);
  } catch (fel) {
    console.error('Fel vid hämtning av konversation:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av konversation' });
  }
});

// GET /api/ansokningar/jobb/:jobbId — företag ser ansökningar på sitt jobb
router.get('/jobb/:jobbId', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  try {
    const ansökningar = await hämtaAnsökningarFörJobb(req.params.jobbId);
    res.json(ansökningar);
  } catch (fel) {
    console.error('Fel vid hämtning av ansökningar:', fel);
    res.status(500).json({ fel: 'Serverfel vid hämtning av ansökningar' });
  }
});

// PATCH /api/ansokningar/:id/status — företag godkänner eller återkallar godkännande
router.patch('/:id/status', kräverInloggning, kräverTyp('företag'), async (req, res) => {
  const { status } = req.body;
  if (!['godkänd', 'väntande'].includes(status)) {
    return res.status(400).json({ fel: 'Ogiltigt status' });
  }
  try {
    const ansökan = await hämtaAnsökanViaId(req.params.id);

    // Var passet redan tillsatt innan den här ändringen? Avgör om räknaren ska röras.
    // Ett jobb är ett pass och räknas en enda gång – byter företaget godkänd person på
    // ett redan tillsatt jobb är det inte ett nytt pass.
    const godkändaFöre = await hämtaGodkändaFörJobb(ansökan.jobb_id);

    // Gäller ansökan ett helt schema? Schemats annons-jobb har schema_id men inget
    // schema_pass_id. Hela påslags- och räknarlogiken nedan är oförändrad och gör redan
    // rätt för ett schema: ett schema = ett pass mot gratisgränsen.
    const jobb = await hämtaJobbViaId(ansökan.jobb_id);
    const ärSchemaAnnons = !!(jobb?.schema_id && !jobb.schema_pass_id);

    // Berörda sökande (utöver den vars status ändras direkt) att signalera om
    let övrigaBerörda = [];
    if (status === 'godkänd') {
      // Ett schema ligger kvar som sökbart tills det tillsätts eller avbryts – aldrig för
      // att ett datum passerat. Har varje pass hunnit ta slut går schemat inte att bemanna:
      // tilldelaSchema skulle ställa in samtliga pass, personen få en tom bekräftelse och
      // företaget ändå förbruka ett pass av gratisgränsen. Avbryt före varje sidoeffekt.
      //
      // Bara vid FÖRSTA godkännandet. Byter företaget person på ett redan tillsatt schema
      // ligger passen kvar på den förra personen (ansokan_id satt), så räkningen vore noll
      // och ett fullt legitimt byte skulle blockeras. Ett byte ökar inte heller räknaren.
      if (ärSchemaAnnons && godkändaFöre.length === 0) {
        if ((await räknaTilldelbaraPass(jobb.schema_id)) === 0) {
          return res.status(409).json({
            fel: 'Schemat har inga pass kvar som kan bemannas. Lägg till nya pass eller avbryt schemat.',
            kod: 'SCHEMA_UTAN_PASS',
          });
        }
      }

      await uppdateraStatus(req.params.id, 'godkänd');
      övrigaBerörda = await avvisaAllaUtomEn(ansökan.jobb_id, req.params.id);

      // Påslaget som ska gälla: nyfryst vid första godkännandet, annars det som redan
      // ligger på jobbet (byte av person ska inte kunna ändra ett avtalat pris).
      let påslag = jobb?.paslag ?? null;

      if (godkändaFöre.length === 0) {
        // Passet är nu genomfört-att-bli och räknas mot månadens gräns. Påslaget avgörs
        // FÖRE inkrementet: pass 1 och 2 får 20 %, pass 3 och framåt 40 %. Det fryses på
        // jobbet och följer sedan med till tidrapporten och fakturan.
        const företag = await hämtaPrenumeration(req.användare.id);
        påslag = gällandePåslag(företag);
        await sättJobbPåslag(ansökan.jobb_id, påslag);
        await ökaPassDennaManad(req.användare.id);
      }

      if (ärSchemaAnnons) {
        // Byter företaget person på ett redan tillsatt schema måste den förra personens
        // framtida pass frigöras först. Genomförda pass rörs inte.
        if (godkändaFöre.length > 0) await frigörFramtidaPass(jobb.schema_id);
        await tilldelaSchema(jobb.schema_id, ansökan.sokande_id, påslag);
      }
    } else {
      övrigaBerörda = await återställAllaFörJobb(ansökan.jobb_id);

      if (godkändaFöre.length > 0) {
        // Godkännandet togs tillbaka – passet blev aldrig av och ska inte förbruka ett
        // gratispass. Påslaget nollas så att det sätts om vid ett nytt godkännande.
        //
        // För ett schema gäller det bara om INGET pass hunnit genomföras. Har personen
        // redan jobbat en dag är passet av och ska faktureras som avtalat.
        let skaNollas = true;
        if (ärSchemaAnnons) {
          const { harGenomfört } = await återställSchema(jobb.schema_id);
          skaNollas = !harGenomfört;
        }
        if (skaNollas) {
          await minskaPassDennaManad(req.användare.id);
          await sättJobbPåslag(ansökan.jobb_id, null);
        }
      }
    }

    res.json({ ok: true });

    // Realtidssignal (utan innehåll) om passets statusändring till alla berörda sökande
    const berörda = new Set([ansökan.sokande_id, ...övrigaBerörda].filter(Boolean));
    for (const sokandeId of berörda) sändRealtidsPing(sokandeId, 'pass-status');

    // Signalera företaget så att dess "Mina jobb"-lista uppdateras direkt vid statusändring
    sändRealtidsPing(req.användare.id, 'ansokan');

    // Jobbet döljs vid godkännande och dyker upp igen när godkännandet ångras – signalera
    // den delade jobblista-kanalen så att alla privatpersoners lista uppdateras direkt.
    sändJobblistaPing(status === 'godkänd' ? 'jobb-tillsatt' : 'jobb-ledigt');

    if (status === 'godkänd') {
      try {
        const pushToken = await hämtaPushToken(ansökan.sokande_id);
        const jobbTitel = jobb?.Titel ?? 'jobbet';
        await skickaNotifikation(
          pushToken,
          'Grattis!',
          ärSchemaAnnons
            ? `Du är godkänd för hela schemat "${jobbTitel}"!`
            : `Din ansökan till "${jobbTitel}" har godkänts!`
        );
      } catch (notisfel) {
        console.error('Push-notifikation fel:', notisfel);
      }
    }
  } catch (fel) {
    console.error('Status fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// GET /api/ansokningar/:id/detaljer — hämtar ansökan med jobbinfo (tillgänglig för båda parter)
router.get('/:id/detaljer', kräverInloggning, async (req, res) => {
  try {
    const ansökan = await hämtaAnsökanMedJobbInfo(req.params.id);
    if (!ansökan) return res.status(404).json({ fel: 'Ansökan hittades inte' });

    const harTillgång = req.användare.id === ansökan.sokande_id || req.användare.id === ansökan.foretagId;
    if (!harTillgång) return res.status(403).json({ fel: 'Åtkomst nekad' });

    res.json(ansökan);
  } catch (fel) {
    console.error('Ansökan detaljer fel:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

// DELETE /api/ansokningar/:id — privatperson ångrar en väntande ansökan
router.delete('/:id', kräverInloggning, kräverTyp('privatperson'), async (req, res) => {
  try {
    const borttagna = await ångraAnsökan(req.params.id, req.användare.id);
    res.json({ ok: true });

    // Signalera företaget så att dess "Mina jobb"-lista uppdateras direkt när en väntande
    // ansökan tas tillbaka. Bara om en rad faktiskt togs bort (rätt ägare och väntande).
    if (borttagna.length > 0) {
      try {
        const jobb = await hämtaJobbViaId(borttagna[0].jobb_id);
        sändRealtidsPing(jobb?.Foretag_id ?? jobb?.foretag_id, 'ansokan');
      } catch (pingfel) {
        console.error('Realtidsping vid ångra ansökan misslyckades:', pingfel);
      }
    }
  } catch (fel) {
    console.error('Fel vid ångra ansökan:', fel);
    res.status(500).json({ fel: 'Serverfel vid ångra ansökan' });
  }
});


module.exports = router;
