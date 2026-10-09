-- Rast per schemapass (minuter). Rasten dras automatiskt av från passets timmar när
-- cron skapar tidrapporten: schemalagda timmar − rast = utbetalda/fakturerade timmar.
--
-- Till skillnad från kategori och ob_tillagg ÄRVER rasten inget från schemat – den är
-- strikt per pass. Därför är `default 0` säkert här: 0 = ingen rast, vilket är korrekt
-- för både nya och befintliga pass. (För arvs-fälten hade en default tyst dödat arvet.)
--
-- Kör i Supabase SQL-editorn.

alter table schema_pass add column if not exists rast_minuter integer not null default 0;

-- Rasten FRYSES på tidrapporten när cron skapar den, precis som avdrag_belopp. Fakturaunderlaget
-- produceras uteslutande ur tidrapporter, så en senare redigering av passet får aldrig ändra en
-- redan skapad rapport eller faktura.
alter table tidrapporter add column if not exists rast_minuter integer not null default 0;
