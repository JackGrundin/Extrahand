-- Två frivilliga datum på ett schema:
--   * sista_ansokningsdag – när datumet passerat går det inte längre att ansöka. Spärren
--     sitter i POST /api/ansokningar (sista försvaret) och läser schemat via annons-jobbet.
--   * senast_besked – rent informativt: när företaget lovar att ge besked. Blockerar inget.
--
-- Båda är nullbara (NULL = inget datum satt, schemat beter sig som förut). Rena
-- schema-begrepp: de speglas INTE till annons-jobbet, till skillnad från Typ och
-- behorighets_krav, eftersom de bara är meningsfulla för ett schema.
--
-- Kör i Supabase SQL-editorn.

alter table scheman add column if not exists sista_ansokningsdag date;
alter table scheman add column if not exists senast_besked date;
