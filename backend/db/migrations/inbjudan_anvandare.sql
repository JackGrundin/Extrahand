-- Kopplar en inbjudan till en användare + index för Förfrågningar-fliken.
--
-- anvandare_id sätts när en inbjudan löses in/kopplas (stämplaInlöst i routes/inbjudan.js)
-- och är det som GET /api/inbjudan/mina filtrerar på för att visa en persons inkomna
-- förfrågningar. Kolumnen skapades redan i schema_privat.sql, så `add column if not exists`
-- är en no-op där – den här migrationen tillför i praktiken bara indexet. Idempotent och
-- säker att köra oavsett.
--
-- Kör i Supabase SQL-editorn.

alter table schema_inbjudningar
  add column if not exists anvandare_id bigint references "användare"(id) on delete set null;

create index if not exists schema_inbjudningar_anvandare_id_idx on schema_inbjudningar (anvandare_id);
