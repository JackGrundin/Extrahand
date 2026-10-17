# FastGig – Webben

Marknadsförings- och kontoingång för FastGig på webben. Samma backend, samma
inloggning och samma designspråk som mobilappen – men ett eget kodträd. I dag är
webben en **publik sajt** (startsida, om oss, kontakt) plus **autentiseringsflödet**
(skapa konto, verifiera e-post, logga in, glömt lösenord). Själva den inloggade
produkten – jobblista, chatt, tidrapporter, scheman osv. – finns ännu bara i appen.

## Tech stack
- **Next.js 14** (App Router, `src/app`), React 18
- **Tailwind CSS 3** för all styling, seedat ur det delade temat (se Designsystem)
- **react-icons** (finns som beroende; sidorna ritar hittills egna SVG:er/CSS i stället)
- Ingen egen databas och ingen server-kod – webben pratar med samma REST-API som
  appen (`api.fastgig.se`) via `src/lib/api.js`
- Deploy: Next-standard (`next build` / `next start`). Backend ligger kvar på Railway.
- Path-alias `@/*` → `src/*` (se `jsconfig.json`)

### API och miljö
- Basadressen läses ur `NEXT_PUBLIC_API_URL` i `src/lib/api.js`, med produktions-
  adressen som fallback. **`/api`-suffixet ingår i variabeln** – alla sökvägar i
  `api`-objektet är relativa (t.ex. `/auth/logga-in`).
- Produktionsvärdet står i den **versionerade** `web/.env`. Kör du mot en lokal
  backend lägger du `NEXT_PUBLIC_API_URL` i `web/.env.local` (gitignorerad).
- `NEXT_PUBLIC`-variabler **inlineas vid byggtid** – `process.env.NEXT_PUBLIC_API_URL`
  måste stå ordagrant (ingen destrukturering), precis som `EXPO_PUBLIC_*` i appen. En
  ändrad `.env.local` slår inte igenom förrän dev-servern startas om.
- Token lagras i **`localStorage`** (appen använder AsyncStorage) under nyckeln `token`.
- Felhanteringen speglar appens `klient.js`: 20 s timeout via `AbortController`,
  nätverksfel normaliseras till `INGEN_ANSLUTNING` med svensk text, och `fetch` kastar
  bara vid nät-/avbrottsfel – ett HTTP-fel behåller serverns eget `fel`-meddelande.
  Ett `401` på ett autentiserat anrop meddelar lyssnare (`lyssnaPåAuthFel`) så att
  `AuthContext` loggar ut centralt.

## Mappstruktur
```
web/
  src/
    app/                  → App Router: en mapp per route + globala layouten
      layout.jsx          → <html>, metadata, viewport, AuthProvider runt allt
      globals.css         → Tailwind-direktiv, typografiskala, animationer
      page.jsx            → Startsidan (/)
      om-oss/page.jsx
      kontakt/page.jsx
      logga-in/page.jsx
      registrera/page.jsx
      verifiera/page.jsx       (?email=… förifyller adressen efter registrering)
      glomt-losenord/page.jsx
    components/
      Toppnav.jsx         → Sticky nav (Hem/Om oss/Kontakt + CTA, mobilmeny)
      Sidfot.jsx          → Enkel sidfot med länkar
      Sida.jsx            → Skal för statiska sidor (nav + titel/ingress + sidfot)
      AuthSkal.jsx        → Skal för auth-sidor (nav + centrerat kort)
      TelefonMockup.jsx   → Dekorativ CSS-telefon i heron (jobblista + chatt)
      ui/                 → Återanvändbara primitiver (speglar appens komponenter)
        Knapp.jsx         → Varianter: primär/sekundär/kontur/fara, storlek normal/liten
        Input.jsx         → Textfält med etikett + FältFel
        FältFel.jsx       → Rött fältfel, null när tomt
        Besked.jsx        → Meddelanderuta: fel/framgång/info, null när tomt
        Kort.jsx          → Baskort med mjuk skugga
    context/
      AuthContext.jsx     → Session i localStorage, återställs via GET /users/profil
    lib/
      api.js              → API-klient (fetch, token, felnormalisering)
    styles/
      tema.js             → Central designpalett (seedar Tailwind)
  public/                 → logotyp.png, favicon.png
  tailwind.config.js      → Läser tema.js
  next.config.js          → reactStrictMode
  .env                    → NEXT_PUBLIC_API_URL (versionerad)
```

## Designsystem
Webben ska se **identisk** ut med mobilappen. Allt utgår från `src/styles/tema.js`,
som speglar `frontend/src/utils/tema.js` i appen. `tailwind.config.js` läser `tema.js`
och exponerar paletten som Tailwind-tokens – ändra en färg/radie/skugga på **båda**
ställena (webbens `tema.js` och appens `tema.js`), annars glider app och webb isär.

- **Palett** (premium-indigo): `primär` `#1d4ed8`, `primär-djup` `#4f46e5`,
  `primär-mjuk`, `accent`, bakgrunder (`bakgrund`/`yta`/`yta-dämpad`), text
  (`text`/`text-dämpad`/`text-svag`), kanter, samt status (`framgång`/`fel`/`varning`/
  `stjärna`). Gradienten `bg-gradient-primär` motsvarar appens `LinearGradient`.
- **Radier**: `rounded-sm` 10px, `md` 14px, `lg` 18px, `pill` 999px.
- **Skuggor**: `shadow-mjuk`, `shadow-lyft`.
- **Typografi** (klasser i `globals.css`, speglar appens `TEXT`): `rubrik-hero`,
  `rubrik-xl`, `rubrik-l`, `rubrik-m`, `överlinje`. Font = systemfont-stack (ingen
  custom font laddas). Rubrikerna krymper på ≤640px.
- **Layout**: innehåll centreras i `max-w-innehåll` (1120px), auth-/statiska sidor i
  smalare behållare. Extra brytpunkt `xs: 380px` för de smalaste telefonerna.
- **Animationer**: `anim-fade-up` + stagger-delays `d-1..d-4`, ren CSS, avstängd vid
  `prefers-reduced-motion`.
- **Stil**: ren, ljus Linear/Stripe-estetik – vita ytor, tunna kanter, diskreta
  skuggor, numrerade funktionsblock utan generiska ikoner.

## Sidor – byggt
- **`/` Startsida** – hero med CTA + CSS-telefonmockup, sektioner för företag och
  privatpersoner, prislista (Gratis / Pro 299 kr), avslutande CTA. Prissiffrorna
  speglar `frontend/src/utils/konstanter.js`.
- **`/om-oss`** – bakgrund, grundare, CTA.
- **`/kontakt`** – e-post (info@fastgig.se).
- **`/logga-in`** – POST `/auth/logga-in`. Hanterar `EMAIL_EJ_VERIFIERAD` (403) genom
  att erbjuda ny kod och skicka vidare till verifiering i stället för rött fel.
- **`/registrera`** – privatperson eller företag (företag har org.nr, fakturauppgifter
  m.m.). Klientvalidering matchar `routes/auth.js`; `MIN_LÖSENORD` = 8 speglar
  `backend/utils/losenord.js`. Loggar inte in direkt – backend svarar
  `{ väntarVerifiering: true }` och användaren skickas till verifieringssteget.
- **`/verifiera`** – anger e-postkod (förifylls via `?email=`), verifierar och loggar
  in. Kan skicka ny kod.
- **`/glomt-losenord`** – POST `/auth/glomt-losenord`. Visar **samma neutrala kvittens**
  oavsett om adressen finns (precis som backend alltid svarar `{ ok: true }`). Själva
  lösenordsbytet sker på en **webbsida som backend serverar** (`routes/aterstallningSida.js`),
  inte här.

### Inloggad företagsdel (route-gruppen `src/app/(app)/`)
Gatas av `(app)/layout.jsx` på inloggning + `användare.typ === 'företag'` (privatpersoner
möts av ett "använd appen"-besked). Skalet är en sidomeny (`components/app/AppSkal.jsx` +
`Sidomeny.jsx`). All data via samma backend som appen; metoderna ligger i `lib/api.js`.
- **`/oversikt`** – dashboard: summeringskort (aktiva annonser, pass att avsluta, nya
  ansökningar, plan), kommande pass, senaste ansökningar, Stripe-returbesked (`?status`).
  "Pass att avsluta" räknas exakt som appens `AttAvslutaContext` och länkar till `/avsluta`.
- **`/avsluta`** – avsluta pass / fyll i jobbade timmar. Listar passen som behöver avslutas
  (samma härledning som dashboarden). "Avsluta pass" slår upp jobbets **godkända** ansökan
  (`ansökningarFörJobb` → `status === 'godkänd'`) och öppnar `AvslutaPassModal` (timmar + OB
  via `OBTilläggRedigerare`). Klienten skickar BARA `{ ansokan_id, timmar, ob_tillagg }` till
  `POST /tidrapporter` (`api.skapaRapport`); backend beräknar alla belopp. Kostnadsraden i
  modalen är en uppskattning, inte facit. 409 = tidrapport finns redan.
- **`/annonser`** – Mina annonser, tre flikar (Pass / Scheman / Historik) med
  `JobbKort`, `SchemaKort` och tidrapportslista.
- **`/publicera/jobb`** – enstaka pass. `valideraJobb`, prispreview, dag-för-dag,
  `PlanvalModal` vid 409 `KRAVER_PLANVAL` (fortsätt gratis / Stripe-checkout).
- **`/publicera/schema`** – fyrstegsflöde (full paritet): grunduppgifter (inkl. **Privat**-
  kryssruta) → kalender-multival + veckodagsgenvägar → per-pass-editor med massredigering →
  löneavdrag. Passlogiken i `utils/schemaPass.js`, urvalsläget (markering XOR öppet pass)
  matchar appen. `privat` följer med i `skapaSchema`-payloaden.
- **`/annonser/jobb/[id]/ansokningar`** och **`/annonser/schema/[id]`** – hantera
  ansökningar (`AnsökningsKort`: godkänn/återta/favorit + "Öppna chatt"). Schemadetaljen
  visar även pass, roller och löneavdrag, en **"Privat"-etikett** och – för privata scheman –
  `InbjudanSektion` (bjud in via e-post + lista inbjudna). `SchemaKort` i `/annonser` har en
  "Privat"-bricka.

### Privata scheman – inbjudna privatpersoner (utanför `(app)`-gruppen)
Invite-vägen låter en inbjuden privatperson se och ansöka på webben. Rutterna ligger
UTANFÖR `(app)` (som gatear till företag) och har egen auth-gate:
- **`/inbjudan/[token]`** – landningssida från mejllänken. `api.hämtaInbjudan(token)` (publik
  `GET /inbjudan/:token`). Inloggad → `/schema/<id>`; utloggad → förhandsvisning + "Skapa
  konto"/"Logga in" som bär `?next=/inbjudan/<token>`.
- **`/schema/[id]`** – privatpersons-schemavy: titel, företag, period, pass, löneavdrag,
  behörighetskrav + **Ansök** (intyga krav via `saknadeKrav` + meddelande →
  `POST /ansokningar/:annonsJobbId`, `api.sökSchema`). Kräver godkänt avtal (sätts i appen) –
  annars 403 `AVTAL_EJ_GODKANT`; nyregistrerade på webben kan behöva godkänna avtalet i appen.
- `?next=`-stöd i `logga-in`, `registrera` och `verifiera` (läst client-side från
  `window.location.search`, ingen Suspense) tar en inbjuden kontolös person
  registrering → verifiering → `/schema/<id>`.
- **`/kalender`** – schemaöversikt (bemanningskalender). `GET /scheman/kalender?from=&till=`
  (schemapass + godkända enstaka pass, inkl. obemannade). `MånadsKalender` har ett LÄSLÄGE
  med rollprickar (tre tillstånd via `rollerFörDag`: ring = saknar person, nedtonad =
  genomfört, fylld = bemannad) vid sidan av flervalsläget. Förklaringsrad + månadssummering
  + dagslista (`grupperaPerKategori`). Hämtar tre månader kring vald månad; refetchar på ping.
- **`/profil`** – skapa/redigera företagsprofil (beskrivning, bransch, stad, hemsida –
  speglar appens `RedigeraProfilScreen`; `PUT /users/profil` accepterar INTE telefonnummer).
  Profilbild via `<input type=file>` → base64 → `POST /users/profil-bild` (backend-proxy till
  Storage, max 3 MB). `AuthContext.uppdateraAnvändare` uppdaterar bilden direkt i sidomenyn.
- **`/meddelanden`** + **`/meddelanden/[ansokanId]`** – inkorg (`företagsKonversationer`) och
  chatt-tråd (`GET/POST /meddelanden/:ansokanId`). Realtid via Supabase Broadcast – se nedan.

### Realtid (Supabase Broadcast)
`lib/supabase.js` speglar appens `supabase.js` (samma projekt-URL + publik anon-nyckel;
`NEXT_PUBLIC_SUPABASE_*`-override med hårdkodad fallback). `context/RealtidsContext.jsx`
(monterad i `(app)/layout.jsx`) prenumererar på `anvandare:<användarens id>`, event `'ny'`;
`useRealtidsPing(cb)` kör cb vid varje signal. Payloaden bär bara en typ-etikett – datan
hämtas via REST. Ingen per-användar-JWT behövs på socketen (bara anon-nyckeln), precis som
i appen. Chatt och kalender refetchar på ping.

Delade utils speglas från appen (ändra på båda ställena, som `tema.js`): `konstanter.js`,
`schemaPass.js` (inkl. `rollerFörDag`/`grupperaPerKategori`), `behorighet.js`,
`svenskaOrter.js`, `datumHelper.js`, `jobbValidering.js`, `schemaValidering.js` (de två
sista importerar `ärGiltigStad` från `utils/stad.js`).

## Återstår
- **Privatpersonens webbvyer** – jobblista/sök, ansökningar, mina pass, profil. Finns bara
  i appen; webben visar "använd appen" för privatkonton.
- **Bestridande/korrigering, betyg, redigera jobb/schema** – avsluta pass (skapa tidrapport)
  finns nu på webben (`/avsluta`), men ett bestritt/korrigerat pass, betygssättning och
  redigering efter publicering görs fortfarande i appen. Chatt-tråden visar bara meddelanden
  (ren text), inte den fulla tidslinjen med tidrapporter/jobbförfrågningar som `ChattScreen`.
- **Återställ lösenord på webben** – görs i dag av backends egen sida; ingen Next-route.
- **Olästmarkeringar i chatten** – inboxen visar senaste meddelandet men ingen oläst-badge
  (ingen read-state-endpoint används ännu).
- **Juridik/övrigt** – villkor, integritetspolicy, cookie-info saknas.

## Konventioner
- Kommentera på svenska, matcha appens kodstil och ordval (`Knapp`, `Besked`,
  `FältFel` osv.).
- `async/await`, inte callbacks.
- Håll det som är delat med appen i synk: temat (`tema.js` ↔ appens `tema.js`),
  priser/konstanter, lösenordslängd, API-kontraktet. Backend är fortsatt sista
  försvaret – klientvalidering är bara snabbare återkoppling.
- `'use client'` krävs i komponenter som använder state/effekter/kontext (nav, auth-
  sidor, context). Statiska sidor (om-oss, kontakt) är server-komponenter med egen
  `metadata`.
