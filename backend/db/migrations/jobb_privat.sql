-- Privata jobb (enstaka pass).
--
-- Ett privat jobb syns INTE i den öppna jobblistan (hämtaAllaJobb filtrerar bort
-- privat = true), på exakt samma sätt som privata scheman. I övrigt fungerar det
-- precis som ett publikt jobb: direkt-via-id, ansökan, godkännande och tidrapporter
-- bryr sig inte om publik/privat. Sätts till true när företaget genererar en
-- inbjudningslänk till jobbet, och tillbaka till false via "Gör publikt".
--
-- Kör i Supabase SQL-editorn.

alter table "Jobb" add column if not exists privat boolean not null default false;
