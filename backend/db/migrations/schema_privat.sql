-- Privata scheman + e-postinbjudningar.
--
-- Ett privat schema syns INTE i den öppna schemalistan (hämtaÖppnaScheman filtrerar bort
-- privat = true). I övrigt fungerar det exakt som ett publikt schema: direkt-via-id,
-- ansökan, godkännande och tidrapporter bryr sig inte om publik/privat.
--
-- Företaget bjuder in personer via e-post. Varje inbjudan får en unik token; endast
-- SHA-256-hashen lagras (precis som lösenordsåterställningen), klartext-token ligger bara
-- i mejllänken. Matchar e-posten ett konto kopplas anvandare_id och en push skickas.
-- Inbjudna privata scheman unionas in i hämtaÖppnaScheman för den matchande e-posten, så
-- att de dyker upp i personens schemalista (app + webb) utan att vara publika.
--
-- Kör i Supabase SQL-editorn.

alter table scheman add column if not exists privat boolean not null default false;

create table if not exists schema_inbjudningar (
  id uuid primary key default gen_random_uuid(),
  schema_id uuid not null references scheman(id) on delete cascade,
  -- Lagras i gemener (lowercased) så matchningen mot användarens e-post är konsekvent.
  email text not null,
  -- Endast hashen lagras; klartext-token finns bara i mejllänken. SHA-256, som
  -- aterstallning_token_hash.
  token_hash text not null,
  -- Sätts om e-posten matchar ett konto (vid inbjudan eller när token löses in). NULL =
  -- personen hade inget konto ännu.
  anvandare_id bigint references "användare"(id) on delete set null,
  skapad_datum timestamptz not null default now(),
  -- Stämplas när länken/token lösts in av en inloggad användare.
  accepterad_at timestamptz
);

create index if not exists schema_inbjudningar_token_hash_idx on schema_inbjudningar (token_hash);
create index if not exists schema_inbjudningar_email_idx on schema_inbjudningar (lower(email));
create index if not exists schema_inbjudningar_schema_id_idx on schema_inbjudningar (schema_id);
