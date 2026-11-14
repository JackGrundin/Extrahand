-- Föreslagna korrigerade tider vid bestridande av en tidrapport.
-- Privatpersonen kan vid bestridande föreslå en korrigerad start- och sluttid
-- utöver fritext-förklaringen (bestridande_orsak). Nullbara: ett bestridande utan
-- tidsförslag (t.ex. "jag jobbade inte alls") lämnar dem NULL. Format 'HH:MM',
-- samma som OB-tilläggens start/slut.
-- Körs manuellt i Supabase SQL-editorn (ingen runner).
ALTER TABLE tidrapporter ADD COLUMN IF NOT EXISTS bestridande_starttid text;
ALTER TABLE tidrapporter ADD COLUMN IF NOT EXISTS bestridande_sluttid text;
