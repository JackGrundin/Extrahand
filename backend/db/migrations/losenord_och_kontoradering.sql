-- Glömt lösenord + radering av konto.
-- Kör i Supabase SQL-editorn.

-- ── Återställning av lösenord ────────────────────────────────────────────────
-- Endast SHA-256-hashen av återställningstoken lagras, aldrig token i klartext.
-- Token skickas i ett mejl och är därmed en nyckel som räcker för att ta över
-- kontot: läcker databasen ska den inte gå att använda. Samma resonemang som för
-- lösenordet självt, som redan lagras hashat.
alter table "användare" add column if not exists aterstallning_token_hash text;
alter table "användare" add column if not exists aterstallning_expires_at timestamptz;

-- Uppslagningen sker på hashen (användaren är okänd tills token slagits upp).
create index if not exists anvandare_aterstallning_token_idx
  on "användare" (aterstallning_token_hash);

-- ── Radering av konto (krav från App Store) ──────────────────────────────────
-- Kontot RADERAS ALDRIG som rad. Tidrapporter, fakturaunderlag och betyg pekar på
-- användarens id, och en borttagen rad hade slitit sönder både bokföringen och
-- chatthistoriken. I stället nollas all personuppgift på raden (namn, e-post,
-- telefon, CV, bilder, fakturauppgifter) och kontot markeras som inaktivt.
--
-- NULL = konto skapat innan den här kolumnen fanns, och ska behandlas som aktivt.
-- Därför testas alltid `aktiv === false` i koden, aldrig `!aktiv`.
alter table "användare" add column if not exists aktiv boolean default true;
alter table "användare" add column if not exists raderad_at timestamptz;

-- Befintliga konton är aktiva.
update "användare" set aktiv = true where aktiv is null;
