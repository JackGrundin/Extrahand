-- Rast på enstaka pass (minuter). Rasten påverkar INTE tidrapportlogiken i backend –
-- den dras av på klientsidan i "Använd planerat"-förifyllningen (planerade timmar − rast).
-- Enstaka pass rapporteras manuellt (företaget skriver in timmarna), så ett backend-avdrag
-- skulle dubbelräknas. Scheman har egen rast per pass (schema_pass.rast_minuter).
-- default 0 = ingen rast, korrekt för både nya och befintliga jobb.
--
-- Kör i Supabase SQL-editorn.

alter table "Jobb" add column if not exists rast_minuter integer not null default 0;
