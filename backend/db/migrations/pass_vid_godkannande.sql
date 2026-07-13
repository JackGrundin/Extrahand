-- Pass-räknaren speglar numera GENOMFÖRDA (godkända) pass i stället för publicerade.
-- Ett företag ska inte förbruka gratispass på jobb som aldrig blev tillsatta. Räknaren
-- ökar när en ansökan godkänns och minskar om godkännandet tas tillbaka. Påslaget
-- fryses på jobbet vid godkännandet och följer sedan med till tidrapporten.
-- Kör i Supabase SQL-editorn.

-- Speglar oka_pass_denna_manad. Klampar vid 0 så att räknaren aldrig kan bli negativ,
-- och rör bara raden om månadsstämpeln avser innevarande månad – har månaden bytt är
-- räknaren redan logiskt nollställd (lazy reset) och ska inte dras ned under noll.
create or replace function minska_pass_denna_manad(p_id bigint, p_manad text)
returns int language plpgsql as $$
declare ny int;
begin
  update "användare"
     set pass_denna_manad = greatest(coalesce(pass_denna_manad, 0) - 1, 0)
   where id = p_id
     and pass_manad = p_manad
   returning pass_denna_manad into ny;
  return ny;
end; $$;

-- Popupen vid publicering styrs av antalet jobb företaget publicerat denna månad.
-- Den siffran räknas direkt ur Jobb (ingen egen kolumn) – då försvinner ett borttaget
-- jobb automatiskt ur räkningen.
create index if not exists jobb_foretag_created_idx on "Jobb" ("Foretag_id", created_at);

-- ENGÅNGSNOLLSTÄLLNING. Räknaren har hittills innehållit antalet PUBLICERADE jobb.
-- Efter omläggningen räknas samma pass igen när de godkänns, vilket skulle dubbelräkna
-- allt som redan hunnit publiceras. Nollställ därför räknaren en gång; den byggs sedan
-- upp igen från godkännandena.
update "användare" set pass_denna_manad = 0 where pass_denna_manad > 0;

-- Av samma skäl: påslag som frystes vid PUBLICERING är inte längre giltiga. Nolla dem
-- på jobb som ännu inte tillsatts, så att påslaget sätts om vid godkännandet. Jobb som
-- redan har en godkänd ansökan behåller sitt påslag – det passet är avtalat.
update "Jobb" set paslag = null
 where paslag is not null
   and id not in (select jobb_id from ansokningar where status = 'godkänd');
