-- Schemafunktion för längre uppdrag (sommarjobb/säsongsarbete). Ett schema är en annons
-- med en period och en lista specifika pass. EN person söker HELA schemat och godkänns
-- för samtliga pass.
--
-- Bärande idé: schemat materialiseras som vanliga Jobb-rader.
--   * Annons-jobbet (schema_id satt, schema_pass_id NULL) skapas när schemat publiceras.
--     Det bär ansökningarna och därmed chatten, påslagsfrysningen och räkningen mot
--     gratisgränsen – ett schema = ett publicerat pass.
--   * Pass-jobben (båda satta) skapas när en person godkänns, ett per pass, var och ett
--     med en direkt godkänd ansökan. Exakt mönstret i routes/jobbforfragan.js.
-- Därmed fungerar chatt, tidrapporter, bestridande, korrigering, betyg och fakturering
-- oförändrat, utan en enda ny UI-yta för dem.
--
-- Kör i Supabase SQL-editorn.
-- OBS: "användare".id är heltal (bigint), därför är foretag_id/anvandare_id bigint.

create table if not exists scheman (
  id uuid primary key default gen_random_uuid(),
  foretag_id bigint not null references "användare"(id) on delete cascade,
  titel text not null,
  beskrivning text,
  plats text,                                  -- stad, för filtrering i schemalistan
  adress text not null,
  kategori text,
  typ text not null default 'sommarjobb',
  startdatum date not null,
  slutdatum date not null,
  timlon numeric not null,
  ob_tillagg jsonb not null default '[]'::jsonb,
  -- Personen som godkänts för HELA schemat. NULL = schemat är fortfarande sökbart.
  anvandare_id bigint references "användare"(id) on delete set null,
  -- Påslaget fryses när företaget godkänner en person, precis som Jobb.paslag. Hela
  -- schemat är ETT pass mot gratisgränsen: räknaren ökas en enda gång, och det frysta
  -- påslaget kopieras till varje genererat Jobb och vidare till varje tidrapport.
  paslag numeric,
  status text not null default 'publicerat',   -- publicerat | tillsatt | avbrutet
  annons_jobb_id uuid,                         -- typ justeras i do-blocket nedan
  skapad_datum timestamptz not null default now()
);

create table if not exists schema_pass (
  id uuid primary key default gen_random_uuid(),
  schema_id uuid not null references scheman(id) on delete cascade,
  datum date not null,
  starttid text not null,
  sluttid text not null,
  anvandare_id bigint references "användare"(id) on delete set null,
  -- planerad | rapporterad | installt.
  -- Statusen är samtidigt cron-jobbets biljett: auto-tidrapporten skapas bara av den
  -- körning som lyckas flytta passet planerad -> rapporterad. Varken två överlappande
  -- körningar eller en omstart mitt i kan därmed ge två tidrapporter för samma pass.
  status text not null default 'planerad',
  -- Stämpel för påminnelsen dagen före. Persistent i databasen i stället för det
  -- in-memory-fönster cron/passPaminnelse.js använder, som tappas vid varje deploy.
  paminnelse_skickad_at timestamptz,
  skapad_datum timestamptz not null default now()
);

-- Kopplar ihop schemat med de materialiserade raderna.
alter table "Jobb" add column if not exists schema_id uuid references scheman(id);

-- Jobb, ansokningar och tidrapporter skapades utanför migrationerna, så deras id-typer
-- läses ur katalogen i stället för att gissas. Kolumnerna nedan måste ha exakt samma typ
-- som id-kolumnen i respektive tabell för att främmande nycklar ska kunna skapas.
do $$
declare t_jobb text; t_ansokan text; t_rapport text;
begin
  select format_type(atttypid, atttypmod) into t_jobb
    from pg_attribute where attrelid = '"Jobb"'::regclass and attname = 'id';
  select format_type(atttypid, atttypmod) into t_ansokan
    from pg_attribute where attrelid = 'ansokningar'::regclass and attname = 'id';
  select format_type(atttypid, atttypmod) into t_rapport
    from pg_attribute where attrelid = 'tidrapporter'::regclass and attname = 'id';

  raise notice 'id-typer: Jobb=%, ansokningar=%, tidrapporter=%', t_jobb, t_ansokan, t_rapport;

  execute format('alter table "Jobb" add column if not exists schema_pass_id %s', 'uuid');
  execute format('alter table schema_pass add column if not exists jobb_id %s references "Jobb"(id) on delete set null', t_jobb);
  execute format('alter table schema_pass add column if not exists ansokan_id %s references ansokningar(id) on delete set null', t_ansokan);
  execute format('alter table schema_pass add column if not exists tidrapport_id %s references tidrapporter(id) on delete set null', t_rapport);

  -- annons_jobb_id skapades som uuid ovan; rätta typen om Jobb.id är något annat.
  if t_jobb <> 'uuid' then
    execute format('alter table scheman alter column annons_jobb_id type %s using annons_jobb_id::text::%s', t_jobb, t_jobb);
  end if;
  execute format('alter table scheman add constraint scheman_annons_jobb_fk foreign key (annons_jobb_id) references "Jobb"(id) on delete set null');
exception when duplicate_object then
  null;  -- främmande nyckeln finns redan sedan en tidigare körning
end $$;

-- Auto-genererade tidrapporter får korrigeras på plats av företaget så länge de väntar på
-- svar (övertid eller rast), i stället för att lägga ett andra kort i chatten.
alter table tidrapporter add column if not exists auto_skapad boolean not null default false;

create index if not exists scheman_foretag_idx on scheman (foretag_id, skapad_datum);
create index if not exists scheman_status_idx on scheman (status);
create index if not exists schema_pass_schema_idx on schema_pass (schema_id, datum);
create index if not exists schema_pass_anvandare_idx on schema_pass (anvandare_id, datum);

-- Cron-jobbets hetaste fråga. Partiellt index så att redan rapporterade pass aldrig läses.
create index if not exists schema_pass_planerade_idx on schema_pass (datum) where status = 'planerad';

-- Jobblistan, Mina annonser, företagets publika profil, publiceringsräknaren och
-- "avsluta passet"-påminnelsen filtrerar alla på schema_id. Partiella index gör att
-- filtret blir gratis i stället för en kolumnjämförelse per rad.
create index if not exists jobb_schema_idx on "Jobb" (schema_id);
create index if not exists jobb_foretag_utan_schema_idx on "Jobb" ("Foretag_id", created_at)
  where schema_id is null;

-- Inget backfill behövs: befintliga Jobb får schema_id = NULL, vilket är precis vad
-- filtren i db/jobb.js letar efter.
