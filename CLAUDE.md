# FastGig – App för flexibla jobb och uppdrag

## Vad appen gör
Plattform som kopplar samman företag och privatpersoner för kortare jobbpass och längre uppdrag. Företag publicerar jobb med datum, tider, adress, timlön och OB-tillägg. Privatpersoner ansöker, chattar med företag och får betyg efter avslutat pass.

## Viktiga detaljer
- Admin-vy tillgänglig för info@fastgig.se med flikar: Tidrapporter, Avtal, Företag, Fakturering
- Faktureringspris beräknas: timlön + timlön*0.32 + timlön*0.06 + ((timlön*1.32) + (timlön*1.32*0.06)) * påslag
- OB-fakturering: samma formel med ob_belopp i stället för timlön
- Påslaget är 0.20 (Pro-kunder + gratiskontonas två första pass per månad) eller 0.40 (från 3:e passet). Formeln bor i backend/utils/pris.js och speglas i frontend/src/utils/konstanter.js – ändra alltid på båda ställena
- Påslaget FRYSES på jobbet när det publiceras (Jobb.paslag) och kopieras till tidrapporten. Faktureringen sker långt senare, då planen kan ha ändrats, så det går inte att härleda i efterhand. Jobb från före prenumerationssystemet saknar påslag och faktureras med 40%
- Prenumeration: Pro 299 kr/mån via Stripe Checkout (extern webbläsare) + Stripes kundportal. Webhook på /webhooks/stripe måste monteras med express.raw FÖRE express.json, annars går signaturverifieringen inte att göra
- Pass-räknaren (pass_denna_manad + månadsstämpeln pass_manad) nollställs av cron den 1:a, men databasfunktionen oka_pass_denna_manad nollställer också lazily vid månadsskifte – så en omstartad Railway-process kan inte råka fakturera 40% i en ny månad
- Privatpersoner blockeras från att ansöka tills avtal är godkänt (avtal_godkant = true)
- E-postverifiering via Resend (noreply@fastgig.se) krävs vid registrering
- Backend körs på Railway via api.fastgig.se
- Realtidsuppdateringar via Supabase Broadcast (meddelanden, tidrapporter, ansökningar, betyg, jobbförfrågningar)
- Supabase-tabeller: användare, Jobb, ansokningar, meddelanden, betyg, tidrapporter, faktureringsunderlag, jobbforfragan
- Jobb försvinner från listan när någon blivit godkänd eller datumet passerat
- Bestridandeflöde: privatperson bestrider → förklaring sparas → företag skickar korrigerad tidrapport

## Tech stack
- Backend: Node.js med Express, REST API
- Databas: PostgreSQL via Supabase
- Frontend: React Native med Expo (mobilapp)
- Auth: JWT-tokens (eget system med bcrypt)
- Hosting: Railway (backend via api.fastgig.se), Supabase (databas)
- Mejl: Resend (noreply@fastgig.se)
- Realtid: Supabase Broadcast

## Kodstil
- Använd async/await, inte callbacks
- Kommentera på svenska
- Varje fil ska ha tydliga funktionsnamn
- Felhantering på alla API-endpoints

## Mappstruktur backend
/routes     → API-endpoints
/middleware → Auth-kontroll
/db         → Databasanrop
/db/migrations → SQL-migrationer

## Mappstruktur frontend
/src/screens    → Alla skärmar
/src/api        → klient.js – alla API-anrop
/src/context    → AuthContext, NotifikationsContext, RealtidsContext
/src/navigation → Navigationsstruktur
/src/utils      → datumHelper.js, konstanter.js
/src/components → Återanvändbara komponenter