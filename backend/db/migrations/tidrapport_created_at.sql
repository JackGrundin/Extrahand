-- Ger tidrapporter en riktig skapad-tidsstämpel så att de kan sorteras kronologiskt
-- i chatten. Tidigare fanns bara ett datum (utan klockslag), vilket gjorde att en
-- skickad tidrapport hamnade ovanför tidigare meddelanden i tidslinjen.
-- Kör i Supabase SQL-editorn.

-- Lägg till kolumnen om den saknas (utan default först, så vi kan backfilla korrekt).
alter table tidrapporter add column if not exists created_at timestamptz;

-- Backfilla befintliga rader från datumet så att historiska rapporter behåller
-- sin ungefärliga plats i tidslinjen i stället för att klumpas ihop på "nu".
update tidrapporter set created_at = datum::timestamptz where created_at is null;

-- Nya rader får skapad-tidpunkten automatiskt.
alter table tidrapporter alter column created_at set default now();
