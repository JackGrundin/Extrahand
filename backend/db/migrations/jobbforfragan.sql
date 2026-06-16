-- Tabell för jobbförfrågningar som företag skickar till privatpersoner via chatten.
-- Kör i Supabase SQL-editorn.
-- OBS: användare.id är heltal (bigint), därför är fran/till bigint – inte uuid.

create table if not exists jobbforfragan (
  id uuid primary key default gen_random_uuid(),
  fran_anvandare_id bigint not null references "användare"(id) on delete cascade,
  till_anvandare_id bigint not null references "användare"(id) on delete cascade,
  datum date not null,
  starttid text not null,
  sluttid text not null,
  timlon numeric not null,
  ob_tillagg jsonb not null default '[]'::jsonb,
  status text not null default 'väntar',
  skapad_datum timestamptz not null default now()
);

-- Snabbare uppslag per konversation (företag <-> privatperson)
create index if not exists jobbforfragan_fran_idx on jobbforfragan (fran_anvandare_id);
create index if not exists jobbforfragan_till_idx on jobbforfragan (till_anvandare_id);
