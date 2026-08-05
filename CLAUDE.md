# FastGig – App för flexibla jobb och uppdrag

## Vad appen gör
Plattform som kopplar samman företag och privatpersoner för kortare jobbpass och längre uppdrag. Företag publicerar jobb med datum, tider, adress, timlön och OB-tillägg. Privatpersoner ansöker, chattar med företag och får betyg efter avslutat pass. Det finns även en schemafunktion för längre uppdrag som sommarjobb och säsongsarbete.

## Viktiga detaljer
- Alla fält i jobbformuläret är obligatoriska utom OB-tillägg (titel, beskrivning, kategori, stad, adress, timlön, antal dagar, datum+tider per dag). Delad validering i frontend/src/utils/jobbValidering.js (valideraJobb) + inline-fel via components/FältFel.js. Backend är sista försvaret: routes/jobb.js valideraJobbInput körs i både POST och PUT och avvisar bl.a. tom/0 timlön med 400 – annars ger jobbet en tidrapport på 0 kr
- Admin-vy tillgänglig för info@fastgig.se med flikar: Tidrapporter, Avtal, Företag, Fakturering
- Faktureringspris beräknas: timlön + timlön*0.32 + timlön*0.06 + ((timlön*1.32) + (timlön*1.32*0.06)) * påslag
- OB-fakturering: samma formel med ob_belopp i stället för timlön
- Påslaget är 0.20 (Pro-kunder + gratiskontonas två första pass per månad) eller 0.40 (från 3:e passet). Formeln bor i backend/utils/pris.js och speglas i frontend/src/utils/konstanter.js – ändra alltid på båda ställena
- Påslaget FRYSES på jobbet (Jobb.paslag) när en ansökan GODKÄNNS – inte vid publicering – och kopieras sedan till tidrapporten. Tas godkännandet tillbaka nollas påslaget och räknaren minskas: ett pass som aldrig blev av ska inte kosta något. Jobb utan påslag faktureras med 40%
- Två skilda storheter: pass_denna_manad räknar GENOMFÖRDA (godkända) pass och styr påslaget, medan popupen vid publicering styrs av antalet jobb företaget publicerat denna månad (räknas direkt ur Jobb, ingen kolumn – så ett borttaget jobb försvinner automatiskt ur räkningen)
- Planvals-popupen visas högst EN gång per månad. Väljer företaget "Fortsätt utan abonnemang" stämplas planval_manad ('YYYY-MM') och de slipper frågan resten av månaden. Stämpeln är självläkande: avser den en tidigare månad räknas valet som ogjort, så popupen kommer tillbaka vid månadsskifte utan cron
- Ett jobb = ett pass och räknas EN gång. Godkännandevägen är inte idempotent (företaget kan godkänna, återkalla, byta person), så räkningen villkoras på om jobbet redan hade en godkänd ansökan – se hämtaGodkändaFörJobb i routes/ansokningar.js
- Prenumeration: Pro 299 kr/mån via Stripe Checkout (extern webbläsare) + Stripes kundportal. Webhook på /webhooks/stripe måste monteras med express.raw FÖRE express.json, annars går signaturverifieringen inte att göra
- Pass-räknaren (pass_denna_manad + månadsstämpeln pass_manad) nollställs av cron den 1:a, men databasfunktionerna oka_/minska_pass_denna_manad nollställer också lazily vid månadsskifte – så en omstartad Railway-process kan inte råka fakturera 40% i en ny månad
- Privatpersoner blockeras från att ansöka tills avtal är godkänt (avtal_godkant = true)
- E-postverifiering via Resend (noreply@fastgig.se) krävs vid registrering
- Backend körs på Railway via api.fastgig.se
- Realtidsuppdateringar via Supabase Broadcast (meddelanden, tidrapporter, ansökningar, betyg, jobbförfrågningar, scheman)
- PostgREST skickar .in()-listor i URL:en och har en längdgräns. Ett schema ger en ansökan per pass, så listorna växer snabbt – använd hämtaIBitar i db/ansokningar.js i stället för att skicka rå .in() med tusentals id
- Supabase-tabeller: användare, Jobb, ansokningar, meddelanden, betyg, tidrapporter, faktureringsunderlag, jobbforfragan, scheman, schema_pass, schema_avdrag
- Jobb försvinner från listan när någon blivit godkänd eller datumet passerat
- Bestridandeflöde: privatperson bestrider → förklaring sparas → företag skickar korrigerad tidrapport
- Schemafunktion: företag skapar schema i ett FYRSTEGSFLÖDE (PubliceraSchemaScreen med StegIndikator): 1 grunduppgifter, 2 period + kalender där man klickar i passdatum med veckodagsgenvägar (Mån–Sön, Vardagar, Helger), 3 detaljer per pass – ett pass i taget, tryck på raden fäller ut en editor i den, ingen massredigering och inga markeringar (medvetet borttaget: två urval i samma vy var det som gjorde steget rörigt), 4 löneavdrag + publicering. SchemaPassModal finns kvar för finjustering av ett enskilt pass. Perioden i steg 2 är BARA ett UI-filter för kalendern – den skickas aldrig till servern, som härleder startdatum/slutdatum ur min/max av passens datum (härledPeriod). EN person söker och godkänns för hela schemat. Guiden har en beforeRemove-vakt som gör Android-bakåt/svep till "ett steg bakåt" i stället för att lämna skärmen – den fångar ALLA bort-navigeringar, så varje avsiktlig utgång måste sätta harPublicerat-refen först (annars backar man bara till steg 3). Efter publicering: navigate till MinaJobbTab med flik 'scheman' + popToTop, eftersom ett flikbyte inte avmonterar guiden och det publicerade schemat annars ligger kvar ifyllt
- Passlogiken i det stegvisa flödet bor i frontend/src/utils/schemaPass.js, utanför skärmen så att den går att testa utan React Native. Fyra regler är lätta att få subtilt fel: (a) synkaPassMotDatum SLÅR IHOP valda datum med befintliga pass så att ifyllda tider överlever att man går tillbaka till steg 2 – bygg aldrig om listan från grunden; (b) varje pass får ett lokalt id och det öppna passet pekas ut med id, inte index, eftersom listan sorteras om när tider fylls i; (c) tillPayload strippar det lokala id:t innan det skickas till servern; (d) nyttPassId() räknar upp en modulnivåräknare, så synkaPassMotDatum får ALDRIG anropas bara för att räkna – vill man veta antalet pass finns antalPassEfterSynk, som är bieffektsfri. Antalet valda DATUM är för övrigt inte antalet PASS: en dag kan ha flera pass
- hittaKrockar fångar två pass med samma datum + starttid när en dag har två roller – backend avvisar det med 400, men utan kontrollen syns felet först vid publicering. harNolltid blockerar identiska tider; blockera ALDRIG "sluttid före starttid", pass över midnatt (22:00–06:00) är giltiga och hanteras av slutEpochFörPass
- MånadsKalender har två lägen: läsvy (valtDatum = en dag, rollprickar) och flerval (valdaDatum = Set, minDatum/maxDatum släcker datum utanför perioden). Flervalet är additivt – rör inte valtDatum-vägen eller prickfärgslogiken, SchemaKalenderScreens förklaringsrad är beroende av dem Automatisk tidrapport skapas när varje pass sluttid passerar. Privatperson godkänner eller bestrider som vanligt i chatten. Kalendervy nås via företagets profil (Schemaöversikt), visar vem som jobbar vilka dagar och grupperar dagens pass per roll
- KATEGORI OCH OB PER PASS: schema_pass.kategori (fri text, företagets egna avdelningar som "Liftvärd" – INTE ur KATEGORIER-listan) och schema_pass.ob_tillagg. Båda är NULL-bara UTAN default, och den skillnaden är bärande: NULL = ärv schemats värde, `[]` = passet har medvetet inget OB. Med `default '[]'` hade alla publicerade scheman tyst tappat sitt OB. Arvet sker på EXAKT ett ställe – passMedArv i db/scheman.js – som anropas av schemaTilldelning, cron/schemaTidrapport, GET /scheman/:id, hämtaKalenderPass och hämtaSchemaPassFörAnvändare. Lägg aldrig till egna if-satser för bakåtkompatibiliteten
- Ett schema har INGEN huvudkategori längre – rollen sätts per pass. `scheman.kategori` finns kvar i databasen (nullbar) för scheman skapade när fältet var obligatoriskt; deras pass utan egen roll ärver den via passMedArv. Tas kravet bort någon gång även i PUT måste `kategori?.trim()` behållas i routes/scheman.js – utan optional chaining kastar raden TypeError och ger 500. Huvudkategorin nådde ALDRIG jobbfiltret: hämtaAllaJobb/hämtaJobbFörFöretag/hämtaTidigareJobbFörFöretag filtrerar bort schemajobb med `.is('schema_id', null)`, och schemalistans filter i JobbScreen går bara på stad
- Rollen visas via `rollFärg` i frontend/src/utils/konstanter.js, som ger varje rollnamn en deterministisk färg ur en palett på åtta. Samma färg används i kalenderns prickar, i förklaringsraden ovanför kalendern, i dagslistans rubriker och i RollBrickor – ändras hashen tappar de vyerna sin koppling. Hashen är FNV-1a med avalanche-steg av ett skäl: en enkel `hash * 31`-summa fördelar sig uselt mot åtta färger eftersom 31 ≡ −1 (mod 8). Färgen är aldrig enda signalen – rollnamnet står alltid i klartext
- API:t levererar `kategorier` (schemats roller, VANLIGAST FÖRST via räknaKategorier i db/scheman.js) på GET /api/scheman, /mina och /:id. RollBrickor visar de tre första och faller tillbaka på en neutral "Schema"-bricka när schemat saknar roller
- LÖNEAVDRAG (schema_avdrag: namn, belopp, typ per_dag|totalt, aktiv) påverkar ALDRIG faktureringsbeloppet – företaget faktureras på bruttot precis som förut, och avdraget reglerar bara vad personen får ut. `totalt_belopp` på tidrapporten förblir brutto; nettot är `totalt_belopp - avdrag_belopp`. Avdragen FRYSES på tidrapporten (kolumnerna avdrag jsonb + avdrag_belopp) eftersom fakturaunderlaget produceras uteslutande ur tidrapporter – annars kunde en redigering i september ändra en faktura från juli. typ='totalt' fördelas jämnt (belopp / antal pass) och kvoten avrundas ALDRIG till hela ören – med avrundning blir summan över passen inte det företaget skrev in (5000/14 → 357,14 × 14 = 4999,96). avdrag_belopp är numeric utan precision, så databasen avrundar inte heller. Totalen i UI får aldrig räknas fram genom att multiplicera tillbaka avdraget per pass; använd beräknaAvdragTotalt i konstanter.js, som utgår från de inskrivna beloppen. Beloppslogiken bor i beräknaBelopp/beräknaAvdragFörPass i utils/pris.js, speglade i konstanter.js
- Avdrag allokeras bara EN gång per pass: en korrigerad rapport efter bestridande är en ny rad för samma ansökan, så POST /api/tidrapporter KOPIERAR avdrag från föregående rapport i stället för att räkna om. PATCH /korrigera rör inte avdragen alls. beräknaBelopp klampar avdraget mot bruttot så att ett stort avdrag på ett kort pass aldrig ger negativ utbetalning
- Avdrag måste synas för den sökande INNAN hen ansöker (SchemaDetaljScreen, ovanför ansökningsknappen) och läggs ett avdrag till på ett redan tillsatt schema skickas push. Ett löneavdrag som dyker upp först på tidrapporten är fel ordning
- OB-tillägg som kommer från klienten MÅSTE gå genom valideraObTillagg i utils/pris.js. beräknaObBelopp gör ob.start.split(':') och kastar på trasig data; cron/schemaTidrapport fångar felet och sätter tillbaka passet till 'planerad', vilket ger en evig omförsöksloop var femte minut
- SCHEMATS BÄRANDE IDÉ: ett schema materialiseras som vanliga Jobb-rader. Annons-jobbet (schema_id satt, schema_pass_id NULL) skapas vid publicering och bär ansökningar, chatt, påslagsfrysning och räkningen mot gratisgränsen. Pass-jobben (båda kolumnerna satta) skapas ETT PER PASS när en person godkänns, vart och ett med en direkt godkänd ansökan – samma mönster som routes/jobbforfragan.js. Därför fungerar chatt, tidrapporter, bestridande, korrigering, betyg och fakturering utan någon ny kodväg, och godkännandet går genom oförändrad kod i routes/ansokningar.js. Se db/schemaTilldelning.js
- Schemaansökningar är vanliga rader i ansokningar mot annons-jobbet – ingen egen tabell. Det ger chatt redan innan personen godkänts. Räknaren för nya ansökningar återanvänder därför Jobb.ansokningar_sedda_at på annons-jobbet (ingen egen kolumn på scheman) och markeraAnsökningarSedda i db/jobb.js, som är scopead på Foretag_id som annons-jobbet har. berikaMedNyaAnsökningar i db/scheman.js speglar räkneregeln i filtreraAktivaJobb – ändra alltid båda. Tillsatta scheman räknas ALDRIG: ett vanligt jobb lämnar listan när någon godkänts, men schemat ligger kvar, så villkoret anvandare_id == null är det som hindrar badgen från att tjata om bemannade scheman
- Schema-genererade Jobb får ALDRIG läcka in bland enstaka pass. Filtren ligger i queryn (inte i JS) på sex ställen i db/jobb.js + db/ansokningar.js: hämtaAllaJobb, hämtaJobbFörFöretag (täcker även företagets publika profil), hämtaTidigareJobbFörFöretag, uppdateraJobb/taBortJobb, hämtaPågåendePassFörPåminnelse — alla `.is('schema_id', null)`. räknaJobbDennaMånad filtrerar i stället på `.is('schema_pass_id', null)`, så annons-jobbet räknas som ett publicerat pass men passjobben inte. Filtret är en korrekthetsfråga: i glappet när någon hoppat av saknar framtida passjobb godkänd ansökan och skulle annars bli publikt sökbara annonser
- Auto-tidrapport (cron/schemaTidrapport.js, var 5:e min) och påminnelse dagen före (cron/schemaPaminnelse.js, var 15:e min) är idempotenta via DATABASEN, inte via ett tidsfönster i minnet: krävPassFörRapport flyttar schema_pass planerad→rapporterad och krävPåminnelse stämplar paminnelse_skickad_at, båda i villkorade updates. Bara den körning som vinner agerar, så varken omstart eller samtidiga körningar kan dubblera
- Schemapass rapporteras med SCHEMALAGDA timmar (brutto, ingen rast). Vid övertid eller rast rättar företaget rapporten på plats via PATCH /api/tidrapporter/:id/korrigera, så länge den är auto_skapad och fortfarande 'väntar'. Efter ett bestridande gäller vanliga flödet (ny rapport via POST)
- Hoppar personen av ett schema AVVISAS ansökningarna – de raderas aldrig. Chattmeddelanden hänger på meddelanden.ansokan_id, så radering skulle slita bort historiken. Jobb-raden behålls också och återanvänds av nästa person med sitt redan frysta påslag. Genomförda pass rörs aldrig, och påslag/räknare nollas bara om INGET pass hunnit genomföras
- Tider tolkas alltid som svensk lokaltid via backend/utils/tid.js (delad av alla tre cron-jobben). Använd hourCycle 'h23' i Intl – med hour12:false svarar vissa ICU-versioner timme "24" och ger ett dygns fel i offseten
- Prenumerationssystem: gratis (2 pass/mån med lågt påslag, sedan högre påslag), Pro 299 kr/mån (alltid lågt påslag). Stripe hanterar betalning och prenumerationshantering.

## Tech stack
- Backend: Node.js med Express, REST API
- Databas: PostgreSQL via Supabase
- Frontend: React Native med Expo (mobilapp)
- Auth: JWT-tokens (eget system med bcrypt)
- Hosting: Railway (backend via api.fastgig.se), Supabase (databas)
- Mejl: Resend (noreply@fastgig.se)
- Realtid: Supabase Broadcast
- Betalning: Stripe (prenumerationer)

## Kodstil
- Använd async/await, inte callbacks
- Kommentera på svenska
- Varje fil ska ha tydliga funktionsnamn
- Felhantering på alla API-endpoints

## Mappstruktur backend
/routes     → API-endpoints
/middleware → Auth-kontroll
/db         → Databasanrop
/db/migrations → SQL-migrationer (körs manuellt i Supabase SQL-editorn, ingen runner)
/cron       → setInterval-baserade jobb, startas i server.js
/utils      → pris.js (påslag + beräknaObBelopp), tid.js (svensk tidszon), manad.js

## Mappstruktur frontend
/src/screens    → Alla skärmar
/src/api        → klient.js – alla API-anrop
/src/context    → AuthContext, NotifikationsContext, RealtidsContext, AttAvslutaContext
/src/navigation → Navigationsstruktur
/src/utils      → datumHelper.js, konstanter.js, jobbValidering.js, schemaValidering.js
/src/components → Återanvändbara komponenter (HandlingsKnapp, FältFel, ProBesparing m.fl.)