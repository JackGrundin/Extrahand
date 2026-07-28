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
- Supabase-tabeller: användare, Jobb, ansokningar, meddelanden, betyg, tidrapporter, faktureringsunderlag, jobbforfragan, scheman, schema_pass
- Jobb försvinner från listan när någon blivit godkänd eller datumet passerat
- Bestridandeflöde: privatperson bestrider → förklaring sparas → företag skickar korrigerad tidrapport
- Schemafunktion: företag skapar schema med titel, period och specifika pass (passgenerator utifrån veckodagar). EN person söker och godkänns för hela schemat. Automatisk tidrapport skapas när varje pass sluttid passerar. Privatperson godkänner eller bestrider som vanligt i chatten. Kalendervy nås via företagets profil (Schemaöversikt) och visar vem som jobbar vilka dagar
- SCHEMATS BÄRANDE IDÉ: ett schema materialiseras som vanliga Jobb-rader. Annons-jobbet (schema_id satt, schema_pass_id NULL) skapas vid publicering och bär ansökningar, chatt, påslagsfrysning och räkningen mot gratisgränsen. Pass-jobben (båda kolumnerna satta) skapas ETT PER PASS när en person godkänns, vart och ett med en direkt godkänd ansökan – samma mönster som routes/jobbforfragan.js. Därför fungerar chatt, tidrapporter, bestridande, korrigering, betyg och fakturering utan någon ny kodväg, och godkännandet går genom oförändrad kod i routes/ansokningar.js. Se db/schemaTilldelning.js
- Schemaansökningar är vanliga rader i ansokningar mot annons-jobbet – ingen egen tabell. Det ger chatt redan innan personen godkänts
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