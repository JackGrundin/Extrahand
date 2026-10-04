-- Dokument som privatpersoner laddar upp på sin profil (CV, körkort, intyg).
-- Varje rad är ETT dokument med användarens eget namn ("B-körkort", "Truckkort A").
-- Själva filen ligger i Supabase Storage-bucketen "dokument"; raden bär namn +
-- metadata och den path som behövs för att kunna ta bort filen igen.
--
-- Kör i Supabase SQL-editorn.
-- OBS: "användare".id är heltal (bigint), därför är anvandare_id bigint.
--
-- MANUELLT STEG utöver den här migrationen: skapa en PUBLIK Storage-bucket
-- "dokument" (som "profilbilder"). Filsökvägen innehåller ett slumpat UUID så att
-- den publika URL:en inte går att gissa eller räkna upp.

create table if not exists dokument (
  id uuid primary key default gen_random_uuid(),
  anvandare_id bigint not null references "användare"(id) on delete cascade,
  namn text not null,              -- användarens eget namn, t.ex. "B-körkort"
  lagring_path text not null,      -- sökväg i bucketen, krävs för radering
  url text not null,               -- publik URL som visas och öppnas
  mime_type text not null,         -- application/pdf | image/jpeg | image/png
  storlek int not null,            -- filstorlek i byte
  skapad_datum timestamptz not null default now()
);

-- Profilen listar en användares dokument i uppladdningsordning.
create index if not exists dokument_anvandare_idx on dokument (anvandare_id, skapad_datum);
