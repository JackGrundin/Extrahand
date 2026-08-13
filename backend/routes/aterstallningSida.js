const express = require('express');
const { MIN_LÖSENORD_LÄNGD } = require('../utils/losenord');

const router = express.Router();

// Webbsidan som återställningslänken i mejlet öppnar. Den ligger på backendens egen
// värd (inte i appen) eftersom appen saknar deep link-schema, och för att länken då
// fungerar likadant oavsett om mejlet öppnas i telefonen eller på en dator.
//
// Sidan skickar sitt formulär till POST /api/auth/aterstall-losenord med JSON via
// fetch. Därför behövs ingen express.urlencoded-middleware, och all validering och
// tokenhantering bor kvar i routes/auth.js.

// Token kommer från query-strängen och ekas in i sidans script-tagg. Våra tokens är
// alltid hex, så allt annat kastas – då kan en preparerad länk varken bryta ut ur
// strängen eller stänga script-taggen. Ett tomt resultat ger samma felmeddelande som
// en utgången länk.
function rensaToken(rå) {
  const text = String(rå ?? '');
  return /^[a-f0-9]{1,128}$/i.test(text) ? text : '';
}

router.get('/aterstall-losenord', (req, res) => {
  const token = rensaToken(req.query.token);

  res.type('html').send(`<!doctype html>
<html lang="sv">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Återställ lösenord – FastGig</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
             font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
             background: #f8fafc; color: #1a1a1a; padding: 24px; }
      .kort { background: #fff; border-radius: 16px; padding: 32px; max-width: 400px; width: 100%;
              box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
      h1 { margin: 0 0 4px; font-size: 26px; color: #2563eb; text-align: center; }
      .underrubrik { margin: 0 0 24px; color: #64748b; text-align: center; font-size: 15px; }
      label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; }
      input { width: 100%; border: 1px solid #ddd; border-radius: 10px; padding: 13px 14px;
              font-size: 16px; margin-bottom: 14px; font-family: inherit; }
      input:focus { outline: none; border-color: #2563eb; }
      button { width: 100%; background: #2563eb; color: #fff; border: 0; border-radius: 10px;
               padding: 15px; font-size: 16px; font-weight: 600; cursor: pointer; font-family: inherit; }
      button:disabled { background: #93c5fd; cursor: default; }
      .fel { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 10px;
             padding: 12px 14px; font-size: 14px; margin-bottom: 16px; line-height: 1.4; }
      .klar { text-align: center; }
      .klar .ikon { font-size: 44px; margin-bottom: 12px; }
      .klar p { color: #64748b; line-height: 1.5; margin: 0; }
      .dold { display: none; }
      .hjälptext { font-size: 13px; color: #94a3b8; margin: 0 0 18px; }
    </style>
  </head>
  <body>
    <div class="kort">
      <h1>FastGig</h1>

      <div id="formulär">
        <p class="underrubrik">Välj ett nytt lösenord</p>
        <div id="fel" class="fel dold"></div>
        <label for="losenord">Nytt lösenord</label>
        <input id="losenord" type="password" autocomplete="new-password" />
        <label for="upprepa">Upprepa lösenord</label>
        <input id="upprepa" type="password" autocomplete="new-password" />
        <p class="hjälptext">Minst ${MIN_LÖSENORD_LÄNGD} tecken.</p>
        <button id="spara" type="button">Spara nytt lösenord</button>
      </div>

      <div id="klar" class="klar dold">
        <div class="ikon">✅</div>
        <p>Ditt lösenord är ändrat.<br />Du kan nu logga in i FastGig-appen med ditt nya lösenord.</p>
      </div>
    </div>

    <script>
      var token = ${JSON.stringify(token)};
      var felRuta = document.getElementById('fel');
      var knapp = document.getElementById('spara');

      function visaFel(text) {
        felRuta.textContent = text;
        felRuta.classList.remove('dold');
      }

      knapp.addEventListener('click', async function () {
        var lösenord = document.getElementById('losenord').value;
        var upprepa = document.getElementById('upprepa').value;

        felRuta.classList.add('dold');

        if (!token) return visaFel('Återställningslänken är ogiltig. Begär en ny i appen.');
        if (lösenord.length < ${MIN_LÖSENORD_LÄNGD}) {
          return visaFel('Lösenordet måste vara minst ${MIN_LÖSENORD_LÄNGD} tecken.');
        }
        if (lösenord !== upprepa) return visaFel('Lösenorden matchar inte.');

        knapp.disabled = true;
        knapp.textContent = 'Sparar...';
        try {
          var svar = await fetch('/api/auth/aterstall-losenord', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token, 'lösenord': lösenord }),
          });
          var data = await svar.json().catch(function () { return null; });
          if (!svar.ok) throw new Error((data && data.fel) || 'Något gick fel. Försök igen.');

          document.getElementById('formulär').classList.add('dold');
          document.getElementById('klar').classList.remove('dold');
        } catch (fel) {
          visaFel(fel.message);
          knapp.disabled = false;
          knapp.textContent = 'Spara nytt lösenord';
        }
      });
    </script>
  </body>
</html>`);
});

module.exports = router;
