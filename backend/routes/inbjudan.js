// Löser in en inbjudningstoken till ett schema. Anropas av webbappens /inbjudan/[token].
// Validerar token via dess SHA-256-hash. Är anroparen inloggad stämplas inbjudan som
// accepterad och kopplas till kontot (om det saknades). Svaret innehåller schemaId så
// webben kan skicka personen vidare till schemavyn.
const express = require('express');
const jwt = require('jsonwebtoken');
const { JWT_HEMLIG_NYCKEL } = require('../utils/jwt');
const { hashaToken, hämtaInbjudanViaTokenHash, markeraAccepterad } = require('../db/schemaInbjudan');
const { hämtaSchemaViaId } = require('../db/scheman');
const { hämtaNamnFörAnvändare } = require('../db/ansokningar');

const router = express.Router();

// Token saneras till hex innan den används som uppslagsnyckel – samma princip som
// återställningssidan, så inget oväntat kan nå databasen.
function rensaToken(token) {
  return String(token ?? '').replace(/[^a-f0-9]/gi, '').slice(0, 128);
}

// Inbjudningslänken fungerar både utloggad (ny användare på väg till registrering) och
// inloggad. Därför ingen kräverInloggning – men om en giltig token finns i headern läser vi
// användaren själva för att kunna stämpla inbjudan som accepterad.
function läsAnvändareValfritt(req) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_HEMLIG_NYCKEL);
  } catch {
    return null;
  }
}

router.get('/:token', async (req, res) => {
  const tokenHash = hashaToken(rensaToken(req.params.token));
  try {
    const inbjudan = await hämtaInbjudanViaTokenHash(tokenHash);
    if (!inbjudan) return res.status(404).json({ fel: 'Inbjudan hittades inte' });

    const schema = await hämtaSchemaViaId(inbjudan.schema_id);
    if (!schema) return res.status(404).json({ fel: 'Schemat hittades inte' });

    const användare = läsAnvändareValfritt(req);
    if (användare?.id) {
      // Idempotent – skriver inte över en tidigare accepterad_at.
      await markeraAccepterad(inbjudan.id, användare.id);
    }

    const företagNamn = (await hämtaNamnFörAnvändare([schema.foretag_id]))[schema.foretag_id] || null;
    res.json({ schemaId: schema.id, titel: schema.titel, företagNamn });
  } catch (fel) {
    console.error('Fel vid uppslag av inbjudan:', fel);
    res.status(500).json({ fel: 'Serverfel' });
  }
});

module.exports = router;
