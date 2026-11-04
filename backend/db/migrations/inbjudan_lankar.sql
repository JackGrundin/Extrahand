-- Inbjudningslänkar för jobb OCH scheman – utökar den befintliga tabellen
-- schema_inbjudningar i stället för att skapa ett parallellt system.
--
-- Tidigare bar tabellen bara e-postinbjudningar till privata SCHEMAN. Nu bär den även:
--   * jobb-inbjudningar (jobb_id satt i stället för schema_id)
--   * länk-inbjudningar utan e-post (företaget delar själv länken; email = null)
--   * rabattmarkering: en person som registrerar sig VIA länken får rabatterat påslag
--     (15% för enstaka pass, 7% för scheman). rabatt_godkand stämplas vid inlösen
--     (koppla) när kontot skapades via länken, så påslagsfrysningen bara läser flaggan.
--
-- accepterad_at återanvänds som "inlöst"-stämpel. Namnet schema_inbjudningar behålls
-- med flit – att döpa om en produktionstabell är onödig risk.
--
-- Kör i Supabase SQL-editorn EFTER schema_privat.sql.

alter table schema_inbjudningar
  add column if not exists jobb_id uuid references "Jobb"(id) on delete cascade,
  add column if not exists foretag_id bigint references "användare"(id) on delete set null,
  add column if not exists rabatt_godkand boolean not null default false;

-- email och schema_id blir valfria: en länk-inbjudan har varken e-post, och en
-- jobb-inbjudan har jobb_id i stället för schema_id. Exakt en av jobb_id/schema_id
-- ska vara satt.
alter table schema_inbjudningar alter column email drop not null;
alter table schema_inbjudningar alter column schema_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inbjudan_jobb_xor_schema'
  ) then
    alter table schema_inbjudningar
      add constraint inbjudan_jobb_xor_schema
      check ((jobb_id is null) <> (schema_id is null));
  end if;
end $$;

create index if not exists schema_inbjudningar_jobb_id_idx on schema_inbjudningar (jobb_id);
