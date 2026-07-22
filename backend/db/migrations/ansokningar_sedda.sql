-- Spårar när ett företag senast öppnade ett jobbs ansökningslista, så att vi kan visa
-- hur många nya ansökningar som kommit in sedan dess (badge på Mina jobb + markering på
-- jobbkortet). Nya ansökningar = ansökningar med created_at efter denna tidsstämpel.
-- NULL = företaget har aldrig öppnat jobbets ansökningar → alla ansökningar räknas som nya.
-- Kör i Supabase SQL-editorn.

alter table "Jobb" add column if not exists ansokningar_sedda_at timestamptz;
