# FastGig – App för flexibla jobb och uppdrag

## Vad appen gör
Plattform som kopplar samman företag och privatpersoner för kortare jobbpass och längre uppdrag. Företag publicerar jobb med datum, tider, adress, timlön och OB-tillägg. Privatpersoner ansöker, chattar med företag och får betyg efter avslutat pass.

## Viktiga detaljer
- Admin-vy tillgänglig för info@fastgig.se med flikar: Tidrapporter, Avtal, Företag, Fakturering
- Faktureringspris beräknas: (timlön + timlön*0.32 + timlön*0.06) * 1.40
- OB-fakturering: (ob_belopp + ob_belopp*0.32 + ob_belopp*0.06) * 1.40
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