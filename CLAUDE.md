# Extrahand – App för flexibla jobb och uppdrag

## Vad appen gör
Plattform som kopplar samman företag och privatpersoner för kortare jobbpass 
och längre uppdrag. Företag publicerar jobb, privatpersoner ansöker. 
Inkluderar chatt, betygsättning och privatuppdrag (barnvakt, trädgård m.m.)

## Tech stack
- Backend: Node.js med Express, REST API
- Databas: PostgreSQL via Supabase
- Frontend: React Native med Expo (mobilapp)
- Auth: JWT-tokens + Supabase Auth

## Kodstil
- Använd async/await, inte callbacks
- Kommentera på svenska
- Varje fil ska ha tydliga funktionsnamn
- Felhantering på alla API-endpoints

## Mappstruktur backend
/routes     → API-endpoints
/middleware → Auth-kontroll
/db         → Databasanrop