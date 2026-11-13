-- Markera ett enskilt schemapass som inställt (sjukdom/frånvaro) utan att ta bort det.
--
-- Till skillnad från "ta bort pass" (som sätter status='installt', nollar personen och
-- avvisar ansökan – avsett för att FLYTTA ett pass) är detta ett REVERSIBELT flöde:
-- passet behåller status='planerad' och sin tilldelade person, och markeras enbart via
-- dessa två kolumner. Företaget kan ångra (nolla kolumnerna igen).
--
-- Cron hoppar över pass där installt_at IS NOT NULL:
--   * schemaTidrapport skapar ingen tidrapport för en sjukdag
--   * schemaPaminnelse skickar ingen påminnelse om ett inställt pass
-- Eftersom status förblir 'planerad' räcker inte statusfiltret – därav installt_at.
--
-- Kör i Supabase SQL-editorn.

alter table schema_pass add column if not exists installt_at timestamptz;
alter table schema_pass add column if not exists installt_orsak text;
