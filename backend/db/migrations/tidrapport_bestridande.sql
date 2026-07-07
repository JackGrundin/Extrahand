-- Stödjer bestridande av tidrapporter med förklaring, samt flera tidrapporter per
-- ansökan så att företaget kan skicka en ny korrigerad tidrapport efter ett bestridande.
-- Kör i Supabase SQL-editorn.

-- Lagrar privatpersonens förklaring till varför tidrapporten bestreds (visas även
-- som ett meddelande i chatten, men sparas här för historiken på själva rapporten).
alter table tidrapporter add column if not exists bestridande_orsak text;

-- Tidigare tilläts bara en tidrapport per ansökan (app-lagret gav 409). Nu ska
-- företaget kunna skicka en korrigerad tidrapport efter ett bestridande, så en
-- eventuell unik begränsning på ansokan_id måste tas bort. Namnet nedan är det
-- standardnamn Postgres ger en unik nyckel – justera om din begränsning heter annat.
alter table tidrapporter drop constraint if exists tidrapporter_ansokan_id_key;
drop index if exists tidrapporter_ansokan_id_key;

-- Snabbare hämtning av senaste tidrapport per ansökan (sorteras på created_at).
create index if not exists tidrapporter_ansokan_created_idx on tidrapporter (ansokan_id, created_at);
