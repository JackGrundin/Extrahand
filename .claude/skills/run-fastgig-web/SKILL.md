---
name: run-fastgig-web
description: Kör, starta och skärmdumpa FastGig-appen automatiserat genom att bygga den som webb (expo start --web) och driva den med Playwright. Använd när du vill se en ändring fungera i den riktiga appen, klicka igenom ett flöde, ta skärmbilder eller verifiera UI visuellt utan simulator.
---

# Kör FastGig-appen (webbmålet)

Maskinen har varken Xcode eller Android-SDK, så **webbmålet är enda sättet att köra
appen automatiserat**. React Native Web renderar riktiga DOM-noder, så texter och
placeholders från JSX:en fungerar direkt som Playwright-selektorer.

Appen drivs av `.claude/skills/run-fastgig-web/driver.mjs` – en REPL som läser kommandon
från stdin. Alla sökvägar nedan är relativa till repo-roten.

Appen pratar med backend, så **båda måste köra**: `backend` på 3999 och Expo på 8082.

## Engångsuppsättning

Playwright ligger i skill-katalogen med egen `package.json` – projektets beroenden
påverkas inte, och `node_modules/` är gitignorerad.

```bash
cd .claude/skills/run-fastgig-web && npm install && npx playwright install chromium
```

## Starta (agentvägen)

### 1. Peka appen mot lokal backend

`API_URL` i `frontend/src/api/klient.js` är hårdkodad mot produktion. Den **måste**
pekas om, annars testar du mot Railway och ser inte dina lokala ändringar:

```bash
sed -i '' "s|^const API_URL = 'https://api.fastgig.se/api';|const API_URL = 'http://localhost:3999/api';|" frontend/src/api/klient.js
```

⚠️ **Detta är en ändring i produktionskod.** Återställ den innan du committar – se
Avsluta nedan. `git status` ska vara ren när du är klar.

### 2. Starta backend och Expo

```bash
cd backend && (PORT=3999 node server.js > /tmp/fastgig-api.log 2>&1 &)
cd frontend && (npx expo start --web --port 8082 > /tmp/fastgig-expo.log 2>&1 &)
sleep 50
curl -s -o /dev/null -w "api=%{http_code} " http://localhost:3999/api/health
curl -s -o /dev/null -w "web=%{http_code}\n" http://localhost:8082
```

Förväntat: `api=200 web=200`. Metro tar ~45 s första gången (~950 moduler).

### 3. Skapa testkonton

Registrering ensam räcker inte – inloggning kräver verifierad mejl, och ansökan kräver
godkänt avtal. Båda flaggorna sätts direkt i databasen:

```bash
cd backend && node -e "
require('dotenv').config({quiet:true});
const { createClient } = require('@supabase/supabase-js'); const ws=require('ws');
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { realtime:{transport:ws} });
const post=(v,k)=>fetch('http://localhost:3999/api'+v,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(k)}).then(r=>r.status);
(async()=>{
  console.log('ftg:', await post('/auth/registrera',{namn:'UITEST Företag AB',email:'uitest-ftg@example.invalid','lösenord':'Testlosen123',typ:'företag',organisationsnummer:'556000-0000',fakturaadress:'Testgatan 1',postnummer:'11122',ort:'Stockholm',fakturamail:'uitest-ftg@example.invalid',referensperson:'Test'}));
  console.log('priv:', await post('/auth/registrera',{namn:'UITEST Person',email:'uitest-priv@example.invalid','lösenord':'Testlosen123',typ:'privatperson'}));
  await s.from('användare').update({ email_verifierad:true, avtal_godkant:true }).ilike('Email','uitest-%@example.invalid');
  process.exit(0);
})();
"
```

### 4. Driv appen

```bash
node .claude/skills/run-fastgig-web/driver.mjs <<'EOF'
login uitest-priv@example.invalid Testlosen123
text Lediga jobb 260
click UITEST Lagerarbete
ss 01-detalj
text Behörighetskrav 200
quit
EOF
```

Varje rad svarar `OK <kommando>` eller `FEL <kommando>: <orsak>`, och sist skrivs
`SIDFEL:` med eventuella JS-fel från sidan. Skärmbilder hamnar i `skott/`.

**Titta på skärmbilden med Read-verktyget.** En tom eller vit bild betyder att appen inte
startade – `OK ss` säger bara att filen skrevs.

| Kommando | Gör |
|---|---|
| `goto [url]` | Laddar appen (default `http://localhost:8082`) |
| `login <email> <lösen>` | Laddar + loggar in |
| `click <text>` | Klickar på **första** elementet med exakt den texten |
| `clicklast <text>` | Klickar på **sista** – flikfältet dubblerar ofta texter |
| `fill <placeholder> = <text>` | Skriver i fältet med den placeholdern |
| `text [nyckelord] [antal]` | Dumpar synlig text, ev. från och med ett nyckelord |
| `ss <namn>` / `ssfull <namn>` | Skärmbild till `skott/<namn>.png` (vyport / hela sidan) |
| `wait <ms>` | Paus |

Miljövariabler: `FASTGIG_WEB_URL`, `FASTGIG_SKOTT`, `FASTGIG_RITPAUS`.

## Avsluta – gör alltid detta

```bash
pkill -f "node server.js"; pkill -f "expo start"
cd backend && node -e "
require('dotenv').config({quiet:true});
const { createClient } = require('@supabase/supabase-js'); const ws=require('ws');
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { realtime:{transport:ws} });
(async()=>{
  const { data: jobb } = await s.from('Jobb').select('id').ilike('Titel','UITEST%');
  for (const j of jobb || []) await s.from('ansokningar').delete().eq('jobb_id', j.id);
  await s.from('Jobb').delete().ilike('Titel','UITEST%');
  await s.from('användare').delete().ilike('Email','uitest-%@example.invalid');
  console.log('testdata borttagen');
  process.exit(0);
})();
"
cd .. && git checkout frontend/src/api/klient.js && git status --short
```

Databasen är **produktionsdatabasen** – det finns ingen separat testinstans. Därför
`UITEST`-prefixet på allt du skapar, och därför är upprensningen obligatorisk.

## Gotchas

- **Datumväljaren fungerar inte på webb.** `@react-native-community/datetimepicker` har
  ingen webbimplementation, så knappen "Datum" i publiceringsformuläret gör ingenting.
  Jobb och scheman går därför **inte** att publicera genom formuläret här – seeda dem via
  `POST /api/jobb` i stället. Allt annat i formuläret går att fylla i och fotografera.
- **`dotenv` skriver en banner till stdout.** `FTG=$(node -e "require('dotenv').config();…")`
  fångar bannern tillsammans med tokenet. Bannern innehåller `◇`, och en
  `Authorization`-header med icke-ASCII får Node att avvisa hela requesten med ett naket
  `HTTP/1.1 400` utan body – vilket ser ut som ett valideringsfel i din egen kod. Använd
  `config({quiet:true})` och/eller `| grep '^TOKEN=' | cut -d= -f2`.
- **Supabase-klienten kräver `ws` på Node 20.** Utan
  `createClient(url, key, { realtime: { transport: ws } })` kastar den
  "Node.js 20 detected without native WebSocket support" redan vid `createClient`.
- **Kolumnnamnen i `användare` är versalstartade**: `Typ`, `Email`, `Namn`, `Lösenord`.
  `.eq('typ', …)` ger "column does not exist".
- **`networkidle` betyder inte klart.** Hela trädet monteras i JS efteråt. Drivern har
  därför en fast paus (`FASTGIG_RITPAUS`, 3500 ms) efter varje navigering. Tar du bort den
  missar selektorerna konsekvent.
- **Texter dubbleras av flikfältet.** "Ansökningar" och "Publicera" finns både som flik och
  som rubrik/knapp. Använd `clicklast` för flikar, `click` för innehåll.
- **Port 8082, inte 8081.** Metro tar 8081 om en annan Expo-instans redan kör.
- **Rätt placeholder spelar roll.** Kör `text` först och läs av vad som faktiskt står –
  timlönefältet säger t.ex. `t.ex. 160`, inte `t.ex. 150`.

## Troubleshooting

| Symptom | Orsak och fix |
|---|---|
| `xcrun: error: unable to find utility "simctl"` | Bara Command Line Tools installerat, ingen full Xcode. Simulatorvägen finns inte – använd den här skillen. |
| `FEL click X: Timeout … waiting for getByText` | Elementet finns inte, eller texten är inte exakt. Kör `text <nyckelord> 400` och läs av den verkliga strängen. |
| Bara inloggningsskärmen syns efter `login` | Fel lösenord, eller `email_verifierad` är false. Kör steg 3 igen. |
| `Ingen internetanslutning` i appen | Backend körs inte, eller `API_URL` pekar fortfarande mot produktion. Kolla steg 1 och 2. |
| `web=000` från curl | Metro har inte bundlat klart. `tail /tmp/fastgig-expo.log` och vänta på `Web Bundled`. |
| `Cannot find package 'playwright'` | Engångsuppsättningen är inte körd, eller så kör du drivern från fel katalog. Kör den från repo-roten. |
